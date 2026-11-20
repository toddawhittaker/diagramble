import { isIPv4, isIPv6 } from "node:net";

/** Counts of failed sign-ins, kept in this process (SPEC.md section 1, "Sign-in"). */

interface Window {
  startedAt: number;
  count: number;
}

export interface Counter {
  /** Count one event and return its window. */
  hit(key: string): Window;
  /** The window as it stands, without counting or storing anything. */
  peek(key: string): Window;
  /** Forget a key. */
  clear(key: string): void;
  /** Whole seconds until this window ends, at least one. */
  retryAfterSeconds(window: Window): number;
  /** How many keys are held now; old ones are dropped as time passes. */
  size(): number;
}

/** Fixed windows keyed by whatever the caller counts: an address, a username. */
export function createCounter(windowMs: number, now: () => number): Counter {
  const windows = new Map<string, Window>();
  let lastSweep = now();

  function live(key: string): Window | undefined {
    const at = now();
    // Drop old windows now and then, so a flood of keys cannot pile up.
    if (at - lastSweep >= windowMs) {
      for (const [k, w] of windows) if (at - w.startedAt >= windowMs) windows.delete(k);
      lastSweep = at;
    }
    const window = windows.get(key);
    if (window && at - window.startedAt >= windowMs) {
      windows.delete(key);
      return undefined;
    }
    return window;
  }

  return {
    hit(key) {
      let window = live(key);
      if (!window) {
        window = { startedAt: now(), count: 0 };
        windows.set(key, window);
      }
      window.count += 1;
      return window;
    },
    peek: (key) => live(key) ?? { startedAt: now(), count: 0 },
    clear: (key) => {
      windows.delete(key);
    },
    retryAfterSeconds(window) {
      return Math.max(1, Math.ceil((window.startedAt + windowMs - now()) / 1000));
    },
    size: () => windows.size,
  };
}

/**
 * The key a per-address count uses. One IPv6 /64 is one subscriber, who can use
 * any of its addresses, so it counts as one; an IPv4-mapped IPv6 address counts
 * as its IPv4 address.
 */
export function addressKey(ip: string): string {
  const mapped = ip.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped?.[1] && isIPv4(mapped[1])) return mapped[1];
  if (!isIPv6(ip)) return ip;
  const [head = "", tail = ""] = ip.toLowerCase().split("%")[0]?.split("::") ?? [];
  const headParts = head ? head.split(":") : [];
  const tailParts = tail ? tail.split(":") : [];
  const missing = 8 - headParts.length - tailParts.length;
  const groups = ip.includes("::")
    ? [...headParts, ...Array<string>(missing).fill("0"), ...tailParts]
    : headParts;
  const prefix = groups.slice(0, 4).map((g) => Number.parseInt(g, 16).toString(16));
  return `${prefix.join(":")}::/64`;
}

const WINDOW_MS = 15 * 60 * 1000;
const MAX_DELAY_MS = 5000;

/** Where a count starts to slow replies and where it refuses them: the failure number of each. */
interface Thresholds {
  slowFrom: number;
  refuseFrom: number;
}

const PER_USERNAME: Thresholds = { slowFrom: 4, refuseFrom: 10 };
const PER_ADDRESS: Thresholds = { slowFrom: 20, refuseFrom: 50 };

/** From the `slowFrom`th failure on, 1 s for each failure past the one before it, up to 5 s. */
function delayFor(count: number, { slowFrom }: Thresholds): number {
  if (count < slowFrom) return 0;
  return Math.min(MAX_DELAY_MS, (count - slowFrom + 1) * 1000);
}

export type SignInCheck = { refused: false; delayMs: number } | { refused: true; retryAfterSeconds: number };

export interface SignInLimiter {
  /** Whether a sign-in attempt may go on and how long to hold its reply. Counts nothing. */
  check(username: string, address: string): SignInCheck;
  recordFailure(username: string, address: string): void;
  /** A success clears the username's count; the address's count stays. */
  recordSuccess(username: string): void;
}

/**
 * Failed sign-ins over a fixed 15-minute window that starts at a key's first
 * failure. `recordFailure` counts; `check` only reads. For a username, the check
 * made after 3 failures gives no delay, the one after 4 gives 1 s, each further
 * failure adds 1 s up to 5 s, and the one after 10 refuses. An address is slowed
 * from its 20th failure and refused from its 50th.
 */
export function createSignInLimiter({ now }: { now: () => number }): SignInLimiter {
  const byUsername = createCounter(WINDOW_MS, now);
  const byAddress = createCounter(WINDOW_MS, now);

  return {
    check(username, address) {
      const user = byUsername.peek(username);
      const addr = byAddress.peek(addressKey(address));
      const waits: number[] = [];
      if (user.count >= PER_USERNAME.refuseFrom) waits.push(byUsername.retryAfterSeconds(user));
      if (addr.count >= PER_ADDRESS.refuseFrom) waits.push(byAddress.retryAfterSeconds(addr));
      if (waits.length > 0) return { refused: true, retryAfterSeconds: Math.max(...waits) };
      return {
        refused: false,
        delayMs: Math.max(delayFor(user.count, PER_USERNAME), delayFor(addr.count, PER_ADDRESS)),
      };
    },
    recordFailure(username, address) {
      byUsername.hit(username);
      byAddress.hit(addressKey(address));
    },
    recordSuccess(username) {
      byUsername.clear(username);
    },
  };
}

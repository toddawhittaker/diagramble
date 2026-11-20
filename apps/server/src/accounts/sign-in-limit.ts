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
  /** Take one event back off a key's count. */
  undo(key: string): void;
  /** Whole seconds until this window ends, at least one. */
  retryAfterSeconds(window: Window): number;
  /** How many keys are held now; old ones are dropped as time passes. */
  size(): number;
}

/** The most keys one counter holds, so memory stays bounded. */
export const MAX_KEYS = 100_000;

/**
 * Fixed windows keyed by whatever the caller counts: an address, a username.
 *
 * A full counter makes room for a new key by dropping, in order: every window that has
 * ended; then the oldest key whose count is below `keepFrom`. If every key is at or
 * above `keepFrom`, the new key is not stored, so a flood of new keys cannot push out
 * the count of a key that is under attack. Such a key's hit is still returned, but
 * not held.
 */
export function createCounter(
  windowMs: number,
  now: () => number,
  maxKeys = MAX_KEYS,
  keepFrom = Infinity,
): Counter {
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

  /** Whether there is room for one more key, dropping keys as the rules above say. */
  function makeRoom(): boolean {
    if (windows.size < maxKeys) return true;
    const at = now();
    // Keys are held oldest window first, so the ended ones are at the front.
    for (const [k, w] of windows) {
      if (at - w.startedAt < windowMs) break;
      windows.delete(k);
    }
    if (windows.size < maxKeys) return true;
    for (const [k, w] of windows) {
      if (w.count < keepFrom) {
        windows.delete(k);
        return true;
      }
    }
    return false;
  }

  return {
    hit(key) {
      let window = live(key);
      if (!window) {
        window = { startedAt: now(), count: 0 };
        if (makeRoom()) windows.set(key, window);
      }
      window.count += 1;
      return window;
    },
    peek: (key) => live(key) ?? { startedAt: now(), count: 0 },
    clear: (key) => {
      windows.delete(key);
    },
    undo(key) {
      const window = live(key);
      if (window && window.count > 0) window.count -= 1;
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
  /**
   * Whether a sign-in attempt may go on and how long to hold its reply if it fails.
   * An attempt that is not refused is counted at once, before its password is checked,
   * so attempts sent in parallel cannot all pass. `username` is undefined when the
   * typed name is not a valid username; then only the address counts. `ip` is the
   * client's address as the request gave it.
   */
  attempt(username: string | undefined, ip: string): SignInCheck;
  /** A success clears the username's count and gives back the address's count for it. */
  succeeded(username: string, ip: string): void;
}

/**
 * Sign-in attempts that have not succeeded, over a fixed 15-minute window that starts
 * at a key's first one. For a username, the attempt after 3 failures gives no delay,
 * the one after 4 gives 1 s, each further failure adds 1 s up to 5 s, and the one
 * after 10 is refused. An address is slowed from its 20th failure and refused from
 * its 50th.
 */
export function createSignInLimiter({ now, maxKeys }: { now: () => number; maxKeys?: number }): SignInLimiter {
  // A key at or past the count where slowing starts is under attack and is never pushed out.
  const byUsername = createCounter(WINDOW_MS, now, maxKeys, PER_USERNAME.slowFrom);
  const byAddress = createCounter(WINDOW_MS, now, maxKeys, PER_ADDRESS.slowFrom);

  return {
    attempt(username, ip) {
      const address = addressKey(ip);
      const user = username === undefined ? undefined : byUsername.peek(username);
      const addr = byAddress.peek(address);
      const waits: number[] = [];
      if (user && user.count >= PER_USERNAME.refuseFrom) waits.push(byUsername.retryAfterSeconds(user));
      if (addr.count >= PER_ADDRESS.refuseFrom) waits.push(byAddress.retryAfterSeconds(addr));
      if (waits.length > 0) return { refused: true, retryAfterSeconds: Math.max(...waits) };
      const delayMs = Math.max(user ? delayFor(user.count, PER_USERNAME) : 0, delayFor(addr.count, PER_ADDRESS));
      if (username !== undefined) byUsername.hit(username);
      byAddress.hit(address);
      return { refused: false, delayMs };
    },
    succeeded(username, ip) {
      byUsername.clear(username);
      byAddress.undo(addressKey(ip));
    },
  };
}

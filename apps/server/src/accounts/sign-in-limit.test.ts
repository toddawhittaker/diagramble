import { describe, expect, test } from "vitest";
import { addressKey, createCounter, createSignInLimiter } from "./sign-in-limit.ts";

const SECOND = 1000;
const WINDOW = 15 * 60 * SECOND;

function fakeClock(start = 1_000_000) {
  let t = start;
  return {
    now: () => t,
    advance(ms: number) {
      t += ms;
    },
  };
}

function setup() {
  const clock = fakeClock();
  return { clock, limiter: createSignInLimiter({ now: clock.now }) };
}

/** Record `n` failures for one username from one address. */
function fail(limiter: ReturnType<typeof createSignInLimiter>, n: number, user = "ada", address = "203.0.113.5") {
  for (let i = 0; i < n; i++) limiter.recordFailure(user, address);
}

describe("per username", () => {
  test("a fresh username is not slowed", () => {
    const { limiter } = setup();
    expect(limiter.check("ada", "203.0.113.5")).toEqual({ refused: false, delayMs: 0 });
  });

  test("no delay through the 3rd failure; 1 s after the 4th, growing by 1 s to 5 s", () => {
    const { limiter } = setup();
    const delays: number[] = [];
    for (let n = 1; n <= 9; n++) {
      fail(limiter, 1);
      const result = limiter.check("ada", "203.0.113.5");
      expect(result.refused).toBe(false);
      delays.push(result.refused ? -1 : result.delayMs);
    }
    // The check made after 1, 2, ... 9 failures.
    expect(delays).toEqual([0, 0, 0, 1000, 2000, 3000, 4000, 5000, 5000]);
  });

  test("refused once the 10th failure is counted, with seconds left in the window", () => {
    const { limiter, clock } = setup();
    fail(limiter, 9);
    expect(limiter.check("ada", "203.0.113.5").refused).toBe(false);
    fail(limiter, 1);
    expect(limiter.check("ada", "203.0.113.5")).toEqual({ refused: true, retryAfterSeconds: 900 });
    clock.advance(100 * SECOND);
    expect(limiter.check("ada", "203.0.113.5")).toEqual({ refused: true, retryAfterSeconds: 800 });
  });

  test("Retry-After rounds up to whole seconds and is at least 1", () => {
    const { limiter, clock } = setup();
    fail(limiter, 10);
    clock.advance(WINDOW - 1500);
    expect(limiter.check("ada", "203.0.113.5")).toEqual({ refused: true, retryAfterSeconds: 2 });
    clock.advance(1499);
    expect(limiter.check("ada", "203.0.113.5")).toEqual({ refused: true, retryAfterSeconds: 1 });
  });

  test("the window ends 15 minutes after the first failure and the count starts over", () => {
    const { limiter, clock } = setup();
    fail(limiter, 10);
    clock.advance(WINDOW - 1);
    expect(limiter.check("ada", "203.0.113.5").refused).toBe(true);
    clock.advance(1);
    expect(limiter.check("ada", "203.0.113.5")).toEqual({ refused: false, delayMs: 0 });
    fail(limiter, 4);
    expect(limiter.check("ada", "203.0.113.5")).toEqual({ refused: false, delayMs: 1000 });
  });

  test("the window is fixed: later failures do not extend it", () => {
    const { limiter, clock } = setup();
    fail(limiter, 1);
    clock.advance(WINDOW - 10 * SECOND);
    fail(limiter, 9);
    expect(limiter.check("ada", "203.0.113.5")).toEqual({ refused: true, retryAfterSeconds: 10 });
  });

  test("check only looks: repeated checks change nothing", () => {
    const { limiter } = setup();
    fail(limiter, 3);
    for (let i = 0; i < 50; i++) limiter.check("ada", "203.0.113.5");
    expect(limiter.check("ada", "203.0.113.5")).toEqual({ refused: false, delayMs: 0 });
    fail(limiter, 1);
    expect(limiter.check("ada", "203.0.113.5")).toEqual({ refused: false, delayMs: 1000 });
  });

  test("a success clears that username's count and no other", () => {
    const { limiter } = setup();
    fail(limiter, 9, "ada", "203.0.113.5");
    fail(limiter, 5, "grace", "203.0.113.6");
    limiter.recordSuccess("ada");
    expect(limiter.check("ada", "198.51.100.1")).toEqual({ refused: false, delayMs: 0 });
    expect(limiter.check("grace", "198.51.100.1")).toEqual({ refused: false, delayMs: 2000 });
  });

  test("a refused username stays refused even from a new address", () => {
    const { limiter } = setup();
    fail(limiter, 10, "ada", "203.0.113.5");
    expect(limiter.check("ada", "198.51.100.77").refused).toBe(true);
  });

  test("usernames are separate counts", () => {
    const { limiter } = setup();
    fail(limiter, 10, "ada", "203.0.113.5");
    expect(limiter.check("grace", "198.51.100.77")).toEqual({ refused: false, delayMs: 0 });
  });
});

describe("per address", () => {
  // A different username each time keeps the username limit out of it.
  function failFrom(limiter: ReturnType<typeof createSignInLimiter>, n: number, address: string, offset = 0) {
    for (let i = 0; i < n; i++) limiter.recordFailure(`user${offset + i}`, address);
  }

  test("no delay through the 19th failure; 1 s after the 20th, growing to 5 s", () => {
    const { limiter } = setup();
    const address = "203.0.113.5";
    const delayAfter = (n: number): number => {
      const r = limiter.check("fresh", address);
      if (r.refused) throw new Error(`refused after ${n}`);
      return r.delayMs;
    };
    failFrom(limiter, 19, address);
    expect(delayAfter(19)).toBe(0);
    failFrom(limiter, 1, address, 19);
    expect(delayAfter(20)).toBe(1000);
    failFrom(limiter, 1, address, 20);
    expect(delayAfter(21)).toBe(2000);
    failFrom(limiter, 3, address, 21);
    expect(delayAfter(24)).toBe(5000);
    failFrom(limiter, 25, address, 24);
    expect(delayAfter(49)).toBe(5000);
  });

  test("refused from the 50th failure, for every username, with seconds left", () => {
    const { limiter, clock } = setup();
    const address = "203.0.113.5";
    failFrom(limiter, 50, address);
    clock.advance(60 * SECOND);
    expect(limiter.check("fresh", address)).toEqual({ refused: true, retryAfterSeconds: 840 });
  });

  test("a success for a username does not clear the address's count", () => {
    const { limiter } = setup();
    const address = "203.0.113.5";
    failFrom(limiter, 20, address);
    limiter.recordSuccess("user0");
    expect(limiter.check("fresh", address)).toEqual({ refused: false, delayMs: 1000 });
  });

  test("the window ends 15 minutes after the first failure", () => {
    const { limiter, clock } = setup();
    const address = "203.0.113.5";
    failFrom(limiter, 50, address);
    clock.advance(WINDOW);
    expect(limiter.check("fresh", address)).toEqual({ refused: false, delayMs: 0 });
  });

  test("another address is not affected", () => {
    const { limiter } = setup();
    failFrom(limiter, 50, "203.0.113.5");
    expect(limiter.check("fresh", "203.0.113.6")).toEqual({ refused: false, delayMs: 0 });
  });

  test("addresses in one IPv6 /64 share a count", () => {
    const { limiter } = setup();
    failFrom(limiter, 25, "2001:db8:1:2::1");
    failFrom(limiter, 25, "2001:db8:1:2:aaaa:bbbb:cccc:dddd", 25);
    expect(limiter.check("fresh", "2001:db8:1:2:1:2:3:4").refused).toBe(true);
    expect(limiter.check("fresh", "2001:db8:1:3::1")).toEqual({ refused: false, delayMs: 0 });
  });

  test("an IPv4-mapped IPv6 address counts as its IPv4 address", () => {
    const { limiter } = setup();
    failFrom(limiter, 25, "203.0.113.5");
    failFrom(limiter, 25, "::ffff:203.0.113.5", 25);
    expect(limiter.check("fresh", "203.0.113.5").refused).toBe(true);
    expect(limiter.check("fresh", "::FFFF:203.0.113.5").refused).toBe(true);
  });
});

describe("both limits at once", () => {
  test("the longer delay wins", () => {
    const { limiter } = setup();
    // 20 failures from one address gives it a 1 s delay; the username has 8 (5 s).
    for (let i = 0; i < 12; i++) limiter.recordFailure(`other${i}`, "203.0.113.5");
    fail(limiter, 8, "ada", "203.0.113.5");
    expect(limiter.check("ada", "203.0.113.5")).toEqual({ refused: false, delayMs: 5000 });
    expect(limiter.check("grace", "203.0.113.5")).toEqual({ refused: false, delayMs: 1000 });
  });

  test("either refusal refuses, and the longer wait is reported", () => {
    const { limiter, clock } = setup();
    fail(limiter, 10, "ada", "198.51.100.1");
    clock.advance(300 * SECOND);
    for (let i = 0; i < 50; i++) limiter.recordFailure(`u${i}`, "203.0.113.5");
    // Username window has 600 s left; the address window has 900 s.
    expect(limiter.check("ada", "203.0.113.5")).toEqual({ refused: true, retryAfterSeconds: 900 });
    expect(limiter.check("ada", "198.51.100.1")).toEqual({ refused: true, retryAfterSeconds: 600 });
  });
});

describe("memory", () => {
  test("expired windows are dropped as time passes", () => {
    const clock = fakeClock();
    const counter = createCounter(WINDOW, clock.now);
    for (let i = 0; i < 1000; i++) counter.hit(`key${i}`);
    expect(counter.size()).toBe(1000);
    clock.advance(WINDOW);
    counter.hit("new");
    expect(counter.size()).toBe(1);
  });

  test("looking at a key that was never counted stores nothing", () => {
    const clock = fakeClock();
    const counter = createCounter(WINDOW, clock.now);
    for (let i = 0; i < 100; i++) expect(counter.peek(`key${i}`).count).toBe(0);
    expect(counter.size()).toBe(0);
  });

  test("clearing a key removes it", () => {
    const clock = fakeClock();
    const counter = createCounter(WINDOW, clock.now);
    counter.hit("a");
    counter.clear("a");
    expect(counter.size()).toBe(0);
    expect(counter.peek("a").count).toBe(0);
  });
});

describe("addressKey", () => {
  test("an IPv4 address is its own key", () => {
    expect(addressKey("203.0.113.5")).toBe("203.0.113.5");
  });

  test("an IPv4-mapped IPv6 address becomes the IPv4 address, in any case", () => {
    expect(addressKey("::ffff:203.0.113.5")).toBe("203.0.113.5");
    expect(addressKey("::FFFF:203.0.113.5")).toBe("203.0.113.5");
  });

  test("an IPv6 address becomes its /64 prefix, written the same however it was spelled", () => {
    const expected = "2001:db8:1:2::/64";
    expect(addressKey("2001:db8:1:2::1")).toBe(expected);
    expect(addressKey("2001:0DB8:0001:0002:ffff:ffff:ffff:ffff")).toBe(expected);
    expect(addressKey("2001:db8:1:2:0:0:0:0")).toBe(expected);
  });

  test("an IPv6 address with a short head keeps zero groups in place", () => {
    expect(addressKey("::1")).toBe("0:0:0:0::/64");
    expect(addressKey("2001:db8::1")).toBe("2001:db8:0:0::/64");
  });

  test("a scope id is ignored", () => {
    expect(addressKey("fe80::1%eth0")).toBe("fe80:0:0:0::/64");
  });

  test("a different /64 is a different key", () => {
    expect(addressKey("2001:db8:1:2::1")).not.toBe(addressKey("2001:db8:1:3::1"));
  });

  test("text that is no address is its own key", () => {
    expect(addressKey("unknown")).toBe("unknown");
  });
});

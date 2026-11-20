// Failed sign-ins are slowed and then refused (SPEC.md section 1, "Sign-in"), tested
// through POST /sign-in with a moving clock and a made-up client address. A username
// is refused after its 10th failure and an address after its 50th, over a fixed
// 15-minute window that begins at the first failure.

import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { createSignInLimiter } from "../accounts/sign-in-limit.ts";
import { createTestDb, type TestDb } from "../db/testing.ts";
import { buildServer } from "../server.ts";
import {
  cookieOf,
  HTTPS_COOKIE,
  HTTPS_ORIGIN,
  makeAccounts,
  makeSettings,
  makeStaticDir,
  PASSWORD,
  setCookieLines,
  signIn,
} from "./harness.ts";

// Several scrypt hashes in one test can outlast the default 5 s while the suite runs in parallel.
vi.setConfig({ testTimeout: 20_000, hookTimeout: 20_000 });

const WINDOW_MS = 15 * 60 * 1000;
const SENTENCE = "That username and password do not match.";

let testDb: TestDb;
let staticDir: string;
let apps: FastifyInstance[] = [];

beforeAll(async () => {
  testDb = await createTestDb();
  await makeAccounts(testDb.db, ["ada", "grace", "alan"]);
  staticDir = makeStaticDir();
});

afterAll(async () => {
  await Promise.all(apps.map((app) => app.close()));
  await testDb.drop();
});

/**
 * A server behind one proxy, with its own counts and its own clock. The waiting that
 * slows a reply is switched off so the tests run quickly; whether a reply is refused is
 * left to the real limiter.
 */
async function limitedServer(): Promise<{ app: FastifyInstance; time: { now: number } }> {
  const time = { now: Date.now() };
  const now = () => time.now;
  const real = createSignInLimiter({ now });
  const app = await buildServer({
    db: testDb.db,
    settings: makeSettings(HTTPS_ORIGIN, staticDir, 1),
    now,
    limiter: {
      ...real,
      attempt(username, address) {
        const result = real.attempt(username, address);
        return result.refused ? result : { refused: false, delayMs: 0 };
      },
    },
  });
  apps.push(app);
  return { app, time };
}

function attempt(
  app: FastifyInstance,
  username: string,
  password: string,
  address: string,
) {
  return signIn(app, HTTPS_ORIGIN, { username, password }, { "x-forwarded-for": address });
}

const WRONG = "not the password";

vi.setConfig({ testTimeout: 60_000 });

describe.concurrent("per username", () => {
  test("ten failures are answered; the next attempt is refused with 429 and Retry-After, even with the right password", async () => {
    const { app, time } = await limitedServer();
    for (let n = 1; n <= 10; n++) {
      const reply = await attempt(app, "ada", WRONG, "203.0.113.1");
      expect(reply.statusCode, `failure ${n}`).toBe(401);
      expect(reply.body).toContain(SENTENCE);
    }
    const refused = await attempt(app, "ada", PASSWORD, "203.0.113.1");
    expect(refused.statusCode).toBe(429);
    expect(refused.headers["retry-after"]).toBe("900");
    expect(refused.body).toContain("too many failed sign-ins");
    expect(setCookieLines(refused)).toEqual([]);
    expect(refused.headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(String(refused.headers["content-security-policy"])).toContain("frame-ancestors 'none'");
  });

  test("it is the username that is refused, from any address and in any letter case", async () => {
    const { app, time } = await limitedServer();
    for (let n = 1; n <= 10; n++) {
      await attempt(app, n % 2 ? "ada" : "ADA", WRONG, `203.0.113.${n}`);
    }
    expect((await attempt(app, "Ada", PASSWORD, "198.51.100.77")).statusCode).toBe(429);
    expect((await attempt(app, "grace", PASSWORD, "203.0.113.1")).statusCode).toBe(303);
  });

  test("an unknown username is counted too, so the refusal does not tell which exist", async () => {
    const { app, time } = await limitedServer();
    for (let n = 1; n <= 10; n++) {
      expect((await attempt(app, "nobody", WRONG, "203.0.113.2")).statusCode).toBe(401);
    }
    expect((await attempt(app, "nobody", WRONG, "203.0.113.2")).statusCode).toBe(429);
  });

  test("a success clears the username's count", async () => {
    const { app, time } = await limitedServer();
    for (let n = 1; n <= 9; n++) await attempt(app, "grace", WRONG, "203.0.113.3");
    expect((await attempt(app, "grace", PASSWORD, "203.0.113.3")).statusCode).toBe(303);
    for (let n = 1; n <= 10; n++) {
      const reply = await attempt(app, "grace", WRONG, "203.0.113.3");
      expect(reply.statusCode, `failure ${n} after the success`).toBe(401);
    }
    expect((await attempt(app, "grace", WRONG, "203.0.113.3")).statusCode).toBe(429);
  });

  test("the window is 15 minutes from the first failure, and then the count starts again", async () => {
    const { app, time } = await limitedServer();
    for (let n = 1; n <= 10; n++) await attempt(app, "alan", WRONG, "203.0.113.4");

    time.now += 5 * 60 * 1000;
    const stillRefused = await attempt(app, "alan", PASSWORD, "203.0.113.4");
    expect(stillRefused.statusCode).toBe(429);
    expect(stillRefused.headers["retry-after"]).toBe("600");

    time.now += WINDOW_MS - 5 * 60 * 1000 - 1;
    expect((await attempt(app, "alan", PASSWORD, "203.0.113.4")).statusCode).toBe(429);

    time.now += 1;
    const open = await attempt(app, "alan", PASSWORD, "203.0.113.4");
    expect(open.statusCode).toBe(303);
    expect(cookieOf(open, HTTPS_COOKIE)).toBeDefined();
  });

  test("after the window the full ten failures are allowed again", async () => {
    const { app, time } = await limitedServer();
    for (let n = 1; n <= 10; n++) await attempt(app, "ada", WRONG, "203.0.113.5");
    time.now += WINDOW_MS;
    for (let n = 1; n <= 10; n++) {
      expect((await attempt(app, "ada", WRONG, "203.0.113.5")).statusCode, `failure ${n}`).toBe(401);
    }
    expect((await attempt(app, "ada", WRONG, "203.0.113.5")).statusCode).toBe(429);
  });
});

describe.concurrent("per address", () => {
  test("fifty failures, each for a different username, refuse the 51st attempt; the window then resets", async () => {
    const { app, time } = await limitedServer();
    for (let n = 1; n <= 50; n++) {
      const reply = await attempt(app, `user${n}`, WRONG, "203.0.113.50");
      expect(reply.statusCode, `failure ${n}`).toBe(401);
    }
    const refused = await attempt(app, "grace", PASSWORD, "203.0.113.50");
    expect(refused.statusCode).toBe(429);
    expect(refused.headers["retry-after"]).toBe("900");
    expect(setCookieLines(refused)).toEqual([]);

    expect((await attempt(app, "grace", PASSWORD, "203.0.113.51")).statusCode).toBe(303);

    time.now += WINDOW_MS;
    expect((await attempt(app, "alan", PASSWORD, "203.0.113.50")).statusCode).toBe(303);
  });

  test("one IPv6 /64 counts as one address, and a success does not clear its count", async () => {
    const { app } = await limitedServer();
    const inSubnet = (n: number) => `2001:db8:1:2:${n.toString(16)}::${n.toString(16)}`;
    for (let n = 1; n <= 49; n++) await attempt(app, `user${n}`, WRONG, inSubnet(n));
    expect((await attempt(app, "grace", PASSWORD, inSubnet(60))).statusCode).toBe(303);
    expect((await attempt(app, "user50", WRONG, inSubnet(50))).statusCode).toBe(401);

    expect((await attempt(app, "alan", PASSWORD, inSubnet(61))).statusCode).toBe(429);
    expect((await attempt(app, "alan", PASSWORD, "2001:db8:1:3::1")).statusCode).toBe(303);
  });
});

describe.concurrent("the client address", () => {
  test("an X-Forwarded-For header is ignored when no proxy is trusted", async () => {
    const time = { now: Date.now() };
    const now = () => time.now;
    const real = createSignInLimiter({ now });
    const seen: string[] = [];
    const app = await buildServer({
      db: testDb.db,
      settings: makeSettings(HTTPS_ORIGIN, staticDir, 0),
      now,
      limiter: {
        ...real,
        attempt(_username, address) {
          seen.push(address);
          return { refused: false, delayMs: 0 };
        },
      },
    });
    apps.push(app);
    await attempt(app, "ada", WRONG, "203.0.113.99");
    await attempt(app, "ada", WRONG, "203.0.113.98");
    expect(seen).toHaveLength(2);
    expect(seen).not.toContain("203.0.113.99");
    expect(seen).not.toContain("203.0.113.98");
    expect(new Set(seen).size).toBe(1);
  });

  test("behind one trusted proxy, the address that proxy reports is used", async () => {
    const time = { now: Date.now() };
    const now = () => time.now;
    const seen: string[] = [];
    const app = await buildServer({
      db: testDb.db,
      settings: makeSettings(HTTPS_ORIGIN, staticDir, 1),
      now,
      limiter: {
        attempt(_username, address) {
          seen.push(address);
          return { refused: false, delayMs: 0 };
        },
        succeeded: () => {},
      },
    });
    apps.push(app);
    await attempt(app, "ada", WRONG, "203.0.113.99");
    expect(seen).toEqual(["203.0.113.99"]);
  });
});

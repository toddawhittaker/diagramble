import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { hashPassword } from "./accounts/password.ts";
import { NO_MATCH, REFUSED } from "./accounts/routes.ts";
import { hashToken } from "./accounts/sessions.ts";
import { createPasswordAccount, loadSession, setDisabled } from "./accounts/store.ts";
import { createTestDb, type TestDb } from "./db/testing.ts";
import { OPEN_ROUTES, ORIGIN_EXEMPT_ROUTES } from "./guard.ts";
import { buildServer } from "./server.ts";
import type { Settings } from "./settings.ts";

const ORIGIN = "https://app.example.edu";
const COOKIE = "__Host-diagramble-session";
const PASSWORD = "correct horse battery staple";
const FORM = "application/x-www-form-urlencoded";

const staticDir = mkdtempSync(path.join(tmpdir(), "diagramble-static-"));
writeFileSync(path.join(staticDir, "index.html"), "<!doctype html><title>Preview</title>");
writeFileSync(path.join(staticDir, "app.js"), "console.log('preview');");
writeFileSync(path.join(staticDir, ".env"), "SECRET=1");

const settings: Settings = {
  databaseUrl: "postgres://unused/x",
  appOrigin: ORIGIN,
  port: 0,
  trustProxyHops: 0,
  staticDir,
};

let testDb: TestDb;
let app: FastifyInstance;
let clock: number;
let accountId: string;

/** A limiter that never slows or refuses, so these tests see only the password check. */
const openLimiter = {
  attempt: () => ({ refused: false as const, delayMs: 0 }),
  succeeded: () => {},
};

beforeAll(async () => {
  testDb = await createTestDb();
  ({ accountId } = await createPasswordAccount(testDb.db, "ada", await hashPassword(PASSWORD)));
  await createPasswordAccount(testDb.db, "grace", await hashPassword(PASSWORD));
  app = await buildServer({ db: testDb.db, settings, now: () => clock, limiter: openLimiter });
});

afterAll(async () => {
  await app.close();
  await testDb.drop();
});

beforeEach(async () => {
  clock = Date.now();
  await setDisabled(testDb.db, accountId, false);
});

function signIn(body: Record<string, string>, headers: Record<string, string> = {}) {
  return app.inject({
    method: "POST",
    url: "/sign-in",
    headers: { origin: ORIGIN, "content-type": FORM, ...headers },
    payload: new URLSearchParams(body).toString(),
  });
}

function sessionCookie(response: LightMyRequestResponse) {
  return response.cookies.find((c) => c.name === COOKIE);
}

async function signedInToken(): Promise<string> {
  const response = await signIn({ username: "ada", password: PASSWORD });
  const cookie = sessionCookie(response);
  if (!cookie) throw new Error("no session cookie");
  return cookie.value;
}

describe("POST /sign-in", () => {
  test("the right password sets a host-only session cookie and redirects to /", async () => {
    const response = await signIn({ username: "Ada", password: PASSWORD });
    expect(response.statusCode).toBe(303);
    expect(response.headers.location).toBe("/");
    const cookie = sessionCookie(response);
    expect(cookie).toMatchObject({
      httpOnly: true,
      secure: true,
      path: "/",
      sameSite: "Lax",
      maxAge: 86400,
    });
    expect(cookie?.domain).toBeUndefined();
    const session = await loadSession(testDb.db, hashToken(cookie!.value), new Date(clock));
    expect(session).toMatchObject({ accountId, login: "ada" });
  });

  test("the session lasts 24 hours from sign-in", async () => {
    const token = await signedInToken();
    const later = (ms: number) => loadSession(testDb.db, hashToken(token), new Date(clock + ms));
    expect(await later(24 * 3600 * 1000 - 1000)).toBeDefined();
    expect(await later(24 * 3600 * 1000)).toBeUndefined();
  });

  test("signing in again ends the session of the cookie sent", async () => {
    const first = await signedInToken();
    const response = await signIn(
      { username: "grace", password: PASSWORD },
      { cookie: `${COOKIE}=${first}` },
    );
    expect(response.statusCode).toBe(303);
    expect(sessionCookie(response)?.value).not.toBe(first);
    expect(await loadSession(testDb.db, hashToken(first), new Date(clock))).toBeUndefined();
  });

  test.each([
    ["a wrong password", { username: "ada", password: "wrong" }],
    ["an unknown username", { username: "nobody", password: PASSWORD }],
    ["an invalid username", { username: "../ada", password: PASSWORD }],
    ["a missing password", { username: "ada" }],
    ["an over-long password", { username: "ada", password: "x".repeat(1025) }],
    ["an over-long username", { username: "a".repeat(257), password: PASSWORD }],
    ["an empty body", {}],
  ])("%s gets the same refusal, with the username kept", async (_name, body: Record<string, string>) => {
    const response = await signIn(body);
    expect(response.statusCode).toBe(401);
    expect(sessionCookie(response)).toBeUndefined();
    expect(response.headers["content-type"]).toBe("text/html; charset=utf-8");
    expect(response.body).toContain(NO_MATCH);
    if (body.username) expect(response.body).toContain(`value="${body.username.slice(0, 256)}"`);
  });

  test("a disabled account gets the same refusal as a wrong password", async () => {
    await setDisabled(testDb.db, accountId, true);
    const disabled = await signIn({ username: "ada", password: PASSWORD });
    await setDisabled(testDb.db, accountId, false);
    const wrong = await signIn({ username: "ada", password: "wrong" });
    expect(disabled.statusCode).toBe(401);
    expect(disabled.body).toBe(wrong.body);
    expect(sessionCookie(disabled)).toBeUndefined();
  });

  test("a JSON body is checked the same way", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/sign-in",
      headers: { origin: ORIGIN },
      payload: { username: "ada", password: PASSWORD },
    });
    expect(response.statusCode).toBe(303);
  });

  test.each([
    ["a matching Origin", ORIGIN, 401],
    ["another Origin", "https://files.example.edu", 403],
    ["Origin: null", "null", 403],
    ["no Origin", undefined, 403],
  ])("%s", async (_name, origin, status) => {
    const headers: Record<string, string> = { "content-type": FORM };
    if (origin !== undefined) headers.origin = origin;
    const response = await app.inject({
      method: "POST",
      url: "/sign-in",
      headers,
      payload: new URLSearchParams({ username: "ada", password: "wrong" }).toString(),
    });
    expect(response.statusCode).toBe(status);
    if (status === 403) expect(response.headers["content-type"]).toBe("text/plain; charset=utf-8");
  });
});

describe("the limiter", () => {
  test("a refusal is 429 with Retry-After and a plain sentence", async () => {
    const seen: string[] = [];
    const refusing = {
      attempt: (username: string | undefined, address: string) => {
        seen.push(String(username), address);
        return { refused: true as const, retryAfterSeconds: 120 };
      },
      succeeded: () => {},
    };
    const limited = await buildServer({ db: testDb.db, settings, limiter: refusing });
    try {
      const response = await limited.inject({
        method: "POST",
        url: "/sign-in",
        headers: { origin: ORIGIN, "content-type": FORM },
        payload: new URLSearchParams({ username: "Ada", password: PASSWORD }).toString(),
      });
      expect(response.statusCode).toBe(429);
      expect(response.headers["retry-after"]).toBe("120");
      expect(response.body).toContain(REFUSED);
      expect(sessionCookie(response)).toBeUndefined();
      expect(seen[0]).toBe("ada");
    } finally {
      await limited.close();
    }
  });

  test("each attempt is counted, a failure is delayed, a success is given back", async () => {
    const calls: string[] = [];
    const recording = {
      attempt: (username: string | undefined, address: string) => {
        calls.push(`try ${username} ${address}`);
        return { refused: false as const, delayMs: 50 };
      },
      succeeded: (username: string, address: string) => void calls.push(`ok ${username} ${address}`),
    };
    const limited = await buildServer({ db: testDb.db, settings, limiter: recording });
    try {
      const send = (password: string) =>
        limited.inject({
          method: "POST",
          url: "/sign-in",
          headers: { origin: ORIGIN, "content-type": FORM },
          payload: new URLSearchParams({ username: "ADA", password }).toString(),
        });
      const started = performance.now();
      expect((await send("wrong")).statusCode).toBe(401);
      expect(performance.now() - started).toBeGreaterThanOrEqual(45);
      expect((await send(PASSWORD)).statusCode).toBe(303);
      // The raw request address goes to the limiter, which owns its normalizing.
      expect(calls).toEqual(["try ada 127.0.0.1", "try ada 127.0.0.1", "ok ada 127.0.0.1"]);
    } finally {
      await limited.close();
    }
  });
});

test("an invalid username counts only by address, still hashes, and is echoed at most 256 characters", async () => {
  const keys: (string | undefined)[] = [];
  const recording = {
    ...openLimiter,
    attempt: (username: string | undefined) => {
      keys.push(username);
      return { refused: false as const, delayMs: 0 };
    },
  };
  const limited = await buildServer({ db: testDb.db, settings, limiter: recording });
  try {
    const started = performance.now();
    const response = await limited.inject({
      method: "POST",
      url: "/sign-in",
      headers: { origin: ORIGIN, "content-type": FORM },
      payload: new URLSearchParams({ username: "B".repeat(300), password: "x" }).toString(),
    });
    expect(performance.now() - started).toBeGreaterThan(5);
    expect(response.statusCode).toBe(401);
    expect(response.body).toContain(NO_MATCH);
    expect(response.body).toContain("B".repeat(256));
    expect(response.body).not.toContain("B".repeat(257));
    expect(keys).toEqual([undefined]);
  } finally {
    await limited.close();
  }
});

test("parallel wrong passwords for one username: only the limit's number reach the password check", async () => {
  const limited = await buildServer({ db: testDb.db, settings });
  try {
    const responses = await Promise.all(
      Array.from({ length: 30 }, () =>
        limited.inject({
          method: "POST",
          url: "/sign-in",
          headers: { origin: ORIGIN, "content-type": FORM },
          payload: new URLSearchParams({ username: "grace", password: "wrong" }).toString(),
        }),
      ),
    );
    const codes = responses.map((r) => r.statusCode);
    expect(codes.filter((c) => c === 401)).toHaveLength(10);
    expect(codes.filter((c) => c === 429)).toHaveLength(20);
  } finally {
    await limited.close();
  }
}, 30_000);

test("request logs carry neither the cookie nor the body", async () => {
  const lines: string[] = [];
  const logged = await buildServer({
    db: testDb.db,
    settings,
    limiter: openLimiter,
    logger: { stream: { write: (line) => void lines.push(line) } },
  });
  try {
    const response = await logged.inject({
      method: "POST",
      url: "/sign-in",
      headers: { origin: ORIGIN, "content-type": FORM, cookie: `${COOKIE}=secret-token-value` },
      payload: new URLSearchParams({ username: "ada", password: PASSWORD }).toString(),
    });
    expect(response.statusCode).toBe(303);
    const log = lines.join("");
    expect(log).toContain("/sign-in");
    expect(log).not.toContain("secret-token-value");
    expect(log).not.toContain(PASSWORD);
    expect(log).not.toContain(sessionCookie(response)!.value);
  } finally {
    await logged.close();
  }
});

describe("POST /sign-out", () => {
  test("ends the session, clears the cookie and redirects to /sign-in", async () => {
    const token = await signedInToken();
    const response = await app.inject({
      method: "POST",
      url: "/sign-out",
      headers: { origin: ORIGIN, cookie: `${COOKIE}=${token}` },
    });
    expect(response.statusCode).toBe(303);
    expect(response.headers.location).toBe("/sign-in");
    expect(sessionCookie(response)).toMatchObject({ value: "", secure: true, path: "/" });
    expect(await loadSession(testDb.db, hashToken(token), new Date(clock))).toBeUndefined();
    const after = await app.inject({ url: "/app.js", headers: { cookie: `${COOKIE}=${token}` } });
    expect(after.statusCode).toBe(401);
  });

  test("works signed out, and still needs the Origin", async () => {
    const signedOut = await app.inject({ method: "POST", url: "/sign-out", headers: { origin: ORIGIN } });
    expect(signedOut.statusCode).toBe(303);
    const noOrigin = await app.inject({ method: "POST", url: "/sign-out" });
    expect(noOrigin.statusCode).toBe(403);
  });
});

describe("who sees what", () => {
  test("a signed-out page request is sent to the sign-in page", async () => {
    for (const url of ["/", "/index.html", "/no/such/page"]) {
      const response = await app.inject({ url, headers: { accept: "text/html,*/*" } });
      expect(response.statusCode).toBe(303);
      expect(response.headers.location).toBe("/sign-in");
    }
  });

  test("a signed-out fetch gets 401", async () => {
    const response = await app.inject({ url: "/app.js", headers: { accept: "*/*" } });
    expect(response.statusCode).toBe(401);
    const head = await app.inject({ method: "HEAD", url: "/" });
    expect(head.statusCode).toBe(401);
  });

  test("an expired session counts as signed out", async () => {
    const token = await signedInToken();
    clock += 24 * 3600 * 1000;
    const response = await app.inject({ url: "/app.js", headers: { cookie: `${COOKIE}=${token}` } });
    expect(response.statusCode).toBe(401);
  });

  test("the open paths stay open signed out", async () => {
    expect(OPEN_ROUTES).toEqual([
      "GET /sign-in",
      "POST /sign-in",
      "GET /sign-in.css",
      "GET /health",
      "POST /sign-out",
    ]);
    expect(ORIGIN_EXEMPT_ROUTES).toEqual([]);
    const page = await app.inject({ url: "/sign-in?x=1", headers: { accept: "text/html" } });
    expect(page.statusCode).toBe(200);
    expect(page.headers["content-type"]).toBe("text/html; charset=utf-8");
    expect(page.headers["content-security-policy"]).toBe(
      "default-src 'none'; style-src 'self'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
    );
    expect(page.body).toContain('action="/sign-in"');
    const css = await app.inject({ url: "/sign-in.css" });
    expect(css.statusCode).toBe(200);
    expect(css.headers["content-type"]).toBe("text/css; charset=utf-8");
    expect((await app.inject({ method: "HEAD", url: "/sign-in" })).statusCode).toBe(200);
    expect((await app.inject({ url: "/health" })).statusCode).toBe(200);
  });

  test("a signed-in person gets the static files, and /sign-in sends them to /", async () => {
    const cookie = `${COOKIE}=${await signedInToken()}`;
    const index = await app.inject({ url: "/", headers: { cookie } });
    expect(index.statusCode).toBe(200);
    expect(index.body).toContain("<title>Preview</title>");
    const script = await app.inject({ url: "/app.js", headers: { cookie } });
    expect(script.statusCode).toBe(200);
    const signInPage = await app.inject({ url: "/sign-in", headers: { cookie } });
    expect(signInPage.statusCode).toBe(303);
    expect(signInPage.headers.location).toBe("/");
  });

  test("a disabled account's session stops working at once", async () => {
    const cookie = `${COOKIE}=${await signedInToken()}`;
    await setDisabled(testDb.db, accountId, true);
    expect((await app.inject({ url: "/app.js", headers: { cookie } })).statusCode).toBe(401);
  });

  test("every reply carries the referrer, sniffing and framing headers", async () => {
    for (const response of [
      await app.inject({ url: "/app.js" }),
      await app.inject({ url: "/health" }),
      await app.inject({ method: "POST", url: "/sign-in" }),
    ]) {
      expect(response.headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
      expect(response.headers["x-content-type-options"]).toBe("nosniff");
      expect(response.headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    }
  });
});

describe("GET /health", () => {
  test("answers ok while the database answers", async () => {
    const response = await app.inject({ url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.body).toBe("ok");
  });

  test("answers 503 when the database does not", async () => {
    const { createDb } = await import("./db/connection.ts");
    const dead = createDb("postgres://postgres:postgres@127.0.0.1:1/none", 1, () => {});
    const broken = await buildServer({ db: dead, settings, limiter: openLimiter });
    try {
      const response = await broken.inject({ url: "/health" });
      expect(response.statusCode).toBe(503);
    } finally {
      await broken.close();
      await dead.destroy();
    }
  });
});

test("a dotfile in the static folder is refused even signed in", async () => {
  const token = await signedInToken();
  const response = await app.inject({ url: "/.env", headers: { cookie: `${COOKIE}=${token}` } });
  expect([403, 404]).toContain(response.statusCode);
  expect(response.body).not.toContain("SECRET");
});

describe("Strict-Transport-Security", () => {
  test("is sent on every reply when the app is served over https", async () => {
    for (const url of ["/health", "/sign-in", "/app.js"]) {
      const response = await app.inject({ url });
      expect(response.headers["strict-transport-security"]).toBe("max-age=31536000");
    }
  });

  test("is not sent when the app is on http://localhost", async () => {
    const local = await buildServer({
      db: testDb.db,
      settings: { ...settings, appOrigin: "http://localhost" },
      limiter: openLimiter,
    });
    try {
      const response = await local.inject({ url: "/health" });
      expect(response.headers["strict-transport-security"]).toBeUndefined();
    } finally {
      await local.close();
    }
  });
});

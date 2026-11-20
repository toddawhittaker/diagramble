// The session cookie and the session behind it (SPEC.md section 1, "Sign-in" and "Host
// names"): its attributes, what the database stores, forged cookies, and the 24 hours.

import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { setDisabled } from "../accounts/store.ts";
import { createTestDb, type TestDb } from "../db/testing.ts";
import { buildServer } from "../server.ts";
import {
  cookieOf,
  HTTP_COOKIE,
  HTTP_ORIGIN,
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

const DAY_MS = 24 * 60 * 60 * 1000;

const limitless = {
  attempt: () => ({ refused: false as const, delayMs: 0 }),
  succeeded: () => {},
};

let testDb: TestDb;
let https: FastifyInstance;
let http: FastifyInstance;
let clock: number;
let accounts: Awaited<ReturnType<typeof makeAccounts>>;

beforeAll(async () => {
  testDb = await createTestDb();
  accounts = await makeAccounts(testDb.db, ["ada", "grace"]);
  const staticDir = makeStaticDir();
  const build = (origin: string) =>
    buildServer({
      db: testDb.db,
      settings: makeSettings(origin, staticDir),
      now: () => clock,
      limiter: limitless,
    });
  https = await build(HTTPS_ORIGIN);
  http = await build(HTTP_ORIGIN);
});

afterAll(async () => {
  await https.close();
  await http.close();
  await testDb.drop();
});

beforeEach(async () => {
  clock = Date.now();
  await setDisabled(testDb.db, accounts.ada!.accountId, false);
});

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

async function tokenFrom(app: FastifyInstance, origin: string, name: string): Promise<string> {
  const response = await signIn(app, origin, { username: "ada", password: PASSWORD });
  const cookie = cookieOf(response, name);
  if (!cookie) throw new Error("no session cookie");
  return cookie.value;
}

const asking = (app: FastifyInstance, name: string, value: string) =>
  app.inject({ url: "/app.js", headers: { cookie: `${name}=${value}` } });

describe("the cookie's attributes", () => {
  test("over https: __Host- prefix, HttpOnly, Secure, Path=/, SameSite=Lax, no Domain, 24 hours", async () => {
    const response = await signIn(https, HTTPS_ORIGIN, { username: "ada", password: PASSWORD });
    expect(response.statusCode).toBe(303);
    const lines = setCookieLines(response);
    expect(lines).toHaveLength(1);
    const attributes = lines[0]!.split(";").map((part) => part.trim());
    expect(attributes[0]).toMatch(/^__Host-diagramble-session=[A-Za-z0-9_-]+$/);
    expect(attributes).toContain("HttpOnly");
    expect(attributes).toContain("Secure");
    expect(attributes).toContain("Path=/");
    expect(attributes).toContain("SameSite=Lax");
    expect(attributes).toContain("Max-Age=86400");
    expect(attributes.some((a) => a.toLowerCase().startsWith("domain"))).toBe(false);
    expect(cookieOf(response, HTTPS_COOKIE)?.domain).toBeUndefined();
  });

  test("over http on localhost: diagramble-session, HttpOnly, not Secure, otherwise the same", async () => {
    const response = await signIn(http, HTTP_ORIGIN, { username: "ada", password: PASSWORD });
    expect(response.statusCode).toBe(303);
    const lines = setCookieLines(response);
    expect(lines).toHaveLength(1);
    const attributes = lines[0]!.split(";").map((part) => part.trim());
    expect(attributes[0]).toMatch(/^diagramble-session=[A-Za-z0-9_-]+$/);
    expect(attributes).toContain("HttpOnly");
    expect(attributes).not.toContain("Secure");
    expect(attributes).toContain("Path=/");
    expect(attributes).toContain("SameSite=Lax");
    expect(attributes).toContain("Max-Age=86400");
    expect(attributes.some((a) => a.toLowerCase().startsWith("domain"))).toBe(false);
  });

  test("a failed sign-in sets no cookie", async () => {
    const response = await signIn(https, HTTPS_ORIGIN, { username: "ada", password: "wrong" });
    expect(setCookieLines(response)).toEqual([]);
  });

  test("the https server does not accept the plain cookie name", async () => {
    const token = await tokenFrom(https, HTTPS_ORIGIN, HTTPS_COOKIE);
    expect((await asking(https, HTTPS_COOKIE, token)).statusCode).toBe(200);
    expect((await asking(https, HTTP_COOKIE, token)).statusCode).toBe(401);
  });
});

describe("what the database holds", () => {
  test("the session id is the SHA-256 of the cookie's value, never the value", async () => {
    const token = await tokenFrom(https, HTTPS_ORIGIN, HTTPS_COOKIE);
    const rows = await testDb.db.selectFrom("sessions").selectAll().execute();
    const ids = rows.map((row) => row.id);
    expect(ids).toContain(sha256(token));
    expect(ids).not.toContain(token);
    for (const row of rows) {
      expect(JSON.stringify(row)).not.toContain(token);
    }
  });

  test("the stored id, which a copy of the database would give, opens no session", async () => {
    const token = await tokenFrom(https, HTTPS_ORIGIN, HTTPS_COOKIE);
    expect((await asking(https, HTTPS_COOKIE, token)).statusCode).toBe(200);
    expect((await asking(https, HTTPS_COOKIE, sha256(token))).statusCode).toBe(401);
  });
});

describe("a cookie that was not given out", () => {
  test("a forged value, an altered value and an empty value are refused", async () => {
    const token = await tokenFrom(https, HTTPS_ORIGIN, HTTPS_COOKIE);
    const last = token.slice(-1) === "A" ? "B" : "A";
    const altered = [
      token.slice(0, -1) + last,
      token.slice(1),
      `${token}x`,
      token.toUpperCase() === token ? token.toLowerCase() : token.toUpperCase(),
      Buffer.alloc(32, 7).toString("base64url"),
      "",
    ];
    for (const value of altered) {
      const response = await asking(https, HTTPS_COOKIE, value);
      expect(response.statusCode, `cookie value "${value}"`).toBe(401);
    }
    expect((await asking(https, HTTPS_COOKIE, token)).statusCode).toBe(200);
  });

  test("a new sign-in with an old cookie ends the old session", async () => {
    const old = await tokenFrom(https, HTTPS_ORIGIN, HTTPS_COOKIE);
    const again = await signIn(
      https,
      HTTPS_ORIGIN,
      { username: "grace", password: PASSWORD },
      { cookie: `${HTTPS_COOKIE}=${old}` },
    );
    const fresh = cookieOf(again, HTTPS_COOKIE)?.value;
    expect(fresh).toBeDefined();
    expect(fresh).not.toBe(old);
    expect((await asking(https, HTTPS_COOKIE, old)).statusCode).toBe(401);
    expect((await asking(https, HTTPS_COOKIE, fresh!)).statusCode).toBe(200);
    const ids = (await testDb.db.selectFrom("sessions").select("id").execute()).map((r) => r.id);
    expect(ids).not.toContain(sha256(old));
  });

  test("signing out ends the session on the server, so a copied cookie stops working", async () => {
    const token = await tokenFrom(https, HTTPS_ORIGIN, HTTPS_COOKIE);
    const out = await https.inject({
      method: "POST",
      url: "/sign-out",
      headers: { origin: HTTPS_ORIGIN, cookie: `${HTTPS_COOKIE}=${token}` },
    });
    expect(out.statusCode).toBe(303);
    const cleared = cookieOf(out, HTTPS_COOKIE);
    expect(cleared?.value).toBe("");
    expect(cleared?.path).toBe("/");
    expect(cleared?.domain).toBeUndefined();
    expect((await asking(https, HTTPS_COOKIE, token)).statusCode).toBe(401);
  });
});

describe("the session's lifetime", () => {
  test("works until 24 hours after sign-in and is refused at and after", async () => {
    const token = await tokenFrom(https, HTTPS_ORIGIN, HTTPS_COOKIE);
    const signedInAt = clock;
    for (const offset of [0, 1000, DAY_MS - 1000, DAY_MS - 1]) {
      clock = signedInAt + offset;
      expect((await asking(https, HTTPS_COOKIE, token)).statusCode, `at +${offset} ms`).toBe(200);
    }
    for (const offset of [DAY_MS, DAY_MS + 1, 2 * DAY_MS]) {
      clock = signedInAt + offset;
      expect((await asking(https, HTTPS_COOKIE, token)).statusCode, `at +${offset} ms`).toBe(401);
    }
  });

  test("using a session does not extend it", async () => {
    const token = await tokenFrom(https, HTTPS_ORIGIN, HTTPS_COOKIE);
    const signedInAt = clock;
    clock = signedInAt + DAY_MS - 60_000;
    expect((await asking(https, HTTPS_COOKIE, token)).statusCode).toBe(200);
    clock = signedInAt + DAY_MS;
    expect((await asking(https, HTTPS_COOKIE, token)).statusCode).toBe(401);
  });

  test("an expired session sent to the sign-in page does not count as signed in", async () => {
    const token = await tokenFrom(https, HTTPS_ORIGIN, HTTPS_COOKIE);
    clock += DAY_MS;
    const response = await https.inject({
      url: "/sign-in",
      headers: { cookie: `${HTTPS_COOKIE}=${token}` },
    });
    expect(response.statusCode).toBe(200);
  });
});

describe("a disabled account", () => {
  test("cannot sign in, even with the right password", async () => {
    await setDisabled(testDb.db, accounts.ada!.accountId, true);
    const response = await signIn(https, HTTPS_ORIGIN, { username: "ada", password: PASSWORD });
    expect(response.statusCode).toBe(401);
    expect(setCookieLines(response)).toEqual([]);
  });

  test("loses the session it already had", async () => {
    const token = await tokenFrom(https, HTTPS_ORIGIN, HTTPS_COOKIE);
    expect((await asking(https, HTTPS_COOKIE, token)).statusCode).toBe(200);
    await setDisabled(testDb.db, accounts.ada!.accountId, true);
    expect((await asking(https, HTTPS_COOKIE, token)).statusCode).toBe(401);
    const page = await https.inject({
      url: "/",
      headers: { accept: "text/html", cookie: `${HTTPS_COOKIE}=${token}` },
    });
    expect(page.statusCode).toBe(303);
    expect(page.headers.location).toBe("/sign-in");
  });
});

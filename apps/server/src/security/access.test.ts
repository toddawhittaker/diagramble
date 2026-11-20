// Who may reach what (SPEC.md section 1, "Sign-in"): signed out, only the sign-in page, its
// stylesheet, the sign-in and sign-out requests and the health check answer.

import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createTestDb, type TestDb } from "../db/testing.ts";
import { buildServer } from "../server.ts";
import {
  HTTPS_COOKIE,
  HTTPS_ORIGIN,
  makeAccounts,
  makeSettings,
  makeStaticDir,
  sessionToken,
  STATIC_PATHS,
} from "./harness.ts";

let testDb: TestDb;
let app: FastifyInstance;
let token: string;

beforeAll(async () => {
  testDb = await createTestDb();
  const accounts = await makeAccounts(testDb.db, ["ada"]);
  app = await buildServer({
    db: testDb.db,
    settings: makeSettings(HTTPS_ORIGIN, makeStaticDir()),
  });
  token = await sessionToken(testDb.db, accounts.ada!, Date.now());
});

afterAll(async () => {
  await app.close();
  await testDb.drop();
});

// Every path a signed-out person must not get anything from, with the open paths' near
// neighbours: other case, a trailing slash and a query string do not make a path open.
const CLOSED_PATHS = [
  ...STATIC_PATHS,
  "/no/such/page",
  "/sign-in/",
  "/SIGN-IN",
  "/sign-in.css/",
  "/health/",
  "/app.js?/sign-in",
  "/assets/",
  "/sign-out",
];

describe("signed out", () => {
  test.each(CLOSED_PATHS)("GET %s as a page request goes to the sign-in page", async (url) => {
    const response = await app.inject({ url, headers: { accept: "text/html,application/xhtml+xml" } });
    expect(response.statusCode).toBe(303);
    expect(response.headers.location).toBe("/sign-in");
    expect(response.body).toBe("");
  });

  test.each(CLOSED_PATHS)("GET %s for anything else gets 401", async (url) => {
    for (const accept of [undefined, "application/json", "*/*"]) {
      const headers: Record<string, string> = {};
      if (accept) headers.accept = accept;
      const response = await app.inject({ url, headers });
      expect(response.statusCode, `${url} accepting ${accept}`).toBe(401);
      expect(response.body).not.toContain("Preview");
      expect(response.body).not.toContain("console.log");
    }
  });

  test.each(STATIC_PATHS)("HEAD %s is refused too", async (url) => {
    const response = await app.inject({ method: "HEAD", url });
    expect(response.statusCode).toBe(401);
  });

  test("a cookie that opens no session is the same as no cookie", async () => {
    const response = await app.inject({
      url: "/app.js",
      headers: { cookie: `${HTTPS_COOKIE}=not-a-session` },
    });
    expect(response.statusCode).toBe(401);
  });

  test.each(["/sign-in", "/sign-in.css", "/health"])("GET %s is open", async (url) => {
    const response = await app.inject({ url, headers: { accept: "text/html" } });
    expect(response.statusCode).toBe(200);
  });

  test("the open paths still answer with a query string", async () => {
    expect((await app.inject({ url: "/sign-in?x=1" })).statusCode).toBe(200);
    expect((await app.inject({ url: "/health?x=1" })).statusCode).toBe(200);
  });

  test("POST /sign-out works signed out, to the sign-in page", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/sign-out",
      headers: { origin: HTTPS_ORIGIN },
    });
    expect(response.statusCode).toBe(303);
    expect(response.headers.location).toBe("/sign-in");
  });
});

describe("signed in", () => {
  const cookie = () => ({ cookie: `${HTTPS_COOKIE}=${token}` });

  test("the page and its files are served", async () => {
    const page = await app.inject({ url: "/", headers: cookie() });
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain("Preview");
    const script = await app.inject({ url: "/app.js", headers: cookie() });
    expect(script.statusCode).toBe(200);
    expect(script.body).toContain("console.log");
    const nested = await app.inject({ url: "/assets/style.css", headers: cookie() });
    expect(nested.statusCode).toBe(200);
    expect(nested.body).toContain("margin");
  });

  test("an unknown path is not found, not refused", async () => {
    const response = await app.inject({ url: "/no/such/page", headers: cookie() });
    expect(response.statusCode).toBe(404);
  });

  test("the sign-in page sends a signed-in person on to /", async () => {
    const response = await app.inject({ url: "/sign-in", headers: cookie() });
    expect(response.statusCode).toBe(303);
    expect(response.headers.location).toBe("/");
  });
});

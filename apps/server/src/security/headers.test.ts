// The headers every reply carries (SPEC.md section 1, "Host names" and "Sign-in"): a
// Referrer-Policy that keeps a same-origin form's Origin header, and a policy that stops
// the app being framed.

import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createTestDb, type TestDb } from "../db/testing.ts";
import { buildServer } from "../server.ts";
import {
  HTTPS_COOKIE,
  HTTPS_ORIGIN,
  makeAccounts,
  makeSettings,
  makeStaticDir,
  PASSWORD,
  sessionToken,
  signIn,
} from "./harness.ts";

const PAGE_POLICY = [
  "default-src 'none'",
  "style-src 'self'",
  "img-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
];

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

const directives = (response: LightMyRequestResponse): string[] =>
  String(response.headers["content-security-policy"] ?? "")
    .split(";")
    .map((d) => d.trim())
    .filter(Boolean);

const replies: [string, () => Promise<LightMyRequestResponse>, number][] = [
  ["the sign-in page", () => app.inject({ url: "/sign-in" }), 200],
  ["the sign-in stylesheet", () => app.inject({ url: "/sign-in.css" }), 200],
  ["the health check", () => app.inject({ url: "/health" }), 200],
  [
    "a static file",
    () => app.inject({ url: "/app.js", headers: { cookie: `${HTTPS_COOKIE}=${token}` } }),
    200,
  ],
  [
    "the app's page",
    () => app.inject({ url: "/", headers: { cookie: `${HTTPS_COOKIE}=${token}` } }),
    200,
  ],
  ["a 401", () => app.inject({ url: "/app.js" }), 401],
  [
    "a 303 to the sign-in page",
    () => app.inject({ url: "/", headers: { accept: "text/html" } }),
    303,
  ],
  [
    "a 403",
    () => app.inject({ method: "POST", url: "/sign-in", headers: { origin: "null" } }),
    403,
  ],
  [
    "a 404",
    () =>
      app.inject({ url: "/no/such/page", headers: { cookie: `${HTTPS_COOKIE}=${token}` } }),
    404,
  ],
  [
    "a failed sign-in",
    () => signIn(app, HTTPS_ORIGIN, { username: "ada", password: `${PASSWORD}!` }),
    401,
  ],
  [
    "a sign-out",
    () => app.inject({ method: "POST", url: "/sign-out", headers: { origin: HTTPS_ORIGIN } }),
    303,
  ],
];

describe("every reply", () => {
  test.each(replies)("%s carries the referrer policy and refuses framing", async (_name, send, status) => {
    const response = await send();
    expect(response.statusCode).toBe(status);
    expect(response.headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(directives(response)).toContain("frame-ancestors 'none'");
  });
});

describe("the sign-in page's policy", () => {
  test("is exactly its own stylesheet and form, nothing else", async () => {
    const response = await app.inject({ url: "/sign-in" });
    expect(directives(response).sort()).toEqual([...PAGE_POLICY].sort());
  });

  test("a failed sign-in, which shows the same page, carries the same policy", async () => {
    const response = await signIn(app, HTTPS_ORIGIN, { username: "ada", password: "wrong" });
    expect(directives(response).sort()).toEqual([...PAGE_POLICY].sort());
  });
});

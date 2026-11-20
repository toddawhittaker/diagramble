// The sign-in POST (SPEC.md section 1, "Sign-in"): every failure looks the same, and a
// success goes to / and nowhere else.

import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { setDisabled } from "../accounts/store.ts";
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

const SENTENCE = "That username and password do not match.";

const limitless = {
  attempt: () => ({ refused: false as const, delayMs: 0 }),
  succeeded: () => {},
};

let testDb: TestDb;
let app: FastifyInstance;

beforeAll(async () => {
  testDb = await createTestDb();
  const accounts = await makeAccounts(testDb.db, ["ada", "retired"]);
  await setDisabled(testDb.db, accounts.retired!.accountId, true);
  app = await buildServer({
    db: testDb.db,
    settings: makeSettings(HTTPS_ORIGIN, makeStaticDir()),
    limiter: limitless,
  });
});

afterAll(async () => {
  await app.close();
  await testDb.drop();
});

/** The page with the username the form echoes back removed, so replies can be compared. */
const withoutUsername = (body: string) => body.replace(/value="[^"]*"/g, 'value=""');

describe("a failed sign-in", () => {
  const failures: [string, Record<string, string>][] = [
    ["a wrong password", { username: "ada", password: "not the password" }],
    ["an unknown username", { username: "nobody", password: PASSWORD }],
    ["an invalid username", { username: "../ada", password: PASSWORD }],
    ["a disabled account with the right password", { username: "retired", password: PASSWORD }],
    ["a disabled account with a wrong password", { username: "retired", password: "wrong" }],
  ];

  test("gives the same status, sentence and page for every cause", async () => {
    const replies = await Promise.all(failures.map(([, body]) => signIn(app, HTTPS_ORIGIN, body)));
    for (const [index, reply] of replies.entries()) {
      const label = failures[index]![0];
      expect(reply.statusCode, label).toBe(401);
      expect(reply.body, label).toContain(SENTENCE);
      expect(reply.headers["content-type"], label).toBe(replies[0]!.headers["content-type"]);
      expect(reply.headers.location, label).toBeUndefined();
      expect(setCookieLines(reply), label).toEqual([]);
      expect(withoutUsername(reply.body), label).toBe(withoutUsername(replies[0]!.body));
    }
  });

  test("names no cause in the page", async () => {
    const reply = await signIn(app, HTTPS_ORIGIN, { username: "retired", password: PASSWORD });
    for (const word of ["disabled", "unknown", "exist", "not found", "locked"]) {
      expect(reply.body.toLowerCase()).not.toContain(word);
    }
  });
});

describe("a successful sign-in goes to / and nowhere else", () => {
  test("with no other field", async () => {
    const reply = await signIn(app, HTTPS_ORIGIN, { username: "ada", password: PASSWORD });
    expect(reply.statusCode).toBe(303);
    expect(reply.headers.location).toBe("/");
  });

  test.each(["next", "redirect", "redirect_to", "return", "returnTo", "return_to", "url", "continue"])(
    "a %s field in the body or the query string is not honoured",
    async (name) => {
      const evil = "https://evil.example/steal";
      const inBody = await signIn(app, HTTPS_ORIGIN, {
        username: "ada",
        password: PASSWORD,
        [name]: evil,
      });
      expect(inBody.statusCode).toBe(303);
      expect(inBody.headers.location).toBe("/");

      const inQuery = await app.inject({
        method: "POST",
        url: `/sign-in?${name}=${encodeURIComponent(evil)}`,
        headers: {
          origin: HTTPS_ORIGIN,
          "content-type": "application/x-www-form-urlencoded",
          referer: `${HTTPS_ORIGIN}/sign-in?${name}=${encodeURIComponent(evil)}`,
        },
        payload: new URLSearchParams({ username: "ada", password: PASSWORD }).toString(),
      });
      expect(inQuery.statusCode).toBe(303);
      expect(inQuery.headers.location).toBe("/");
    },
  );

  test("the sign-in page for a signed-in person goes to / whatever the query string says", async () => {
    const reply = await signIn(app, HTTPS_ORIGIN, { username: "ada", password: PASSWORD });
    const token = cookieOf(reply, HTTPS_COOKIE)!.value;
    const page = await app.inject({
      url: "/sign-in?next=https://evil.example/",
      headers: { cookie: `${HTTPS_COOKIE}=${token}` },
    });
    expect(page.statusCode).toBe(303);
    expect(page.headers.location).toBe("/");
  });

  test("the sign-in page has no field that names a place to go", async () => {
    const page = await app.inject({ url: "/sign-in?next=https://evil.example/" });
    expect(page.statusCode).toBe(200);
    expect(page.body).not.toContain("evil.example");
    expect(page.body).not.toMatch(/name="(next|redirect|return|url|continue)/i);
  });
});

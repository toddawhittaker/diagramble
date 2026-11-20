// The Origin rule of SPEC.md section 1, "Host names", on every route that changes
// anything. The routes are collected as the server registers them, so a route a later
// epic adds is covered without editing this file.

import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { createTestDb, type TestDb } from "../db/testing.ts";
import { buildServer } from "../server.ts";
import {
  FORM,
  HTTPS_COOKIE,
  HTTPS_ORIGIN,
  makeAccounts,
  makeSettings,
  makeStaticDir,
  sessionToken,
} from "./harness.ts";

interface Registered {
  method: string;
  url: string;
}

const registered = vi.hoisted((): Registered[] => []);

vi.mock("fastify", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fastify")>();
  const create = actual.default as unknown as (...args: unknown[]) => FastifyInstance;
  const wrapped = (...args: unknown[]) => {
    const app = create(...args);
    app.addHook("onRoute", (route) => {
      const methods = Array.isArray(route.method) ? route.method : [route.method];
      for (const method of methods) registered.push({ method, url: route.url });
    });
    return app;
  };
  return { ...actual, default: Object.assign(wrapped, actual.default) };
});

const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];

let testDb: TestDb;
let app: FastifyInstance;
let changingRoutes: Registered[];
let token: string;
let clock = Date.now();

beforeAll(async () => {
  testDb = await createTestDb();
  const accounts = await makeAccounts(testDb.db, ["ada"]);
  app = await buildServer({
    db: testDb.db,
    settings: makeSettings(HTTPS_ORIGIN, makeStaticDir()),
    now: () => clock,
  });
  token = await sessionToken(testDb.db, accounts.ada!, clock);
  const seen = new Set<string>();
  changingRoutes = registered.filter((route) => {
    const key = `${route.method} ${route.url}`;
    if (SAFE_METHODS.includes(route.method) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
});

afterAll(async () => {
  await app.close();
  await testDb.drop();
});

/** A URL a request can really use: parameters and wildcards filled in. */
function concrete(url: string): string {
  return url.replace(/:[A-Za-z_]\w*/g, "x").replace(/\*/g, "x");
}

function send(
  route: Registered,
  origin: string | undefined,
  signedIn: boolean,
): Promise<LightMyRequestResponse> {
  const headers: Record<string, string> = { "content-type": FORM };
  if (origin !== undefined) headers.origin = origin;
  if (signedIn) headers.cookie = `${HTTPS_COOKIE}=${token}`;
  return app.inject({
    method: route.method as "POST",
    url: concrete(route.url),
    headers,
    payload: route.method === "DELETE" ? undefined : "a=b",
  });
}

const REFUSED_ORIGINS: [string, string | undefined][] = [
  ["another Origin", "https://files.example.edu"],
  ["a longer host that starts with the app's host", "https://app.example.edu.evil.test"],
  ["Origin: null", "null"],
  ["no Origin", undefined],
  ["the same host over the other scheme", "http://app.example.edu"],
  ["the same host on another port", "https://app.example.edu:8443"],
  ["the same host with a trailing slash", "https://app.example.edu/"],
  ["the same host in another case", "https://APP.EXAMPLE.EDU"],
  ["an empty Origin", ""],
];

describe.each([
  ["signed out", false],
  ["signed in", true],
])("the Origin rule, %s", (_label, signedIn) => {
  test("the routes that change anything are found, and include sign-in and sign-out", () => {
    expect(changingRoutes.length).toBeGreaterThan(0);
    const keys = changingRoutes.map((r) => `${r.method} ${r.url}`);
    expect(keys).toContain("POST /sign-in");
    expect(keys).toContain("POST /sign-out");
  });

  test("a matching Origin passes the check on every such route", async () => {
    for (const route of changingRoutes) {
      const response = await send(route, HTTPS_ORIGIN, signedIn);
      expect(response.statusCode, `${route.method} ${route.url}`).not.toBe(403);
    }
  });

  test.each(REFUSED_ORIGINS)("%s gets 403 on every such route", async (label, origin) => {
    for (const route of changingRoutes) {
      const response = await send(route, origin, signedIn);
      expect(response.statusCode, `${route.method} ${route.url} with ${label}`).toBe(403);
      expect(response.headers["set-cookie"], `${route.method} ${route.url}`).toBeUndefined();
    }
  });

  test.each(["POST", "PUT", "PATCH", "DELETE"] as const)(
    "%s to a path no route handles still needs the Origin",
    async (method) => {
      const headers: Record<string, string> = {};
      if (signedIn) headers.cookie = `${HTTPS_COOKIE}=${token}`;
      const refused = await app.inject({ method, url: "/no/such/route", headers });
      expect(refused.statusCode).toBe(403);
      const wrong = await app.inject({
        method,
        url: "/no/such/route",
        headers: { ...headers, origin: "https://files.example.edu" },
      });
      expect(wrong.statusCode).toBe(403);
      const matching = await app.inject({
        method,
        url: "/no/such/route",
        headers: { ...headers, origin: HTTPS_ORIGIN },
      });
      expect(matching.statusCode).not.toBe(403);
    },
  );

  test.each(["PUT", "PATCH", "DELETE"] as const)(
    "%s to the sign-in path with another Origin is refused, not routed",
    async (method) => {
      const headers: Record<string, string> = { origin: "null" };
      if (signedIn) headers.cookie = `${HTTPS_COOKIE}=${token}`;
      const response = await app.inject({ method, url: "/sign-in", headers });
      expect(response.statusCode).toBe(403);
    },
  );
});

test("a request that only reads is not held to the Origin rule", async () => {
  const response = await app.inject({
    url: "/health",
    headers: { origin: "https://files.example.edu" },
  });
  expect(response.statusCode).toBe(200);
});

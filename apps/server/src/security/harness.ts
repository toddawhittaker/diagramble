// Shared set-up for the security tests: a server over a throwaway database, accounts
// made through the store, and sessions started without the cost of a password check.

import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import type { Kysely } from "kysely";
import { hashPassword } from "../accounts/password.ts";
import { startSession } from "../accounts/sessions.ts";
import { createPasswordAccount } from "../accounts/store.ts";
import type { Database } from "../db/schema.ts";
import type { Settings } from "../settings.ts";

export const HTTPS_ORIGIN = "https://app.example.edu";
export const HTTP_ORIGIN = "http://localhost:3000";
export const HTTPS_COOKIE = "__Host-diagramble-session";
export const HTTP_COOKIE = "diagramble-session";
export const PASSWORD = "correct horse battery staple";
export const FORM = "application/x-www-form-urlencoded";

/** A folder of files to serve behind the sign-in: a page, a script and a nested file. */
export function makeStaticDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "diagramble-security-"));
  writeFileSync(path.join(dir, "index.html"), "<!doctype html><title>Preview</title>");
  writeFileSync(path.join(dir, "app.js"), "console.log('preview');");
  mkdirSync(path.join(dir, "assets"));
  writeFileSync(path.join(dir, "assets", "style.css"), "body { margin: 0 }");
  return dir;
}

/** The files `makeStaticDir` makes, as served paths. */
export const STATIC_PATHS = ["/", "/index.html", "/app.js", "/assets/style.css"];

export function makeSettings(
  appOrigin: string,
  staticDir: string,
  trustProxyHops = 0,
): Settings {
  return { databaseUrl: "postgres://unused/x", appOrigin, port: 0, trustProxyHops, staticDir };
}

/** Make a password account for each username, all with `PASSWORD`. */
export async function makeAccounts(
  db: Kysely<Database>,
  usernames: string[],
): Promise<Record<string, { accountId: string; methodId: string }>> {
  const hash = await hashPassword(PASSWORD);
  const made: Record<string, { accountId: string; methodId: string }> = {};
  for (const username of usernames) {
    made[username] = await createPasswordAccount(db, username, hash);
  }
  return made;
}

/** A session token for an account, made at `now` without a password check. */
export function sessionToken(
  db: Kysely<Database>,
  account: { accountId: string; methodId: string },
  now: number,
): Promise<string> {
  return startSession(db, account, new Date(now));
}

/** POST /sign-in with a matching Origin unless the headers say otherwise. */
export function signIn(
  app: FastifyInstance,
  origin: string,
  body: Record<string, string>,
  headers: Record<string, string> = {},
): Promise<LightMyRequestResponse> {
  return app.inject({
    method: "POST",
    url: "/sign-in",
    headers: { origin, "content-type": FORM, ...headers },
    payload: new URLSearchParams(body).toString(),
  });
}

/** The cookie a reply sets under `name`, if it sets one. */
export function cookieOf(response: LightMyRequestResponse, name: string) {
  return response.cookies.find((c) => c.name === name);
}

/** The raw `Set-Cookie` header lines of a reply. */
export function setCookieLines(response: LightMyRequestResponse): string[] {
  const raw = response.headers["set-cookie"];
  if (raw === undefined) return [];
  return Array.isArray(raw) ? raw : [raw];
}

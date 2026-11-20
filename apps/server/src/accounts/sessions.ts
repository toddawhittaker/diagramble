// Sessions of SPEC.md section 1, "Sign-in": the cookie holds a random token and the
// database only its hash, so a copy of the database opens no session.

import { createHash, randomBytes } from "node:crypto";
import type { CookieSerializeOptions } from "@fastify/cookie";
import type { Kysely } from "kysely";
import type { Database } from "../db/schema.ts";
import type { Settings } from "../settings.ts";
import { createSession, deleteSession, loadSession } from "./store.ts";

/** A session lasts this long from sign-in, however much it is used. */
export const SESSION_SECONDS = 24 * 60 * 60;

/** A new session token: 32 random bytes in base64url. */
export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

/** The session's id: the SHA-256 of its token, in lowercase hex. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function isHttps(settings: Pick<Settings, "appOrigin">): boolean {
  return settings.appOrigin.startsWith("https:");
}

/**
 * Over https the cookie carries the `__Host-` prefix, which browsers accept only
 * when it is Secure, Path=/ and has no Domain, so it stays host-only (SPEC.md
 * section 1, "Host names").
 */
export function cookieName(settings: Pick<Settings, "appOrigin">): string {
  return isHttps(settings) ? "__Host-diagramble-session" : "diagramble-session";
}

export function cookieOptions(settings: Pick<Settings, "appOrigin">): CookieSerializeOptions {
  return {
    httpOnly: true,
    secure: isHttps(settings),
    path: "/",
    sameSite: "lax",
    maxAge: SESSION_SECONDS,
  };
}

/**
 * The options of a session made by a Canvas launch (SPEC.md section 1, "Canvas launch"):
 * SameSite=None so the cookie travels inside Canvas's frame, and Partitioned so the
 * browser keeps it only under the site that framed the app. Always Secure, which
 * SameSite=None requires; browsers treat localhost as secure.
 */
export function launchCookieOptions(): CookieSerializeOptions {
  return {
    httpOnly: true,
    secure: true,
    path: "/",
    sameSite: "none",
    partitioned: true,
    maxAge: SESSION_SECONDS,
  };
}

/** Start a session for a sign-in method and return its token. */
export async function startSession(
  db: Kysely<Database>,
  method: { accountId: string; methodId: string },
  now: Date,
): Promise<string> {
  const token = newToken();
  await createSession(db, {
    id: hashToken(token),
    accountId: method.accountId,
    methodId: method.methodId,
    expiresAt: new Date(now.getTime() + SESSION_SECONDS * 1000),
  });
  return token;
}

/** The person behind a token, or `undefined` for an unknown, expired or disabled one. */
export function sessionFor(
  db: Kysely<Database>,
  token: string,
  now: Date,
): Promise<{ accountId: string; methodId: string; login: string } | undefined> {
  return loadSession(db, hashToken(token), now);
}

/** End the session of a token, if there is one. */
export function endSession(db: Kysely<Database>, token: string): Promise<void> {
  return deleteSession(db, hashToken(token));
}

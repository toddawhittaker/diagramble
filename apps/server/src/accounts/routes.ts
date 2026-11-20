// Signing in and out (SPEC.md section 1, "Sign-in"). Every failure gives the same
// reply, so it does not reveal whether a username exists or is disabled.

import type { FastifyInstance, FastifyReply } from "fastify";
import type { Kysely } from "kysely";
import { z } from "zod";
import type { Database } from "../db/schema.ts";
import type { Settings } from "../settings.ts";
import { normalizeUsername, verifyAgainstDummy, verifyPassword } from "./password.ts";
import { cookieName, cookieOptions, endSession, startSession } from "./sessions.ts";
import { addressKey, type createSignInLimiter } from "./sign-in-limit.ts";
import { renderSignInPage, signInCss } from "./sign-in-page.ts";
import { findPasswordMethod } from "./store.ts";

export const NO_MATCH = "That username and password do not match.";
export const REFUSED =
  "There have been too many failed sign-ins. Wait a few minutes, then try again.";

/** The sign-in page's own policy: its stylesheet and form, nothing else. */
const PAGE_POLICY =
  "default-src 'none'; style-src 'self'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'";

const signInBody = z.object({
  username: z.string(),
  password: z.string().max(1024),
});

function sendPage(reply: FastifyReply, page: { username?: string; message?: string }): FastifyReply {
  return reply
    .header("content-security-policy", PAGE_POLICY)
    .type("text/html; charset=utf-8")
    .send(renderSignInPage(page));
}

function rawUsername(body: unknown): string {
  const value = (body as { username?: unknown } | null | undefined)?.username;
  return typeof value === "string" ? value : "";
}

/**
 * The sign-in method the body's password opens, if its account is enabled. It hashes
 * once whatever the body holds, so the time taken does not tell an unknown username.
 */
async function methodOpened(
  db: Kysely<Database>,
  body: unknown,
): Promise<{ accountId: string; methodId: string } | undefined> {
  const parsed = signInBody.safeParse(body);
  const username = parsed.success ? normalizeUsername(parsed.data.username) : undefined;
  if (!parsed.success || username === undefined) {
    await verifyAgainstDummy(parsed.success ? parsed.data.password : "");
    return undefined;
  }
  const method = await findPasswordMethod(db, username);
  if (!method) {
    await verifyAgainstDummy(parsed.data.password);
    return undefined;
  }
  const matches = await verifyPassword(parsed.data.password, method.passwordHash);
  return matches && !method.disabled ? method : undefined;
}

export function accountRoutes(
  app: FastifyInstance,
  {
    db,
    settings,
    now,
    limiter,
  }: {
    db: Kysely<Database>;
    settings: Settings;
    now: () => number;
    limiter: ReturnType<typeof createSignInLimiter>;
  },
): void {
  const cookie = cookieName(settings);
  const options = cookieOptions(settings);

  app.get("/sign-in", async (request, reply) => {
    if (request.signedIn) return reply.code(303).header("location", "/").send();
    return sendPage(reply, {});
  });

  app.get("/sign-in.css", async (_request, reply) =>
    reply.type("text/css; charset=utf-8").send(signInCss),
  );

  app.post("/sign-in", async (request, reply) => {
    const username = rawUsername(request.body);
    const limitKey = normalizeUsername(username) ?? username.toLowerCase();
    const address = addressKey(request.ip);

    const limit = limiter.check(limitKey, address);
    if (limit.refused) {
      reply.code(429).header("retry-after", String(limit.retryAfterSeconds));
      return sendPage(reply, { username, message: REFUSED });
    }

    const method = await methodOpened(db, request.body);
    if (!method) {
      limiter.recordFailure(limitKey, address);
      await new Promise((resolve) => setTimeout(resolve, limit.delayMs));
      return sendPage(reply.code(401), { username, message: NO_MATCH });
    }

    limiter.recordSuccess(limitKey);
    const sent = request.cookies[cookie];
    if (sent) await endSession(db, sent);
    const token = await startSession(db, method, new Date(now()));
    return reply.setCookie(cookie, token, options).code(303).header("location", "/").send();
  });

  app.post("/sign-out", async (request, reply) => {
    const sent = request.cookies[cookie];
    if (sent) await endSession(db, sent);
    const { maxAge: _maxAge, ...clear } = options;
    return reply.clearCookie(cookie, clear).code(303).header("location", "/sign-in").send();
  });
}

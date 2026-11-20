// The guard every request passes first: the headers, the Origin check and the session
// lookup of SPEC.md section 1, "Sign-in" and "Host names".

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Kysely } from "kysely";
import { cookieName, sessionFor } from "./accounts/sessions.ts";
import type { Database } from "./db/schema.ts";
import type { Settings } from "./settings.ts";

/** Who a request is signed in as. */
export interface SignedIn {
  accountId: string;
  methodId: string;
  login: string;
}

declare module "fastify" {
  interface FastifyRequest {
    signedIn: SignedIn | null;
  }
}

/** Routes, as "METHOD url", that a signed-out person may reach. A GET route also covers HEAD. */
export const OPEN_ROUTES: readonly string[] = [
  "GET /sign-in",
  "POST /sign-in",
  "GET /sign-in.css",
  "GET /health",
  // Sign-out only ends a session, so it needs none; an expired cookie still gets cleared.
  "POST /sign-out",
];

/** Routes, as "METHOD url", that prove themselves another way and skip the Origin check. */
export const ORIGIN_EXEMPT_ROUTES: readonly string[] = [];

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** The routed URL, never the raw one, so a query string or path trick cannot match. */
function routeKey(request: FastifyRequest): string | undefined {
  const url = request.routeOptions.url;
  if (url === undefined) return undefined;
  const method = request.method === "HEAD" ? "GET" : request.method;
  return `${method} ${url}`;
}

function isOpen(request: FastifyRequest): boolean {
  const key = routeKey(request);
  return key !== undefined && OPEN_ROUTES.includes(key);
}

/**
 * Every request that can change something must carry an Origin equal to the app's
 * own, signed in or not; `null` and a missing one are refused.
 */
function originAllowed(request: FastifyRequest, appOrigin: string): boolean {
  if (SAFE_METHODS.has(request.method)) return true;
  const key = routeKey(request);
  if (key !== undefined && ORIGIN_EXEMPT_ROUTES.includes(key)) return true;
  return request.headers.origin === appOrigin;
}

function refuseSignedOut(request: FastifyRequest, reply: FastifyReply): FastifyReply {
  const html = request.headers.accept?.includes("text/html") ?? false;
  if ((request.method === "GET" || request.method === "HEAD") && html) {
    return reply.code(303).header("location", "/sign-in").send();
  }
  return reply.code(401).type("text/plain; charset=utf-8").send("Sign in to continue.");
}

export function installGuard(
  app: FastifyInstance,
  { db, settings, now }: { db: Kysely<Database>; settings: Settings; now: () => number },
): void {
  const cookie = cookieName(settings);
  // Over https, browsers are told to use nothing else for a year (SPEC.md section 1, "Host names").
  const https = settings.appOrigin.startsWith("https:");
  app.decorateRequest("signedIn", null);

  app.addHook("onRequest", async (request, reply) => {
    reply.header("referrer-policy", "strict-origin-when-cross-origin");
    reply.header("x-content-type-options", "nosniff");
    reply.header("content-security-policy", "frame-ancestors 'none'");
    if (https) reply.header("strict-transport-security", "max-age=31536000");

    if (!originAllowed(request, settings.appOrigin)) {
      return reply
        .code(403)
        .type("text/plain; charset=utf-8")
        .send("This request did not come from Diagramble's own pages, so it was refused.");
    }

    const token = request.cookies[cookie];
    if (token) {
      request.signedIn = (await sessionFor(db, token, new Date(now()))) ?? null;
    }

    if (!request.signedIn && !isOpen(request)) return refuseSignedOut(request, reply);
  });
}

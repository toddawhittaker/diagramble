// The web server of SPEC.md section 12: one Fastify instance, the guard before every
// route. A later epic adds its routes with one line here.

import cookie from "@fastify/cookie";
import formbody from "@fastify/formbody";
import Fastify, { type FastifyInstance } from "fastify";
import type { Kysely } from "kysely";
import { accountRoutes } from "./accounts/routes.ts";
import { createSignInLimiter } from "./accounts/sign-in-limit.ts";
import type { Database } from "./db/schema.ts";
import { installGuard } from "./guard.ts";
import { healthRoutes } from "./health.ts";
import type { Settings } from "./settings.ts";
import { staticFiles } from "./static.ts";

export interface ServerOptions {
  db: Kysely<Database>;
  settings: Settings;
  /** The clock, in milliseconds; the tests move it. */
  now?: () => number;
  limiter?: ReturnType<typeof createSignInLimiter>;
  logger?: boolean;
}

export async function buildServer({
  db,
  settings,
  now = Date.now,
  limiter = createSignInLimiter({ now }),
  logger = false,
}: ServerOptions): Promise<FastifyInstance> {
  const hops = settings.trustProxyHops;
  // Trust the nearest `hops` proxies, as a number would; Fastify's types take no number.
  const app = Fastify({ trustProxy: (_address, hop) => hop < hops, logger });
  await app.register(formbody);
  // Awaited so its cookie parsing runs before the guard's hook.
  await app.register(cookie);
  installGuard(app, { db, settings, now });
  healthRoutes(app, db);
  accountRoutes(app, { db, settings, now, limiter });
  await staticFiles(app, settings.staticDir);
  return app;
}

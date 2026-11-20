// The Canvas launch of SPEC.md section 1, "Canvas launch", and section 3.9: the
// LTI 1.3 login, the launch that signs a person in, and the tool's public key set.
// Registered only when the LTI_* settings are set.

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { createRemoteJWKSet, type JWTVerifyGetKey } from "jose";
import type { Kysely } from "kysely";
import { cookieName, endSession, launchCookieOptions, startSession } from "../accounts/sessions.ts";
import { createLtiAccount, findLtiMethod } from "../accounts/store.ts";
import type { Database } from "../db/schema.ts";
import type { Settings } from "../settings.ts";
import { isNavigation, startLogin } from "./login.ts";
import { refusalPolicy, renderRefusalPage } from "./pages.ts";
import type { LtiSettings } from "./settings.ts";
import { STATE_COOKIE, stateCookieOptions, statesMatch } from "./state.ts";
import { consumeLoginState, saveLoginState, upsertCourse, upsertMembership } from "./store.ts";
import { toolJwks } from "./tool-key.ts";
import { validateLaunch } from "./validate.ts";

/** Where the platform's public keys come from; the tests pass a local key set. */
export type KeySource = JWTVerifyGetKey;

/** The key set's own policy: it is data, never framed. */
const JWKS_POLICY = "default-src 'none'; frame-ancestors 'none'";

function field(body: unknown, name: string): string | undefined {
  const value = (body as Record<string, unknown> | null | undefined)?.[name];
  return typeof value === "string" ? value : undefined;
}

export function ltiRoutes(
  app: FastifyInstance,
  {
    db,
    settings,
    lti,
    now,
    keys = createRemoteJWKSet(new URL(lti.keysUrl)),
  }: {
    db: Kysely<Database>;
    settings: Settings;
    lti: LtiSettings;
    now: () => number;
    keys?: KeySource | undefined;
  },
): void {
  const sessionCookie = cookieName(settings);
  const platformOrigin = new URL(lti.authUrl).origin;
  const { maxAge: _maxAge, ...clearState } = stateCookieOptions;

  /** The refusal page, with the reason in the log line only. */
  function refuse(request: FastifyRequest, reply: FastifyReply, status: number, reason: string): FastifyReply {
    request.log.warn({ reason, statusCode: status }, "Canvas launch refused");
    return reply
      .code(status)
      .header("content-security-policy", refusalPolicy(lti.frameOrigins))
      .type("text/html; charset=utf-8")
      .send(renderRefusalPage());
  }

  async function login(request: FastifyRequest, reply: FastifyReply, params: unknown): Promise<FastifyReply> {
    if (!isNavigation(request.headers)) return refuse(request, reply, 400, "not a navigation");
    const started = startLogin((params ?? {}) as Record<string, unknown>, lti, settings.appOrigin);
    if (!started.ok) return refuse(request, reply, 400, started.reason);
    await saveLoginState(db, { state: started.state, nonce: started.nonce }, new Date(now()));
    return reply
      .setCookie(STATE_COOKIE, started.state, stateCookieOptions)
      .code(request.method === "GET" ? 302 : 303)
      .header("location", started.redirectUrl)
      .send();
  }

  app.get("/lti/login", (request, reply) => login(request, reply, request.query));
  app.post("/lti/login", (request, reply) => login(request, reply, request.body));

  app.post("/lti/launch", async (request, reply) => {
    // The guard exempts this route from the app's own Origin; only the platform's will do.
    if (request.headers.origin !== platformOrigin) return refuse(request, reply, 403, "wrong origin");
    const state = field(request.body, "state");
    if (!statesMatch(request.cookies[STATE_COOKIE], state)) {
      return refuse(request, reply, 401, "state cookie does not match");
    }
    const nonce = await consumeLoginState(db, state as string, new Date(now()));
    if (nonce === undefined) return refuse(request, reply, 401, "state unknown, used or expired");
    const idToken = field(request.body, "id_token") ?? "";
    const checked = await validateLaunch(idToken, { settings: lti, keys, nonce, now: new Date(now()) });
    if (!checked.ok) return refuse(request, reply, 401, checked.reason);
    const { launch } = checked;
    if (!launch.context) return refuse(request, reply, 401, "no course context");

    const method =
      (await findLtiMethod(db, launch.issuer, launch.subject)) ??
      (await createLtiAccount(db, {
        issuer: launch.issuer,
        subject: launch.subject,
        loginId: launch.loginId,
        email: launch.email,
      }));
    if (method.disabled) return refuse(request, reply, 403, "account disabled");

    const courseId = await upsertCourse(db, {
      issuer: launch.issuer,
      contextId: launch.context.id,
      title: launch.context.title,
    });
    await upsertMembership(db, { courseId, accountId: method.accountId, role: launch.role });

    const sent = request.cookies[sessionCookie];
    if (sent) await endSession(db, sent);
    const token = await startSession(db, method, new Date(now()));
    return reply
      .setCookie(sessionCookie, token, launchCookieOptions())
      .clearCookie(STATE_COOKIE, clearState)
      .code(303)
      .header("location", `/?course=${encodeURIComponent(courseId)}`)
      .send();
  });

  app.get("/lti/jwks", async (_request, reply) =>
    reply.header("content-security-policy", JWKS_POLICY).send(await toolJwks(lti.toolKey)),
  );
}

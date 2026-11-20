// The Canvas launch of SPEC.md section 1, "Canvas launch", and section 3.9: the
// LTI 1.3 login, the launch that signs a person in, and the tool's public key set.
// Registered only when the LTI_* settings are set.

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { createRemoteJWKSet, type JWTVerifyGetKey } from "jose";
import type { Kysely } from "kysely";
import { clearingOptions, cookieName, cookieOptions, endSession, launchCookieOptions, startSession } from "../accounts/sessions.ts";
import { createLtiAccount, findLtiMethod } from "../accounts/store.ts";
import type { Database } from "../db/schema.ts";
import type { Settings } from "../settings.ts";
import { isNavigation, type LtiLoginParams, startLogin } from "./login.ts";
import { refusalPolicy, renderRefusalPage } from "./pages.ts";
import type { LtiSettings } from "./settings.ts";
import { checkLaunchState, stateCookieName, stateCookieOptions } from "./state.ts";
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
  // The launch comes from the platform's sign-in page or from a page that frames the
  // app, never from the app itself (SPEC.md section 1, "Canvas launch").
  const launchOrigins = new Set([new URL(lti.authUrl).origin, ...lti.frameOrigins]);
  launchOrigins.delete(settings.appOrigin);
  const stateCookie = stateCookieName(settings);
  const clearStateLine = app.serializeCookie(stateCookie, "", clearingOptions(stateCookieOptions()));
  const clearPasswordSessionLine = app.serializeCookie(sessionCookie, "", clearingOptions(cookieOptions(settings)));

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
    if (!isNavigation(request.headers)) return refuse(request, reply, 400, "not_navigation");
    const started = startLogin((params ?? {}) as LtiLoginParams, lti, settings.appOrigin);
    if (!started.ok) return refuse(request, reply, 400, started.reason);
    await saveLoginState(db, { state: started.state, nonce: started.nonce }, new Date(now()));
    return reply
      .setCookie(stateCookie, started.state, stateCookieOptions())
      .code(303)
      .header("location", started.redirectUrl)
      .send();
  }

  app.get("/lti/login", (request, reply) => login(request, reply, request.query));
  app.post("/lti/login", (request, reply) => login(request, reply, request.body));

  app.post("/lti/launch", async (request, reply) => {
    // The guard exempts this route from the app's own Origin; only the platform's will do.
    const origin = request.headers.origin;
    if (origin === undefined || !launchOrigins.has(origin)) return refuse(request, reply, 403, "wrong_origin");
    // From here on a refusal also clears the state cookie, which no later launch can use.
    const refuseAndClear = (status: number, reason: string): FastifyReply => {
      reply.header("set-cookie", clearStateLine);
      return refuse(request, reply, status, reason);
    };
    const state = field(request.body, "state");
    const stateProblem = checkLaunchState(state, request.cookies[stateCookie]);
    if (stateProblem) return refuseAndClear(401, stateProblem);
    const nonce = await consumeLoginState(db, state as string, new Date(now()));
    if (nonce === undefined) return refuseAndClear(401, "state_unknown");
    const idToken = field(request.body, "id_token") ?? "";
    const checked = await validateLaunch(idToken, {
      settings: lti,
      keys,
      nonce,
      appOrigin: settings.appOrigin,
      now: new Date(now()),
    });
    if (!checked.ok) {
      // An outage is not the person's fault: 503, and the log names it.
      return "outage" in checked ? refuseAndClear(503, checked.outage) : refuseAndClear(401, checked.reason);
    }
    const { launch } = checked;

    const method =
      (await findLtiMethod(db, launch.issuer, launch.subject)) ??
      (await createLtiAccount(db, {
        issuer: launch.issuer,
        subject: launch.subject,
        loginId: launch.loginId,
        email: launch.email,
      }));
    if (method.disabled) return refuseAndClear(403, "account_disabled");

    const courseId = await upsertCourse(db, {
      issuer: launch.issuer,
      contextId: launch.context.id,
      title: launch.context.title,
    });
    await upsertMembership(db, { courseId, accountId: method.accountId, role: launch.role });

    const sent = request.cookies[sessionCookie];
    if (sent) await endSession(db, sent);
    const token = await startSession(db, method, new Date(now()));
    // A password session of the same name, SameSite=Lax and unpartitioned, may still be
    // in the browser; it would be sent first and win, so the launch clears it. The
    // plug-in keeps one cookie per name, so the lines are written here.
    return reply
      .header("set-cookie", [
        app.serializeCookie(sessionCookie, token, launchCookieOptions()),
        clearPasswordSessionLine,
        clearStateLine,
      ])
      .code(303)
      .header("location", `/?course=${encodeURIComponent(courseId)}`)
      .send();
  });

  app.get("/lti/jwks", async (_request, reply) =>
    reply.header("content-security-policy", JWKS_POLICY).send(await toolJwks(lti.toolKey)),
  );
}

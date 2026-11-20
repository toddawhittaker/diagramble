import { type JWTVerifyGetKey, compactVerify, decodeProtectedHeader, errors } from "jose";
import type { CourseRole } from "../db/schema.ts";
import { isOnOrigin } from "./login.ts";
import { mapLtiRoles } from "./roles.ts";
import type { LtiSettings } from "./settings.ts";

/** Every reason a token is refused, one per check, in the order the checks run. */
export type LaunchRefusal =
  | "alg_not_allowed"
  | "bad_signature"
  | "keyset_unavailable"
  | "wrong_issuer"
  | "wrong_audience"
  | "expired"
  | "issued_in_future"
  | "nonce_mismatch"
  | "unknown_deployment"
  | "wrong_message_type"
  | "wrong_version"
  | "wrong_target"
  | "missing_subject"
  | "missing_resource_link"
  | "missing_context"
  | "bad_context";

/** What a valid launch says about the person and the course. It holds no token and no raw claims. */
export interface LtiLaunch {
  /** The token's `iss`, exactly as sent. */
  issuer: string;
  subject: string;
  /** The custom claim `login_id`, unchecked: `chooseLtiLogin` decides whether it is usable. */
  loginId: string | null;
  email: string | null;
  context: { id: string; title: string };
  role: CourseRole;
}

export type LaunchResult = { ok: true; launch: LtiLaunch } | { ok: false; reason: LaunchRefusal };

export interface ValidateLaunchInput {
  settings: Pick<LtiSettings, "issuer" | "clientId" | "deploymentId">;
  /** The platform's keys: `createRemoteJWKSet` in the server, `createLocalJWKSet` in tests. */
  keys: JWTVerifyGetKey;
  /** The nonce the login stored under this launch's state. */
  nonce: string;
  /** The app's origin; the token's target must be on it. */
  appOrigin: string;
  now: Date;
}

const CLAIM = "https://purl.imsglobal.org/spec/lti/claim/";
const CLOCK_SKEW_SECONDS = 60;
const MAX_ID_LENGTH = 255;

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function objectClaim(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Check the algorithm, then the signature, and return the claims. No claim is
 * read before the signature holds. Only RS256 is allowed, so `none` and an HMAC
 * made from a public key are refused before any key is looked up.
 */
async function verifySignature(
  idToken: string,
  keys: JWTVerifyGetKey,
): Promise<{ claims: Record<string, unknown> } | { reason: LaunchRefusal }> {
  let alg: unknown;
  try {
    alg = decodeProtectedHeader(idToken).alg;
  } catch {
    return { reason: "bad_signature" };
  }
  if (alg !== "RS256") return { reason: "alg_not_allowed" };
  try {
    const { payload } = await compactVerify(idToken, keys, { algorithms: ["RS256"] });
    const claims = objectClaim(JSON.parse(new TextDecoder().decode(payload)));
    return claims ? { claims } : { reason: "bad_signature" };
  } catch (error) {
    if (
      error instanceof errors.JWSSignatureVerificationFailed ||
      error instanceof errors.JWKSNoMatchingKey ||
      error instanceof errors.JWSInvalid ||
      error instanceof SyntaxError
    ) {
      return { reason: "bad_signature" };
    }
    return { reason: "keyset_unavailable" };
  }
}

/**
 * The audience names this client; with several audiences `azp` must be present, and
 * whenever `azp` is present it must name this client too.
 */
function audienceMatches(claims: Record<string, unknown>, clientId: string): boolean {
  const aud = claims.aud;
  if (claims.azp !== undefined && claims.azp !== clientId) return false;
  if (Array.isArray(aud)) {
    if (!aud.includes(clientId)) return false;
    return aud.length === 1 || claims.azp === clientId;
  }
  return aud === clientId;
}

/** Refuse a token that has expired or was issued in the future, within the clock skew. */
function checkTimes(claims: Record<string, unknown>, now: Date): LaunchRefusal | null {
  const nowSeconds = Math.floor(now.getTime() / 1000);
  if (typeof claims.exp !== "number" || claims.exp + CLOCK_SKEW_SECONDS <= nowSeconds) return "expired";
  if (typeof claims.iat !== "number" || claims.iat - CLOCK_SKEW_SECONDS > nowSeconds) {
    return "issued_in_future";
  }
  return null;
}

/** The course the launch comes from, or the refusal for a claim that is absent or malformed. */
function contextOf(claims: Record<string, unknown>): LtiLaunch["context"] | LaunchRefusal {
  const raw = claims[`${CLAIM}context`];
  if (raw === undefined) return "missing_context";
  const context = objectClaim(raw);
  if (!context || !isString(context.id) || context.id.length < 1 || context.id.length > MAX_ID_LENGTH) {
    return "bad_context";
  }
  const title = [context.title, context.label].find((v): v is string => isString(v) && v.trim() !== "");
  return { id: context.id, title: title?.trim() ?? "" };
}

/** The custom claim `login_id` as sent; anything but a string is absent. */
function loginIdOf(claims: Record<string, unknown>): string | null {
  const loginId = objectClaim(claims[`${CLAIM}custom`])?.login_id;
  return isString(loginId) ? loginId : null;
}

/**
 * Check a launch's `id_token` against the login it answers, and say who the
 * person is and which course they came from. The signature is checked before
 * any claim is trusted; every refusal carries one reason code.
 */
export async function validateLaunch(idToken: string, input: ValidateLaunchInput): Promise<LaunchResult> {
  const { settings } = input;
  const refuse = (reason: LaunchRefusal): LaunchResult => ({ ok: false, reason });

  const verified = await verifySignature(idToken, input.keys);
  if ("reason" in verified) return refuse(verified.reason);
  const { claims } = verified;

  if (claims.iss !== settings.issuer) return refuse("wrong_issuer");
  if (!audienceMatches(claims, settings.clientId)) return refuse("wrong_audience");
  const timeRefusal = checkTimes(claims, input.now);
  if (timeRefusal) return refuse(timeRefusal);
  if (claims.nonce !== input.nonce) return refuse("nonce_mismatch");

  if (claims[`${CLAIM}deployment_id`] !== settings.deploymentId) return refuse("unknown_deployment");
  if (claims[`${CLAIM}message_type`] !== "LtiResourceLinkRequest") return refuse("wrong_message_type");
  if (claims[`${CLAIM}version`] !== "1.3.0") return refuse("wrong_version");
  const target = claims[`${CLAIM}target_link_uri`];
  if (!isString(target) || !isOnOrigin(target, input.appOrigin)) return refuse("wrong_target");

  const sub = claims.sub;
  if (!isString(sub) || sub.length < 1 || sub.length > MAX_ID_LENGTH) return refuse("missing_subject");
  const resourceLink = objectClaim(claims[`${CLAIM}resource_link`]);
  if (!resourceLink || !isString(resourceLink.id) || resourceLink.id === "") {
    return refuse("missing_resource_link");
  }
  const context = contextOf(claims);
  if (isString(context)) return refuse(context);

  return {
    ok: true,
    launch: {
      issuer: settings.issuer,
      subject: sub,
      loginId: loginIdOf(claims),
      email: isString(claims.email) && claims.email !== "" ? claims.email : null,
      context,
      role: mapLtiRoles(claims[`${CLAIM}roles`]),
    },
  };
}

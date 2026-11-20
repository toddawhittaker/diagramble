import { randomBytes } from "node:crypto";
import type { LtiSettings } from "./settings.ts";

/** The third-party login initiation parameters (a GET query or a POST form). */
export interface LtiLoginParams {
  iss?: string;
  login_hint?: string;
  target_link_uri?: string;
  lti_message_hint?: string;
  client_id?: string;
}

/** Why `/lti/login` is refused. The log names it; the person is told nothing of it. */
export type LtiLoginRefusal = "wrong_issuer" | "wrong_client" | "missing_login_hint" | "wrong_target";

export type LtiLoginResult =
  | {
      ok: true;
      /** Goes in the state cookie, and hashed into the state row. */
      state: string;
      /** Goes in the state row. */
      nonce: string;
      /** The platform's authorization endpoint with the request in its query. */
      redirectUrl: string;
    }
  | { ok: false; reason: LtiLoginRefusal };

/** True when `uri` parses and is on `appOrigin`. */
export function isOnOrigin(uri: string, appOrigin: string): boolean {
  try {
    return new URL(uri).origin === new URL(appOrigin).origin;
  } catch {
    return false;
  }
}

/**
 * Whether a browser header set says the request is a page load, in a window or
 * a frame. A request without the header (an older browser) counts as one.
 */
export function isNavigation(headers: { "sec-fetch-dest"?: string | string[] | undefined }): boolean {
  const dest = headers["sec-fetch-dest"];
  return dest === undefined || dest === "document" || dest === "iframe";
}

/**
 * Check a login initiation and build the authorization request. The caller
 * stores the state with `saveLoginState`, sets the state cookie, and redirects.
 */
export function startLogin(
  params: LtiLoginParams,
  settings: Pick<LtiSettings, "issuer" | "clientId" | "authUrl">,
  appOrigin: string,
): LtiLoginResult {
  if (params.iss !== settings.issuer) return { ok: false, reason: "wrong_issuer" };
  if (params.client_id && params.client_id !== settings.clientId) {
    return { ok: false, reason: "wrong_client" };
  }
  if (!params.login_hint) return { ok: false, reason: "missing_login_hint" };
  if (!params.target_link_uri || !isOnOrigin(params.target_link_uri, appOrigin)) {
    return { ok: false, reason: "wrong_target" };
  }

  const state = randomBytes(32).toString("base64url");
  const nonce = randomBytes(32).toString("base64url");
  const url = new URL(settings.authUrl);
  const query: Record<string, string> = {
    scope: "openid",
    response_type: "id_token",
    response_mode: "form_post",
    prompt: "none",
    client_id: settings.clientId,
    redirect_uri: `${appOrigin}/lti/launch`,
    login_hint: params.login_hint,
    state,
    nonce,
  };
  if (params.lti_message_hint) query.lti_message_hint = params.lti_message_hint;
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return { ok: true, state, nonce, redirectUrl: url.toString() };
}

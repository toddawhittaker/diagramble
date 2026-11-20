import { timingSafeEqual } from "node:crypto";
import { hashToken, hostPrefix, launchCookieOptions, type SessionCookieOptions } from "../accounts/sessions.ts";
import type { Settings } from "../settings.ts";
import { LOGIN_STATE_SECONDS } from "./store.ts";

/**
 * The cookie that carries a login's state from `/lti/login` to `/lti/launch`.
 * Over https it has the `__Host-` prefix, as the session cookie does (SPEC.md
 * section 1, "Host names").
 */
export function stateCookieName(settings: Pick<Settings, "appOrigin">): string {
  return `${hostPrefix(settings)}diagramble-lti-state`;
}

/**
 * The platform's launch is a cross-site form post, often inside a frame, so the
 * cookie has a launch session's options (`SameSite=None`, `Partitioned`, Secure) and
 * lasts as long as the state.
 */
export function stateCookieOptions(): SessionCookieOptions {
  return { ...launchCookieOptions(), maxAge: LOGIN_STATE_SECONDS };
}

/**
 * Whether the form's state equals the cookie's: `state_missing` when either is
 * absent or empty, `state_mismatch` when they differ, `null` when they match.
 * The comparison takes the same time wherever the values differ.
 */
export function checkLaunchState(
  formState: string | undefined,
  cookieState: string | undefined,
): "state_missing" | "state_mismatch" | null {
  if (!formState || !cookieState) return "state_missing";
  const form = Buffer.from(hashToken(formState), "hex");
  const cookie = Buffer.from(hashToken(cookieState), "hex");
  return timingSafeEqual(form, cookie) ? null : "state_mismatch";
}

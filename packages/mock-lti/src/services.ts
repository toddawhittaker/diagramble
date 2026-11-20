import { randomBytes } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { JWTPayload } from "jose";
import { json, send } from "./http.ts";
import { NRPS_MEDIA_TYPE, NRPS_SCOPE, rosterPage } from "./roster.ts";
import { CLIENT_ID } from "./seed.ts";
import { type FetchToolKeys, verifyToolJwt } from "./tool.ts";

const ASSERTION_TYPE = "urn:ietf:params:oauth:client-assertion-type:jwt-bearer";
const MAX_REMEMBERED = 1000;
const TOKEN_SECONDS = 3600;
const PLAIN_TEXT = "text/plain; charset=utf-8";

export interface ServicesOptions {
  issuer: string;
  fetchKeys: FetchToolKeys;
  /** Seconds since the epoch. */
  now: () => number;
  log: (line: string) => void;
}

/** Drops the oldest entry so a long-running mock stays bounded. */
function boundedAdd<K, V>(map: Map<K, V>, key: K, value: V) {
  if (map.size >= MAX_REMEMBERED) {
    const oldest = map.keys().next().value;
    if (oldest !== undefined) map.delete(oldest);
  }
  map.set(key, value);
}

/** The token endpoint and the class-list endpoint of the Names and Role Provisioning Services. */
export function createServices(options: ServicesOptions) {
  const { issuer, fetchKeys, now, log } = options;
  // Bearer token to its expiry, and each assertion ID seen to the time it was seen.
  const accessTokens = new Map<string, number>();
  const seenAssertions = new Map<string, number>();

  const tokenError = (res: ServerResponse, status: number, error: string) => json(res, status, { error });

  async function token(params: URLSearchParams, res: ServerResponse) {
    if (params.get("grant_type") !== "client_credentials") return tokenError(res, 400, "unsupported_grant_type");
    if (params.get("client_assertion_type") !== ASSERTION_TYPE) return tokenError(res, 400, "invalid_request");
    let payload: JWTPayload;
    try {
      payload = await verifyToolJwt(fetchKeys, params.get("client_assertion") ?? "", `${issuer}/token`, now(), [
        "exp",
        "jti",
        "sub",
      ]);
    } catch {
      return tokenError(res, 401, "invalid_client");
    }
    const jti = String(payload.jti);
    if (payload.sub !== CLIENT_ID || seenAssertions.has(jti)) return tokenError(res, 401, "invalid_client");
    boundedAdd(seenAssertions, jti, now());
    if (!(params.get("scope") ?? "").split(" ").includes(NRPS_SCOPE)) return tokenError(res, 400, "invalid_scope");
    const accessToken = randomBytes(32).toString("base64url");
    boundedAdd(accessTokens, accessToken, now() + TOKEN_SECONDS);
    log("token issued");
    return json(res, 200, {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: TOKEN_SECONDS,
      scope: NRPS_SCOPE,
    });
  }

  /** The class list of the course in the path, for any unexpired bearer token this mock issued. */
  function memberships(req: IncomingMessage, url: URL, res: ServerResponse) {
    const bearer = /^Bearer (.+)$/.exec(req.headers.authorization ?? "")?.[1];
    const expires = bearer === undefined ? undefined : accessTokens.get(bearer);
    if (expires === undefined || now() >= expires) return send(res, 401, PLAIN_TEXT, "Unauthorized\n");
    const courseId = /^\/nrps\/([^/]+)\/memberships$/.exec(url.pathname)?.[1] ?? "";
    const page = rosterPage(issuer, courseId, url.searchParams.get("page"), url.searchParams.get("limit"));
    if (!page) return send(res, 404, PLAIN_TEXT, "Not found\n");
    if (page.next) res.setHeader("link", `<${page.next}>; rel="next"`);
    return send(res, 200, NRPS_MEDIA_TYPE, JSON.stringify(page.body));
  }

  return { token, memberships };
}

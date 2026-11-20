import { createLocalJWKSet, type JSONWebKeySet, type JWTPayload, jwtVerify } from "jose";
import { CLIENT_ID } from "./seed.ts";

/** Fetches the tool's public keys; tests replace it. */
export type FetchToolKeys = () => Promise<JSONWebKeySet>;

export function fetchKeysFrom(toolUrl: string): FetchToolKeys {
  return async () => {
    const res = await fetch(`${toolUrl}/lti/jwks`);
    if (!res.ok) throw new Error(`tool key set answered ${res.status}`);
    return (await res.json()) as JSONWebKeySet;
  };
}

/** Verifies a JWT the tool signed: RS256, one of the tool's published keys, issued by its client ID and addressed to `audience`. */
export async function verifyToolJwt(
  fetchKeys: FetchToolKeys,
  token: string,
  audience: string,
  now: number,
  required: string[] = [],
): Promise<JWTPayload> {
  const keys = createLocalJWKSet(await fetchKeys());
  const { payload } = await jwtVerify(token, keys, {
    algorithms: ["RS256"],
    issuer: CLIENT_ID,
    audience,
    currentDate: new Date(now * 1000),
    requiredClaims: required,
  });
  return payload;
}

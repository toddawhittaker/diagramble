import { createHash, createPublicKey } from "node:crypto";

/** The tool's public key set: public members only. */
export interface ToolJwks {
  keys: { kty: string; n: string; e: string; kid: string; alg: "RS256"; use: "sig" }[];
}

/**
 * The public half of the tool's RSA private key, as a key set. Its `kid` is the
 * key's SHA-256 thumbprint (RFC 7638), so it is stable for one key. Throws when
 * the PEM is not an RSA key.
 */
export function toolJwks(pem: string): ToolJwks {
  const { kty, n, e } = createPublicKey(pem).export({ format: "jwk" });
  if (kty !== "RSA" || !n || !e) throw new Error("The tool key is not an RSA key.");
  // RFC 7638: the required members in lexical order, with no whitespace.
  const kid = createHash("sha256").update(JSON.stringify({ e, kty, n })).digest("base64url");
  return { keys: [{ kty, n, e, kid, alg: "RS256", use: "sig" }] };
}

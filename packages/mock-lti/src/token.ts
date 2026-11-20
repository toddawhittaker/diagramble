import { randomUUID } from "node:crypto";
import { type CryptoKey, exportJWK, generateKeyPair, type JWK, SignJWT } from "jose";
import { CLIENT_ID, type Course, DEPLOYMENT_ID, type Person, ROLE_URIS, type RoleName } from "./seed.ts";

// Each defect makes a launch wrong in exactly one way, so a test knows which tool-side check refused it.
export const DEFECTS = [
  "bad_signature",
  "alg_none",
  "alg_hs256",
  "wrong_iss",
  "wrong_aud",
  "expired",
  "issued_in_future",
  "wrong_nonce",
  "replayed",
  "unknown_deployment",
  "wrong_message_type",
  "wrong_version",
  "wrong_target",
  "missing_sub",
  "missing_resource_link",
  "missing_context",
] as const;

export type Defect = (typeof DEFECTS)[number];

export function isDefect(value: string): value is Defect {
  return (DEFECTS as readonly string[]).includes(value);
}

export const LTI_CLAIM = "https://purl.imsglobal.org/spec/lti/claim/";
export const CUSTOM_CLAIM = `${LTI_CLAIM}custom`;

const LIFETIME_SECONDS = 300;
const OFFSET_SECONDS = 3600;

export interface Signer {
  kid: string;
  privateKey: CryptoKey;
  // Signs bad_signature launches under the same kid, so only the signature is wrong.
  strangerKey: CryptoKey;
  /** The public key set: public members only. */
  jwks: { keys: JWK[] };
}

// A fresh key per process: nothing this mock signs outlives it.
export async function createSigner(): Promise<Signer> {
  const kid = randomUUID();
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const stranger = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  return {
    kid,
    privateKey,
    strangerKey: stranger.privateKey,
    jwks: { keys: [{ kty: jwk.kty, n: jwk.n, e: jwk.e, kid, alg: "RS256", use: "sig" }] },
  };
}

export interface LaunchClaimsInput {
  issuer: string;
  toolUrl: string;
  person: Person;
  course: Course;
  role: RoleName;
  nonce: string;
  /** Seconds since the epoch. */
  now: number;
  defect?: Defect;
}

/**
 * The claims of one resource link launch. A defect changes exactly the claim its name says;
 * `bad_signature`, `alg_none`, `alg_hs256` and `replayed` change none and act when signing or sending.
 */
export function launchClaims(input: LaunchClaimsInput): Record<string, unknown> {
  const { person, course, defect } = input;
  const iat =
    defect === "expired" ? input.now - OFFSET_SECONDS : defect === "issued_in_future" ? input.now + OFFSET_SECONDS : input.now;
  return {
    iss: defect === "wrong_iss" ? "https://other-platform.invalid" : input.issuer,
    ...(defect !== "missing_sub" && { sub: person.sub }),
    aud: defect === "wrong_aud" ? "some-other-tool" : CLIENT_ID,
    iat,
    exp: iat + LIFETIME_SECONDS,
    nonce: defect === "wrong_nonce" ? `${input.nonce}-other` : input.nonce,
    name: `${person.givenName} ${person.familyName}`,
    given_name: person.givenName,
    family_name: person.familyName,
    email: person.email,
    [CUSTOM_CLAIM]: { login_id: person.loginId },
    [`${LTI_CLAIM}message_type`]: defect === "wrong_message_type" ? "LtiSubmissionReviewRequest" : "LtiResourceLinkRequest",
    [`${LTI_CLAIM}version`]: defect === "wrong_version" ? "1.1.0" : "1.3.0",
    [`${LTI_CLAIM}deployment_id`]: defect === "unknown_deployment" ? "unknown-deployment" : DEPLOYMENT_ID,
    [`${LTI_CLAIM}target_link_uri`]: defect === "wrong_target" ? "https://elsewhere.invalid/" : `${input.toolUrl}/`,
    ...(defect !== "missing_resource_link" && {
      [`${LTI_CLAIM}resource_link`]: { id: `${course.id}-diagramble`, title: "Diagramble" },
    }),
    ...(defect !== "missing_context" && {
      [`${LTI_CLAIM}context`]: {
        id: course.id,
        label: course.label,
        title: course.title,
        type: ["http://purl.imsglobal.org/vocab/lis/v2/course#CourseOffering"],
      },
    }),
    [`${LTI_CLAIM}roles`]: [ROLE_URIS[input.role]],
  };
}

function base64url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export async function signLaunch(signer: Signer, claims: Record<string, unknown>, defect?: Defect): Promise<string> {
  if (defect === "alg_none") {
    return `${base64url({ alg: "none", typ: "JWT", kid: signer.kid })}.${base64url(claims)}.`;
  }
  if (defect === "alg_hs256") {
    // The key-confusion attack: an HMAC secret made from the published public key.
    const secret = new TextEncoder().encode(JSON.stringify(signer.jwks.keys[0]));
    return new SignJWT(claims).setProtectedHeader({ alg: "HS256", typ: "JWT", kid: signer.kid }).sign(secret);
  }
  const key = defect === "bad_signature" ? signer.strangerKey : signer.privateKey;
  return new SignJWT(claims).setProtectedHeader({ alg: "RS256", typ: "JWT", kid: signer.kid }).sign(key);
}

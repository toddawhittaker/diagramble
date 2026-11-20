import { createLocalJWKSet, decodeJwt, decodeProtectedHeader, jwtVerify } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { CLIENT_ID, COURSES, DEPLOYMENT_ID, PEOPLE, ROLE_URIS, UNFILLED_LOGIN_ID } from "./seed.ts";
import {
  CUSTOM_CLAIM,
  createSigner,
  DEFECTS,
  type Defect,
  isDefect,
  LTI_CLAIM,
  launchClaims,
  type Signer,
  signLaunch,
} from "./token.ts";

const ISSUER = "https://platform.test";
const TOOL = "https://tool.test";
const NOW = 1_900_000_000;
function seeded<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("seed is missing");
  return value;
}
const person = seeded(PEOPLE.find((p) => p.key === "sam"));
const course = seeded(COURSES[0]);

let signer: Signer;
beforeAll(async () => {
  signer = await createSigner();
});

function input(defect?: Defect) {
  return { issuer: ISSUER, toolUrl: TOOL, person, course, role: person.role, nonce: "n-1", now: NOW, defect };
}

const claimsFor = (defect?: Defect) => launchClaims(input(defect));

async function tokenFor(defect?: Defect): Promise<string> {
  return signLaunch(signer, claimsFor(defect), defect);
}

/** The strictest check a tool makes: RS256 only, this issuer and audience, at NOW. */
const verify = (token: string) =>
  jwtVerify(token, createLocalJWKSet(signer.jwks), {
    algorithms: ["RS256"],
    issuer: ISSUER,
    audience: CLIENT_ID,
    currentDate: new Date(NOW * 1000),
  });

function changedClaims(defect: Defect): string[] {
  const good = claimsFor();
  const bad = claimsFor(defect);
  const names = new Set([...Object.keys(good), ...Object.keys(bad)]);
  return [...names].filter((name) => JSON.stringify(good[name]) !== JSON.stringify(bad[name])).sort();
}

describe("the defect list", () => {
  it("holds the sixteen defects", () => {
    expect([...DEFECTS]).toEqual([
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
    ]);
    expect(isDefect("expired")).toBe(true);
    expect(isDefect("odd")).toBe(false);
  });
});

describe("the key set", () => {
  it("holds one RS256 public key and no private member", () => {
    expect(signer.jwks.keys).toHaveLength(1);
    const key = signer.jwks.keys[0] as Record<string, unknown>;
    expect(Object.keys(key).sort()).toEqual(["alg", "e", "kid", "kty", "n", "use"]);
    expect(key).toMatchObject({ kty: "RSA", alg: "RS256", use: "sig", kid: signer.kid });
  });

  it("is new for every signer", async () => {
    const other = await createSigner();
    expect(other.kid).not.toBe(signer.kid);
    expect(other.jwks.keys[0]?.n).not.toBe(signer.jwks.keys[0]?.n);
  });
});

describe("a good launch", () => {
  it("verifies and carries every claim the tool checks", async () => {
    const { payload, protectedHeader } = await verify(await tokenFor());
    expect(protectedHeader).toMatchObject({ alg: "RS256", kid: signer.kid });
    expect(payload).toMatchObject({
      iss: ISSUER,
      sub: person.sub,
      aud: CLIENT_ID,
      iat: NOW,
      exp: NOW + 300,
      nonce: "n-1",
      email: person.email,
      [`${LTI_CLAIM}message_type`]: "LtiResourceLinkRequest",
      [`${LTI_CLAIM}version`]: "1.3.0",
      [`${LTI_CLAIM}deployment_id`]: DEPLOYMENT_ID,
      [`${LTI_CLAIM}target_link_uri`]: `${TOOL}/`,
      [`${LTI_CLAIM}roles`]: [ROLE_URIS.Learner],
    });
    expect(payload[`${LTI_CLAIM}resource_link`]).toMatchObject({ id: expect.any(String) });
    expect(payload[`${LTI_CLAIM}context`]).toMatchObject({ id: course.id, title: course.title });
  });

  it("uses the role it is given", () => {
    const claims = launchClaims({ ...input(), role: "Instructor" });
    expect(claims[`${LTI_CLAIM}roles`]).toEqual([ROLE_URIS.Instructor]);
  });
});

describe("the custom login_id claim", () => {
  it("rides every launch of every seed person", () => {
    for (const p of PEOPLE) {
      const claims = launchClaims({ ...input(), person: p });
      expect(claims[CUSTOM_CLAIM]).toEqual({ login_id: p.loginId });
    }
    expect(CUSTOM_CLAIM).toBe("https://purl.imsglobal.org/spec/lti/claim/custom");
  });

  it("includes a student, an instructor, one with no login ID and one with the literal unfilled value", () => {
    const roles = new Set(PEOPLE.map((p) => p.role));
    expect(roles.has("Learner")).toBe(true);
    expect(roles.has("Instructor")).toBe(true);
    expect(PEOPLE.some((p) => p.loginId === "")).toBe(true);
    expect(PEOPLE.some((p) => p.loginId === "$Canvas.user.loginId")).toBe(true);
    expect(UNFILLED_LOGIN_ID).toBe("$Canvas.user.loginId");
    expect(COURSES.length).toBeGreaterThanOrEqual(2);
  });
});

describe("each defect is wrong in exactly one way", () => {
  // The claims each defect may change; every other claim must equal a good launch's.
  const claimChanges: Record<Defect, string[]> = {
    bad_signature: [],
    alg_none: [],
    alg_hs256: [],
    wrong_iss: ["iss"],
    wrong_aud: ["aud"],
    expired: ["exp", "iat"],
    issued_in_future: ["exp", "iat"],
    wrong_nonce: ["nonce"],
    replayed: [],
    unknown_deployment: [`${LTI_CLAIM}deployment_id`],
    wrong_message_type: [`${LTI_CLAIM}message_type`],
    wrong_version: [`${LTI_CLAIM}version`],
    wrong_target: [`${LTI_CLAIM}target_link_uri`],
    missing_sub: ["sub"],
    missing_resource_link: [`${LTI_CLAIM}resource_link`],
    missing_context: [`${LTI_CLAIM}context`],
  };

  it("has an entry for every defect", () => {
    expect(Object.keys(claimChanges).sort()).toEqual([...DEFECTS].sort());
  });

  it.each(DEFECTS)("%s changes only the claims it should", (defect) => {
    expect(changedClaims(defect)).toEqual([...claimChanges[defect]].sort());
  });

  it.each(DEFECTS.filter((d) => !["bad_signature", "alg_none", "alg_hs256"].includes(d)))(
    "%s keeps a valid RS256 signature under the published key",
    async (defect) => {
      const header = decodeProtectedHeader(await tokenFor(defect));
      expect(header).toEqual(decodeProtectedHeader(await tokenFor()));
      if (defect === "wrong_iss" || defect === "wrong_aud" || defect === "expired") {
        await expect(verify(await tokenFor(defect))).rejects.toThrow();
      } else {
        await expect(verify(await tokenFor(defect))).resolves.toBeDefined();
      }
    },
  );

  it("replayed is a good launch: the mock sends it a second time", async () => {
    expect(await tokenFor("replayed")).toBe(await tokenFor());
  });

  it("bad_signature keeps the header and claims but not the signature", async () => {
    const token = await tokenFor("bad_signature");
    expect(decodeProtectedHeader(token)).toEqual(decodeProtectedHeader(await tokenFor()));
    expect(decodeJwt(token)).toEqual(decodeJwt(await tokenFor()));
    await expect(verify(token)).rejects.toThrow(/signature/);
  });

  it("alg_none is unsigned", async () => {
    const token = await tokenFor("alg_none");
    expect(decodeProtectedHeader(token)).toMatchObject({ alg: "none" });
    expect(token.endsWith(".")).toBe(true);
    expect(decodeJwt(token)).toEqual(decodeJwt(await tokenFor()));
    await expect(verify(token)).rejects.toThrow();
  });

  it("alg_hs256 is an HMAC token with the good claims", async () => {
    const token = await tokenFor("alg_hs256");
    expect(decodeProtectedHeader(token)).toMatchObject({ alg: "HS256", kid: signer.kid });
    expect(decodeJwt(token)).toEqual(decodeJwt(await tokenFor()));
    await expect(verify(token)).rejects.toThrow();
  });

  it("wrong_iss, wrong_aud, expired and issued_in_future fail only their own time or name check", async () => {
    await expect(verify(await tokenFor("wrong_iss"))).rejects.toThrow(/iss/);
    await expect(verify(await tokenFor("wrong_aud"))).rejects.toThrow(/aud/);
    await expect(verify(await tokenFor("expired"))).rejects.toThrow(/exp/);
    const future = await tokenFor("issued_in_future");
    expect(decodeJwt(future).iat).toBeGreaterThan(NOW + 60);
    expect(decodeJwt(future).exp).toBeGreaterThan(NOW);
  });

  it("expired is past its lifetime and was issued in the past", () => {
    const claims = claimsFor("expired");
    expect(Number(claims.exp)).toBeLessThan(NOW);
    expect(Number(claims.iat)).toBeLessThan(NOW);
  });

  it("wrong_nonce differs from the nonce the tool asked for", () => {
    expect(claimsFor("wrong_nonce").nonce).not.toBe("n-1");
  });
});

import { SignJWT, createLocalJWKSet } from "jose";
import {
  CLIENT_ID,
  COURSES,
  DEFECTS,
  DEPLOYMENT_ID,
  type Defect,
  LTI_CLAIM,
  PEOPLE,
  type Signer,
  UNFILLED_LOGIN_ID,
  createSigner,
  launchClaims,
  signLaunch,
} from "@diagramble/mock-lti";
import { beforeAll, describe, expect, test } from "vitest";
import { chooseLtiLogin } from "../accounts/store.ts";
import { type LaunchRefusal, type ValidateLaunchInput, validateLaunch } from "./validate.ts";

const ISSUER = "https://platform.test";
const APP = "https://tool.test";
const NONCE = "nonce-1";
const NOW_SECONDS = 1_900_000_000;
const NOW = new Date(NOW_SECONDS * 1000);

function seeded<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("seed is missing");
  return value;
}
const sam = seeded(PEOPLE.find((p) => p.key === "sam"));
const course = seeded(COURSES[0]);

let signer: Signer;
let input: ValidateLaunchInput;
beforeAll(async () => {
  signer = await createSigner();
  input = {
    settings: { issuer: ISSUER, clientId: CLIENT_ID, deploymentId: DEPLOYMENT_ID },
    keys: createLocalJWKSet(signer.jwks),
    nonce: NONCE,
    appOrigin: APP,
    now: NOW,
  };
});

function claims(defect?: Defect, person = sam) {
  return launchClaims({
    issuer: ISSUER,
    toolUrl: APP,
    person,
    course,
    role: person.role,
    nonce: NONCE,
    now: NOW_SECONDS,
    defect,
  });
}

/** A token signed with the platform's key, with any claim changed or removed (`undefined` removes it). */
async function tokenWith(changes: Record<string, unknown>): Promise<string> {
  const payload = { ...claims(), ...changes };
  for (const key of Object.keys(payload)) if (payload[key] === undefined) delete payload[key];
  return new SignJWT(payload).setProtectedHeader({ alg: "RS256", kid: signer.kid }).sign(signer.privateKey);
}

async function reasonFor(token: string): Promise<LaunchRefusal | "ok"> {
  const result = await validateLaunch(token, input);
  if (result.ok) return "ok";
  if ("outage" in result) throw new Error(result.outage);
  return result.reason;
}

describe("a good launch", () => {
  test.each(PEOPLE.map((p) => [p.key, p] as const))("%s is accepted, with the course and the person's own claims", async (_key, person) => {
    const result = await validateLaunch(await signLaunch(signer, claims(undefined, person)), input);
    expect(result).toEqual({
      ok: true,
      launch: {
        issuer: ISSUER,
        subject: person.sub,
        loginId: person.loginId,
        email: person.email,
        context: { id: course.id, title: course.title },
        role: person.role === "Learner" ? "student" : "instructor",
      },
    });
  });

  test("hands an unfilled or empty login ID on as it came, for chooseLtiLogin to replace", async () => {
    const lee = seeded(PEOPLE.find((p) => p.key === "lee"));
    const una = seeded(PEOPLE.find((p) => p.key === "una"));
    expect(lee.loginId).toBe(UNFILLED_LOGIN_ID);
    for (const [person, login] of [
      [lee, "lee"],
      [una, "una"],
    ] as const) {
      const result = await validateLaunch(await signLaunch(signer, claims(undefined, person)), input);
      if (!result.ok) throw new Error("reason" in result ? result.reason : result.outage);
      expect(chooseLtiLogin(result.launch, "00000000-0000-4000-8000-000000000000")).toBe(login);
    }
  });

  test("takes an audience that is a list of one", async () => {
    expect(await reasonFor(await tokenWith({ aud: [CLIENT_ID] }))).toBe("ok");
  });

  test("takes several audiences when azp is this client", async () => {
    expect(await reasonFor(await tokenWith({ aud: [CLIENT_ID, "other"], azp: CLIENT_ID }))).toBe("ok");
  });

  test("allows a minute of clock skew, and no more", async () => {
    expect(await reasonFor(await tokenWith({ iat: NOW_SECONDS + 60, exp: NOW_SECONDS + 360 }))).toBe("ok");
    expect(await reasonFor(await tokenWith({ iat: NOW_SECONDS + 61, exp: NOW_SECONDS + 361 }))).toBe("issued_in_future");
    expect(await reasonFor(await tokenWith({ iat: NOW_SECONDS - 400, exp: NOW_SECONDS - 59 }))).toBe("ok");
    expect(await reasonFor(await tokenWith({ iat: NOW_SECONDS - 400, exp: NOW_SECONDS - 60 }))).toBe("expired");
  });

  test("reads no title as the course label, and then as empty", async () => {
    const context = { id: course.id, label: "IS 301" };
    const withLabel = await validateLaunch(await tokenWith({ [`${LTI_CLAIM}context`]: context }), input);
    expect(withLabel).toMatchObject({ ok: true, launch: { context: { id: course.id, title: "IS 301" } } });
    const bare = await validateLaunch(await tokenWith({ [`${LTI_CLAIM}context`]: { id: course.id } }), input);
    expect(bare).toMatchObject({ ok: true, launch: { context: { id: course.id, title: "" } } });
  });

  test("reads a missing custom claim, a non-string login ID and an empty email as null", async () => {
    for (const custom of [undefined, { login_id: 7 }, "text"]) {
      const result = await validateLaunch(await tokenWith({ [`${LTI_CLAIM}custom`]: custom, email: "" }), input);
      expect(result).toMatchObject({ ok: true, launch: { loginId: null, email: null } });
    }
  });

  test("maps a roles claim that is missing to a student", async () => {
    const result = await validateLaunch(await tokenWith({ [`${LTI_CLAIM}roles`]: undefined }), input);
    expect(result).toMatchObject({ ok: true, launch: { role: "student" } });
  });
});

/** The reason each defect of the mock platform is refused for. `replayed` is a good token: its state is the check (see state.test.ts). */
const REASONS: Record<Defect, LaunchRefusal | "ok"> = {
  bad_signature: "bad_signature",
  alg_none: "alg_not_allowed",
  alg_hs256: "alg_not_allowed",
  wrong_iss: "wrong_issuer",
  wrong_aud: "wrong_audience",
  expired: "expired",
  issued_in_future: "issued_in_future",
  wrong_nonce: "nonce_mismatch",
  replayed: "ok",
  unknown_deployment: "unknown_deployment",
  wrong_message_type: "wrong_message_type",
  wrong_version: "wrong_version",
  wrong_target: "wrong_target",
  missing_sub: "missing_subject",
  missing_resource_link: "missing_resource_link",
  missing_context: "missing_context",
};

describe("each defect of the mock platform", () => {
  test("is in the table, so a new defect needs its reason said here", () => {
    expect(Object.keys(REASONS).sort()).toEqual([...DEFECTS].sort());
    expect(DEFECTS).toHaveLength(16);
  });

  test.each(DEFECTS.map((d) => [d, REASONS[d]] as const))("%s is refused as %s", async (defect, reason) => {
    expect(await reasonFor(await signLaunch(signer, claims(defect), defect))).toBe(reason);
  });
});

describe("the signature and the algorithm", () => {
  test("a token that is not a JWT is a bad signature", async () => {
    expect(await reasonFor("not-a-token")).toBe("bad_signature");
    expect(await reasonFor("")).toBe("bad_signature");
  });

  test("a token signed under an unknown key ID is a bad signature", async () => {
    const stranger = await new SignJWT(claims()).setProtectedHeader({ alg: "RS256", kid: "no-such-key" }).sign(signer.privateKey);
    expect(await reasonFor(stranger)).toBe("bad_signature");
  });

  test("a payload that is not an object is a bad signature", async () => {
    const token = await new SignJWT({}).setProtectedHeader({ alg: "RS256", kid: signer.kid }).sign(signer.privateKey);
    const [header, , signature] = token.split(".");
    const array = Buffer.from("[1]").toString("base64url");
    expect(await reasonFor(`${header}.${array}.${signature}`)).toBe("bad_signature");
  });

  test("a key source that fails for another reason is an unavailable key set", async () => {
    const failing = { ...input, keys: () => Promise.reject(new Error("network down")) };
    const result = await validateLaunch(await signLaunch(signer, claims()), failing);
    expect(result).toEqual({ ok: false, outage: "keyset_unavailable" });
  });

  test("checks the signature before any claim: a forged token with a wrong issuer is a bad signature", async () => {
    const forged = await signLaunch(signer, claims("wrong_iss"), "bad_signature");
    expect(await reasonFor(forged)).toBe("bad_signature");
  });
});

describe("the claims, one at a time", () => {
  test.each([
    ["an audience list without this client", { aud: ["other"] }, "wrong_audience"],
    ["several audiences with no azp", { aud: [CLIENT_ID, "other"] }, "wrong_audience"],
    ["several audiences with another azp", { aud: [CLIENT_ID, "other"], azp: "other" }, "wrong_audience"],
    ["one audience with another azp", { azp: "other" }, "wrong_audience"],
    ["a one-item audience list with another azp", { aud: [CLIENT_ID], azp: "other" }, "wrong_audience"],
    ["no audience", { aud: undefined }, "wrong_audience"],
    ["no exp", { exp: undefined }, "expired"],
    ["a string exp", { exp: "soon" }, "expired"],
    ["no iat", { iat: undefined }, "issued_in_future"],
    ["no nonce", { nonce: undefined }, "nonce_mismatch"],
    ["no deployment", { [`${LTI_CLAIM}deployment_id`]: undefined }, "unknown_deployment"],
    ["a numeric deployment", { [`${LTI_CLAIM}deployment_id`]: 1 }, "unknown_deployment"],
    ["no message type", { [`${LTI_CLAIM}message_type`]: undefined }, "wrong_message_type"],
    ["a deep linking request", { [`${LTI_CLAIM}message_type`]: "LtiDeepLinkingRequest" }, "wrong_message_type"],
    ["no version", { [`${LTI_CLAIM}version`]: undefined }, "wrong_version"],
    ["no target", { [`${LTI_CLAIM}target_link_uri`]: undefined }, "wrong_target"],
    ["a target that is not a URL", { [`${LTI_CLAIM}target_link_uri`]: "/relative" }, "wrong_target"],
    ["a target on the app's host but another scheme", { [`${LTI_CLAIM}target_link_uri`]: "http://tool.test/" }, "wrong_target"],
    ["an empty subject", { sub: "" }, "missing_subject"],
    ["a numeric subject", { sub: 12 }, "missing_subject"],
    ["a subject over 255 characters", { sub: "s".repeat(256) }, "missing_subject"],
    ["a resource link that is not an object", { [`${LTI_CLAIM}resource_link`]: "link" }, "missing_resource_link"],
    ["a resource link with an empty ID", { [`${LTI_CLAIM}resource_link`]: { id: "" } }, "missing_resource_link"],
    ["a context that is not an object", { [`${LTI_CLAIM}context`]: "course" }, "bad_context"],
    ["a context with no ID", { [`${LTI_CLAIM}context`]: { title: "t" } }, "bad_context"],
    ["a context with an empty ID", { [`${LTI_CLAIM}context`]: { id: "" } }, "bad_context"],
    ["a context ID over 255 characters", { [`${LTI_CLAIM}context`]: { id: "c".repeat(256) } }, "bad_context"],
  ] as const)("%s is refused as %s", async (_name, changes, reason) => {
    expect(await reasonFor(await tokenWith(changes))).toBe(reason);
  });

  test("takes a subject and a context ID of exactly 255 characters", async () => {
    const changes = { sub: "s".repeat(255), [`${LTI_CLAIM}context`]: { id: "c".repeat(255), title: "t" } };
    expect(await reasonFor(await tokenWith(changes))).toBe("ok");
  });

  test("checks the issuer, audience, times and nonce before the LTI message claims", async () => {
    const bothWrong = await tokenWith({ iss: "https://other.invalid", [`${LTI_CLAIM}version`]: "1.1.0" });
    expect(await reasonFor(bothWrong)).toBe("wrong_issuer");
    const nonceAndDeployment = await tokenWith({ nonce: "x", [`${LTI_CLAIM}deployment_id`]: "x" });
    expect(await reasonFor(nonceAndDeployment)).toBe("nonce_mismatch");
  });

  test("checks the context last, after the resource link", async () => {
    const both = await tokenWith({ [`${LTI_CLAIM}resource_link`]: undefined, [`${LTI_CLAIM}context`]: undefined });
    expect(await reasonFor(both)).toBe("missing_resource_link");
  });
});

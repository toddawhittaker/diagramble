import { createLocalJWKSet } from "jose";
import { CLIENT_ID, COURSES, DEPLOYMENT_ID, PEOPLE, createSigner, launchClaims, signLaunch } from "@diagramble/mock-lti";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { type TestDb, createTestDb } from "../db/testing.ts";
import { checkLaunchState, stateCookieName, stateCookieOptions } from "./state.ts";
import { LOGIN_STATE_SECONDS, consumeLoginState, saveLoginState } from "./store.ts";
import { validateLaunch } from "./validate.ts";

describe("stateCookieName", () => {
  test("has the __Host- prefix over https and none on http://localhost", () => {
    expect(stateCookieName({ appOrigin: "https://app.example.edu" })).toBe("__Host-diagramble-lti-state");
    expect(stateCookieName({ appOrigin: "http://localhost:3000" })).toBe("diagramble-lti-state");
    expect(stateCookieName({ appOrigin: "http://app.localhost:3000" })).toBe("diagramble-lti-state");
  });

  test("is not the session cookie's name", () => {
    expect(stateCookieName({ appOrigin: "https://app.example.edu" })).not.toContain("session");
  });
});

describe("stateCookieOptions", () => {
  test("is Secure, HttpOnly, SameSite=None, Partitioned, Path=/ and lasts as long as the state", () => {
    expect(stateCookieOptions()).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "none",
      partitioned: true,
      path: "/",
      maxAge: LOGIN_STATE_SECONDS,
    });
    expect(LOGIN_STATE_SECONDS).toBe(600);
  });
});

describe("checkLaunchState", () => {
  test("accepts equal states", () => {
    expect(checkLaunchState("abc", "abc")).toBeNull();
  });

  test.each([
    [undefined, "abc"],
    ["abc", undefined],
    ["", "abc"],
    ["abc", ""],
    [undefined, undefined],
  ])("says the state is missing for form %j and cookie %j", (form, cookie) => {
    expect(checkLaunchState(form, cookie)).toBe("state_missing");
  });

  test.each([
    ["abc", "abd"],
    ["abc", "abcd"],
    ["abcd", "abc"],
    ["abc", "ABC"],
  ])("says the states differ for form %j and cookie %j", (form, cookie) => {
    expect(checkLaunchState(form, cookie)).toBe("state_mismatch");
  });
});

describe("a replayed launch", () => {
  let testDb: TestDb;
  beforeAll(async () => {
    testDb = await createTestDb();
  });
  afterAll(async () => {
    await testDb.drop();
  });

  test("passes the token checks once and finds no nonce the second time", async () => {
    const signer = await createSigner();
    const person = PEOPLE[0];
    const course = COURSES[0];
    if (!person || !course) throw new Error("seed is missing");
    const now = new Date("2030-01-01T12:00:00Z");
    const claims = launchClaims({
      issuer: "https://platform.test",
      toolUrl: "https://tool.test",
      person,
      course,
      role: person.role,
      nonce: "replay-nonce",
      now: Math.floor(now.getTime() / 1000),
      defect: "replayed",
    });
    const token = await signLaunch(signer, claims, "replayed");
    const input = {
      settings: { issuer: "https://platform.test", clientId: CLIENT_ID, deploymentId: DEPLOYMENT_ID },
      keys: createLocalJWKSet(signer.jwks),
      appOrigin: "https://tool.test",
      now,
    };

    await saveLoginState(testDb.db, { state: "replay-state", nonce: "replay-nonce" }, now);
    const first = await consumeLoginState(testDb.db, "replay-state", now);
    expect(first).toBe("replay-nonce");
    expect(await validateLaunch(token, { ...input, nonce: first ?? "" })).toMatchObject({ ok: true });

    expect(await consumeLoginState(testDb.db, "replay-state", now)).toBeUndefined();
  });
});

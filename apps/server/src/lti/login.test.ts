import { describe, expect, test } from "vitest";
import { type LtiLoginParams, isNavigation, isOnOrigin, startLogin } from "./login.ts";

const settings = {
  issuer: "https://canvas.example.edu",
  clientId: "client-1",
  authUrl: "https://canvas.example.edu/api/lti/authorize_redirect",
};
const APP = "https://app.example.edu";
const good: LtiLoginParams = {
  iss: settings.issuer,
  login_hint: "hint-1",
  target_link_uri: `${APP}/`,
  lti_message_hint: "message-hint",
  client_id: "client-1",
};

describe("startLogin", () => {
  test("builds the authorization request", () => {
    const result = startLogin(good, settings, APP);
    if (!result.ok) throw new Error(result.reason);
    const url = new URL(result.redirectUrl);
    expect(`${url.origin}${url.pathname}`).toBe(settings.authUrl);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      scope: "openid",
      response_type: "id_token",
      response_mode: "form_post",
      prompt: "none",
      client_id: "client-1",
      redirect_uri: `${APP}/lti/launch`,
      login_hint: "hint-1",
      lti_message_hint: "message-hint",
      state: result.state,
      nonce: result.nonce,
    });
  });

  test("leaves out the message hint when none was sent, and takes a login without a client ID", () => {
    const { lti_message_hint: _hint, client_id: _client, ...bare } = good;
    const result = startLogin(bare, settings, APP);
    if (!result.ok) throw new Error(result.reason);
    const query = new URL(result.redirectUrl).searchParams;
    expect(query.has("lti_message_hint")).toBe(false);
    expect(query.get("client_id")).toBe("client-1");
  });

  test("makes a state and a nonce that are long, different from each other, and new each time", () => {
    const a = startLogin(good, settings, APP);
    const b = startLogin(good, settings, APP);
    if (!a.ok || !b.ok) throw new Error("refused");
    expect(a.state).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a.nonce).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(new Set([a.state, a.nonce, b.state, b.nonce]).size).toBe(4);
  });

  test("keeps a query the authorization address already has", () => {
    const result = startLogin(good, { ...settings, authUrl: `${settings.authUrl}?tenant=1` }, APP);
    if (!result.ok) throw new Error(result.reason);
    expect(new URL(result.redirectUrl).searchParams.get("tenant")).toBe("1");
  });

  test.each([
    ["no issuer", { iss: undefined }, "wrong_issuer"],
    ["another issuer", { iss: "https://other.example.edu" }, "wrong_issuer"],
    ["the issuer with a trailing slash", { iss: `${settings.issuer}/` }, "wrong_issuer"],
    ["another client ID", { client_id: "client-2" }, "wrong_client"],
    ["no login hint", { login_hint: undefined }, "missing_login_hint"],
    ["an empty login hint", { login_hint: "" }, "missing_login_hint"],
    ["no target", { target_link_uri: undefined }, "wrong_target"],
    ["a target on another site", { target_link_uri: "https://elsewhere.example/" }, "wrong_target"],
    ["a target that is not a URL", { target_link_uri: "/lti/launch" }, "wrong_target"],
    ["a target on another scheme", { target_link_uri: "http://app.example.edu/" }, "wrong_target"],
  ] as const)("refuses %s as %s", (_name, change, reason) => {
    expect(startLogin({ ...good, ...change }, settings, APP)).toEqual({ ok: false, reason });
  });

  test("takes an empty client ID as not sent", () => {
    expect(startLogin({ ...good, client_id: "" }, settings, APP).ok).toBe(true);
  });
});

describe("isOnOrigin", () => {
  test("compares origins, not prefixes", () => {
    expect(isOnOrigin(`${APP}/deep/path?x=1`, APP)).toBe(true);
    expect(isOnOrigin("https://app.example.edu.evil.example/", APP)).toBe(false);
    expect(isOnOrigin("not a url", APP)).toBe(false);
    expect(isOnOrigin(APP, "not a url")).toBe(false);
  });
});

describe("isNavigation", () => {
  test.each([
    [undefined, true],
    ["document", true],
    ["iframe", true],
    ["empty", false],
    ["script", false],
    ["image", false],
    ["style", false],
    [["document", "script"], false],
  ])("Sec-Fetch-Dest %j is %s", (dest, expected) => {
    expect(isNavigation({ "sec-fetch-dest": dest })).toBe(expected);
  });
});

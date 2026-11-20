import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import {
  clearingOptions,
  cookieName,
  cookieOptions,
  hashToken,
  hostPrefix,
  launchCookieOptions,
  newToken,
  SESSION_SECONDS,
} from "./sessions.ts";

describe("session tokens", () => {
  test("a token is 32 random bytes in base64url, new each time", () => {
    const token = newToken();
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newToken()).not.toBe(token);
  });

  test("the stored id is the SHA-256 of the token in hex", () => {
    expect(hashToken("abc")).toBe(createHash("sha256").update("abc").digest("hex"));
  });
});

describe("the session cookie", () => {
  test("over https it is __Host- and Secure", () => {
    const settings = { appOrigin: "https://app.example.edu" };
    expect(cookieName(settings)).toBe("__Host-diagramble-session");
    expect(cookieOptions(settings)).toEqual({
      httpOnly: true,
      secure: true,
      path: "/",
      sameSite: "lax",
      maxAge: 24 * 60 * 60,
    });
  });

  test("on http://localhost it has a plain name and is not Secure", () => {
    const settings = { appOrigin: "http://localhost:3000" };
    expect(cookieName(settings)).toBe("diagramble-session");
    expect(cookieOptions(settings).secure).toBe(false);
    expect(SESSION_SECONDS).toBe(86400);
  });
});

test("a launch session's cookie is Secure, HttpOnly, SameSite=None, Partitioned, Path=/ for 24 hours", () => {
  expect(launchCookieOptions()).toEqual({
    httpOnly: true,
    secure: true,
    path: "/",
    sameSite: "none",
    partitioned: true,
    maxAge: SESSION_SECONDS,
  });
});

describe("hostPrefix", () => {
  test("is __Host- over https and nothing otherwise", () => {
    expect(hostPrefix({ appOrigin: "https://app.example.edu" })).toBe("__Host-");
    expect(hostPrefix({ appOrigin: "http://localhost:3000" })).toBe("");
    expect(hostPrefix({ appOrigin: "http://app.localhost:3000" })).toBe("");
  });
});

describe("clearingOptions", () => {
  test("keeps what makes a cookie the same cookie and ends it at once", () => {
    expect(clearingOptions(cookieOptions({ appOrigin: "https://app.example.edu" }))).toEqual({
      httpOnly: true,
      secure: true,
      path: "/",
      sameSite: "lax",
      maxAge: 0,
      expires: new Date(0),
    });
  });

  test("keeps Partitioned and SameSite=None for a launch cookie", () => {
    expect(clearingOptions(launchCookieOptions())).toEqual({
      httpOnly: true,
      secure: true,
      path: "/",
      sameSite: "none",
      partitioned: true,
      maxAge: 0,
      expires: new Date(0),
    });
  });

  test("has secure as a boolean over http", () => {
    expect(clearingOptions(cookieOptions({ appOrigin: "http://localhost:3000" })).secure).toBe(false);
  });
});

import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import { cookieName, cookieOptions, hashToken, launchCookieOptions, newToken, SESSION_SECONDS } from "./sessions.ts";

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

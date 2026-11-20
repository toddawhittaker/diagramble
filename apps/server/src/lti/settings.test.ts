import { generateKeyPairSync } from "node:crypto";
import { describe, expect, test } from "vitest";
import { readLtiSettings } from "./settings.ts";

const pem = (bits: number) =>
  generateKeyPairSync("rsa", { modulusLength: bits })
    .privateKey.export({ format: "pem", type: "pkcs8" })
    .toString();
const KEY = pem(2048);

const good = {
  LTI_ISSUER: "https://canvas.instructure.com",
  LTI_CLIENT_ID: "10000000000001",
  LTI_DEPLOYMENT_ID: "1:abcdef",
  LTI_AUTH_URL: "https://sso.canvaslms.com/api/lti/authorize_redirect",
  LTI_KEYS_URL: "https://sso.canvaslms.com/api/lti/security/jwks",
  LTI_FRAME_ORIGINS: "https://school.instructure.com",
  LTI_TOOL_KEY: KEY,
};
const NAMES = Object.keys(good);

describe("readLtiSettings", () => {
  test("reads the seven variables", () => {
    expect(readLtiSettings(good)).toEqual({
      issuer: good.LTI_ISSUER,
      clientId: good.LTI_CLIENT_ID,
      deploymentId: good.LTI_DEPLOYMENT_ID,
      authUrl: good.LTI_AUTH_URL,
      keysUrl: good.LTI_KEYS_URL,
      frameOrigins: ["https://school.instructure.com"],
      toolKey: KEY,
    });
  });

  test("is null when none is set, and when each is empty", () => {
    expect(readLtiSettings({})).toBeNull();
    expect(readLtiSettings({ DATABASE_URL: "postgres://db/x" })).toBeNull();
    expect(readLtiSettings(Object.fromEntries(NAMES.map((n) => [n, ""])))).toBeNull();
  });

  test("takes the addresses of a local platform over http", () => {
    for (const host of ["localhost:4000", "mock.localhost:4000", "mock-lti:4000", "localhost"]) {
      const s = readLtiSettings({
        ...good,
        LTI_AUTH_URL: `http://${host}/authorize`,
        LTI_KEYS_URL: `http://${host}/jwks`,
      });
      expect(s?.authUrl).toBe(`http://${host}/authorize`);
    }
  });

  test("takes several frame origins, separated by any spaces", () => {
    const s = readLtiSettings({
      ...good,
      LTI_FRAME_ORIGINS: "  https://a.example.edu   https://b.example.edu\thttp://localhost:4000 ",
    });
    expect(s?.frameOrigins).toEqual(["https://a.example.edu", "https://b.example.edu", "http://localhost:4000"]);
  });

  test.each(NAMES.map((name) => [name]))("names %s when it is the only one missing", (name) => {
    const { [name]: _left, ...rest } = good as Record<string, string>;
    expect(() => readLtiSettings(rest)).toThrow(`The LTI settings are set all together or not at all, and ${name} is missing.`);
  });

  test("names every missing variable when several are", () => {
    const { LTI_ISSUER: _a, LTI_TOOL_KEY: _b, LTI_KEYS_URL: _c, ...rest } = good;
    expect(() => readLtiSettings(rest)).toThrow("and LTI_ISSUER, LTI_KEYS_URL, LTI_TOOL_KEY are missing.");
    expect(() => readLtiSettings({ LTI_ISSUER: "x" })).toThrow(/LTI_CLIENT_ID, LTI_DEPLOYMENT_ID.*are missing/);
  });

  test("counts an empty value as missing", () => {
    expect(() => readLtiSettings({ ...good, LTI_CLIENT_ID: "" })).toThrow("LTI_CLIENT_ID is missing");
  });

  test.each([
    ["LTI_AUTH_URL", "http://canvas.example.edu/authorize"],
    ["LTI_AUTH_URL", "ftp://localhost/authorize"],
    ["LTI_AUTH_URL", "canvas.example.edu/authorize"],
    ["LTI_AUTH_URL", "http://127.0.0.1:4000/authorize"],
    ["LTI_AUTH_URL", "http://[::1]:4000/authorize"],
    ["LTI_AUTH_URL", "http://localhost.example.edu/authorize"],
    ["LTI_KEYS_URL", "http://platform.example.edu/jwks"],
    ["LTI_KEYS_URL", "not a url"],
    ["LTI_FRAME_ORIGINS", " "],
    ["LTI_FRAME_ORIGINS", "https://school.instructure.com/"],
    ["LTI_FRAME_ORIGINS", "https://school.instructure.com/path"],
    ["LTI_FRAME_ORIGINS", "http://school.instructure.com"],
    ["LTI_FRAME_ORIGINS", "*"],
    ["LTI_FRAME_ORIGINS", "https://a.example.edu 'self'"],
    ["LTI_FRAME_ORIGINS", "https://a.example.edu; script-src *"],
    ["LTI_FRAME_ORIGINS", "https://a.example.edu,https://b.example.edu"],
    ["LTI_TOOL_KEY", "not a key"],
    ["LTI_TOOL_KEY", pem(1024)],
    [
      "LTI_TOOL_KEY",
      generateKeyPairSync("ec", { namedCurve: "P-256" }).privateKey.export({ format: "pem", type: "pkcs8" }).toString(),
    ],
    [
      "LTI_TOOL_KEY",
      generateKeyPairSync("rsa", { modulusLength: 2048 }).publicKey.export({ format: "pem", type: "spki" }).toString(),
    ],
  ])("refuses a bad %s: %j", (name, value) => {
    expect(() => readLtiSettings({ ...good, [name]: value })).toThrow(new RegExp(`^The setting ${name} must`));
  });

  test("never puts the tool key in an error", () => {
    expect(() => readLtiSettings({ ...good, LTI_TOOL_KEY: pem(1024) })).toThrow(/^(?!.*PRIVATE KEY)/s);
  });

  test("takes the first bad variable in the order of the list", () => {
    expect(() => readLtiSettings({ ...good, LTI_KEYS_URL: "nope", LTI_TOOL_KEY: "nope" })).toThrow(
      /^The setting LTI_KEYS_URL must/,
    );
  });
});

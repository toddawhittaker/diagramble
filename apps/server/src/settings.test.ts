import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { readSettings } from "./settings.ts";

const TOOL_KEY = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ type: "pkcs8", format: "pem" }) as string;
const dir = mkdtempSync(path.join(tmpdir(), "diagramble-settings-"));
const good = {
  DATABASE_URL: "postgres://u:p@db:5432/diagramble",
  APP_ORIGIN: "https://app.example.edu",
  STATIC_DIR: dir,
};

describe("readSettings", () => {
  test("reads good values and fills the defaults", () => {
    expect(readSettings(good)).toEqual({
      databaseUrl: good.DATABASE_URL,
      appOrigin: good.APP_ORIGIN,
      port: 3000,
      trustProxyHops: 0,
      staticDir: dir,
      lti: null,
    });
  });

  test("takes a port, proxy hops, postgresql:// and a local http origin", () => {
    const s = readSettings({
      ...good,
      DATABASE_URL: "postgresql://db/x",
      APP_ORIGIN: "http://diagramble.localhost:8080",
      PORT: "8080",
      TRUST_PROXY_HOPS: "1",
    });
    expect(s).toMatchObject({ port: 8080, trustProxyHops: 1 });
    expect(readSettings({ ...good, APP_ORIGIN: "http://localhost" }).appOrigin).toBe("http://localhost");
  });

  test.each([
    ["DATABASE_URL", undefined],
    ["DATABASE_URL", "mysql://db/x"],
    ["DATABASE_URL", "postgres://"],
    ["APP_ORIGIN", undefined],
    ["APP_ORIGIN", "http://app.example.edu"],
    ["APP_ORIGIN", "https://app.example.edu/"],
    ["APP_ORIGIN", "https://app.example.edu/path"],
    ["APP_ORIGIN", "HTTPS://APP.example.edu"],
    ["APP_ORIGIN", "ftp://localhost"],
    ["APP_ORIGIN", "not a url"],
    ["PORT", "abc"],
    ["PORT", "-1"],
    ["PORT", "3000.5"],
    ["PORT", "70000"],
    ["PORT", ""],
    ["TRUST_PROXY_HOPS", "one"],
    ["STATIC_DIR", undefined],
    ["STATIC_DIR", path.join(dir, "missing")],
  ])("refuses %s = %s with one sentence naming it", (name, value) => {
    expect(() => readSettings({ ...good, [name]: value })).toThrow(
      new RegExp(`^The setting ${name} must .*\\.$`),
    );
  });

  test("refuses a file as STATIC_DIR", () => {
    expect(() => readSettings({ ...good, STATIC_DIR: import.meta.filename })).toThrow(/STATIC_DIR/);
  });

  test("reads the LTI settings when they are set, and refuses some without the rest", () => {
    const lti = {
      LTI_ISSUER: "https://canvas.example.edu",
      LTI_CLIENT_ID: "1000",
      LTI_DEPLOYMENT_ID: "1:abc",
      LTI_AUTH_URL: "https://sso.canvaslms.com/api/lti/authorize_redirect",
      LTI_KEYS_URL: "https://sso.canvaslms.com/api/lti/security/jwks",
      LTI_FRAME_ORIGINS: "https://school.instructure.com",
      LTI_TOOL_KEY: TOOL_KEY,
    };
    expect(readSettings({ ...good, ...lti }).lti).toMatchObject({ issuer: lti.LTI_ISSUER, frameOrigins: [lti.LTI_FRAME_ORIGINS] });
    expect(() => readSettings({ ...good, LTI_ISSUER: lti.LTI_ISSUER })).toThrow(/LTI_CLIENT_ID/);
  });
});

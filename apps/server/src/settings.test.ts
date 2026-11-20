import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { readSettings } from "./settings.ts";

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
});

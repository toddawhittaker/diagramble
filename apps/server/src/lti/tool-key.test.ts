import { createHash, generateKeyPairSync } from "node:crypto";
import { describe, expect, test } from "vitest";
import { toolJwks } from "./tool-key.ts";

const pem = (key: { export: (o: { format: "pem"; type: "pkcs8" }) => string | Buffer }) =>
  key.export({ format: "pem", type: "pkcs8" }).toString();
const rsaPem = pem(generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey);
const ecPem = pem(generateKeyPairSync("ec", { namedCurve: "P-256" }).privateKey);

describe("toolJwks", () => {
  test("publishes one key with only the public members", () => {
    const { keys } = toolJwks(rsaPem);
    expect(keys).toHaveLength(1);
    const key = keys[0];
    expect(Object.keys(key ?? {}).sort()).toEqual(["alg", "e", "kid", "kty", "n", "use"]);
    expect(key).toMatchObject({ kty: "RSA", alg: "RS256", use: "sig" });
    expect(JSON.stringify(keys)).not.toMatch(/"(d|p|q|dp|dq|qi)"/);
  });

  test("takes the RFC 7638 thumbprint as the key ID", () => {
    const key = toolJwks(rsaPem).keys[0];
    const thumbprint = createHash("sha256")
      .update(JSON.stringify({ e: key?.e, kty: "RSA", n: key?.n }))
      .digest("base64url");
    expect(key?.kid).toBe(thumbprint);
  });

  test("gives one key the same ID every time, and two keys different ones", () => {
    const other = pem(generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey);
    expect(toolJwks(rsaPem).keys[0]?.kid).toBe(toolJwks(rsaPem).keys[0]?.kid);
    expect(toolJwks(other).keys[0]?.kid).not.toBe(toolJwks(rsaPem).keys[0]?.kid);
  });

  test("throws for a key that is not RSA", () => {
    expect(() => toolJwks(ecPem)).toThrow(/not an RSA key/);
  });
});

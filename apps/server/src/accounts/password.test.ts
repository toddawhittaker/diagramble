import { randomBytes } from "node:crypto";
import { describe, expect, test, vi } from "vitest";
import {
  generatePassword,
  hashPassword,
  normalizeUsername,
  verifyAgainstDummy,
  verifyPassword,
} from "./password.ts";

// Several scrypt hashes in one test can outlast the default 5 s while the suite runs in parallel.
vi.setConfig({ testTimeout: 20_000, hookTimeout: 20_000 });

const STORED_FORM = /^\$scrypt\$ln=15,r=8,p=3\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/;

describe("hashPassword and verifyPassword", () => {
  test("a hash names its settings and holds a 16-byte salt and a 32-byte key", async () => {
    const stored = await hashPassword("correct horse battery");
    expect(stored).toMatch(STORED_FORM);
    const [, , , salt, key] = stored.split("$");
    expect(Buffer.from(salt ?? "", "base64url")).toHaveLength(16);
    expect(Buffer.from(key ?? "", "base64url")).toHaveLength(32);
  });

  test("the right password verifies and a wrong one does not", async () => {
    const stored = await hashPassword("correct horse battery");
    expect(await verifyPassword("correct horse battery", stored)).toBe(true);
    expect(await verifyPassword("correct horse batterz", stored)).toBe(false);
    expect(await verifyPassword("", stored)).toBe(false);
  });

  test("the same password hashed twice gives two different strings that both verify", async () => {
    const a = await hashPassword("same password here");
    const b = await hashPassword("same password here");
    expect(a).not.toBe(b);
    expect(await verifyPassword("same password here", a)).toBe(true);
    expect(await verifyPassword("same password here", b)).toBe(true);
  });

  test("a changed salt or a changed key fails", async () => {
    const stored = await hashPassword("correct horse battery");
    const [, , params, salt, key] = stored.split("$");
    const otherSalt = randomBytes(16).toString("base64url");
    expect(await verifyPassword("correct horse battery", `$scrypt$${params}$${otherSalt}$${key}`)).toBe(false);
    const otherKey = randomBytes(32).toString("base64url");
    expect(await verifyPassword("correct horse battery", `$scrypt$${params}$${salt}$${otherKey}`)).toBe(false);
  });

  test("it reads the settings from the stored string, not from constants", async () => {
    // Made with a smaller cost than today's, as a later version might store.
    const { scrypt } = await import("node:crypto");
    const salt = randomBytes(16);
    const key = await new Promise<Buffer>((resolve, reject) =>
      scrypt("older password", salt, 24, { N: 2 ** 10, r: 4, p: 1 }, (e, k) => (e ? reject(e) : resolve(k))),
    );
    const stored = `$scrypt$ln=10,r=4,p=1$${salt.toString("base64url")}$${key.toString("base64url")}`;
    expect(await verifyPassword("older password", stored)).toBe(true);
    expect(await verifyPassword("other password", stored)).toBe(false);
  });

  test.each([
    ["an empty string", ""],
    ["plain text", "not a hash"],
    ["another scheme", "$argon2id$v=19$m=65536,t=3,p=4$c2FsdHNhbHQ$aGFzaGhhc2g"],
    ["a missing key", "$scrypt$ln=15,r=8,p=3$AAAAAAAAAAAAAAAAAAAAAA"],
    ["an empty key", "$scrypt$ln=15,r=8,p=3$AAAAAAAAAAAAAAAAAAAAAA$"],
    ["an empty salt", "$scrypt$ln=15,r=8,p=3$$AAAA"],
    ["an extra field", "$scrypt$ln=15,r=8,p=3$AAAAAAAAAAAAAAAAAAAAAA$AAAA$AAAA"],
    ["settings out of order", "$scrypt$r=8,ln=15,p=3$AAAAAAAAAAAAAAAAAAAAAA$AAAA"],
    ["a word for a number", "$scrypt$ln=x,r=8,p=3$AAAAAAAAAAAAAAAAAAAAAA$AAAA"],
    ["zero cost", "$scrypt$ln=0,r=8,p=3$AAAAAAAAAAAAAAAAAAAAAA$AAAA"],
    ["a cost too large to allow", "$scrypt$ln=40,r=8,p=3$AAAAAAAAAAAAAAAAAAAAAA$AAAA"],
    ["a block size too large to allow", "$scrypt$ln=10,r=999,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAA"],
    ["characters outside base64url", "$scrypt$ln=10,r=8,p=1$AAAAAAAAAAAAAAAAAAAA+/==$AAAA"],
  ])("a malformed string (%s) is a mismatch, not an error", async (_name, stored) => {
    await expect(verifyPassword("anything", stored)).resolves.toBe(false);
  });
});

describe("verifyAgainstDummy", () => {
  test("is always false, for any password", async () => {
    expect(await verifyAgainstDummy("anything")).toBe(false);
    expect(await verifyAgainstDummy("")).toBe(false);
  });

  test("does about the same work as a real check", async () => {
    const stored = await hashPassword("some password here");
    const timeOf = async (run: () => Promise<boolean>): Promise<number> => {
      const start = performance.now();
      await run();
      return performance.now() - start;
    };
    const real = Math.min(
      await timeOf(() => verifyPassword("wrong", stored)),
      await timeOf(() => verifyPassword("wrong", stored)),
    );
    const dummy = Math.min(
      await timeOf(() => verifyAgainstDummy("wrong")),
      await timeOf(() => verifyAgainstDummy("wrong")),
    );
    // Both run a full scrypt; a short-circuit would be orders of magnitude faster.
    expect(dummy).toBeGreaterThan(real / 3);
  });
});

describe("generatePassword", () => {
  test("is 20 characters from a lowercase, digit-only alphabet without look-alikes", () => {
    for (let i = 0; i < 200; i++) {
      expect(generatePassword()).toMatch(/^[a-hjkmnp-z2-9]{20}$/);
    }
  });

  test("differs each time", () => {
    const seen = new Set(Array.from({ length: 200 }, () => generatePassword()));
    expect(seen.size).toBe(200);
  });

  test("uses every character of the alphabet about equally, with no modulo bias", () => {
    const counts = new Map<string, number>();
    const total = 31 * 4000;
    for (let i = 0; i < total / 20; i++) {
      for (const ch of generatePassword()) counts.set(ch, (counts.get(ch) ?? 0) + 1);
    }
    expect(counts.size).toBe(31);
    const expected = total / 31;
    for (const n of counts.values()) {
      expect(n).toBeGreaterThan(expected * 0.8);
      expect(n).toBeLessThan(expected * 1.2);
    }
  });

  test("a generated password hashes and verifies", async () => {
    const password = generatePassword();
    expect(await verifyPassword(password, await hashPassword(password))).toBe(true);
  });
});

describe("normalizeUsername", () => {
  test("lowercases a valid name", () => {
    expect(normalizeUsername("Ada.Lovelace")).toBe("ada.lovelace");
    expect(normalizeUsername("ADA_99-x")).toBe("ada_99-x");
  });

  test("accepts one character, digits first, and 64 characters", () => {
    expect(normalizeUsername("a")).toBe("a");
    expect(normalizeUsername("7up")).toBe("7up");
    expect(normalizeUsername("a".repeat(64))).toBe("a".repeat(64));
  });

  test.each([
    ["empty", ""],
    ["65 characters", "a".repeat(65)],
    ["starting with a dot", ".ada"],
    ["starting with a hyphen", "-ada"],
    ["starting with an underscore", "_ada"],
    ["with a space", "ada lovelace"],
    ["with a slash", "ada/lovelace"],
    ["with a trailing newline", "ada\n"],
    ["with surrounding spaces", " ada "],
    ["with an accent", "adá"],
    ["with an at sign", "ada@example.org"],
    ["with the Kelvin sign, which lowercases to k", "Ken"],
  ])("refuses a name %s", (_name, raw) => {
    expect(normalizeUsername(raw)).toBeUndefined();
  });
});

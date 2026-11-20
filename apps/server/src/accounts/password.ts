import { randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";

/**
 * Password hashing for the password sign-in method (SPEC.md section 1,
 * "Sign-in"). A hash is scrypt, stored as
 * `$scrypt$ln=<log2 N>,r=<r>,p=<p>$<salt>$<hash>` with the salt and hash in
 * base64url, so the string names its own settings and they can be raised later.
 */

const LOG_N = 15;
const R = 8;
const P = 3;
const SALT_BYTES = 16;
const KEY_BYTES = 32;

/** Bounds on the settings read back from a stored string, so a damaged row cannot ask for unbounded memory or time. */
const MAX_LOG_N = 20;
const MAX_R = 32;
const MAX_P = 16;
const MAX_KEY_BYTES = 64;

const STORED_FORM = /^\$scrypt\$ln=(\d{1,2}),r=(\d{1,3}),p=(\d{1,3})\$([A-Za-z0-9_-]+)\$([A-Za-z0-9_-]+)$/;

interface ParsedHash {
  logN: number;
  r: number;
  p: number;
  salt: Buffer;
  key: Buffer;
}

function parse(stored: string): ParsedHash | undefined {
  const match = STORED_FORM.exec(stored);
  if (!match) return undefined;
  const logN = Number(match[1]);
  const r = Number(match[2]);
  const p = Number(match[3]);
  const salt = Buffer.from(match[4] ?? "", "base64url");
  const key = Buffer.from(match[5] ?? "", "base64url");
  if (logN < 1 || logN > MAX_LOG_N || r < 1 || r > MAX_R || p < 1 || p > MAX_P) return undefined;
  if (salt.length === 0 || key.length === 0 || key.length > MAX_KEY_BYTES) return undefined;
  return { logN, r, p, salt, key };
}

function derive(password: string, salt: Buffer, keyBytes: number, logN: number, r: number, p: number): Promise<Buffer> {
  const N = 2 ** logN;
  // scrypt needs about 128 * N * r bytes, and Node refuses more than 32 MiB by default.
  const maxmem = 256 * N * r + 128 * r * p;
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyBytes, { N, r, p, maxmem }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

/** Hash a password with a fresh random salt. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(password, salt, KEY_BYTES, LOG_N, R, P);
  return `$scrypt$ln=${LOG_N},r=${R},p=${P}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

/** Whether `password` matches `stored`. A string that is not a well-formed hash is a mismatch. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parse(stored);
  if (!parsed) return false;
  const key = await derive(password, parsed.salt, parsed.key.length, parsed.logN, parsed.r, parsed.p);
  return timingSafeEqual(key, parsed.key);
}

/** A well-formed hash that no password matches in practice, for a username with no account. */
const DUMMY_HASH = `$scrypt$ln=${LOG_N},r=${R},p=${P}$${Buffer.alloc(SALT_BYTES).toString("base64url")}$${Buffer.alloc(KEY_BYTES).toString("base64url")}`;

/**
 * Do the work of a real check against a fixed dummy hash and answer false, so
 * the time taken does not reveal that a username is unknown (SPEC.md section 1,
 * "Sign-in").
 */
export async function verifyAgainstDummy(password: string): Promise<false> {
  await verifyPassword(password, DUMMY_HASH);
  return false;
}

/**
 * The characters a generated password uses: lowercase letters and the digits 2
 * to 9, without i, l and o, 0 and 1, which look alike. 31 characters, so 20 of
 * them carry about 99 bits.
 */
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/** A random password of 20 characters, for `make` and `set-password`. */
export function generatePassword(): string {
  let password = "";
  // randomInt draws without modulo bias.
  for (let i = 0; i < 20; i++) password += ALPHABET[randomInt(ALPHABET.length)];
  return password;
}

const USERNAME_FORM = /^[a-z0-9][a-z0-9._-]{0,63}$/;

/**
 * The username lowercased, or `undefined` when it is not 1 to 64 characters of
 * lowercase letters, digits, dot, underscore and hyphen starting with a letter
 * or digit. The rule keeps the login safe in export file names (SPEC.md section
 * 1, "Sign-in"). Only A to Z are lowercased, so no other character can turn into
 * an ASCII letter.
 */
export function normalizeUsername(raw: string): string | undefined {
  const lower = raw.replace(/[A-Z]/g, (c) => c.toLowerCase());
  return USERNAME_FORM.test(lower) ? lower : undefined;
}

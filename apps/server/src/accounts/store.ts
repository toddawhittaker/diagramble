import { randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import { sql } from "kysely";
import type { Database } from "../db/schema.ts";

/** A password account is a `password` method whose issuer is empty and whose subject is the username. */
const PASSWORD_ISSUER = "";

const UNIQUE_VIOLATION = "23505";

/** Thrown by `createPasswordAccount` when the username already has a password method. */
export class UsernameTakenError extends Error {
  readonly username: string;

  constructor(username: string) {
    super(`The username "${username}" is already taken.`);
    this.name = "UsernameTakenError";
    this.username = username;
  }
}

/**
 * Make an account and its password method in one transaction. The username
 * arrives already normalized and becomes the account's login. Throws
 * `UsernameTakenError` when a password method already has that username; the
 * database's unique key decides, so two simultaneous calls cannot both win.
 */
export async function createPasswordAccount(
  db: Kysely<Database>,
  username: string,
  passwordHash: string,
): Promise<{ accountId: string; methodId: string }> {
  try {
    return await db.transaction().execute(async (trx) => {
      const account = await trx
        .insertInto("accounts")
        .values({ login: username })
        .returning("id")
        .executeTakeFirstOrThrow();
      const method = await trx
        .insertInto("sign_in_methods")
        .values({
          account_id: account.id,
          kind: "password",
          issuer: PASSWORD_ISSUER,
          subject: username,
          password_hash: passwordHash,
        })
        .returning("id")
        .executeTakeFirstOrThrow();
      return { accountId: account.id, methodId: method.id };
    });
  } catch (error) {
    if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
      throw new UsernameTakenError(username);
    }
    throw error;
  }
}

/** The password method of a username, with whether its account is disabled; `undefined` when there is none. */
export async function findPasswordMethod(
  db: Kysely<Database>,
  username: string,
): Promise<
  { accountId: string; methodId: string; passwordHash: string; disabled: boolean } | undefined
> {
  const row = await db
    .selectFrom("sign_in_methods")
    .innerJoin("accounts", "accounts.id", "sign_in_methods.account_id")
    .select([
      "accounts.id as accountId",
      "sign_in_methods.id as methodId",
      "sign_in_methods.password_hash as passwordHash",
      "accounts.disabled_at as disabledAt",
    ])
    .where("sign_in_methods.kind", "=", "password")
    .where("sign_in_methods.issuer", "=", PASSWORD_ISSUER)
    .where("sign_in_methods.subject", "=", username)
    .executeTakeFirst();
  if (!row || row.passwordHash === null) return undefined;
  return {
    accountId: row.accountId,
    methodId: row.methodId,
    passwordHash: row.passwordHash,
    disabled: row.disabledAt !== null,
  };
}

/** Replace the hash of a password method. */
export async function setPasswordHash(
  db: Kysely<Database>,
  methodId: string,
  passwordHash: string,
): Promise<void> {
  await db
    .updateTable("sign_in_methods")
    .set({ password_hash: passwordHash })
    .where("id", "=", methodId)
    .where("kind", "=", "password")
    .execute();
}

/** Disable or enable an account. Disabling an already disabled account keeps its first time. */
export async function setDisabled(
  db: Kysely<Database>,
  accountId: string,
  disabled: boolean,
): Promise<void> {
  await db
    .updateTable("accounts")
    .set({ disabled_at: disabled ? sql<Date>`coalesce(disabled_at, now())` : null })
    .where("id", "=", accountId)
    .execute();
}

/** Store a session, and delete every session that has already expired. */
export async function createSession(
  db: Kysely<Database>,
  session: { id: string; accountId: string; methodId: string; expiresAt: Date },
): Promise<void> {
  await db.deleteFrom("sessions").where("expires_at", "<=", sql<Date>`now()`).execute();
  await db
    .insertInto("sessions")
    .values({
      id: session.id,
      account_id: session.accountId,
      method_id: session.methodId,
      expires_at: session.expiresAt,
    })
    .execute();
}

/**
 * The person behind a session id, or `undefined` when the session is unknown,
 * expired at `now`, or belongs to a disabled account.
 */
export async function loadSession(
  db: Kysely<Database>,
  id: string,
  now: Date,
): Promise<{ accountId: string; methodId: string; login: string } | undefined> {
  return db
    .selectFrom("sessions")
    .innerJoin("accounts", "accounts.id", "sessions.account_id")
    .select(["accounts.id as accountId", "sessions.method_id as methodId", "accounts.login as login"])
    .where("sessions.id", "=", id)
    .where("sessions.expires_at", ">", now)
    .where("accounts.disabled_at", "is", null)
    .executeTakeFirst();
}

/** End one session. */
export async function deleteSession(db: Kysely<Database>, id: string): Promise<void> {
  await db.deleteFrom("sessions").where("id", "=", id).execute();
}

/** End every session of an account. */
export async function deleteSessionsFor(db: Kysely<Database>, accountId: string): Promise<void> {
  await db.deleteFrom("sessions").where("account_id", "=", accountId).execute();
}

/** An `lti` method and its account. The method's issuer is the platform's `iss` exactly as sent. */
export interface LtiMethod {
  accountId: string;
  methodId: string;
  disabled: boolean;
}

/** The longest login an account takes (SPEC.md section 3.9). */
const MAX_LOGIN_LENGTH = 255;

function capLogin(value: string): string {
  return [...value].slice(0, MAX_LOGIN_LENGTH).join("");
}

/**
 * The login a new account made by a launch gets (SPEC.md section 3.9). It is the
 * platform's login ID, trimmed and cut to 255 characters. A missing or empty one,
 * or one starting with `$` (the platform left a variable unfilled), gives way to
 * the part of the email before `@`, and with no usable email, to `user` followed
 * by the first 8 characters of the account ID.
 */
export function chooseLtiLogin(
  claims: { loginId?: string | null; email?: string | null },
  accountId: string,
): string {
  const loginId = claims.loginId?.trim() ?? "";
  if (loginId !== "" && !loginId.startsWith("$")) return capLogin(loginId);
  const email = claims.email ?? "";
  const at = email.indexOf("@");
  const local = at > 0 ? email.slice(0, at).trim() : "";
  if (local !== "") return capLogin(local);
  return `user${accountId.slice(0, 8)}`;
}

/**
 * The `lti` method of a platform's person, found by the platform's `iss` and the
 * person's `sub`; `undefined` when there is none. A password method is never
 * returned, whatever its login.
 */
export async function findLtiMethod(
  db: Kysely<Database>,
  issuer: string,
  subject: string,
): Promise<LtiMethod | undefined> {
  const row = await db
    .selectFrom("sign_in_methods")
    .innerJoin("accounts", "accounts.id", "sign_in_methods.account_id")
    .select([
      "accounts.id as accountId",
      "sign_in_methods.id as methodId",
      "accounts.disabled_at as disabledAt",
    ])
    .where("sign_in_methods.kind", "=", "lti")
    .where("sign_in_methods.issuer", "=", issuer)
    .where("sign_in_methods.subject", "=", subject)
    .executeTakeFirst();
  if (!row) return undefined;
  return { accountId: row.accountId, methodId: row.methodId, disabled: row.disabledAt !== null };
}

/**
 * Make an account and its `lti` method in one transaction, for a person's first
 * launch. The login is chosen by `chooseLtiLogin` from the launch's claims and the
 * new account's ID, which is made here. When another first launch of the same
 * person wins the unique key, this returns the winner's account and method.
 */
export async function createLtiAccount(
  db: Kysely<Database>,
  person: { issuer: string; subject: string; loginId?: string | null; email?: string | null },
): Promise<LtiMethod> {
  const accountId = randomUUID();
  try {
    return await db.transaction().execute(async (trx) => {
      await trx
        .insertInto("accounts")
        .values({ id: accountId, login: chooseLtiLogin(person, accountId) })
        .execute();
      const method = await trx
        .insertInto("sign_in_methods")
        .values({
          account_id: accountId,
          kind: "lti",
          issuer: person.issuer,
          subject: person.subject,
          password_hash: null,
        })
        .returning("id")
        .executeTakeFirstOrThrow();
      return { accountId, methodId: method.id, disabled: false };
    });
  } catch (error) {
    if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
      const winner = await findLtiMethod(db, person.issuer, person.subject);
      if (winner) return winner;
    }
    throw error;
  }
}

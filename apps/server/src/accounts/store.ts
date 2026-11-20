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

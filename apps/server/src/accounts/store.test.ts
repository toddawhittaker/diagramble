import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { type TestDb, createTestDb } from "../db/testing.ts";
import {
  UsernameTakenError,
  chooseLtiLogin,
  createLtiAccount,
  createPasswordAccount,
  createSession,
  deleteSession,
  deleteSessionsFor,
  findLtiMethod,
  findPasswordMethod,
  loadSession,
  setDisabled,
  setPasswordHash,
} from "./store.ts";

let testDb: TestDb;
let db: TestDb["db"];
beforeAll(async () => {
  testDb = await createTestDb();
  db = testDb.db;
});
afterAll(async () => {
  await testDb.drop();
});

const hour = 60 * 60 * 1000;
const now = new Date("2030-01-01T12:00:00Z");
const later = new Date(now.getTime() + hour);
const earlier = new Date(now.getTime() - hour);

async function sessionCount(accountId: string): Promise<number> {
  const row = await db
    .selectFrom("sessions")
    .select((eb) => eb.fn.countAll<string>().as("n"))
    .where("account_id", "=", accountId)
    .executeTakeFirstOrThrow();
  return Number(row.n);
}

describe("createPasswordAccount", () => {
  test("makes an account whose login is the username, and a password method", async () => {
    const { accountId, methodId } = await createPasswordAccount(db, "ada", "hash-1");
    const account = await db.selectFrom("accounts").selectAll().where("id", "=", accountId).executeTakeFirstOrThrow();
    expect(account.login).toBe("ada");
    expect(account.disabled_at).toBeNull();
    expect(account.created_at).toBeInstanceOf(Date);
    const method = await db.selectFrom("sign_in_methods").selectAll().where("id", "=", methodId).executeTakeFirstOrThrow();
    expect(method).toMatchObject({
      account_id: accountId,
      kind: "password",
      issuer: "",
      subject: "ada",
      password_hash: "hash-1",
    });
  });

  test("gives each account an id of its own", async () => {
    const a = await createPasswordAccount(db, "ids-a", "h");
    const b = await createPasswordAccount(db, "ids-b", "h");
    expect(a.accountId).not.toBe(b.accountId);
    expect(a.methodId).not.toBe(b.methodId);
  });

  test("refuses a taken username with UsernameTakenError and leaves no second account", async () => {
    await createPasswordAccount(db, "grace", "hash-1");
    const error = await createPasswordAccount(db, "grace", "hash-2").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UsernameTakenError);
    expect((error as UsernameTakenError).username).toBe("grace");
    expect((error as Error).message).toBe('The username "grace" is already taken.');
    const accounts = await db.selectFrom("accounts").select("id").where("login", "=", "grace").execute();
    expect(accounts).toHaveLength(1);
    expect((await findPasswordMethod(db, "grace"))?.passwordHash).toBe("hash-1");
  });

  test("lets only one of two simultaneous calls win", async () => {
    const results = await Promise.allSettled([
      createPasswordAccount(db, "race", "h1"),
      createPasswordAccount(db, "race", "h2"),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const lost = results.find((r) => r.status === "rejected");
    expect((lost as PromiseRejectedResult).reason).toBeInstanceOf(UsernameTakenError);
    expect(await db.selectFrom("accounts").select("id").where("login", "=", "race").execute()).toHaveLength(1);
  });

  test("rethrows an error that is not a taken username", async () => {
    const error = await createPasswordAccount(db, "no-hash", null as unknown as string).catch((e: unknown) => e);
    expect(error).not.toBeInstanceOf(UsernameTakenError);
    expect(error).toBeInstanceOf(Error);
    expect(await findPasswordMethod(db, "no-hash")).toBeUndefined();
    expect(await db.selectFrom("accounts").select("id").where("login", "=", "no-hash").execute()).toEqual([]);
  });
});

describe("findPasswordMethod", () => {
  test("returns the ids, the hash and whether the account is disabled", async () => {
    const { accountId, methodId } = await createPasswordAccount(db, "find-me", "hash-f");
    expect(await findPasswordMethod(db, "find-me")).toEqual({
      accountId,
      methodId,
      passwordHash: "hash-f",
      disabled: false,
    });
    await setDisabled(db, accountId, true);
    expect((await findPasswordMethod(db, "find-me"))?.disabled).toBe(true);
    await setDisabled(db, accountId, false);
    expect((await findPasswordMethod(db, "find-me"))?.disabled).toBe(false);
  });

  test("returns undefined for an unknown username", async () => {
    expect(await findPasswordMethod(db, "nobody")).toBeUndefined();
  });

  test("matches the username exactly, not by case", async () => {
    await createPasswordAccount(db, "exact", "h");
    expect(await findPasswordMethod(db, "EXACT")).toBeUndefined();
  });
});

describe("setPasswordHash", () => {
  test("replaces the hash and touches no other account", async () => {
    const a = await createPasswordAccount(db, "hash-a", "old-a");
    await createPasswordAccount(db, "hash-b", "old-b");
    await setPasswordHash(db, a.methodId, "new-a");
    expect((await findPasswordMethod(db, "hash-a"))?.passwordHash).toBe("new-a");
    expect((await findPasswordMethod(db, "hash-b"))?.passwordHash).toBe("old-b");
  });
});

describe("setDisabled", () => {
  test("sets disabled_at, keeps the first time on a repeat, and clears it", async () => {
    const { accountId } = await createPasswordAccount(db, "toggle", "h");
    const disabledAt = async () =>
      (await db.selectFrom("accounts").select("disabled_at").where("id", "=", accountId).executeTakeFirstOrThrow())
        .disabled_at;

    expect(await disabledAt()).toBeNull();
    await setDisabled(db, accountId, true);
    const first = await disabledAt();
    expect(first).toBeInstanceOf(Date);
    await sql`select pg_sleep(0.01)`.execute(db);
    await setDisabled(db, accountId, true);
    expect(await disabledAt()).toEqual(first);
    await setDisabled(db, accountId, false);
    expect(await disabledAt()).toBeNull();
  });
});

describe("the schema's own rules", () => {
  test("a (kind, issuer, subject) is unique, whichever account holds it", async () => {
    const a = await createPasswordAccount(db, "unique-a", "h");
    const other = await db.insertInto("accounts").values({ login: "unique-other" }).returning("id").executeTakeFirstOrThrow();
    const insert = db.insertInto("sign_in_methods").values({
      account_id: other.id,
      kind: "password",
      issuer: "",
      subject: "unique-a",
      password_hash: "h",
    });
    await expect(insert.execute()).rejects.toMatchObject({ code: "23505" });
    expect(a.accountId).not.toBe(other.id);
  });

  test("a password method needs a hash", async () => {
    const account = await db.insertInto("accounts").values({ login: "hash-check-1" }).returning("id").executeTakeFirstOrThrow();
    await expect(
      db
        .insertInto("sign_in_methods")
        .values({ account_id: account.id, kind: "password", issuer: "", subject: "hash-check-1", password_hash: null })
        .execute(),
    ).rejects.toMatchObject({ code: "23514" });
  });

  test("only a password method may carry a hash, and only the two known kinds are allowed", async () => {
    const account = await db.insertInto("accounts").values({ login: "hash-check-2" }).returning("id").executeTakeFirstOrThrow();
    const insertKind = (kind: string, hash: string | null) =>
      sql`insert into sign_in_methods (account_id, kind, issuer, subject, password_hash)
          values (${account.id}, ${kind}, 'https://lms.example', 'sub-hash-check', ${hash})`.execute(db);
    await expect(insertKind("lti", "h")).rejects.toMatchObject({ code: "23514" });
    await expect(insertKind("other", null)).rejects.toMatchObject({ code: "23514" });
    await insertKind("lti", null);
  });

  test("deleting an account deletes its methods and sessions", async () => {
    const { accountId, methodId } = await createPasswordAccount(db, "cascade-a", "h");
    await createSession(db, { id: "cascade-a-1", accountId, methodId, expiresAt: later });
    const survivor = await createPasswordAccount(db, "cascade-b", "h");
    await createSession(db, { id: "cascade-b-1", accountId: survivor.accountId, methodId: survivor.methodId, expiresAt: later });

    await db.deleteFrom("accounts").where("id", "=", accountId).execute();

    expect(await findPasswordMethod(db, "cascade-a")).toBeUndefined();
    expect(await sessionCount(accountId)).toBe(0);
    expect(await findPasswordMethod(db, "cascade-b")).toBeDefined();
    expect(await sessionCount(survivor.accountId)).toBe(1);
  });

  test("deleting a sign-in method deletes its sessions but not the account", async () => {
    const { accountId, methodId } = await createPasswordAccount(db, "cascade-method", "h");
    await createSession(db, { id: "cascade-method-1", accountId, methodId, expiresAt: later });
    await db.deleteFrom("sign_in_methods").where("id", "=", methodId).execute();
    expect(await sessionCount(accountId)).toBe(0);
    expect(await db.selectFrom("accounts").select("id").where("id", "=", accountId).execute()).toHaveLength(1);
  });

  test("a session needs an existing account and method", async () => {
    const { accountId, methodId } = await createPasswordAccount(db, "orphan-check", "h");
    const missing = "00000000-0000-4000-8000-000000000000";
    await expect(
      createSession(db, { id: "orphan-1", accountId: missing, methodId, expiresAt: later }),
    ).rejects.toMatchObject({ code: "23503" });
    await expect(
      createSession(db, { id: "orphan-2", accountId, methodId: missing, expiresAt: later }),
    ).rejects.toMatchObject({ code: "23503" });
  });
});

describe("sessions", () => {
  test("a live session of an enabled account loads with its ids and the login", async () => {
    const { accountId, methodId } = await createPasswordAccount(db, "live", "h");
    await createSession(db, { id: "live-1", accountId, methodId, expiresAt: later });
    expect(await loadSession(db, "live-1", now)).toEqual({ accountId, methodId, login: "live" });
  });

  test("an unknown id loads nothing", async () => {
    expect(await loadSession(db, "no-such-session", now)).toBeUndefined();
  });

  test("a session is refused at and after its expiry, and accepted just before", async () => {
    const { accountId, methodId } = await createPasswordAccount(db, "expiry", "h");
    await createSession(db, { id: "expiry-1", accountId, methodId, expiresAt: later });
    expect(await loadSession(db, "expiry-1", new Date(later.getTime() - 1))).toBeDefined();
    expect(await loadSession(db, "expiry-1", later)).toBeUndefined();
    expect(await loadSession(db, "expiry-1", new Date(later.getTime() + 1))).toBeUndefined();
  });

  test("a disabled account's session is refused, and works again once enabled", async () => {
    const { accountId, methodId } = await createPasswordAccount(db, "disabled-session", "h");
    await createSession(db, { id: "disabled-1", accountId, methodId, expiresAt: later });
    await setDisabled(db, accountId, true);
    expect(await loadSession(db, "disabled-1", now)).toBeUndefined();
    await setDisabled(db, accountId, false);
    expect(await loadSession(db, "disabled-1", now)).toBeDefined();
  });

  test("making a session deletes the expired ones of every account and keeps the live ones", async () => {
    const a = await createPasswordAccount(db, "sweep-a", "h");
    const b = await createPasswordAccount(db, "sweep-b", "h");
    const real = Date.now();
    await db
      .insertInto("sessions")
      .values([
        { id: "sweep-old-a", account_id: a.accountId, method_id: a.methodId, expires_at: new Date(real - hour) },
        { id: "sweep-old-b", account_id: b.accountId, method_id: b.methodId, expires_at: new Date(real - 1000) },
        { id: "sweep-live-b", account_id: b.accountId, method_id: b.methodId, expires_at: new Date(real + hour) },
      ])
      .execute();

    await createSession(db, { id: "sweep-new-a", accountId: a.accountId, methodId: a.methodId, expiresAt: new Date(real + hour) });

    const ids = (await db.selectFrom("sessions").select("id").where("id", "like", "sweep-%").orderBy("id").execute()).map(
      (r) => r.id,
    );
    expect(ids).toEqual(["sweep-live-b", "sweep-new-a"]);
  });

  test("a session id is used once", async () => {
    const { accountId, methodId } = await createPasswordAccount(db, "dup-id", "h");
    await createSession(db, { id: "dup-1", accountId, methodId, expiresAt: later });
    await expect(createSession(db, { id: "dup-1", accountId, methodId, expiresAt: later })).rejects.toMatchObject({
      code: "23505",
    });
  });

  test("deleteSession ends one session only", async () => {
    const { accountId, methodId } = await createPasswordAccount(db, "end-one", "h");
    await createSession(db, { id: "end-one-1", accountId, methodId, expiresAt: later });
    await createSession(db, { id: "end-one-2", accountId, methodId, expiresAt: later });
    await deleteSession(db, "end-one-1");
    expect(await loadSession(db, "end-one-1", now)).toBeUndefined();
    expect(await loadSession(db, "end-one-2", now)).toBeDefined();
    await deleteSession(db, "end-one-1");
  });

  test("deleteSessionsFor ends every session of one account and no other", async () => {
    const a = await createPasswordAccount(db, "end-all-a", "h");
    const b = await createPasswordAccount(db, "end-all-b", "h");
    await createSession(db, { id: "end-all-a1", accountId: a.accountId, methodId: a.methodId, expiresAt: later });
    await createSession(db, { id: "end-all-a2", accountId: a.accountId, methodId: a.methodId, expiresAt: later });
    await createSession(db, { id: "end-all-b1", accountId: b.accountId, methodId: b.methodId, expiresAt: later });
    await deleteSessionsFor(db, a.accountId);
    expect(await loadSession(db, "end-all-a1", now)).toBeUndefined();
    expect(await loadSession(db, "end-all-a2", now)).toBeUndefined();
    expect(await loadSession(db, "end-all-b1", now)).toBeDefined();
  });

  test("an expired session is refused even though it still sits in the table", async () => {
    const { accountId, methodId } = await createPasswordAccount(db, "stale", "h");
    await db
      .insertInto("sessions")
      .values({ id: "stale-1", account_id: accountId, method_id: methodId, expires_at: earlier })
      .execute();
    expect(await loadSession(db, "stale-1", now)).toBeUndefined();
  });
});

describe("chooseLtiLogin", () => {
  const id = "1234abcd-0000-4000-8000-000000000000";

  test("uses the login ID, trimmed", () => {
    expect(chooseLtiLogin({ loginId: "  ada.l  ", email: "x@y.example" }, id)).toBe("ada.l");
  });

  test("cuts a login ID to 255 characters, counting characters and not bytes", () => {
    expect(chooseLtiLogin({ loginId: "a".repeat(300) }, id)).toBe("a".repeat(255));
    expect(chooseLtiLogin({ loginId: "é😀".repeat(200) }, id)).toBe("é😀".repeat(127) + "é");
  });

  test.each([
    ["missing", undefined],
    ["null", null],
    ["empty", ""],
    ["blank", "   "],
    ["an unfilled variable", "$Canvas.user.loginId"],
    ["an unfilled variable after trimming", "  $Canvas.user.loginId"],
  ])("falls back to the email's local part when the login ID is %s", (_name, loginId) => {
    expect(chooseLtiLogin({ loginId, email: "grace.h@school.example" }, id)).toBe("grace.h");
  });

  test.each([
    ["missing", undefined],
    ["empty", ""],
    ["without an @", "not-an-email"],
    ["with nothing before the @", "@school.example"],
    ["with a blank before the @", "  @school.example"],
  ])("falls back to user and 8 characters of the ID when the email is %s", (_name, email) => {
    expect(chooseLtiLogin({ loginId: "$Canvas.user.loginId", email }, id)).toBe("user1234abcd");
  });

  test("uses the user fallback when there are no claims at all", () => {
    expect(chooseLtiLogin({}, id)).toBe("user1234abcd");
  });

  test("keeps the part before the first @ and cuts it to 255 characters", () => {
    expect(chooseLtiLogin({ email: "a@b@c.example" }, id)).toBe("a");
    expect(chooseLtiLogin({ email: `${"e".repeat(300)}@c.example` }, id)).toBe("e".repeat(255));
  });
});

describe("createLtiAccount and findLtiMethod", () => {
  const issuer = "https://lms.example";

  test("makes an account with an lti method that has no password hash", async () => {
    const made = await createLtiAccount(db, { issuer, subject: "sub-1", loginId: "lti-ada" });
    expect(made.disabled).toBe(false);
    const account = await db.selectFrom("accounts").selectAll().where("id", "=", made.accountId).executeTakeFirstOrThrow();
    expect(account.login).toBe("lti-ada");
    const method = await db.selectFrom("sign_in_methods").selectAll().where("id", "=", made.methodId).executeTakeFirstOrThrow();
    expect(method).toMatchObject({
      account_id: made.accountId,
      kind: "lti",
      issuer,
      subject: "sub-1",
      password_hash: null,
    });
  });

  test("gives the account the login chosen from its own new ID when the claims have none", async () => {
    const made = await createLtiAccount(db, { issuer, subject: "sub-nologin", loginId: "$Canvas.user.loginId" });
    const account = await db.selectFrom("accounts").select("login").where("id", "=", made.accountId).executeTakeFirstOrThrow();
    expect(account.login).toBe(`user${made.accountId.slice(0, 8)}`);
  });

  test("uses the email's local part when the login ID is unfilled", async () => {
    const made = await createLtiAccount(db, {
      issuer,
      subject: "sub-email",
      loginId: "$Canvas.user.loginId",
      email: "hopper@school.example",
    });
    const account = await db.selectFrom("accounts").select("login").where("id", "=", made.accountId).executeTakeFirstOrThrow();
    expect(account.login).toBe("hopper");
  });

  test("finds the method by issuer and subject, with whether the account is disabled", async () => {
    const made = await createLtiAccount(db, { issuer, subject: "sub-find", loginId: "finder" });
    expect(await findLtiMethod(db, issuer, "sub-find")).toEqual({
      accountId: made.accountId,
      methodId: made.methodId,
      disabled: false,
    });
    await setDisabled(db, made.accountId, true);
    expect(await findLtiMethod(db, issuer, "sub-find")).toMatchObject({ accountId: made.accountId, disabled: true });
  });

  test("finds nothing for another subject or another issuer", async () => {
    await createLtiAccount(db, { issuer, subject: "sub-scope", loginId: "scoped" });
    expect(await findLtiMethod(db, issuer, "sub-other")).toBeUndefined();
    expect(await findLtiMethod(db, "https://other.example", "sub-scope")).toBeUndefined();
    expect(await findLtiMethod(db, `${issuer}/`, "sub-scope")).toBeUndefined();
  });

  test("never returns a password account, whatever its login or subject", async () => {
    await createPasswordAccount(db, "pw-twin", "hash");
    expect(await findLtiMethod(db, "", "pw-twin")).toBeUndefined();
    const made = await createLtiAccount(db, { issuer, subject: "pw-twin", loginId: "pw-twin" });
    const found = await findLtiMethod(db, issuer, "pw-twin");
    expect(found?.accountId).toBe(made.accountId);
    const password = await findPasswordMethod(db, "pw-twin");
    expect(password?.accountId).not.toBe(made.accountId);
  });

  test("gives an lti person with a password account's login a separate account", async () => {
    const pw = await createPasswordAccount(db, "shared-login", "hash");
    const made = await createLtiAccount(db, { issuer, subject: "sub-shared", loginId: "shared-login" });
    expect(made.accountId).not.toBe(pw.accountId);
    expect(await findLtiMethod(db, issuer, "sub-shared")).toMatchObject({ accountId: made.accountId });
  });

  test("returns the winner's account when two first launches run at once", async () => {
    const person = { issuer, subject: "sub-race", loginId: "racer" };
    const [a, b] = await Promise.all([createLtiAccount(db, person), createLtiAccount(db, person)]);
    expect(a).toEqual(b);
    const accounts = await db.selectFrom("accounts").select("id").where("login", "=", "racer").execute();
    expect(accounts).toEqual([{ id: a.accountId }]);
    const methods = await db.selectFrom("sign_in_methods").select("id").where("subject", "=", "sub-race").execute();
    expect(methods).toEqual([{ id: a.methodId }]);
  });

  test("returns the existing account when the person is made again later", async () => {
    const first = await createLtiAccount(db, { issuer, subject: "sub-again", loginId: "again" });
    const second = await createLtiAccount(db, { issuer, subject: "sub-again", loginId: "changed" });
    expect(second).toEqual(first);
    const account = await db.selectFrom("accounts").select("login").where("id", "=", first.accountId).executeTakeFirstOrThrow();
    expect(account.login).toBe("again");
  });

  test("rethrows a failure that is not a lost race", async () => {
    await expect(createLtiAccount(db, { issuer, subject: "sub-\u0000nul", loginId: "nul" })).rejects.toThrow();
  });
});

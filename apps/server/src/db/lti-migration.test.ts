import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { type TestDb, createTestDb } from "./testing.ts";

let testDb: TestDb;
let db: TestDb["db"];
beforeAll(async () => {
  testDb = await createTestDb();
  db = testDb.db;
});
afterAll(async () => {
  await testDb.drop();
});

async function account(login: string): Promise<string> {
  const row = await db.insertInto("accounts").values({ login }).returning("id").executeTakeFirstOrThrow();
  return row.id;
}

async function course(contextId: string): Promise<string> {
  const row = await db
    .insertInto("courses")
    .values({ issuer: "https://lms.example", context_id: contextId, title: "Course" })
    .returning("id")
    .executeTakeFirstOrThrow();
  return row.id;
}

async function constraintNames(table: string): Promise<string[]> {
  const result = await sql<{ conname: string }>`
    select conname from pg_constraint where conrelid = ${table}::regclass order by conname`.execute(db);
  return result.rows.map((r) => r.conname);
}

describe("0002_lti: sign_in_methods", () => {
  test("keeps the constraint's name and the password-hash check", async () => {
    expect(await constraintNames("sign_in_methods")).toEqual(
      expect.arrayContaining(["sign_in_methods_kind_check", "sign_in_methods_password_hash_check"]),
    );
  });

  test("accepts an lti method without a hash", async () => {
    const accountId = await account("lti-ok");
    await db
      .insertInto("sign_in_methods")
      .values({ account_id: accountId, kind: "lti", issuer: "https://lms.example", subject: "s1", password_hash: null })
      .execute();
  });

  test("refuses an lti method with a hash", async () => {
    const accountId = await account("lti-hash");
    await expect(
      db
        .insertInto("sign_in_methods")
        .values({ account_id: accountId, kind: "lti", issuer: "https://lms.example", subject: "s2", password_hash: "x" })
        .execute(),
    ).rejects.toMatchObject({ constraint: "sign_in_methods_password_hash_check" });
  });

  test("refuses a password method without a hash", async () => {
    const accountId = await account("pw-nohash");
    await expect(
      db
        .insertInto("sign_in_methods")
        .values({ account_id: accountId, kind: "password", issuer: "", subject: "pw-nohash", password_hash: null })
        .execute(),
    ).rejects.toMatchObject({ constraint: "sign_in_methods_password_hash_check" });
  });

  test("refuses an unknown kind", async () => {
    const accountId = await account("bad-kind");
    await expect(
      sql`insert into sign_in_methods (account_id, kind, issuer, subject) values (${accountId}, 'saml', 'i', 's')`.execute(
        db,
      ),
    ).rejects.toMatchObject({ constraint: "sign_in_methods_kind_check" });
  });

  test("keeps the unique key over kind, issuer and subject", async () => {
    const accountId = await account("dup");
    const values = { account_id: accountId, kind: "lti" as const, issuer: "https://lms.example", subject: "dup", password_hash: null };
    await db.insertInto("sign_in_methods").values(values).execute();
    await expect(db.insertInto("sign_in_methods").values(values).execute()).rejects.toMatchObject({
      constraint: "sign_in_methods_kind_issuer_subject_key",
    });
  });
});

describe("0002_lti: lti_login_states", () => {
  test("is keyed by the state's hash and needs a nonce and an expiry", async () => {
    const expires = new Date("2030-01-01T00:00:00Z");
    await db.insertInto("lti_login_states").values({ state_hash: "h1", nonce: "n", expires_at: expires }).execute();
    await expect(
      db.insertInto("lti_login_states").values({ state_hash: "h1", nonce: "n", expires_at: expires }).execute(),
    ).rejects.toMatchObject({ code: "23505" });
    const row = await db.selectFrom("lti_login_states").selectAll().where("state_hash", "=", "h1").executeTakeFirstOrThrow();
    expect(row.created_at).toBeInstanceOf(Date);
  });
});

describe("0002_lti: courses", () => {
  test("is unique on issuer and context", async () => {
    await course("unique-ctx");
    await expect(course("unique-ctx")).rejects.toMatchObject({ constraint: "courses_issuer_context_id_key" });
    await db
      .insertInto("courses")
      .values({ issuer: "https://other.example", context_id: "unique-ctx", title: "Same context, other platform" })
      .execute();
  });

  test("takes a context ID of 1 and of 255 characters", async () => {
    await course("x");
    await course("y".repeat(255));
  });

  test("refuses a context ID that is empty or longer than 255 characters", async () => {
    await expect(course("")).rejects.toMatchObject({ code: "23514" });
    await expect(course("z".repeat(256))).rejects.toMatchObject({ code: "23514" });
  });

  test("counts characters, not bytes", async () => {
    await course("é".repeat(255));
  });
});

describe("0002_lti: course_members", () => {
  test("refuses a role other than student or instructor", async () => {
    const accountId = await account("role-bad");
    const courseId = await course("role-bad");
    await expect(
      sql`insert into course_members (course_id, account_id, role) values (${courseId}, ${accountId}, 'admin')`.execute(db),
    ).rejects.toMatchObject({ code: "23514" });
    for (const role of ["student", "instructor"] as const) {
      const other = await account(`role-${role}`);
      await db.insertInto("course_members").values({ course_id: courseId, account_id: other, role }).execute();
    }
  });

  test("has one row per course and account", async () => {
    const accountId = await account("pk");
    const courseId = await course("pk");
    const row = { course_id: courseId, account_id: accountId, role: "student" as const };
    await db.insertInto("course_members").values(row).execute();
    await expect(db.insertInto("course_members").values(row).execute()).rejects.toMatchObject({
      constraint: "course_members_pkey",
    });
  });

  test("needs an account and a course that exist", async () => {
    const accountId = await account("fk");
    const courseId = await course("fk");
    const missing = "00000000-0000-4000-8000-000000000000";
    await expect(
      db.insertInto("course_members").values({ course_id: missing, account_id: accountId, role: "student" }).execute(),
    ).rejects.toMatchObject({ code: "23503" });
    await expect(
      db.insertInto("course_members").values({ course_id: courseId, account_id: missing, role: "student" }).execute(),
    ).rejects.toMatchObject({ code: "23503" });
  });

  test("goes with its account, and with its course, but not the other way", async () => {
    const accountA = await account("cascade-a");
    const accountB = await account("cascade-b");
    const courseA = await course("cascade-a");
    const courseB = await course("cascade-b");
    for (const [c, a] of [[courseA, accountA], [courseA, accountB], [courseB, accountA]] as const) {
      await db.insertInto("course_members").values({ course_id: c, account_id: a, role: "student" }).execute();
    }
    await db.deleteFrom("accounts").where("id", "=", accountA).execute();
    const afterAccount = await db.selectFrom("course_members").select(["course_id", "account_id"]).execute();
    expect(afterAccount.filter((m) => m.account_id === accountA)).toEqual([]);
    expect(afterAccount.filter((m) => m.course_id === courseA)).toEqual([{ course_id: courseA, account_id: accountB }]);
    expect(await db.selectFrom("courses").select("id").where("id", "=", courseB).execute()).toHaveLength(1);

    await db.deleteFrom("courses").where("id", "=", courseA).execute();
    expect(await db.selectFrom("course_members").select("account_id").where("course_id", "=", courseA).execute()).toEqual([]);
    expect(await db.selectFrom("accounts").select("id").where("id", "=", accountB).execute()).toHaveLength(1);
  });
});

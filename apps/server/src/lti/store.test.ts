import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { hashToken } from "../accounts/sessions.ts";
import { createLtiAccount } from "../accounts/store.ts";
import { type TestDb, createTestDb } from "../db/testing.ts";
import {
  LOGIN_STATE_SECONDS,
  consumeLoginState,
  saveLoginState,
  upsertCourse,
  upsertMembership,
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

const now = new Date("2030-01-01T12:00:00Z");
const minutes = (n: number) => new Date(now.getTime() + n * 60 * 1000);

async function stateRows(): Promise<string[]> {
  const rows = await db.selectFrom("lti_login_states").select("state_hash").orderBy("state_hash").execute();
  return rows.map((r) => r.state_hash);
}

describe("saveLoginState", () => {
  test("keeps the hash of the state, never the state, and expires in 10 minutes", async () => {
    await saveLoginState(db, { state: "state-keep", nonce: "nonce-keep" }, now);
    const row = await db
      .selectFrom("lti_login_states")
      .selectAll()
      .where("state_hash", "=", hashToken("state-keep"))
      .executeTakeFirstOrThrow();
    expect(row.nonce).toBe("nonce-keep");
    expect(row.expires_at).toEqual(minutes(10));
    expect(LOGIN_STATE_SECONDS).toBe(600);
    expect(await stateRows()).not.toContain("state-keep");
  });

  test("deletes the rows that had expired, and keeps the others", async () => {
    await saveLoginState(db, { state: "old-1", nonce: "n" }, minutes(-30));
    await saveLoginState(db, { state: "old-2", nonce: "n" }, minutes(-11));
    await saveLoginState(db, { state: "live", nonce: "n" }, minutes(-9));
    await saveLoginState(db, { state: "fresh", nonce: "n" }, now);
    const rows = await stateRows();
    expect(rows).not.toContain(hashToken("old-1"));
    expect(rows).not.toContain(hashToken("old-2"));
    expect(rows).toContain(hashToken("live"));
    expect(rows).toContain(hashToken("fresh"));
  });

  test("deletes a row that expires exactly now", async () => {
    await saveLoginState(db, { state: "edge", nonce: "n" }, minutes(-10));
    await saveLoginState(db, { state: "after-edge", nonce: "n" }, now);
    expect(await stateRows()).not.toContain(hashToken("edge"));
  });
});

describe("consumeLoginState", () => {
  test("returns the nonce once and then nothing", async () => {
    await saveLoginState(db, { state: "once", nonce: "nonce-once" }, now);
    expect(await consumeLoginState(db, "once", minutes(1))).toBe("nonce-once");
    expect(await consumeLoginState(db, "once", minutes(1))).toBeUndefined();
    expect(await stateRows()).not.toContain(hashToken("once"));
  });

  test("gives the nonce to only one of two launches at the same moment", async () => {
    await saveLoginState(db, { state: "twice", nonce: "nonce-twice" }, now);
    const results = await Promise.all([
      consumeLoginState(db, "twice", minutes(1)),
      consumeLoginState(db, "twice", minutes(1)),
    ]);
    expect(results.filter((r) => r === "nonce-twice")).toHaveLength(1);
    expect(results.filter((r) => r === undefined)).toHaveLength(1);
  });

  test("returns nothing for an unknown state", async () => {
    expect(await consumeLoginState(db, "never-saved", now)).toBeUndefined();
  });

  test("returns nothing for an expired state, and removes its row", async () => {
    await saveLoginState(db, { state: "expired", nonce: "n" }, now);
    expect(await consumeLoginState(db, "expired", minutes(10))).toBeUndefined();
    expect(await stateRows()).not.toContain(hashToken("expired"));
  });

  test("returns the nonce up to the last moment before expiry", async () => {
    await saveLoginState(db, { state: "last", nonce: "n-last" }, now);
    expect(await consumeLoginState(db, "last", new Date(minutes(10).getTime() - 1))).toBe("n-last");
  });

  test("takes only the row of its own state", async () => {
    await saveLoginState(db, { state: "mine", nonce: "n-mine" }, now);
    await saveLoginState(db, { state: "yours", nonce: "n-yours" }, now);
    expect(await consumeLoginState(db, "mine", now)).toBe("n-mine");
    expect(await consumeLoginState(db, "yours", now)).toBe("n-yours");
  });
});

describe("upsertCourse", () => {
  test("makes a course and returns its ID", async () => {
    const id = await upsertCourse(db, { issuer: "https://lms.example", contextId: "c-new", title: "Systems" });
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    const row = await db.selectFrom("courses").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
    expect(row).toMatchObject({ issuer: "https://lms.example", context_id: "c-new", title: "Systems" });
  });

  test("returns the same ID for the same course, and refreshes the title and updated_at", async () => {
    const course = { issuer: "https://lms.example", contextId: "c-again", title: "Before" };
    const first = await upsertCourse(db, course);
    const before = await db.selectFrom("courses").selectAll().where("id", "=", first).executeTakeFirstOrThrow();
    const second = await upsertCourse(db, { ...course, title: "After" });
    expect(second).toBe(first);
    const after = await db.selectFrom("courses").selectAll().where("id", "=", first).executeTakeFirstOrThrow();
    expect(after.title).toBe("After");
    expect(after.created_at).toEqual(before.created_at);
    expect(after.updated_at.getTime()).toBeGreaterThan(before.updated_at.getTime());
  });

  test("keeps the courses of two platforms with one context ID apart", async () => {
    const a = await upsertCourse(db, { issuer: "https://a.example", contextId: "shared", title: "A" });
    const b = await upsertCourse(db, { issuer: "https://b.example", contextId: "shared", title: "B" });
    expect(a).not.toBe(b);
  });

  test("refuses a context ID of 0 or over 255 characters", async () => {
    await expect(upsertCourse(db, { issuer: "i", contextId: "", title: "t" })).rejects.toMatchObject({ code: "23514" });
    await expect(upsertCourse(db, { issuer: "i", contextId: "c".repeat(256), title: "t" })).rejects.toMatchObject({
      code: "23514",
    });
  });
});

describe("upsertMembership", () => {
  test("makes a membership on the first launch", async () => {
    const courseId = await upsertCourse(db, { issuer: "i", contextId: "m-first", title: "t" });
    const { accountId } = await createLtiAccount(db, { issuer: "i", subject: "m-first", loginId: "m-first" });
    await upsertMembership(db, { courseId, accountId, role: "student" });
    const row = await db.selectFrom("course_members").selectAll().executeTakeFirstOrThrow();
    expect(row).toMatchObject({ course_id: courseId, account_id: accountId, role: "student" });
    expect(row.first_launch_at).toBeInstanceOf(Date);
  });

  test("refreshes the role and last_launch_at, never first_launch_at", async () => {
    const courseId = await upsertCourse(db, { issuer: "i", contextId: "m-again", title: "t" });
    const { accountId } = await createLtiAccount(db, { issuer: "i", subject: "m-again", loginId: "m-again" });
    const key = { course_id: courseId, account_id: accountId };
    await upsertMembership(db, { courseId, accountId, role: "student" });
    const before = await db.selectFrom("course_members").selectAll().where("course_id", "=", courseId).executeTakeFirstOrThrow();
    await upsertMembership(db, { courseId, accountId, role: "instructor" });
    const rows = await db.selectFrom("course_members").selectAll().where("course_id", "=", key.course_id).execute();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.role).toBe("instructor");
    expect(rows[0]?.first_launch_at).toEqual(before.first_launch_at);
    expect(rows[0]?.last_launch_at.getTime()).toBeGreaterThan(before.last_launch_at.getTime());
  });

  test("goes with the account and with the course", async () => {
    const courseId = await upsertCourse(db, { issuer: "i", contextId: "m-cascade", title: "t" });
    const { accountId } = await createLtiAccount(db, { issuer: "i", subject: "m-cascade", loginId: "m-cascade" });
    await upsertMembership(db, { courseId, accountId, role: "student" });
    await db.deleteFrom("accounts").where("id", "=", accountId).execute();
    expect(await db.selectFrom("course_members").select("role").where("course_id", "=", courseId).execute()).toEqual([]);
    expect(await db.selectFrom("courses").select("id").where("id", "=", courseId).execute()).toHaveLength(1);
  });
});

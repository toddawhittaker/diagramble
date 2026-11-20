import type { Kysely } from "kysely";
import { sql } from "kysely";
import { hashToken } from "../accounts/sessions.ts";
import type { CourseRole, Database } from "../db/schema.ts";

/** A login state, and so its nonce, works for this long (SPEC.md section 1, "Canvas launch"). */
export const LOGIN_STATE_SECONDS = 10 * 60;

/**
 * Keep the nonce of a login under its state, which the platform returns with the
 * launch. Only the state's SHA-256 is stored. Rows that have already expired at
 * `now` are deleted.
 */
export async function saveLoginState(
  db: Kysely<Database>,
  login: { state: string; nonce: string },
  now: Date,
): Promise<void> {
  await db.deleteFrom("lti_login_states").where("expires_at", "<=", now).execute();
  await db
    .insertInto("lti_login_states")
    .values({
      state_hash: hashToken(login.state),
      nonce: login.nonce,
      expires_at: new Date(now.getTime() + LOGIN_STATE_SECONDS * 1000),
    })
    .execute();
}

/**
 * Take the nonce kept under a state. One statement deletes the row, so a state
 * works once, even for two launches at the same moment. Returns `undefined` when
 * the state is unknown, was used before, or had expired at `now`.
 */
export async function consumeLoginState(
  db: Kysely<Database>,
  state: string,
  now: Date,
): Promise<string | undefined> {
  const row = await db
    .deleteFrom("lti_login_states")
    .where("state_hash", "=", hashToken(state))
    .returning(["nonce", "expires_at"])
    .executeTakeFirst();
  if (!row || row.expires_at.getTime() <= now.getTime()) return undefined;
  return row.nonce;
}

/**
 * Our row for a platform's course, made on its first launch. Every launch
 * refreshes the title and `updated_at`. Returns `courses.id`.
 */
export async function upsertCourse(
  db: Kysely<Database>,
  course: { issuer: string; contextId: string; title: string },
): Promise<string> {
  const row = await db
    .insertInto("courses")
    .values({ issuer: course.issuer, context_id: course.contextId, title: course.title })
    .onConflict((oc) =>
      oc
        .columns(["issuer", "context_id"])
        .doUpdateSet({ title: course.title, updated_at: sql<Date>`now()` }),
    )
    .returning("id")
    .executeTakeFirstOrThrow();
  return row.id;
}

/**
 * Record that an account launched from a course. The first launch makes the
 * membership; every launch refreshes the role and `last_launch_at`.
 */
export async function upsertMembership(
  db: Kysely<Database>,
  membership: { courseId: string; accountId: string; role: CourseRole },
): Promise<void> {
  await db
    .insertInto("course_members")
    .values({
      course_id: membership.courseId,
      account_id: membership.accountId,
      role: membership.role,
    })
    .onConflict((oc) =>
      oc
        .columns(["course_id", "account_id"])
        .doUpdateSet({ role: membership.role, last_launch_at: sql<Date>`now()` }),
    )
    .execute();
}

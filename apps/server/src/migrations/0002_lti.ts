import type { Kysely } from "kysely";
import { sql } from "kysely";

/**
 * The course launch: the `lti` sign-in method, the states a login hands to a
 * launch, the courses a platform sends people from, and who belongs to them
 * (SPEC.md sections 1, "Canvas launch", and 3.9).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  // The password-hash check already ties a hash to the password kind, so an lti
  // method has none.
  await sql`alter table sign_in_methods drop constraint sign_in_methods_kind_check`.execute(db);
  await sql`alter table sign_in_methods add constraint sign_in_methods_kind_check check (kind in ('password', 'lti'))`.execute(
    db,
  );

  await db.schema
    .createTable("lti_login_states")
    .addColumn("state_hash", "text", (col) => col.primaryKey())
    .addColumn("nonce", "text", (col) => col.notNull())
    .addColumn("expires_at", "timestamptz", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();
  // Expired states are swept by their expiry time.
  await db.schema
    .createIndex("lti_login_states_expires_at_idx")
    .on("lti_login_states")
    .column("expires_at")
    .execute();

  await db.schema
    .createTable("courses")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("issuer", "text", (col) => col.notNull())
    .addColumn("context_id", "text", (col) =>
      col.notNull().check(sql`char_length(context_id) between 1 and 255`),
    )
    .addColumn("title", "text", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addUniqueConstraint("courses_issuer_context_id_key", ["issuer", "context_id"])
    .execute();

  await db.schema
    .createTable("course_members")
    .addColumn("course_id", "uuid", (col) =>
      col.notNull().references("courses.id").onDelete("cascade"),
    )
    .addColumn("account_id", "uuid", (col) =>
      col.notNull().references("accounts.id").onDelete("cascade"),
    )
    .addColumn("role", "text", (col) => col.notNull().check(sql`role in ('student', 'instructor')`))
    .addColumn("first_launch_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("last_launch_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint("course_members_pkey", ["course_id", "account_id"])
    .execute();
}

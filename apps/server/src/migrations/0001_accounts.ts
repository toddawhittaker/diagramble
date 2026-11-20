import type { Kysely } from "kysely";
import { sql } from "kysely";

/** Accounts, how they sign in, and their sessions (SPEC.md section 3.9). */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("accounts")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("login", "text", (col) => col.notNull())
    .addColumn("disabled_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createTable("sign_in_methods")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("account_id", "uuid", (col) =>
      col.notNull().references("accounts.id").onDelete("cascade"),
    )
    .addColumn("kind", "text", (col) => col.notNull().check(sql`kind in ('password')`))
    .addColumn("issuer", "text", (col) => col.notNull())
    .addColumn("subject", "text", (col) => col.notNull())
    .addColumn("password_hash", "text")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addUniqueConstraint("sign_in_methods_kind_issuer_subject_key", ["kind", "issuer", "subject"])
    .addCheckConstraint(
      "sign_in_methods_password_hash_check",
      sql`(kind = 'password') = (password_hash is not null)`,
    )
    .execute();

  await db.schema
    .createTable("sessions")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("account_id", "uuid", (col) =>
      col.notNull().references("accounts.id").onDelete("cascade"),
    )
    .addColumn("method_id", "uuid", (col) =>
      col.notNull().references("sign_in_methods.id").onDelete("cascade"),
    )
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("expires_at", "timestamptz", (col) => col.notNull())
    .execute();

  await db.schema.createIndex("sessions_expires_at_idx").on("sessions").column("expires_at").execute();
  await db.schema.createIndex("sessions_account_id_idx").on("sessions").column("account_id").execute();
}

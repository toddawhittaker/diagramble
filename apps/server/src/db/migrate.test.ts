import { readdirSync } from "node:fs";
import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { migrateToLatest } from "./migrate.ts";
import { type TestDb, createTestDb } from "./testing.ts";

let testDb: TestDb;
beforeAll(async () => {
  testDb = await createTestDb();
});
afterAll(async () => {
  await testDb.drop();
});

describe("migrateToLatest", () => {
  test("a second run applies nothing", async () => {
    expect(await migrateToLatest(testDb.db)).toEqual([]);
  });

  test("runs the files of src/migrations in name order", async () => {
    const files = readdirSync(new URL("../migrations", import.meta.url)).filter((f) => f.endsWith(".ts"));
    const applied = await sql<{ name: string }>`select name from kysely_migration order by name`.execute(testDb.db);
    expect(applied.rows.map((r) => `${r.name}.ts`)).toEqual([...files].sort());
    expect(applied.rows[0]?.name).toBe("0001_accounts");
  });

  test("makes the three tables and the two session indexes", async () => {
    const tables = await sql<{ table_name: string }>`
      select table_name from information_schema.tables where table_schema = 'public' order by table_name`.execute(
      testDb.db,
    );
    expect(tables.rows.map((r) => r.table_name)).toEqual([
      "accounts",
      "kysely_migration",
      "kysely_migration_lock",
      "sessions",
      "sign_in_methods",
    ]);
    const indexes = await sql<{ indexname: string }>`
      select indexname from pg_indexes where tablename = 'sessions' order by indexname`.execute(testDb.db);
    expect(indexes.rows.map((r) => r.indexname)).toEqual([
      "sessions_account_id_idx",
      "sessions_expires_at_idx",
      "sessions_pkey",
    ]);
  });

  test("throws when the recorded history names a migration that has no file", async () => {
    await sql`insert into kysely_migration (name, timestamp) values ('0000_gone', now()::text)`.execute(testDb.db);
    await expect(migrateToLatest(testDb.db)).rejects.toThrow(/0000_gone/);
  });
});

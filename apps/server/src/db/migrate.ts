import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Kysely } from "kysely";
import { FileMigrationProvider, Migrator } from "kysely/migration";
import type { Database } from "./schema.ts";

const migrationFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), "../migrations");

/**
 * Run every pending migration in `src/migrations/`, in file-name order, and
 * return the names of those that ran. A later epic adds a file there and
 * edits no index. A migration file's name sorts after every earlier one;
 * Kysely refuses one that sorts before an applied migration.
 */
export async function migrateToLatest(db: Kysely<Database>): Promise<string[]> {
  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder,
      import: (file) => import(pathToFileURL(file).href),
    }),
  });

  const { results, error } = await migrator.migrateToLatest();
  if (error) {
    throw error;
  }
  return (results ?? []).filter((r) => r.status === "Success").map((r) => r.migrationName);
}

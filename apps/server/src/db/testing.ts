import { createHash } from "node:crypto";
import { hostname } from "node:os";
import type { Kysely } from "kysely";
import pg from "pg";
import { expect } from "vitest";
import { createDb } from "./connection.ts";
import { migrateToLatest } from "./migrate.ts";
import type { Database } from "./schema.ts";

export interface TestDb {
  db: Kysely<Database>;
  /** Close the pool and drop this file's database. Call in afterAll. */
  drop: () => Promise<void>;
}

/** What to run, said when `DATABASE_URL` is missing. */
export const MISSING_DATABASE_URL_MESSAGE =
  "DATABASE_URL is not set, and the database tests need a PostgreSQL server. Start one with:\n" +
  "  docker run -d --rm --name diagramble-pg -p 5432:5432 -e POSTGRES_PASSWORD=postgres " +
  "-e POSTGRES_DB=diagramble_test postgres:18\n" +
  "then export DATABASE_URL=postgres://postgres:postgres@localhost:5432/diagramble_test";

/**
 * Every test file gets its own database, so the files run in parallel. The
 * name carries a host identifier, the process id and a hash of the test file
 * path: the host identifier keeps machines that share one PostgreSQL server
 * apart, the process id keeps two whole-suite runs on one machine apart, and
 * the hash keeps the files of one run apart and says which file a leftover
 * database came from. PostgreSQL identifiers stop at 63 characters, hence the
 * trimmed base.
 */
export function basePrefix(url: URL): string {
  return url.pathname
    .slice(1)
    .replace(/[^A-Za-z0-9_]/g, "_")
    .slice(0, 30);
}

/**
 * A short, stable identifier for this host, used to tell its own test
 * databases from another machine's.
 */
export function hostId(): string {
  return createHash("sha256").update(hostname()).digest("hex").slice(0, 4);
}

function perFileDbName(url: URL, testPath: string): string {
  const hash = createHash("sha256").update(testPath).digest("hex").slice(0, 8);
  return `${basePrefix(url)}_h${hostId()}_p${process.pid}_${hash}`;
}

/**
 * Drop test databases left behind by runs whose process is gone. A test file
 * that crashes never drops its database, so without this the server collects
 * them forever. Only this host's databases are considered: a process id that
 * looks dead here may be alive on another machine sharing the server.
 */
export async function dropOrphanedDbs(url: string, prefix: string): Promise<void> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const escapedPrefix = prefix.replace(/_/g, "\\_");
    const { rows } = await client.query<{ datname: string }>(
      "SELECT datname FROM pg_database WHERE datname LIKE $1",
      [`${escapedPrefix}\\_h${hostId()}\\_p%`],
    );
    for (const { datname } of rows) {
      const pid = Number(/_p(\d+)_/.exec(datname)?.[1]);
      if (!Number.isInteger(pid) || pid <= 0 || isProcessAlive(pid)) continue;
      try {
        await client.query(`DROP DATABASE IF EXISTS "${datname}" WITH (FORCE)`);
      } catch {
        // Someone else is using it; leaving it behind is harmless.
      }
    }
  } finally {
    await client.end();
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM means the process exists but belongs to another user.
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

/**
 * Pools per test file times test files must stay under the server's
 * max_connections (100 by default), so each file's pool stays small.
 */
const TEST_POOL_SIZE = 4;

/** The shared server's URL from `DATABASE_URL`; throws, saying how to start PostgreSQL, when it is not set. */
export function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(MISSING_DATABASE_URL_MESSAGE);
  }
  return url;
}

/**
 * Make a database of this test file's own from `DATABASE_URL`, migrate it,
 * and return it with a `drop` that closes the pool and removes it. One call
 * per test file.
 */
export async function createTestDb(): Promise<TestDb> {
  const sharedUrl = requireDatabaseUrl();
  const url = new URL(sharedUrl);
  const name = perFileDbName(url, expect.getState().testPath ?? "unknown");
  await dropOrphanedDbs(sharedUrl, basePrefix(url));
  // A crashed earlier run with the same process id could have left this behind.
  await runOnServer(sharedUrl, [
    `DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`,
    `CREATE DATABASE "${name}"`,
  ]);

  url.pathname = `/${name}`;
  const db = createDb(url.toString(), TEST_POOL_SIZE);
  await migrateToLatest(db);

  const drop = async () => {
    await db.destroy();
    await runOnServer(sharedUrl, [`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`]);
  };

  return { db, drop };
}

/** Run statements on the shared database, used to create and drop databases. */
async function runOnServer(url: string, statements: string[]): Promise<void> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    for (const statement of statements) {
      await client.query(statement);
    }
  } finally {
    await client.end();
  }
}

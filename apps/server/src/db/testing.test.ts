import { spawnSync } from "node:child_process";
import pg from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import {
  MISSING_DATABASE_URL_MESSAGE,
  basePrefix,
  createTestDb,
  dropOrphanedDbs,
  hostId,
  requireDatabaseUrl,
} from "./testing.ts";

async function databaseNames(like: string): Promise<string[]> {
  const client = new pg.Client({ connectionString: requireDatabaseUrl() });
  await client.connect();
  try {
    const { rows } = await client.query<{ datname: string }>(
      "select datname from pg_database where datname like $1 order by datname",
      [like],
    );
    return rows.map((r) => r.datname);
  } finally {
    await client.end();
  }
}

async function run(statement: string): Promise<void> {
  const client = new pg.Client({ connectionString: requireDatabaseUrl() });
  await client.connect();
  try {
    await client.query(statement);
  } finally {
    await client.end();
  }
}

describe("requireDatabaseUrl", () => {
  const saved = process.env.DATABASE_URL;
  afterEach(() => {
    if (saved === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = saved;
  });

  test("refuses without DATABASE_URL and says how to start PostgreSQL", async () => {
    delete process.env.DATABASE_URL;
    expect(() => requireDatabaseUrl()).toThrow(MISSING_DATABASE_URL_MESSAGE);
    await expect(createTestDb()).rejects.toThrow(/docker run .*postgres:18/);
    expect(MISSING_DATABASE_URL_MESSAGE).toContain("DATABASE_URL=postgres://");
  });

  test("returns the URL when it is set", () => {
    process.env.DATABASE_URL = "postgres://a:b@c/d";
    expect(requireDatabaseUrl()).toBe("postgres://a:b@c/d");
  });
});

describe("basePrefix", () => {
  test("keeps letters, digits and underscores of the database name, at most 30", () => {
    expect(basePrefix(new URL("postgres://u:p@h:1/diagramble-test"))).toBe("diagramble_test");
    expect(basePrefix(new URL(`postgres://u:p@h:1/${"a".repeat(40)}`))).toHaveLength(30);
  });
});

describe("createTestDb", () => {
  test("makes a migrated database of this file's own and drops it", async () => {
    const { db, drop } = await createTestDb();
    const tables = await db
      .selectFrom("accounts")
      .select((eb) => eb.fn.countAll<string>().as("n"))
      .executeTakeFirstOrThrow();
    expect(tables.n).toBe("0");

    const own = await databaseNames(`${basePrefix(new URL(requireDatabaseUrl()))}\\_h${hostId()}\\_p${process.pid}\\_%`);
    expect(own.length).toBeGreaterThan(0);

    await drop();
    expect(await databaseNames(own[0] as string)).toEqual([]);
  });
});

describe("dropOrphanedDbs", () => {
  const prefix = "diagramble_sweep_check";
  const deadPid = spawnSync(process.execPath, ["-e", ""]).pid;
  const otherHost = hostId() === "0000" ? "0001" : "0000";
  const deadHere = `${prefix}_h${hostId()}_p${deadPid}_aaaaaaaa`;
  const aliveHere = `${prefix}_h${hostId()}_p${process.pid}_bbbbbbbb`;
  const otherUser = `${prefix}_h${hostId()}_p1_cccccccc`;
  const otherMachine = `${prefix}_h${otherHost}_p${deadPid}_dddddddd`;
  const everything = [deadHere, aliveHere, otherUser, otherMachine];

  beforeAll(async () => {
    for (const name of everything) await run(`create database "${name}"`);
  });
  afterAll(async () => {
    for (const name of everything) await run(`drop database if exists "${name}" with (force)`);
  });

  test("drops this host's databases whose process is gone and keeps the rest", async () => {
    await dropOrphanedDbs(requireDatabaseUrl(), prefix);
    expect(await databaseNames(`${prefix}%`)).toEqual([aliveHere, otherUser, otherMachine].sort());
  });
});

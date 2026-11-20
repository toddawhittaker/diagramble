import { EventEmitter } from "node:events";
import { sql } from "kysely";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createDb, createPool, poolOptions } from "./connection.ts";
import { requireDatabaseUrl } from "./testing.ts";

describe("poolOptions", () => {
  test("bounds the wait for a connection, a statement and an idle transaction", () => {
    expect(poolOptions("postgres://u:p@h/d", 3)).toEqual({
      connectionString: "postgres://u:p@h/d",
      max: 3,
      connectionTimeoutMillis: 5000,
      statement_timeout: 30_000,
      idle_in_transaction_session_timeout: 60_000,
    });
  });
});

describe("createPool", () => {
  afterEach(() => vi.restoreAllMocks());

  test("passes an idle connection's error to the listener instead of ending the process", async () => {
    const heard: Error[] = [];
    const pool = createPool("postgres://u:p@localhost:1/d", 1, (e) => heard.push(e));
    pool.emit("error", new Error("connection reset"));
    expect(heard.map((e) => e.message)).toEqual(["connection reset"]);
    await pool.end();
  });

  test("warns by default", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const pool = createPool("postgres://u:p@localhost:1/d");
    pool.emit("error", new Error("connection reset"));
    expect(warn).toHaveBeenCalledWith("database connection lost: connection reset");
    await pool.end();
  });

  test("keeps a checked-out client's error from ending the process", async () => {
    const pool = createPool("postgres://u:p@localhost:1/d");
    const client = new EventEmitter();
    pool.emit("connect", client);
    expect(() => client.emit("error", new Error("reset"))).not.toThrow();
    await pool.end();
  });
});

describe("createDb", () => {
  test("connects to the server named by DATABASE_URL", async () => {
    const db = createDb(requireDatabaseUrl(), 1);
    try {
      const result = await sql<{ one: number }>`select 1 as one`.execute(db);
      expect(result.rows).toEqual([{ one: 1 }]);
    } finally {
      await db.destroy();
    }
  });
});

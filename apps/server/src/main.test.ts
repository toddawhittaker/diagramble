import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import pg from "pg";
import { Kysely } from "kysely";
import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { basePrefix, hostId, requireDatabaseUrl } from "./db/testing.ts";
import { start } from "./main.ts";

// start() connects by URL, so it gets a database of its own, named so the sweep in
// db/testing.ts drops it if this run crashes.
const shared = requireDatabaseUrl();
const url = new URL(shared);
const name = `${basePrefix(url)}_h${hostId()}_p${process.pid}_main`;
url.pathname = `/${name}`;

async function onServer(statement: string): Promise<void> {
  const client = new pg.Client({ connectionString: shared });
  await client.connect();
  try {
    await client.query(statement);
  } finally {
    await client.end();
  }
}

beforeAll(async () => {
  await onServer(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await onServer(`CREATE DATABASE "${name}"`);
});

afterAll(async () => {
  await onServer(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
});

const env = {
  DATABASE_URL: url.toString(),
  APP_ORIGIN: "http://localhost",
  PORT: "0",
  STATIC_DIR: mkdtempSync(path.join(tmpdir(), "diagramble-main-")),
};

test("start migrates, listens and closes cleanly", async () => {
  const { server, close } = await start(env, { logger: false });
  try {
    const { port } = server.server.address() as { port: number };
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("ok");
  } finally {
    await close();
    await close();
  }
  expect(process.listenerCount("SIGTERM")).toBe(0);
});

test("start refuses bad settings before connecting", async () => {
  await expect(start({ ...env, PORT: "x" })).rejects.toThrow(/PORT/);
});

test("start closes the pool when migrating fails", async () => {
  const missing = new URL(url);
  missing.pathname = "/no_such_database_here";
  await expect(start({ ...env, DATABASE_URL: missing.toString() }, { logger: false })).rejects.toThrow();
});

test("start closes the server and the pool when listening fails", async () => {
  const first = await start(env, { logger: false });
  try {
    const { port } = first.server.server.address() as { port: number };
    const destroy = vi.spyOn(Kysely.prototype, "destroy");
    try {
      await expect(start({ ...env, PORT: String(port) }, { logger: false })).rejects.toThrow(/EADDRINUSE/);
      expect(destroy).toHaveBeenCalledTimes(1);
    } finally {
      destroy.mockRestore();
    }
    expect(process.listenerCount("SIGTERM")).toBe(1);
  } finally {
    await first.close();
  }
});

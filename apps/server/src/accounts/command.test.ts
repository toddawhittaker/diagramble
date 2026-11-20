import { spawn } from "node:child_process";
import { Readable, Writable } from "node:stream";
import { fileURLToPath } from "node:url";
import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { type TestDb, createTestDb, requireDatabaseUrl } from "../db/testing.ts";
import { type CommandIo, run } from "./command.ts";
import { verifyPassword } from "./password.ts";
import {
  createSession,
  findPasswordMethod,
  loadSession,
} from "./store.ts";

// Several scrypt hashes in one test can outlast the default 5 s while the suite runs in parallel.
vi.setConfig({ testTimeout: 20_000, hookTimeout: 20_000 });

let testDb: TestDb;
let db: TestDb["db"];
beforeAll(async () => {
  testDb = await createTestDb();
  db = testDb.db;
});
afterAll(async () => {
  await testDb.drop();
});

interface Run {
  code: number;
  stdout: string;
  stderr: string;
}

function collector(): { stream: Writable; text: () => string } {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, done) {
      chunks.push(String(chunk));
      done();
    },
  });
  return { stream, text: () => chunks.join("") };
}

async function command(args: string[], stdin = ""): Promise<Run> {
  const out = collector();
  const err = collector();
  const io: CommandIo = {
    stdout: out.stream,
    stderr: err.stream,
    stdin: Readable.from([Buffer.from(stdin)]),
  };
  const code = await run(args, { db }, io);
  return { code, stdout: out.text(), stderr: err.text() };
}

const usage = /^usage: /m;
const strong = "correct horse battery";

/** Make an account through the command and return its generated password. */
async function made(username: string): Promise<string> {
  const result = await command(["make", username]);
  expect(result.code).toBe(0);
  return result.stdout.trimEnd();
}

async function startSession(username: string): Promise<string> {
  const method = await findPasswordMethod(db, username);
  if (!method) throw new Error("no such account");
  const id = `session-${username}-${Math.random()}`;
  await createSession(db, {
    id,
    accountId: method.accountId,
    methodId: method.methodId,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  return id;
}

const stillSignedIn = async (id: string) => (await loadSession(db, id, new Date())) !== undefined;

describe("make", () => {
  test("makes an account and prints its password once, and nothing else, on standard output", async () => {
    const result = await command(["make", "alice"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/^\S{20,}\n$/);
    expect(result.stderr).not.toContain(result.stdout.trim());
    const method = await findPasswordMethod(db, "alice");
    expect(method).toBeDefined();
    expect(await verifyPassword(result.stdout.trim(), method?.passwordHash ?? "")).toBe(true);
  });

  test("stores the login under the normalized username", async () => {
    expect((await command(["make", "Bob.Smith"])).code).toBe(0);
    const row = await db
      .selectFrom("accounts")
      .select("login")
      .where("login", "=", "bob.smith")
      .executeTakeFirst();
    expect(row?.login).toBe("bob.smith");
  });

  test("refuses a taken username with one sentence on standard error", async () => {
    await made("taken");
    const result = await command(["make", "TAKEN"]);
    expect(result.code).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toMatch(/already taken/);
    expect(result.stderr.trim().split("\n")).toHaveLength(1);
  });

  test("refuses an invalid username with exit 1 and no output on standard output", async () => {
    for (const name of ["", "_leading", "has space", "x".repeat(65), "ünï"]) {
      const result = await command(["make", name]);
      expect(result.code, name).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr.trim().split("\n")).toHaveLength(1);
    }
  });

  test("with --stdin reads the password and prints nothing on standard output", async () => {
    const result = await command(["make", "viaStdin", "--stdin"], `${strong}\n`);
    expect(result.code).toBe(0);
    expect(result.stdout).toBe("");
    const method = await findPasswordMethod(db, "viastdin");
    expect(await verifyPassword(strong, method?.passwordHash ?? "")).toBe(true);
  });
});

describe("set-password", () => {
  test("replaces the password: the new one verifies, the old one does not", async () => {
    const old = await made("carol");
    const result = await command(["set-password", "carol"]);
    expect(result.code).toBe(0);
    const fresh = result.stdout.trimEnd();
    expect(fresh).toMatch(/^\S{20,}$/);
    expect(result.stdout).toBe(`${fresh}\n`);
    const method = await findPasswordMethod(db, "carol");
    expect(await verifyPassword(fresh, method?.passwordHash ?? "")).toBe(true);
    expect(await verifyPassword(old, method?.passwordHash ?? "")).toBe(false);
  });

  test("ends the account's sessions and no one else's", async () => {
    await made("dave");
    await made("erin");
    const daves = await startSession("dave");
    const erins = await startSession("erin");
    expect((await command(["set-password", "dave"])).code).toBe(0);
    expect(await stillSignedIn(daves)).toBe(false);
    expect(await stillSignedIn(erins)).toBe(true);
  });

  test("with --stdin takes the password from standard input", async () => {
    await made("frank");
    const result = await command(["set-password", "frank", "--stdin"], strong);
    expect(result.code).toBe(0);
    expect(result.stdout).toBe("");
    const method = await findPasswordMethod(db, "frank");
    expect(await verifyPassword(strong, method?.passwordHash ?? "")).toBe(true);
  });

  test("refuses an unknown username", async () => {
    const result = await command(["set-password", "nobody"]);
    expect(result.code).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toMatch(/no account/i);
  });

  test("refuses an invalid username", async () => {
    const result = await command(["set-password", "bad name"]);
    expect(result.code).toBe(1);
    expect(result.stdout).toBe("");
  });
});

describe("disable and enable", () => {
  test("disable marks the account and ends its sessions", async () => {
    await made("gina");
    const id = await startSession("gina");
    const result = await command(["disable", "gina"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toBe("");
    expect((await findPasswordMethod(db, "gina"))?.disabled).toBe(true);
    const row = await sql<{ n: string }>`select count(*) as n from sessions where id = ${id}`.execute(db);
    expect(row.rows[0]?.n).toBe("0");
  });

  test("enable clears the mark, and a new session loads again", async () => {
    await made("hank");
    await command(["disable", "hank"]);
    const method = await findPasswordMethod(db, "hank");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const blocked = { id: "hank-blocked", accountId: method?.accountId ?? "", methodId: method?.methodId ?? "", expiresAt };
    await createSession(db, blocked);
    expect(await stillSignedIn("hank-blocked")).toBe(false);

    const result = await command(["enable", "hank"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toBe("");
    expect((await findPasswordMethod(db, "hank"))?.disabled).toBe(false);
    expect(await stillSignedIn("hank-blocked")).toBe(true);
  });

  test("an unknown username is refused for both", async () => {
    for (const sub of ["disable", "enable"]) {
      const result = await command([sub, "nobody"]);
      expect(result.code).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toMatch(/no account/i);
    }
  });

  test("an invalid username is refused for both", async () => {
    for (const sub of ["disable", "enable"]) {
      expect((await command([sub, "_x"])).code).toBe(1);
    }
  });
});

describe("usage errors exit 2", () => {
  const cases: Array<[string, string[]]> = [
    ["no arguments", []],
    ["an unknown subcommand", ["remove", "alice"]],
    ["a missing username", ["make"]],
    ["an extra argument, such as a password", ["make", "zed", "hunter2hunter2hunter2"]],
    ["an extra argument after --stdin", ["set-password", "zed", "--stdin", "hunter2"]],
    ["an unknown flag", ["make", "zed", "--password"]],
    ["a flag in place of the username", ["make", "--stdin"]],
    ["--stdin on disable", ["disable", "zed", "--stdin"]],
    ["--stdin on enable", ["enable", "zed", "--stdin"]],
  ];
  test.each(cases)("%s", async (_name, args) => {
    const result = await command(args);
    expect(result.code).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toMatch(usage);
  });

  test("a refused password argument is never stored or echoed", async () => {
    const secret = "hunter2hunter2hunter2";
    const result = await command(["make", "zed", secret]);
    expect(result.stderr).not.toContain(secret);
    expect(await findPasswordMethod(db, "zed")).toBeUndefined();
  });
});

describe("--stdin length limits", () => {
  const at = (n: number) => "p".repeat(n);

  test.each([14, 129])("refuses %i characters and changes nothing", async (n) => {
    await made(`len${n}`);
    const before = (await findPasswordMethod(db, `len${n}`))?.passwordHash;
    const result = await command(["set-password", `len${n}`, "--stdin"], `${at(n)}\n`);
    expect(result.code).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr.trim().split("\n")).toHaveLength(1);
    expect((await findPasswordMethod(db, `len${n}`))?.passwordHash).toBe(before);
  });

  test.each([15, 128])("accepts %i characters", async (n) => {
    await made(`len${n}`);
    const result = await command(["set-password", `len${n}`, "--stdin"], `${at(n)}\n`);
    expect(result.code).toBe(0);
    const method = await findPasswordMethod(db, `len${n}`);
    expect(await verifyPassword(at(n), method?.passwordHash ?? "")).toBe(true);
  });

  test("make refuses a short password before making the account", async () => {
    const result = await command(["make", "shorty", "--stdin"], "short\n");
    expect(result.code).toBe(1);
    expect(await findPasswordMethod(db, "shorty")).toBeUndefined();
  });

  test("strips one trailing newline: \\n or \\r\\n, and only one", async () => {
    await made("newlines");
    for (const [input, expected] of [
      [`${at(15)}\n`, at(15)],
      [`${at(15)}\r\n`, at(15)],
      [`${at(15)}\n\n`, `${at(15)}\n`],
      [at(15), at(15)],
    ] as const) {
      expect((await command(["set-password", "newlines", "--stdin"], input)).code).toBe(0);
      const method = await findPasswordMethod(db, "newlines");
      expect(await verifyPassword(expected, method?.passwordHash ?? "")).toBe(true);
    }
  });

  test("an empty standard input is refused", async () => {
    await made("empty");
    expect((await command(["set-password", "empty", "--stdin"], "")).code).toBe(1);
  });
});

describe("run as a program", () => {
  const script = fileURLToPath(new URL("./command.ts", import.meta.url));

  function program(args: string[], env: NodeJS.ProcessEnv, stdin = ""): Promise<Run> {
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [script, ...args], {
        env: { PATH: process.env.PATH, ...env },
      });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => (stdout += chunk));
      child.stderr.on("data", (chunk) => (stderr += chunk));
      child.on("error", reject);
      child.on("close", (code) => resolve({ code: code ?? -1, stdout, stderr }));
      child.stdin.end(stdin);
    });
  }

  test("a missing DATABASE_URL is one sentence and exit 2", async () => {
    const result = await program(["make", "someone"], {});
    expect(result.code).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toMatch(/DATABASE_URL/);
    expect(result.stderr.trim().split("\n")).toHaveLength(1);
  });

  test("reads only DATABASE_URL, works on the database, and exits", async () => {
    const name = (await sql<{ name: string }>`select current_database() as name`.execute(db))
      .rows[0]?.name;
    const url = new URL(requireDatabaseUrl());
    url.pathname = `/${name}`;
    const env = { DATABASE_URL: url.toString() };

    const result = await program(["make", "viaprogram", "--stdin"], env, `${strong}\n`);
    expect(result.stderr).toMatch(/viaprogram/);
    expect(result.code).toBe(0);
    expect(result.stdout).toBe("");
    const method = await findPasswordMethod(db, "viaprogram");
    expect(await verifyPassword(strong, method?.passwordHash ?? "")).toBe(true);

    const again = await program(["make", "viaprogram"], env);
    expect(again.code).toBe(1);
  });

  test("an unreachable database is one sentence and exit 1", async () => {
    const result = await program(["make", "someone"], {
      DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:1/none",
    });
    expect(result.code).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr.trim().split("\n")).toHaveLength(1);
  });
});

test("an account made before is untouched by a refused make", async () => {
  const first = await made("untouched");
  await command(["make", "untouched"]);
  const method = await findPasswordMethod(db, "untouched");
  expect(await verifyPassword(first, method?.passwordHash ?? "")).toBe(true);
});

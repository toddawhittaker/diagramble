import type { Kysely } from "kysely";
import { createDb } from "../db/connection.ts";
import type { Database } from "../db/schema.ts";
import { generatePassword, hashPassword, normalizeUsername } from "./password.ts";
import {
  UsernameTakenError,
  createPasswordAccount,
  deleteSessionsFor,
  findPasswordMethod,
  setDisabled,
  setPasswordHash,
} from "./store.ts";

/*
 * The account command (SPEC.md section 1, "Sign-in"; section 3.9). It is the only
 * way to make an account, set its password, or disable it: nobody signs up from
 * the web. Its shape follows `runResetAdmin` of Portikus
 * (packages/auth/src/local-admin.ts): `run` takes the arguments, what it needs
 * and its three streams, and returns the exit code.
 */

/** Where `run` reads and writes: standard output carries a generated password and nothing else. */
export interface CommandIo {
  stdout: NodeJS.WritableStream;
  stderr: NodeJS.WritableStream;
  stdin: NodeJS.ReadableStream;
}

/** What `run` needs from the process, so tests can pass their own. */
export interface CommandDeps {
  db: Kysely<Database>;
}

const USAGE =
  "usage: account make <username> [--stdin]\n" +
  "       account set-password <username> [--stdin]\n" +
  "       account disable <username>\n" +
  "       account enable <username>\n";

const MIN_PASSWORD_LENGTH = 15;
const MAX_PASSWORD_LENGTH = 128;

type Subcommand = "make" | "set-password" | "disable" | "enable";

interface Parsed {
  subcommand: Subcommand;
  username: string;
  stdin: boolean;
}

/** The parsed arguments, or the sentence that says what is wrong with them. */
function parseArgs(args: string[]): Parsed | string {
  const positional: string[] = [];
  let stdin = false;
  for (const arg of args) {
    if (arg === "--stdin") stdin = true;
    else if (arg.startsWith("-")) return `Unknown option: ${arg}.`;
    else positional.push(arg);
  }
  const [subcommand, username, ...extra] = positional;
  if (
    subcommand !== "make" &&
    subcommand !== "set-password" &&
    subcommand !== "disable" &&
    subcommand !== "enable"
  ) {
    return subcommand === undefined
      ? "Say what to do."
      : `Unknown subcommand: ${subcommand}.`;
  }
  if (username === undefined) return `${subcommand} needs a username.`;
  if (extra.length > 0) {
    return "Give only a username; a password is never taken as an argument.";
  }
  if (stdin && (subcommand === "disable" || subcommand === "enable")) {
    return `${subcommand} takes no password, so --stdin does not apply.`;
  }
  return { subcommand, username, stdin };
}

/** Standard input as text, with one trailing newline (`\n` or `\r\n`) removed. */
async function readPassword(stdin: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer));
  }
  return Buffer.concat(chunks).toString("utf8").replace(/\r?\n$/, "");
}

/**
 * Run one subcommand and return the exit code: 0 on success, 1 when the request
 * cannot be done (invalid or unknown or taken username, a password of the wrong
 * length, an unexpected failure), 2 for a bad command line. A generated password
 * goes to standard output followed by a newline; every other message goes to
 * standard error.
 */
export async function run(args: string[], deps: CommandDeps, io: CommandIo): Promise<number> {
  const say = (text: string) => io.stderr.write(`${text}\n`);

  const parsed = parseArgs(args);
  if (typeof parsed === "string") {
    io.stderr.write(`${parsed}\n${USAGE}`);
    return 2;
  }
  const username = normalizeUsername(parsed.username);
  if (username === undefined) {
    say(
      "A username has 1 to 64 letters, digits, dots, underscores or hyphens, and starts with a letter or digit.",
    );
    return 1;
  }

  try {
    let password: string | undefined;
    let generated = false;
    if (parsed.subcommand === "make" || parsed.subcommand === "set-password") {
      if (parsed.stdin) {
        password = await readPassword(io.stdin);
        const length = [...password].length;
        if (length < MIN_PASSWORD_LENGTH || length > MAX_PASSWORD_LENGTH) {
          say(
            `A password read from standard input must have ${MIN_PASSWORD_LENGTH} to ${MAX_PASSWORD_LENGTH} characters.`,
          );
          return 1;
        }
      } else {
        password = generatePassword();
        generated = true;
      }
    }

    if (parsed.subcommand === "make") {
      await createPasswordAccount(deps.db, username, await hashPassword(password ?? ""));
      say(`Made the account ${username}.`);
    } else {
      const method = await findPasswordMethod(deps.db, username);
      if (!method) {
        say(`There is no account named ${username}.`);
        return 1;
      }
      // Each change and the ending of the sessions land together or not at all.
      if (parsed.subcommand === "set-password") {
        const hash = await hashPassword(password ?? "");
        await deps.db.transaction().execute(async (trx) => {
          await setPasswordHash(trx, method.methodId, hash);
          await deleteSessionsFor(trx, method.accountId);
        });
        say(`Set a new password for ${username} and ended its sessions.`);
      } else if (parsed.subcommand === "disable") {
        await deps.db.transaction().execute(async (trx) => {
          await setDisabled(trx, method.accountId, true);
          await deleteSessionsFor(trx, method.accountId);
        });
        say(`Disabled ${username} and ended its sessions.`);
      } else {
        await setDisabled(deps.db, method.accountId, false);
        say(`Enabled ${username}.`);
      }
    }

    if (generated) io.stdout.write(`${password}\n`);
    return 0;
  } catch (error) {
    if (error instanceof UsernameTakenError) {
      say(`The username ${username} is already taken.`);
      return 1;
    }
    const reason = error instanceof Error ? error.message : String(error);
    say(`The command failed: ${reason.replace(/\s+/g, " ")}`);
    return 1;
  }
}

if (import.meta.main) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    process.stderr.write("DATABASE_URL must be set to the database to change.\n");
    process.exitCode = 2;
  } else {
    const db = createDb(url, 2);
    try {
      process.exitCode = await run(process.argv.slice(2), { db }, process);
    } finally {
      await db.destroy();
    }
  }
}

// The server's settings, read once from the environment at start-up (SPEC.md section 1,
// "Deployment"). Secrets arrive only as environment variables.

import { statSync } from "node:fs";
import { z } from "zod";

function isPostgresUrl(value: string): boolean {
  return /^postgres(ql)?:\/\//.test(value) && URL.canParse(value) && new URL(value).hostname !== "";
}

/** An origin with nothing after it, https unless the host is local (SPEC.md section 1, "Host names"). */
function isAppOrigin(value: string): boolean {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  if (url.origin !== value) return false;
  if (url.protocol === "https:") return true;
  const local = url.hostname === "localhost" || url.hostname.endsWith(".localhost");
  return url.protocol === "http:" && local;
}

function isDirectory(value: string): boolean {
  try {
    return statSync(value).isDirectory();
  } catch {
    return false;
  }
}

const wholeNumber = (fallback: string) =>
  z.string().regex(/^\d+$/).default(fallback).transform(Number);

export const settingsSchema = z.object({
  DATABASE_URL: z.string().refine(isPostgresUrl),
  APP_ORIGIN: z.string().refine(isAppOrigin),
  PORT: wholeNumber("3000").refine((port) => port <= 65535),
  TRUST_PROXY_HOPS: wholeNumber("0"),
  STATIC_DIR: z.string().refine(isDirectory),
});

/** What each variable must be, said when it is not. */
const rules: Record<keyof z.input<typeof settingsSchema>, string> = {
  DATABASE_URL: "must be a postgres:// or postgresql:// URL",
  APP_ORIGIN:
    "must be an origin such as https://app.example.edu, with no path, and https unless the host is localhost",
  PORT: "must be a whole number from 0 to 65535",
  TRUST_PROXY_HOPS: "must be a whole number",
  STATIC_DIR: "must name an existing directory",
};

export interface Settings {
  databaseUrl: string;
  appOrigin: string;
  port: number;
  trustProxyHops: number;
  staticDir: string;
}

/** The settings from `env`; throws one sentence naming the first bad or missing variable. */
export function readSettings(env: Record<string, string | undefined>): Settings {
  const result = settingsSchema.safeParse(env);
  if (!result.success) {
    const name = result.error.issues[0]?.path[0] as keyof typeof rules;
    throw new Error(`The setting ${name} ${rules[name]}.`);
  }
  const s = result.data;
  return {
    databaseUrl: s.DATABASE_URL,
    appOrigin: s.APP_ORIGIN,
    port: s.PORT,
    trustProxyHops: s.TRUST_PROXY_HOPS,
    staticDir: s.STATIC_DIR,
  };
}

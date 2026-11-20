// Start-up: settings, database, migrations, then the server (SPEC.md section 1,
// "Deployment").

import type { FastifyInstance } from "fastify";
import { createDb } from "./db/connection.ts";
import { migrateToLatest } from "./db/migrate.ts";
import { buildServer } from "./server.ts";
import { readSettings } from "./settings.ts";

export async function start(
  env: Record<string, string | undefined>,
  { logger = true }: { logger?: boolean } = {},
): Promise<{ server: FastifyInstance; close: () => Promise<void> }> {
  const settings = readSettings(env);
  const db = createDb(settings.databaseUrl);
  try {
    await migrateToLatest(db);
  } catch (error) {
    await db.destroy();
    throw error;
  }
  const server = await buildServer({ db, settings, logger });
  await server.listen({ host: "0.0.0.0", port: settings.port });

  let closing: Promise<void> | undefined;
  const close = () => {
    closing ??= (async () => {
      process.off("SIGTERM", onSignal);
      process.off("SIGINT", onSignal);
      await server.close();
      await db.destroy();
    })();
    return closing;
  };
  const onSignal = () => void close();
  process.once("SIGTERM", onSignal);
  process.once("SIGINT", onSignal);
  return { server, close };
}

if (import.meta.main) {
  try {
    await start(process.env);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

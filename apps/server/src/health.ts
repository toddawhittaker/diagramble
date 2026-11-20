import type { FastifyInstance } from "fastify";
import { type Kysely, sql } from "kysely";
import type { Database } from "./db/schema.ts";

/** `GET /health`: 200 when the database answers, else 503. */
export function healthRoutes(app: FastifyInstance, db: Kysely<Database>): void {
  app.get("/health", async (_request, reply) => {
    try {
      await sql`select 1`.execute(db);
      return reply.type("text/plain; charset=utf-8").send("ok");
    } catch {
      return reply.code(503).type("text/plain; charset=utf-8").send("The database is not answering.");
    }
  });
}

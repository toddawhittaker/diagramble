import fastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";

/** The prototype's build at `/`, reached only signed in because the guard runs first. */
export async function staticFiles(app: FastifyInstance, root: string): Promise<void> {
  await app.register(fastifyStatic, { root, prefix: "/" });
}

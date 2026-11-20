import fastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";

/** The prototype's build at `/`, reached only signed in because the guard runs first. */
export async function staticFiles(app: FastifyInstance, root: string): Promise<void> {
  // A dotfile such as `.env` is never served (SPEC.md section 1, "Sign-in").
  await app.register(fastifyStatic, { root, prefix: "/", dotfiles: "deny" });
}

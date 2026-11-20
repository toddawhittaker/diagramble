import { z } from "zod";
import { Id } from "../id.ts";
import { commonFields } from "./common.ts";

export const Diagram = z.strictObject({
  kind: z.literal("diagram"),
  ...commonFields,
  diagramKind: z.enum(["context", "dfd"]).meta({ description: "The context diagram, or a data flow diagram that decomposes a process." }),
  decomposesProcessId: Id.nullable().meta({ description: "The process this diagram decomposes; null for the context diagram." }),
});
export type Diagram = z.infer<typeof Diagram>;

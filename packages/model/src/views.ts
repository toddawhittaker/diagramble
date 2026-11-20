import { z } from "zod";
import { Id } from "./id.ts";

export const Occurrence = z.strictObject({
  id: Id,
  diagramId: Id.meta({ description: "The diagram the element is shown on." }),
  elementId: Id.meta({ description: "The element shown." }),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});
export type Occurrence = z.infer<typeof Occurrence>;

export const Point = z.strictObject({ x: z.number(), y: z.number() });
export type Point = z.infer<typeof Point>;

export const Route = z.strictObject({
  id: Id,
  flowId: Id.meta({ description: "The data flow or control flow this route draws." }),
  diagramId: Id.meta({ description: "The flow's diagram." }),
  sourceOccurrenceId: Id.nullable().meta({ description: "The occurrence the source end attaches to; null when unattached, off-diagram, or for a control flow." }),
  targetOccurrenceId: Id.nullable().meta({ description: "The occurrence the target end attaches to; null when unattached or off-diagram." }),
  points: z.array(Point).meta({ description: "The bend points of the line, in order." }),
});
export type Route = z.infer<typeof Route>;

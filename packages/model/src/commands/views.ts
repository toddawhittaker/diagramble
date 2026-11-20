import { z } from "zod";
import { Id } from "../id.ts";
import type { AnyCommandDefinition, CommandDefinition } from "../registry.ts";
import { Point } from "../views.ts";

// The commands that change only how a diagram is drawn: where an occurrence sits and
// the bend points of a route (docs/SPEC.md sections 3.5 and 4.1). Neither touches an
// element, so neither can break an invariant of section 3.4.

const MoveOccurrenceArgs = z.strictObject({
  occurrenceId: Id.meta({ description: "The occurrence to move or resize." }),
  x: z.number().meta({ description: "The new horizontal position of the occurrence's top-left corner." }),
  y: z.number().meta({ description: "The new vertical position of the occurrence's top-left corner." }),
  width: z.number().meta({ description: "The new width. Must be greater than zero." }),
  height: z.number().meta({ description: "The new height. Must be greater than zero." }),
});

const moveOccurrence: CommandDefinition<z.infer<typeof MoveOccurrenceArgs>> = {
  name: "moveOccurrence",
  kind: "command",
  sentence: "Move or resize a shape on a diagram.",
  args: MoveOccurrenceArgs,
  newIds: () => [],
  run(doc, args) {
    const occurrence = doc.views.occurrences[args.occurrenceId];
    if (occurrence === undefined) return { ok: false, message: "That shape is not on any diagram." };
    if (!(args.width > 0) || !(args.height > 0)) {
      return { ok: false, message: "A shape must be wider and taller than zero." };
    }
    occurrence.x = args.x;
    occurrence.y = args.y;
    occurrence.width = args.width;
    occurrence.height = args.height;
    return { ok: true, doc };
  },
};

const SetRouteArgs = z.strictObject({
  routeId: Id.meta({ description: "The route whose bend points are replaced." }),
  points: z.array(Point).meta({ description: "The new bend points of the line, in order. An empty list draws a straight line." }),
});

const setRoute: CommandDefinition<z.infer<typeof SetRouteArgs>> = {
  name: "setRoute",
  kind: "command",
  sentence: "Change the bend points of a flow's line on a diagram.",
  args: SetRouteArgs,
  newIds: () => [],
  run(doc, args) {
    const route = doc.views.routes[args.routeId];
    if (route === undefined) return { ok: false, message: "That flow line is not on any diagram." };
    route.points = args.points;
    return { ok: true, doc };
  },
};

export const viewCommands: AnyCommandDefinition[] = [moveOccurrence, setRoute];

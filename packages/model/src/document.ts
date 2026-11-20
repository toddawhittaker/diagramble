import { z } from "zod";
import { Id } from "./id.ts";
import { ControlFlow, DataFlow, DataStore, ExternalEntity, Process } from "./kinds/dfd.ts";
import { DataElement, DataStructure } from "./kinds/dictionary.ts";
import { Diagram } from "./kinds/diagram.ts";
import { Occurrence, Route } from "./views.ts";

// One line per family; a later release adds a line here.
export const Element = z.discriminatedUnion("kind", [
  Process, ExternalEntity, DataStore, DataFlow, ControlFlow,
  DataStructure, DataElement,
  Diagram,
]);
export type Element = z.infer<typeof Element>;

export const Settings = z.strictObject({
  name: z.string().meta({ description: "The project's name." }),
  topDiagramId: Id.nullable().meta({ description: "The highest diagram the project is expected to contain; null only before the project has a diagram." }),
  showFindings: z.enum(["always", "onRequest"]).meta({ description: "Whether findings are shown always or only when the student asks." }),
  caseText: z.string().meta({ description: "The case description the exercise starts from. May be empty." }),
});
export type Settings = z.infer<typeof Settings>;

export const ProjectDocument = z
  .strictObject({
    schemaVersion: z.literal(1),
    settings: Settings,
    elements: z.record(Id, Element).meta({ description: "Every element, keyed by its id." }),
    views: z.strictObject({
      occurrences: z.record(Id, Occurrence).meta({ description: "Every node occurrence, keyed by its id." }),
      routes: z.record(Id, Route).meta({ description: "Every flow route, keyed by its id." }),
    }),
  })
  .meta({
    title: "Diagramble project, version 1",
    description:
      "A Diagramble project document. Each map key must equal its record's id; JSON Schema cannot say this, and the model's invariant check enforces it.",
  });
export type ProjectDocument = z.infer<typeof ProjectDocument>;

export function emptyDocument(): ProjectDocument {
  return {
    schemaVersion: 1,
    settings: { name: "", topDiagramId: null, showFindings: "always", caseText: "" },
    elements: {},
    views: { occurrences: {}, routes: {} },
  };
}

export function projectJsonSchema(): unknown {
  return z.toJSONSchema(ProjectDocument);
}

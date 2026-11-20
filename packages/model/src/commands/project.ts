// createProject (docs/SPEC.md section 4): the context diagram, process 0 and its
// occurrence, and the project settings.
import { z } from "zod";
import { Id } from "../id.ts";
import { isEmpty } from "../invariants.ts";
import type { CommandDefinition } from "../registry.ts";

const CreateProjectArgs = z.strictObject({
  name: z.string().meta({ description: "The project's name, also the name of process 0." }),
  contextDiagramId: Id.meta({ description: "The new context diagram's id." }),
  processId: Id.meta({ description: "Process 0's id." }),
  occurrenceId: Id.meta({ description: "The id of process 0's occurrence on the context diagram." }),
});
type CreateProjectArgs = z.infer<typeof CreateProjectArgs>;

const createProject: CommandDefinition<CreateProjectArgs> = {
  name: "createProject",
  kind: "command",
  sentence: "Start a project with its context diagram and process 0.",
  args: CreateProjectArgs,
  newIds: (args) => [args.contextDiagramId, args.processId, args.occurrenceId],
  run(doc, args, { origin }) {
    if (!isEmpty(doc)) {
      return { ok: false, message: "A project can be created only in an empty document." };
    }
    const text = { description: "", aliases: [], notes: "", origin };
    doc.elements[args.contextDiagramId] = {
      kind: "diagram", id: args.contextDiagramId, name: "Context diagram", ...text,
      diagramKind: "context", decomposesProcessId: null,
    };
    doc.elements[args.processId] = {
      kind: "process", id: args.processId, name: args.name, ...text,
      parentProcessId: null, ordinal: 0, processDescription: "",
    };
    doc.views.occurrences[args.occurrenceId] = {
      id: args.occurrenceId, diagramId: args.contextDiagramId, elementId: args.processId,
      x: 0, y: 0, width: 160, height: 120,
    };
    doc.settings = { name: args.name, topDiagramId: args.contextDiagramId, showFindings: "always", caseText: "" };
    return { ok: true, doc };
  },
};

export const projectCommands: CommandDefinition<CreateProjectArgs>[] = [createProject];

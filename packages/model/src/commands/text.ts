// The text commands (docs/SPEC.md sections 3.2, 3.3 and 4.1): names, descriptions,
// aliases, notes and a process's longer description.
import { z } from "zod";
import type { Element } from "../document.ts";
import { elementById } from "../derive.ts";
import { Id } from "../id.ts";
import { Called } from "../names.ts";
import type { AnyCommandDefinition, CommandDefinition } from "../registry.ts";

function missing(): { ok: false; message: string } {
  return { ok: false, message: "There is no element with that id." };
}

const elementId = Id.meta({ description: "The element to change." });

const RenameArgs = z.strictObject({
  elementId,
  name: z.string().meta({ description: "The new name. For a control flow, the event that starts the process." }),
});
type RenameArgs = z.infer<typeof RenameArgs>;

const rename: CommandDefinition<RenameArgs> = {
  name: "rename",
  kind: "command",
  sentence: "Change the name of an element.",
  args: RenameArgs,
  newIds: () => [],
  run(doc, args) {
    const element = elementById(doc, args.elementId);
    if (!element) return missing();
    if (element.kind === "dataFlow") {
      return {
        ok: false,
        message: "A data flow's label is the name of its data, so rename the data it carries or use setFlowData to carry different data.",
      };
    }
    element.name = args.name;
    return { ok: true, doc };
  },
};

const DescribeArgs = z.strictObject({
  elementId,
  description: z.string().meta({ description: "The new short description. May be empty." }),
});
type DescribeArgs = z.infer<typeof DescribeArgs>;

const describe: CommandDefinition<DescribeArgs> = {
  name: "describe",
  kind: "command",
  sentence: "Change the description of an element.",
  args: DescribeArgs,
  newIds: () => [],
  run(doc, args) {
    const element = elementById(doc, args.elementId);
    if (!element) return missing();
    element.description = args.description;
    return { ok: true, doc };
  },
};

const SetAliasesArgs = z.strictObject({
  elementId,
  aliases: z.array(z.string()).meta({ description: "The complete list of other names; it replaces the old list." }),
});
type SetAliasesArgs = z.infer<typeof SetAliasesArgs>;

const setAliases: CommandDefinition<SetAliasesArgs> = {
  name: "setAliases",
  kind: "command",
  sentence: "Replace the other names an element goes by.",
  args: SetAliasesArgs,
  newIds: () => [],
  run(doc, args) {
    const element = elementById(doc, args.elementId);
    if (!element) return missing();
    element.aliases = args.aliases;
    return { ok: true, doc };
  },
};

const SetNotesArgs = z.strictObject({
  elementId,
  notes: z.string().meta({ description: "The new working notes. May be empty." }),
});
type SetNotesArgs = z.infer<typeof SetNotesArgs>;

const setNotes: CommandDefinition<SetNotesArgs> = {
  name: "setNotes",
  kind: "command",
  sentence: "Replace the working notes of an element.",
  args: SetNotesArgs,
  newIds: () => [],
  run(doc, args) {
    const element = elementById(doc, args.elementId);
    if (!element) return missing();
    element.notes = args.notes;
    return { ok: true, doc };
  },
};

const SetProcessDescriptionArgs = z.strictObject({
  processId: Id.meta({ description: "The process to change." }),
  text: z.string().meta({ description: "The longer step-by-step text of what the process does. May be empty." }),
});
type SetProcessDescriptionArgs = z.infer<typeof SetProcessDescriptionArgs>;

const setProcessDescription: CommandDefinition<SetProcessDescriptionArgs> = {
  name: "setProcessDescription",
  kind: "command",
  sentence: "Set the longer description of a process.",
  args: SetProcessDescriptionArgs,
  newIds: () => [],
  run(doc, args) {
    const element = elementById(doc, args.processId);
    if (!element) return missing();
    if (element.kind !== "process") {
      return { ok: false, message: `${Called(element)} is not a process, so it has no process description.` };
    }
    element.processDescription = args.text;
    return { ok: true, doc };
  },
};

export const textCommands: AnyCommandDefinition[] = [rename, describe, setAliases, setNotes, setProcessDescription];

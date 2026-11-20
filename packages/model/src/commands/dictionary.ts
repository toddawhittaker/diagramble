// The dictionary commands (docs/SPEC.md sections 3.3 and 4.1): data structures, data
// elements, and what a structure is composed of. A structure may contain itself or
// form a cycle with another; the model allows it and a rule may report it.
import { z } from "zod";
import { elementById } from "../derive.ts";
import { Id } from "../id.ts";
import { AllowedValue, Component } from "../kinds/dictionary.ts";
import { called, Called } from "../names.ts";
import type { AnyCommandDefinition, CommandDefinition } from "../registry.ts";

const DefineDataArgs = z.strictObject({
  id: Id.meta({ description: "The new data definition's id." }),
  dataKind: z.enum(["structure", "element"]).meta({ description: "A data structure (a group of data) or a data element (a single piece of data)." }),
  name: z.string().meta({ description: "The data definition's name." }),
});
type DefineDataArgs = z.infer<typeof DefineDataArgs>;

const defineData: CommandDefinition<DefineDataArgs> = {
  name: "defineData",
  kind: "command",
  sentence: "Create a data structure or a data element.",
  args: DefineDataArgs,
  newIds: (args) => [args.id],
  run(doc, args, { origin }) {
    const common = { id: args.id, name: args.name, description: "", aliases: [], notes: "", origin };
    doc.elements[args.id] = args.dataKind === "structure"
      ? { kind: "dataStructure", ...common, components: [] }
      : { kind: "dataElement", ...common, dataType: "", allowedValues: [] };
    return { ok: true, doc };
  },
};

const SetCompositionArgs = z.strictObject({
  structureId: Id.meta({ description: "The data structure to change." }),
  components: z.array(Component).meta({ description: "The complete list of parts, in order; it replaces the old list." }),
});
type SetCompositionArgs = z.infer<typeof SetCompositionArgs>;

const setComposition: CommandDefinition<SetCompositionArgs> = {
  name: "setComposition",
  kind: "command",
  sentence: "Replace the list of parts a data structure is made of.",
  args: SetCompositionArgs,
  newIds: () => [],
  run(doc, args) {
    const structure = elementById(doc, args.structureId);
    if (structure?.kind !== "dataStructure") {
      return {
        ok: false,
        message: structure
          ? `${Called(structure)} is not a data structure, so it has no parts.`
          : "There is no data structure with that id.",
      };
    }
    for (const component of args.components) {
      const part = elementById(doc, component.dataId);
      if (part?.kind !== "dataStructure" && part?.kind !== "dataElement") {
        return {
          ok: false,
          message: part
            ? `${Called(part)} is not a data structure or a data element, so it cannot be part of ${called(structure)}.`
            : `A part of ${called(structure)} is not an existing data structure or data element.`,
        };
      }
      if (component.limit !== null && component.occurs !== "many") {
        return {
          ok: false,
          message: `${Called(part)} has a limit but does not occur "many" times; a limit applies only to a part that occurs many times.`,
        };
      }
    }
    structure.components = args.components;
    return { ok: true, doc };
  },
};

const SetDataElementArgs = z.strictObject({
  elementId: Id.meta({ description: "The data element to change." }),
  dataType: z.string().meta({ description: "The type of the data, as text, such as date or text." }),
  allowedValues: z.array(AllowedValue).meta({ description: "The complete list of allowed values with their meanings; empty for any value." }),
});
type SetDataElementArgs = z.infer<typeof SetDataElementArgs>;

const setDataElement: CommandDefinition<SetDataElementArgs> = {
  name: "setDataElement",
  kind: "command",
  sentence: "Set the type and the allowed values of a data element.",
  args: SetDataElementArgs,
  newIds: () => [],
  run(doc, args) {
    const element = elementById(doc, args.elementId);
    if (element?.kind !== "dataElement") {
      return {
        ok: false,
        message: element
          ? `${Called(element)} is not a data element, so it has no type or allowed values.`
          : "There is no data element with that id.",
      };
    }
    element.dataType = args.dataType;
    element.allowedValues = args.allowedValues;
    return { ok: true, doc };
  },
};

export const dictionaryCommands: AnyCommandDefinition[] = [defineData, setComposition, setDataElement];

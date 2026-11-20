// The dictionary queries (docs/SPEC.md section 4.2).
import { z } from "zod";
import { elementById } from "../derive.ts";
import type { ProjectDocument } from "../document.ts";
import { Id } from "../id.ts";
import type { AnyQueryDefinition, QueryDefinition } from "../registry.ts";

/**
 * The data elements a data definition is ultimately composed of, each once, in the
 * order they are first met going through the parts in order. A data element gives
 * itself. A structure is expanded at most once, so a structure that contains itself,
 * directly or through others, cannot loop. An unknown id, an id of another kind and a
 * part that does not exist give nothing.
 */
export function dataElementsOf(doc: ProjectDocument, dataId: Id): Id[] {
  const found: Id[] = [];
  const seen = new Set<Id>();
  const visit = (id: Id): void => {
    if (seen.has(id)) return;
    seen.add(id);
    const definition = elementById(doc, id);
    if (definition?.kind === "dataElement") found.push(id);
    else if (definition?.kind === "dataStructure") definition.components.forEach((c) => visit(c.dataId));
  };
  visit(dataId);
  return found;
}

const ExpandDataArgs = z.strictObject({
  dataId: Id.meta({ description: "The data structure or data element to expand." }),
});
type ExpandDataArgs = z.infer<typeof ExpandDataArgs>;

const expandData: QueryDefinition<ExpandDataArgs, Id[]> = {
  name: "expandData",
  kind: "query",
  sentence: "List the data elements a data definition is ultimately made of.",
  args: ExpandDataArgs,
  run: (doc, args) => dataElementsOf(doc, args.dataId),
};

export const dictionaryQueries: AnyQueryDefinition[] = [expandData];

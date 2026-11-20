// The element queries of docs/SPEC.md section 4.2: getModel, getElement and whereUsed.
// Results are plain JSON values that share nothing with the document.
import { z } from "zod";
import { flowsTouching } from "../derive.ts";
import type { Element, ProjectDocument } from "../document.ts";
import { Id } from "../id.ts";
import { compareText } from "../names.ts";
import type { QueryDefinition } from "../registry.ts";
import type { Occurrence } from "../views.ts";

// Not apply.ts's copy: apply.ts imports the registry, which imports this file.
function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function byId<T extends { id: Id }>(items: T[]): T[] {
  return [...items].sort((a, b) => compareText(a.id, b.id));
}

function sortedUnique(ids: Id[]): Id[] {
  return [...new Set(ids)].sort(compareText);
}

// An id such as "toString" must not find a method of Object.
function find(doc: ProjectDocument, id: Id): Element | undefined {
  return Object.hasOwn(doc.elements, id) ? doc.elements[id] : undefined;
}

const NoArgs = z.strictObject({});

const getModel: QueryDefinition<z.infer<typeof NoArgs>, ProjectDocument> = {
  name: "getModel",
  kind: "query",
  sentence: "Return the whole project document in its storage form.",
  args: NoArgs,
  run: (doc) => copy(doc),
};

const ElementArgs = z.strictObject({
  elementId: Id.meta({ description: "The id of the element to look up." }),
});
type ElementArgs = z.infer<typeof ElementArgs>;

export type ElementWithOccurrences = { element: Element; occurrences: Occurrence[] };

const getElement: QueryDefinition<ElementArgs, ElementWithOccurrences | null> = {
  name: "getElement",
  kind: "query",
  sentence: "Return one element with its occurrences on every diagram, or null when the id is unknown.",
  args: ElementArgs,
  run(doc, { elementId }) {
    const element = find(doc, elementId);
    if (element === undefined) return null;
    const occurrences = byId(Object.values(doc.views.occurrences).filter((o) => o.elementId === elementId));
    return copy({ element, occurrences });
  },
};

export type WhereUsed = { diagrams: Id[]; flows: Id[]; structures: Id[] };

const whereUsed: QueryDefinition<ElementArgs, WhereUsed | null> = {
  name: "whereUsed",
  kind: "query",
  sentence:
    "List the diagrams that show an element or decompose it, the flows that connect to it, carry it or lie on it, and the data structures that list it, or null when the id is unknown.",
  args: ElementArgs,
  run(doc, { elementId }) {
    if (find(doc, elementId) === undefined) return null;
    const everyElement = Object.values(doc.elements);
    const carrying = everyElement.filter((e) => e.kind === "dataFlow" && e.dataId === elementId);
    const onDiagram = everyElement.filter((e) => (e.kind === "dataFlow" || e.kind === "controlFlow") && e.diagramId === elementId);
    const child = everyElement.filter((e) => e.kind === "diagram" && e.decomposesProcessId === elementId);
    return {
      diagrams: sortedUnique([
        ...Object.values(doc.views.occurrences).filter((o) => o.elementId === elementId).map((o) => o.diagramId),
        ...child.map((d) => d.id),
      ]),
      flows: sortedUnique([...flowsTouching(doc, elementId), ...carrying, ...onDiagram].map((flow) => flow.id)),
      structures: sortedUnique(
        everyElement
          .filter((e) => e.kind === "dataStructure" && e.components.some((c) => c.dataId === elementId))
          .map((e) => e.id),
      ),
    };
  },
};

export const elementQueries: QueryDefinition<any, unknown>[] = [getModel, getElement, whereUsed];

// deleteElement and removeOccurrence (docs/SPEC.md sections 3.4, 3.5 and 4.1).
import { z } from "zod";
import type { Element, ProjectDocument } from "../document.ts";
import { Id } from "../id.ts";
import { elementById, occurrenceById, occurrencesOn } from "../derive.ts";
import { called } from "../names.ts";
import type { CommandDefinition } from "../registry.ts";

/**
 * Deletes the seed elements and everything that cannot outlive them: the flows on a
 * deleted diagram, the flows touching or carrying a deleted element, the occurrences
 * of deleted elements and on deleted diagrams, and the routes of deleted flows. A
 * deleted data definition leaves every component list.
 */
function removeWithDependents(doc: ProjectDocument, seed: Iterable<Id>): void {
  // One pass is enough (SPEC.md section 4.1): every seed is decided before the pass, and
  // a flow added to the set cannot make another flow need removing, because a flow's
  // ends, diagram and data are never flows.
  const doomed = new Set<Id>(seed);
  for (const element of Object.values(doc.elements)) {
    if (element.kind === "dataFlow") {
      const touches =
        (element.sourceId !== null && doomed.has(element.sourceId)) ||
        (element.targetId !== null && doomed.has(element.targetId));
      if (touches || doomed.has(element.diagramId) || doomed.has(element.dataId)) doomed.add(element.id);
    } else if (element.kind === "controlFlow") {
      if (doomed.has(element.targetId) || doomed.has(element.diagramId)) doomed.add(element.id);
    }
  }
  for (const id of doomed) delete doc.elements[id];
  for (const occurrence of Object.values(doc.views.occurrences)) {
    if (doomed.has(occurrence.elementId) || doomed.has(occurrence.diagramId)) {
      delete doc.views.occurrences[occurrence.id];
    }
  }
  for (const route of Object.values(doc.views.routes)) {
    if (doomed.has(route.flowId) || doomed.has(route.diagramId)) delete doc.views.routes[route.id];
  }
  for (const element of Object.values(doc.elements)) {
    if (element.kind === "dataStructure") {
      element.components = element.components.filter((c) => !doomed.has(c.dataId));
    }
  }
}

/** The process and every process below it, with the diagrams that decompose them. */
function branchOf(doc: ProjectDocument, processId: Id): Id[] {
  const processes = new Set<Id>([processId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const element of Object.values(doc.elements)) {
      if (
        element.kind === "process" &&
        element.parentProcessId !== null &&
        processes.has(element.parentProcessId) &&
        !processes.has(element.id)
      ) {
        processes.add(element.id);
        grew = true;
      }
    }
  }
  const diagrams = Object.values(doc.elements)
    .filter((e) => e.kind === "diagram" && e.decomposesProcessId !== null && processes.has(e.decomposesProcessId))
    .map((e) => e.id);
  return [...processes, ...diagrams];
}

function flowsCarrying(doc: ProjectDocument, dataId: Id): Element[] {
  return Object.values(doc.elements).filter((e) => e.kind === "dataFlow" && e.dataId === dataId);
}

function structuresListing(doc: ProjectDocument, dataId: Id): Element[] {
  return Object.values(doc.elements).filter(
    (e) => e.kind === "dataStructure" && e.id !== dataId && e.components.some((c) => c.dataId === dataId),
  );
}

const DeleteElementArgs = z.strictObject({
  elementId: Id.meta({ description: "The element to delete everywhere." }),
  cascade: z.boolean().optional().meta({
    description:
      "For a data structure or data element that is still in use: also delete the flows that carry it and take it out of every structure that lists it.",
  }),
});
type DeleteElementArgs = z.infer<typeof DeleteElementArgs>;

const deleteElement: CommandDefinition<DeleteElementArgs> = {
  name: "deleteElement",
  kind: "command",
  sentence:
    "Delete an element everywhere, with the occurrences, routes and flows that cannot exist without it.",
  args: DeleteElementArgs,
  newIds: () => [],
  run(doc, args) {
    const element = elementById(doc, args.elementId);
    if (element === undefined) {
      return { ok: false, message: `There is no element with the id "${args.elementId}".` };
    }
    const name = called(element);
    switch (element.kind) {
      case "diagram": {
        if (element.diagramKind === "context") {
          return { ok: false, message: `The context diagram ${name} cannot be deleted because every project has one.` };
        }
        const showsProcess = occurrencesOn(doc, element.id).some((o) => elementById(doc, o.elementId)?.kind === "process");
        if (showsProcess) {
          return {
            ok: false,
            message: `The diagram ${name} shows processes, so delete the process it decomposes instead.`,
          };
        }
        removeWithDependents(doc, [element.id]);
        break;
      }
      case "process": {
        if (element.parentProcessId === null) {
          return { ok: false, message: `Process 0 (${name}) cannot be deleted because it is the top of the project.` };
        }
        removeWithDependents(doc, branchOf(doc, element.id));
        break;
      }
      case "dataStructure":
      case "dataElement": {
        const carriers = flowsCarrying(doc, element.id);
        const users = structuresListing(doc, element.id);
        if ((carriers.length > 0 || users.length > 0) && args.cascade !== true) {
          return {
            ok: false,
            message: `The data ${name} is still carried by a flow or listed in a data structure, so delete it with cascade to delete those flows and remove it from the structures.`,
          };
        }
        removeWithDependents(doc, [element.id]);
        break;
      }
      default:
        removeWithDependents(doc, [element.id]);
        break;
    }
    return { ok: true, doc };
  },
};

const RemoveOccurrenceArgs = z.strictObject({
  occurrenceId: Id.meta({ description: "The occurrence to remove from its diagram." }),
});
type RemoveOccurrenceArgs = z.infer<typeof RemoveOccurrenceArgs>;

const removeOccurrence: CommandDefinition<RemoveOccurrenceArgs> = {
  name: "removeOccurrence",
  kind: "command",
  sentence:
    "Remove one occurrence of a data store or external entity from its diagram, with the flows attached to it there.",
  args: RemoveOccurrenceArgs,
  newIds: () => [],
  run(doc, args) {
    const occurrence = occurrenceById(doc, args.occurrenceId);
    if (occurrence === undefined) {
      return { ok: false, message: `There is no occurrence with the id "${args.occurrenceId}".` };
    }
    const shown = elementById(doc, occurrence.elementId);
    if (shown?.kind === "process") {
      return {
        ok: false,
        message: `The process ${called(shown)} is shown on exactly one diagram, so delete the process instead of removing its occurrence.`,
      };
    }
    const attached = Object.values(doc.views.routes)
      .filter((r) => r.sourceOccurrenceId === occurrence.id || r.targetOccurrenceId === occurrence.id)
      .map((r) => r.flowId);
    removeWithDependents(doc, attached);
    delete doc.views.occurrences[occurrence.id];
    return { ok: true, doc };
  },
};

export const deleteCommands: CommandDefinition<any>[] = [deleteElement, removeOccurrence];

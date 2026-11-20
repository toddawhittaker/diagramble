// expandProcess (docs/SPEC.md sections 3.3, 3.4, 3.5 and 4.1): the child diagram of a
// process, with a new flow for each data flow that touches the process on its parent
// diagram.
import { z } from "zod";
import { childDiagram, diagramShowing, occurrencesOn } from "../derive.ts";
import type { ProjectDocument } from "../document.ts";
import { Id } from "../id.ts";
import type { DataFlow } from "../kinds/dfd.ts";
import type { CommandDefinition } from "../registry.ts";

const FlowIds = z.strictObject({
  flowId: Id.meta({ description: "The id of the new data flow on the child diagram." }),
  routeId: Id.meta({ description: "The id of the new data flow's route." }),
});

const ExpandProcessArgs = z.strictObject({
  processId: Id.meta({ description: "The process to expand." }),
  diagramId: Id.meta({ description: "The id of the new child diagram." }),
  flowIds: z.record(Id, FlowIds).meta({
    description:
      "One entry for each data flow on the parent diagram that touches the process, keyed by that flow's id, with the ids of the new flow and its route.",
  }),
  occurrenceIds: z.record(Id, Id).meta({
    description:
      "One entry for each external entity or data store the new flows connect to, keyed by that element's id, with the id of its new occurrence on the child diagram.",
  }),
});
type ExpandProcessArgs = z.infer<typeof ExpandProcessArgs>;

const KIND_WORDS: Record<ProjectDocument["elements"][string]["kind"], string> = {
  process: "process",
  externalEntity: "external entity",
  dataStore: "data store",
  dataFlow: "data flow",
  controlFlow: "control flow",
  dataStructure: "data structure",
  dataElement: "data element",
  diagram: "diagram",
};

/** An element for a sentence: its kind and name, or its kind alone when it has no name. */
function describe(doc: ProjectDocument, id: Id): string {
  const element = doc.elements[id];
  if (element === undefined) return `"${id}"`;
  const label = element.kind === "dataFlow" ? (doc.elements[element.dataId]?.name ?? "") : element.name;
  const kind = KIND_WORDS[element.kind];
  return label === "" ? `an unnamed ${kind}` : `${kind} "${label}"`;
}

function sentenceStart(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function list(items: string[]): string {
  if (items.length < 2) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

type Carried = { flow: DataFlow; processIsSource: boolean; other: Id };

const expandProcess: CommandDefinition<ExpandProcessArgs> = {
  name: "expandProcess",
  kind: "command",
  sentence: "Create the child diagram of a process, carrying down the data flows that touch it.",
  args: ExpandProcessArgs,
  newIds: (args) => [
    args.diagramId,
    ...Object.values(args.flowIds).flatMap((ids) => [ids.flowId, ids.routeId]),
    ...Object.values(args.occurrenceIds),
  ],
  run(doc, args, { origin }) {
    const process = doc.elements[args.processId];
    if (process === undefined) {
      return { ok: false, message: `There is no process with the id "${args.processId}" to expand.` };
    }
    if (process.kind !== "process") {
      return { ok: false, message: `${sentenceStart(describe(doc, process.id))} is not a process, so it cannot be expanded.` };
    }
    if (childDiagram(doc, process.id) !== null) {
      return { ok: false, message: `The process "${process.name}" already has a child diagram, so it cannot be expanded again.` };
    }
    const parentId = diagramShowing(doc, process.id);
    if (parentId === null) {
      return { ok: false, message: `The process "${process.name}" is not shown on any diagram, so it cannot be expanded.` };
    }

    // The data flows to carry down: those on the parent diagram with the process at one
    // end. A flow whose other end is empty has nothing to attach on the child diagram, and
    // a flow from the process to itself would have no end left, so neither is carried.
    const carried: Carried[] = [];
    const flows = Object.values(doc.elements)
      .filter((e): e is DataFlow => e.kind === "dataFlow" && e.diagramId === parentId)
      .sort((a, b) => compare(a.id, b.id));
    for (const flow of flows) {
      const processIsSource = flow.sourceId === process.id;
      if (!processIsSource && flow.targetId !== process.id) continue;
      const other = processIsSource ? flow.targetId : flow.sourceId;
      if (other === process.id) {
        return {
          ok: false,
          message: `${sentenceStart(describe(doc, flow.id))} runs from the process "${process.name}" to itself, so it cannot be carried down.`,
        };
      }
      if (other === null) continue;
      carried.push({ flow, processIsSource, other });
    }

    const placedIds = [
      ...new Set(
        carried.map((c) => c.other).filter((id) => {
          const kind = doc.elements[id]?.kind;
          return kind === "externalEntity" || kind === "dataStore";
        }),
      ),
    ].sort(compare);

    const problems: string[] = [];
    const missingFlows = carried.filter((c) => !Object.hasOwn(args.flowIds, c.flow.id));
    if (missingFlows.length > 0) {
      problems.push(`flowIds has no entry for ${list(missingFlows.map((c) => describe(doc, c.flow.id)))}`);
    }
    const carriedIds = new Set(carried.map((c) => c.flow.id));
    const extraFlows = Object.keys(args.flowIds).filter((id) => !carriedIds.has(id)).sort(compare);
    if (extraFlows.length > 0) {
      problems.push(`flowIds has ${list(extraFlows.map((id) => describe(doc, id)))}, which ${extraFlows.length === 1 ? "is" : "are"} not carried down`);
    }
    const missingPlaced = placedIds.filter((id) => !Object.hasOwn(args.occurrenceIds, id));
    if (missingPlaced.length > 0) {
      problems.push(`occurrenceIds has no entry for ${list(missingPlaced.map((id) => describe(doc, id)))}`);
    }
    const extraPlaced = Object.keys(args.occurrenceIds).filter((id) => !placedIds.includes(id)).sort(compare);
    if (extraPlaced.length > 0) {
      problems.push(`occurrenceIds has ${list(extraPlaced.map((id) => describe(doc, id)))}, which ${extraPlaced.length === 1 ? "is" : "are"} not placed on the child diagram`);
    }
    if (problems.length > 0) {
      return { ok: false, message: `The process "${process.name}" cannot be expanded because ${problems.join("; ")}.` };
    }

    const text = { description: "", aliases: [], notes: "", origin };
    doc.elements[args.diagramId] = {
      kind: "diagram", id: args.diagramId, name: process.name, ...text,
      diagramKind: "dfd", decomposesProcessId: process.id,
    };

    const placed = new Map<Id, Id>();
    const parentOccurrences = occurrencesOn(doc, parentId).sort((a, b) => compare(a.id, b.id));
    for (const [index, elementId] of placedIds.entries()) {
      const first = parentOccurrences.find((o) => o.elementId === elementId);
      if (first === undefined) {
        return { ok: false, message: `${sentenceStart(describe(doc, elementId))} is not shown on the diagram that shows the process "${process.name}".` };
      }
      const occurrenceId = args.occurrenceIds[elementId] as Id;
      doc.views.occurrences[occurrenceId] = {
        id: occurrenceId, diagramId: args.diagramId, elementId,
        x: 0, y: 140 * index, width: first.width, height: first.height,
      };
      placed.set(elementId, occurrenceId);
    }

    for (const { flow, processIsSource, other } of carried) {
      const ids = args.flowIds[flow.id] as z.infer<typeof FlowIds>;
      const otherEnd = processIsSource ? flow.targetId : flow.sourceId;
      doc.elements[ids.flowId] = {
        kind: "dataFlow", id: ids.flowId, name: "", ...text,
        diagramId: args.diagramId,
        sourceId: processIsSource ? null : otherEnd,
        targetId: processIsSource ? otherEnd : null,
        dataId: flow.dataId,
      };
      const occurrenceId = placed.get(other) ?? null;
      doc.views.routes[ids.routeId] = {
        id: ids.routeId, flowId: ids.flowId, diagramId: args.diagramId,
        sourceOccurrenceId: processIsSource ? null : occurrenceId,
        targetOccurrenceId: processIsSource ? occurrenceId : null,
        points: [],
      };
    }
    return { ok: true, doc };
  },
};

export const expandCommands: CommandDefinition<ExpandProcessArgs>[] = [expandProcess];

// The DFD commands of docs/SPEC.md section 4.1: nodes, flows, process numbers and the
// flow ends of section 3.4 (invariants 2, 3 and 8).
import { z } from "zod";
import { elementById, isOffDiagramProcess, isShownOn, occurrencesOn } from "../derive.ts";
import type { ProjectDocument } from "../document.ts";
import { Id } from "../id.ts";
import type { Origin } from "../kinds/common.ts";
import type { Diagram } from "../kinds/diagram.ts";
import { called } from "../names.ts";
import type { AnyCommandDefinition, CommandDefinition } from "../registry.ts";

type Refusal = { ok: false; message: string };
type Placement = { x: number; y: number; width: number; height: number };

const refuse = (message: string): Refusal => ({ ok: false, message });

const placement = {
  x: z.number().meta({ description: "The left edge of the symbol on the diagram." }),
  y: z.number().meta({ description: "The top edge of the symbol on the diagram." }),
  width: z.number().positive().meta({ description: "The width of the symbol; more than zero." }),
  height: z.number().positive().meta({ description: "The height of the symbol; more than zero." }),
};
const diagramId = Id.meta({ description: "The diagram the item is on." });
const name = (what: string) => z.string().meta({ description: `The ${what}'s name. May be empty while work is in progress.` });

/** An element named for a student, or the id in quotes when there is no such element. */
function calledId(doc: ProjectDocument, id: Id): string {
  const element = elementById(doc, id);
  return element === undefined ? `"${id}"` : called(element);
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

function diagramAt(doc: ProjectDocument, id: Id): Diagram | Refusal {
  const element = elementById(doc, id);
  return element?.kind === "diagram" ? element : refuse(`There is no diagram with the id "${id}".`);
}

function text(origin: Origin) {
  return { description: "", aliases: [] as string[], notes: "", origin };
}

function nextStoreOrdinal(doc: ProjectDocument): number {
  let highest = 0;
  for (const e of Object.values(doc.elements)) if (e.kind === "dataStore") highest = Math.max(highest, e.ordinal);
  return highest + 1;
}

function siblings(doc: ProjectDocument, parentId: Id | null, except?: Id) {
  return Object.values(doc.elements).filter(
    (e) => e.kind === "process" && e.parentProcessId === parentId && e.id !== except,
  );
}

function nextFreeOrdinal(doc: ProjectDocument, parentId: Id): number {
  const used = new Set(siblings(doc, parentId).map((p) => (p.kind === "process" ? p.ordinal : 0)));
  let candidate = 1;
  while (used.has(candidate)) candidate += 1;
  return candidate;
}

function addOccurrence(doc: ProjectDocument, id: Id, diagram: Id, element: Id, box: Placement): void {
  const { x, y, width, height } = box;
  doc.views.occurrences[id] = { id, diagramId: diagram, elementId: element, x, y, width, height };
}

// ---- Flow ends (SPEC.md sections 3.4 and 3.5) ----

type End = { offDiagram: boolean };

/** Whether an element can be a flow's end on this diagram: shown there, or an allowed off-diagram process. */
function checkEnd(doc: ProjectDocument, diagram: Diagram, endId: Id): End | Refusal {
  const element = elementById(doc, endId);
  if (element === undefined) return refuse(`There is no element with the id "${endId}".`);
  if (element.kind !== "process" && element.kind !== "externalEntity" && element.kind !== "dataStore") {
    return refuse(`A flow can only start or end at a process, data store or external entity, not at ${calledId(doc, endId)}.`);
  }
  if (isShownOn(doc, endId, diagram.id)) return { offDiagram: false };
  if (isOffDiagramProcess(doc, diagram.id, endId)) return { offDiagram: true };
  if (element.kind === "process") {
    return refuse(
      `${cap(calledId(doc, endId))} is not shown on ${calledId(doc, diagram.id)}, and a flow can leave a diagram only to a process outside the one the diagram breaks down.`,
    );
  }
  return refuse(`${cap(calledId(doc, endId))} is not shown on ${calledId(doc, diagram.id)}; place it there first.`);
}

/** The occurrence a route attaches an end to: the named one, the only one, or null off the diagram. */
function pickOccurrence(
  doc: ProjectDocument,
  diagram: Id,
  elementId: Id,
  offDiagram: boolean,
  named: Id | undefined,
): { ok: true; id: Id | null } | Refusal {
  if (offDiagram) {
    return named === undefined
      ? { ok: true, id: null }
      : refuse(`${cap(calledId(doc, elementId))} is not shown on ${calledId(doc, diagram)}, so it has no occurrence there to attach to.`);
  }
  const shown = occurrencesOn(doc, diagram).filter((o) => o.elementId === elementId);
  if (named !== undefined) {
    return shown.some((o) => o.id === named)
      ? { ok: true, id: named }
      : refuse(`The occurrence "${named}" is not a symbol for ${calledId(doc, elementId)} on ${calledId(doc, diagram)}.`);
  }
  const only = shown[0];
  if (shown.length === 1 && only !== undefined) return { ok: true, id: only.id };
  return refuse(`${cap(calledId(doc, elementId))} is shown ${shown.length} times on ${calledId(doc, diagram)}; say which occurrence the flow attaches to.`);
}

const BOTH_OFF = "Only one end of a flow may be an off-diagram process.";

// ---- Creating nodes ----

const NodeArgs = z.strictObject({
  id: Id.meta({ description: "The new element's id." }),
  occurrenceId: Id.meta({ description: "The new occurrence's id." }),
  diagramId,
  name: name("element"),
  ...placement,
});
type NodeArgs = z.infer<typeof NodeArgs>;

function nodeCommand(
  commandName: "addExternalEntity" | "addDataStore",
  sentence: string,
): CommandDefinition<NodeArgs> {
  return {
    name: commandName,
    kind: "command",
    sentence,
    args: NodeArgs,
    newIds: (a) => [a.id, a.occurrenceId],
    run(doc, a, { origin }) {
      const diagram = diagramAt(doc, a.diagramId);
      if ("ok" in diagram) return diagram;
      const base = { id: a.id, name: a.name, ...text(origin) };
      doc.elements[a.id] =
        commandName === "addDataStore"
          ? { kind: "dataStore", ...base, ordinal: nextStoreOrdinal(doc) }
          : { kind: "externalEntity", ...base };
      addOccurrence(doc, a.occurrenceId, a.diagramId, a.id, a);
      return { ok: true, doc };
    },
  };
}

const addExternalEntity = nodeCommand("addExternalEntity", "Add an external entity and show it on a diagram.");
const addDataStore = nodeCommand("addDataStore", "Add a data store, numbered D1, D2 and so on, and show it on a diagram.");

const AddProcessArgs = z.strictObject({
  ...NodeArgs.shape,
  ordinal: z.int().min(1).optional().meta({ description: "The last part of the process number; defaults to the next free whole number among its siblings." }),
});
type AddProcessArgs = z.infer<typeof AddProcessArgs>;

const addProcess: CommandDefinition<AddProcessArgs> = {
  name: "addProcess",
  kind: "command",
  sentence: "Add a process to a data flow diagram and show it there.",
  args: AddProcessArgs,
  newIds: (a) => [a.id, a.occurrenceId],
  run(doc, a, { origin }) {
    const diagram = diagramAt(doc, a.diagramId);
    if ("ok" in diagram) return diagram;
    if (diagram.diagramKind === "context" || diagram.decomposesProcessId === null) {
      return refuse("The context diagram shows only process 0, so a process cannot be added to it.");
    }
    const parent = diagram.decomposesProcessId;
    if (a.ordinal !== undefined && siblings(doc, parent).some((p) => p.kind === "process" && p.ordinal === a.ordinal)) {
      return refuse(`Another process under ${calledId(doc, parent)} already has the number ${a.ordinal}.`);
    }
    doc.elements[a.id] = {
      kind: "process", id: a.id, name: a.name, ...text(origin),
      parentProcessId: parent, ordinal: a.ordinal ?? nextFreeOrdinal(doc, parent), processDescription: "",
    };
    addOccurrence(doc, a.occurrenceId, a.diagramId, a.id, a);
    return { ok: true, doc };
  },
};

const PlaceExistingArgs = z.strictObject({
  occurrenceId: Id.meta({ description: "The new occurrence's id." }),
  elementId: Id.meta({ description: "The external entity or data store to show again." }),
  diagramId,
  ...placement,
});
type PlaceExistingArgs = z.infer<typeof PlaceExistingArgs>;

const placeExisting: CommandDefinition<PlaceExistingArgs> = {
  name: "placeExisting",
  kind: "command",
  sentence: "Show an existing external entity or data store on a diagram.",
  args: PlaceExistingArgs,
  newIds: (a) => [a.occurrenceId],
  run(doc, a) {
    const diagram = diagramAt(doc, a.diagramId);
    if ("ok" in diagram) return diagram;
    const element = elementById(doc, a.elementId);
    if (element === undefined) return refuse(`There is no element with the id "${a.elementId}".`);
    if (element.kind !== "externalEntity" && element.kind !== "dataStore") {
      return refuse(`Only an external entity or a data store can be shown on more than one place; ${calledId(doc, a.elementId)} cannot.`);
    }
    addOccurrence(doc, a.occurrenceId, a.diagramId, a.elementId, a);
    return { ok: true, doc };
  },
};

const SetProcessNumberArgs = z.strictObject({
  processId: Id.meta({ description: "The process to renumber." }),
  ordinal: z.int().min(1).meta({ description: "The new last part of the process number; 1 or more." }),
});
type SetProcessNumberArgs = z.infer<typeof SetProcessNumberArgs>;

const setProcessNumber: CommandDefinition<SetProcessNumberArgs> = {
  name: "setProcessNumber",
  kind: "command",
  sentence: "Change the last part of a process's number.",
  args: SetProcessNumberArgs,
  newIds: () => [],
  run(doc, a) {
    const process = elementById(doc, a.processId);
    if (process?.kind !== "process") return refuse(`There is no process with the id "${a.processId}".`);
    if (process.parentProcessId === null) return refuse("Process 0 always keeps the number 0.");
    if (siblings(doc, process.parentProcessId, process.id).some((p) => p.kind === "process" && p.ordinal === a.ordinal)) {
      return refuse(`Another process under ${calledId(doc, process.parentProcessId)} already has the number ${a.ordinal}.`);
    }
    process.ordinal = a.ordinal;
    return { ok: true, doc };
  },
};

// ---- Flows ----

const AddControlFlowArgs = z.strictObject({
  id: Id.meta({ description: "The new control flow's id." }),
  routeId: Id.meta({ description: "The new route's id." }),
  diagramId,
  targetId: Id.meta({ description: "The process the event starts; it must be shown on the diagram." }),
  targetOccurrenceId: Id.optional().meta({ description: "The occurrence of the process the line ends at; needed only when it has more than one." }),
  name: name("event"),
});
type AddControlFlowArgs = z.infer<typeof AddControlFlowArgs>;

const addControlFlow: CommandDefinition<AddControlFlowArgs> = {
  name: "addControlFlow",
  kind: "command",
  sentence: "Add a control flow, named for its event, into a process shown on a diagram.",
  args: AddControlFlowArgs,
  newIds: (a) => [a.id, a.routeId],
  run(doc, a, { origin }) {
    const diagram = diagramAt(doc, a.diagramId);
    if ("ok" in diagram) return diagram;
    if (elementById(doc, a.targetId)?.kind !== "process") {
      return refuse(`A control flow must start a process, and ${calledId(doc, a.targetId)} is not one.`);
    }
    if (!isShownOn(doc, a.targetId, a.diagramId)) {
      return refuse(`${cap(calledId(doc, a.targetId))} is not shown on ${calledId(doc, a.diagramId)}, so a control flow cannot start it there.`);
    }
    const target = pickOccurrence(doc, a.diagramId, a.targetId, false, a.targetOccurrenceId);
    if (!target.ok) return target;
    doc.elements[a.id] = { kind: "controlFlow", id: a.id, name: a.name, ...text(origin), diagramId: a.diagramId, targetId: a.targetId };
    doc.views.routes[a.routeId] = {
      id: a.routeId, flowId: a.id, diagramId: a.diagramId,
      sourceOccurrenceId: null, targetOccurrenceId: target.id, points: [],
    };
    return { ok: true, doc };
  },
};

function dataCheck(doc: ProjectDocument, dataId: Id): Refusal | null {
  const kind = elementById(doc, dataId)?.kind;
  if (kind === "dataStructure" || kind === "dataElement") return null;
  return refuse(
    kind === undefined
      ? `There is no data structure or data element with the id "${dataId}".`
      : `A flow can only carry a data structure or data element, not ${calledId(doc, dataId)}.`,
  );
}

const AddFlowArgs = z.strictObject({
  id: Id.meta({ description: "The new data flow's id." }),
  routeId: Id.meta({ description: "The new route's id." }),
  diagramId,
  sourceId: Id.meta({ description: "The element the flow starts from; shown on the diagram, or an off-diagram process." }),
  targetId: Id.meta({ description: "The element the flow ends at; shown on the diagram, or an off-diagram process." }),
  sourceOccurrenceId: Id.optional().meta({ description: "The occurrence the flow starts at; needed only when the source is shown more than once." }),
  targetOccurrenceId: Id.optional().meta({ description: "The occurrence the flow ends at; needed only when the target is shown more than once." }),
  dataId: Id.meta({ description: "The data structure or data element the flow carries; with newDataName, the id of the new data structure." }),
  newDataName: z.string().optional().meta({ description: "When given, a new data structure with this name and no components is made with the id dataId." }),
});
type AddFlowArgs = z.infer<typeof AddFlowArgs>;

const addFlow: CommandDefinition<AddFlowArgs> = {
  name: "addFlow",
  kind: "command",
  sentence: "Add a data flow between two elements on a diagram, carrying existing data or a new data structure.",
  args: AddFlowArgs,
  newIds: (a) => [a.id, a.routeId, ...(a.newDataName === undefined ? [] : [a.dataId])],
  run(doc, a, { origin }) {
    const diagram = diagramAt(doc, a.diagramId);
    if ("ok" in diagram) return diagram;
    const source = checkEnd(doc, diagram, a.sourceId);
    if ("ok" in source) return source;
    const target = checkEnd(doc, diagram, a.targetId);
    if ("ok" in target) return target;
    if (source.offDiagram && target.offDiagram) return refuse(BOTH_OFF);
    if (a.newDataName === undefined) {
      const bad = dataCheck(doc, a.dataId);
      if (bad !== null) return bad;
    }
    const sourceOcc = pickOccurrence(doc, a.diagramId, a.sourceId, source.offDiagram, a.sourceOccurrenceId);
    if (!sourceOcc.ok) return sourceOcc;
    const targetOcc = pickOccurrence(doc, a.diagramId, a.targetId, target.offDiagram, a.targetOccurrenceId);
    if (!targetOcc.ok) return targetOcc;
    if (a.newDataName !== undefined) {
      doc.elements[a.dataId] = { kind: "dataStructure", id: a.dataId, name: a.newDataName, ...text(origin), components: [] };
    }
    doc.elements[a.id] = {
      kind: "dataFlow", id: a.id, name: "", ...text(origin),
      diagramId: a.diagramId, sourceId: a.sourceId, targetId: a.targetId, dataId: a.dataId,
    };
    doc.views.routes[a.routeId] = {
      id: a.routeId, flowId: a.id, diagramId: a.diagramId,
      sourceOccurrenceId: sourceOcc.id, targetOccurrenceId: targetOcc.id, points: [],
    };
    return { ok: true, doc };
  },
};

const SetFlowDataArgs = z.strictObject({
  flowId: Id.meta({ description: "The data flow to change." }),
  dataId: Id.meta({ description: "The data structure or data element the flow now carries." }),
});
type SetFlowDataArgs = z.infer<typeof SetFlowDataArgs>;

const setFlowData: CommandDefinition<SetFlowDataArgs> = {
  name: "setFlowData",
  kind: "command",
  sentence: "Change which data structure or data element a data flow carries.",
  args: SetFlowDataArgs,
  newIds: () => [],
  run(doc, a) {
    const flow = elementById(doc, a.flowId);
    if (flow?.kind !== "dataFlow") return refuse(`There is no data flow with the id "${a.flowId}".`);
    const bad = dataCheck(doc, a.dataId);
    if (bad !== null) return bad;
    flow.dataId = a.dataId;
    return { ok: true, doc };
  },
};

const ReconnectFlowArgs = z.strictObject({
  flowId: Id.meta({ description: "The data flow to reattach." }),
  end: z.enum(["source", "target"]).meta({ description: "Which end of the flow to attach or change." }),
  elementId: Id.meta({ description: "The element the end now attaches to; shown on the flow's diagram, or an off-diagram process." }),
  occurrenceId: Id.optional().meta({ description: "The occurrence the end attaches to; needed only when the element is shown more than once." }),
});
type ReconnectFlowArgs = z.infer<typeof ReconnectFlowArgs>;

const reconnectFlow: CommandDefinition<ReconnectFlowArgs> = {
  name: "reconnectFlow",
  kind: "command",
  sentence: "Attach or change one end of a data flow.",
  args: ReconnectFlowArgs,
  newIds: () => [],
  run(doc, a) {
    const flow = elementById(doc, a.flowId);
    if (flow?.kind !== "dataFlow") return refuse(`There is no data flow with the id "${a.flowId}".`);
    const diagram = diagramAt(doc, flow.diagramId);
    if ("ok" in diagram) return diagram;
    const route = Object.values(doc.views.routes).find((r) => r.flowId === flow.id);
    if (route === undefined) return refuse("This data flow has no line on its diagram to reattach.");
    const end = checkEnd(doc, diagram, a.elementId);
    if ("ok" in end) return end;
    const otherId = a.end === "source" ? flow.targetId : flow.sourceId;
    if (end.offDiagram && otherId !== null && !isShownOn(doc, otherId, flow.diagramId)) return refuse(BOTH_OFF);
    const occurrence = pickOccurrence(doc, flow.diagramId, a.elementId, end.offDiagram, a.occurrenceId);
    if (!occurrence.ok) return occurrence;
    if (a.end === "source") {
      flow.sourceId = a.elementId;
      route.sourceOccurrenceId = occurrence.id;
    } else {
      flow.targetId = a.elementId;
      route.targetOccurrenceId = occurrence.id;
    }
    return { ok: true, doc };
  },
};

export const dfdCommands: AnyCommandDefinition[] = [
  addExternalEntity, addDataStore, addProcess, placeExisting, addControlFlow,
  setProcessNumber, addFlow, setFlowData, reconnectFlow,
];

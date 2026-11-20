import { ancestors, diagramShowing, isShownOn } from "./derive.ts";
import type { Element, ProjectDocument } from "./document.ts";
import type { Id } from "./id.ts";
import type { ControlFlow, DataFlow, Process } from "./kinds/dfd.ts";
import type { Diagram } from "./kinds/diagram.ts";

// The invariants of SPEC.md section 3.4, with the map-key and view checks of
// sections 3.5 and 3.6. A command whose result has any violation is refused. Each
// check tolerates a document that breaks the others, so all of them can run together.

export interface Violation {
  message: string;
  ids: Id[];
}

type Kind = Element["kind"];
const NODE_KINDS: readonly Kind[] = ["process", "dataStore", "externalEntity"];
const ALL_KINDS: readonly Kind[] = [...NODE_KINDS, "dataFlow", "controlFlow", "dataStructure", "dataElement", "diagram"];
const DATA_KINDS: readonly Kind[] = ["dataStructure", "dataElement"];

function all(doc: ProjectDocument): Element[] {
  return Object.values(doc.elements);
}
function processes(doc: ProjectDocument): Process[] {
  return all(doc).filter((e): e is Process => e.kind === "process");
}
function diagrams(doc: ProjectDocument): Diagram[] {
  return all(doc).filter((e): e is Diagram => e.kind === "diagram");
}
function dataFlows(doc: ProjectDocument): DataFlow[] {
  return all(doc).filter((e): e is DataFlow => e.kind === "dataFlow");
}
function controlFlows(doc: ProjectDocument): ControlFlow[] {
  return all(doc).filter((e): e is ControlFlow => e.kind === "controlFlow");
}
function kindOf(doc: ProjectDocument, id: Id): Kind | undefined {
  return doc.elements[id]?.kind;
}
function isNode(doc: ProjectDocument, id: Id): boolean {
  const kind = kindOf(doc, id);
  return kind !== undefined && NODE_KINDS.includes(kind);
}
function isEmpty(doc: ProjectDocument): boolean {
  return (
    Object.keys(doc.elements).length === 0 &&
    Object.keys(doc.views.occurrences).length === 0 &&
    Object.keys(doc.views.routes).length === 0
  );
}

/** Every map key equals its record's id, and no id is used in two of the three maps. */
export function checkMapKeys(doc: ProjectDocument): Violation[] {
  const out: Violation[] = [];
  const maps: [string, Record<string, { id: Id }>][] = [
    ["element", doc.elements],
    ["occurrence", doc.views.occurrences],
    ["route", doc.views.routes],
  ];
  const owner = new Map<Id, string>();
  for (const [label, map] of maps) {
    for (const [key, record] of Object.entries(map)) {
      if (key !== record.id) {
        out.push({ message: `The ${label} stored under "${key}" has the id "${record.id}".`, ids: [key, record.id] });
      }
      const first = owner.get(key);
      if (first !== undefined) {
        out.push({ message: `The id "${key}" is used by both an ${first} and a ${label}.`, ids: [key] });
      } else {
        owner.set(key, label);
      }
    }
  }
  return out;
}

/** Apart from the empty document before createProject, the top diagram is a diagram. */
export function checkTopDiagram(doc: ProjectDocument): Violation[] {
  if (isEmpty(doc)) return [];
  const top = doc.settings.topDiagramId;
  if (top !== null && kindOf(doc, top) === "diagram") return [];
  return [{ message: "The project's top diagram is not a diagram in the project.", ids: top === null ? [] : [top] }];
}

/** Invariant 1: every reference points to an existing element of the right kind. */
export function checkReferences(doc: ProjectDocument): Violation[] {
  const out: Violation[] = [];
  const expect = (from: Element, field: string, id: Id, kinds: readonly Kind[], what: string): void => {
    const kind = kindOf(doc, id);
    if (kind === undefined) {
      out.push({ message: `The element "${from.id}" refers in ${field} to "${id}", which does not exist.`, ids: [from.id, id] });
    } else if (!kinds.includes(kind)) {
      out.push({ message: `The element "${from.id}" refers in ${field} to "${id}", which is not ${what}.`, ids: [from.id, id] });
    }
  };
  for (const e of all(doc)) {
    switch (e.kind) {
      case "dataFlow":
        expect(e, "diagramId", e.diagramId, ["diagram"], "a diagram");
        expect(e, "dataId", e.dataId, DATA_KINDS, "a data structure or data element");
        // The kind of each end is invariant 3's to check; this one checks the end exists.
        if (e.sourceId !== null) expect(e, "sourceId", e.sourceId, ALL_KINDS, "an element");
        if (e.targetId !== null) expect(e, "targetId", e.targetId, ALL_KINDS, "an element");
        if (e.sourceId === null && e.targetId === null) {
          out.push({ message: `The data flow "${e.id}" has neither a source nor a target.`, ids: [e.id] });
        }
        break;
      case "controlFlow":
        expect(e, "diagramId", e.diagramId, ["diagram"], "a diagram");
        expect(e, "targetId", e.targetId, ["process"], "a process");
        break;
      case "process":
        if (e.parentProcessId !== null) expect(e, "parentProcessId", e.parentProcessId, ["process"], "a process");
        break;
      case "diagram":
        if (e.decomposesProcessId !== null) {
          expect(e, "decomposesProcessId", e.decomposesProcessId, ["process"], "a process");
        }
        break;
      case "dataStructure":
        for (const c of e.components) expect(e, "a component", c.dataId, DATA_KINDS, "a data structure or data element");
        break;
      default:
        break;
    }
  }
  return out;
}

function isOffDiagramEnd(doc: ProjectDocument, flow: DataFlow, endId: Id): boolean {
  const diagram = doc.elements[flow.diagramId];
  if (diagram?.kind !== "diagram" || diagram.decomposesProcessId === null) return false;
  if (kindOf(doc, endId) !== "process") return false;
  const p = diagram.decomposesProcessId;
  return endId !== p && !ancestors(doc, p).includes(endId) && !ancestors(doc, endId).includes(p);
}

/**
 * Invariant 2: a data flow's ends are shown on its diagram, except one off-diagram end:
 * on the diagram that decomposes P, a process that is not P, above P or below P.
 */
export function checkFlowEndsShown(doc: ProjectDocument): Violation[] {
  const out: Violation[] = [];
  for (const flow of dataFlows(doc)) {
    if (kindOf(doc, flow.diagramId) !== "diagram") continue; // invariant 1 reports it
    let offDiagram = 0;
    for (const end of [flow.sourceId, flow.targetId]) {
      if (end === null || !isNode(doc, end) || isShownOn(doc, end, flow.diagramId)) continue;
      if (isOffDiagramEnd(doc, flow, end)) {
        offDiagram += 1;
      } else {
        out.push({ message: `The data flow "${flow.id}" connects to "${end}", which is not shown on its diagram.`, ids: [flow.id, end] });
      }
    }
    if (offDiagram === 2) {
      out.push({ message: `The data flow "${flow.id}" has both ends off its diagram; only one may be.`, ids: [flow.id] });
    }
  }
  return out;
}

/** Invariant 3: flow ends are nodes, and a control flow's target process is on its diagram. */
export function checkFlowEndKinds(doc: ProjectDocument): Violation[] {
  const out: Violation[] = [];
  for (const flow of dataFlows(doc)) {
    for (const end of [flow.sourceId, flow.targetId]) {
      if (end !== null && kindOf(doc, end) !== undefined && !isNode(doc, end)) {
        out.push({ message: `The data flow "${flow.id}" connects to "${end}", which is not a process, data store or external entity.`, ids: [flow.id, end] });
      }
    }
  }
  for (const flow of controlFlows(doc)) {
    if (kindOf(doc, flow.targetId) === "process" && !isShownOn(doc, flow.targetId, flow.diagramId)) {
      out.push({ message: `The control flow "${flow.id}" starts "${flow.targetId}", which is not shown on its diagram.`, ids: [flow.id, flow.targetId] });
    }
  }
  return out;
}

/** Invariant 4: a process is decomposed by at most one diagram; only DFDs decompose. */
export function checkDecomposition(doc: ProjectDocument): Violation[] {
  const out: Violation[] = [];
  const byProcess = new Map<Id, Id[]>();
  for (const d of diagrams(doc)) {
    if (d.diagramKind === "context" && d.decomposesProcessId !== null) {
      out.push({ message: `The context diagram "${d.id}" cannot decompose a process.`, ids: [d.id] });
    }
    if (d.diagramKind === "dfd" && d.decomposesProcessId === null) {
      out.push({ message: `The data flow diagram "${d.id}" does not say which process it decomposes.`, ids: [d.id] });
    }
    if (d.decomposesProcessId !== null) {
      byProcess.set(d.decomposesProcessId, [...(byProcess.get(d.decomposesProcessId) ?? []), d.id]);
    }
  }
  for (const [processId, ids] of byProcess) {
    if (ids.length > 1) {
      out.push({ message: `The process "${processId}" is decomposed by more than one diagram.`, ids: [processId, ...ids] });
    }
  }
  return out;
}

/** Invariant 5: the processes form one tree rooted at process 0, which has ordinal 0. */
export function checkProcessTree(doc: ProjectDocument): Violation[] {
  const out: Violation[] = [];
  const all = processes(doc);
  const roots = all.filter((p) => p.parentProcessId === null);
  if (all.length > 0 && roots.length !== 1) {
    out.push({ message: `There must be exactly one top process (process 0), but there are ${roots.length}.`, ids: roots.map((p) => p.id) });
  }
  for (const p of all) {
    if (p.parentProcessId === null && p.ordinal !== 0) {
      out.push({ message: `The top process "${p.id}" must have ordinal 0.`, ids: [p.id] });
    }
    if (p.parentProcessId !== null && p.ordinal < 1) {
      out.push({ message: `The process "${p.id}" needs an ordinal of 1 or more.`, ids: [p.id] });
    }
    // Walk up; a walk that meets a process it has already seen is a cycle.
    const seen = new Set<Id>();
    let current: Process | undefined = p;
    while (current !== undefined && current.parentProcessId !== null) {
      if (seen.has(current.id)) {
        out.push({ message: `The process "${p.id}" has a loop among its parent processes.`, ids: [p.id] });
        break;
      }
      seen.add(current.id);
      const parent: Element | undefined = doc.elements[current.parentProcessId];
      current = parent?.kind === "process" ? parent : undefined;
    }
  }
  return out;
}

/** Invariant 6: each process has exactly one occurrence, on the diagram that shows it. */
export function checkProcessOccurrences(doc: ProjectDocument): Violation[] {
  const out: Violation[] = [];
  const occurrences = Object.values(doc.views.occurrences);
  for (const p of processes(doc)) {
    const mine = occurrences.filter((o) => o.elementId === p.id);
    const expected = diagramShowing(doc, p.id);
    if (mine.length !== 1 || mine[0]?.diagramId !== expected) {
      out.push({
        message: `The process "${p.id}" must be shown exactly once, on the diagram that decomposes its parent.`,
        ids: [p.id, ...mine.map((o) => o.id)],
      });
    }
  }
  return out;
}

/** Invariant 7: there is exactly one context diagram. */
export function checkOneContextDiagram(doc: ProjectDocument): Violation[] {
  if (isEmpty(doc)) return [];
  const contexts = diagrams(doc).filter((d) => d.diagramKind === "context");
  if (contexts.length === 1) return [];
  return [{ message: `A project has exactly one context diagram, but this one has ${contexts.length}.`, ids: contexts.map((d) => d.id) }];
}

/** Invariant 8: sibling processes have different ordinals, and so do all data stores. */
export function checkOrdinals(doc: ProjectDocument): Violation[] {
  const out: Violation[] = [];
  const groups = new Map<string, Id[]>();
  const add = (key: string, id: Id): void => {
    groups.set(key, [...(groups.get(key) ?? []), id]);
  };
  for (const e of all(doc)) {
    if (e.kind === "process") add(`process ${e.parentProcessId ?? ""} ${e.ordinal}`, e.id);
    if (e.kind === "dataStore") add(`store ${e.ordinal}`, e.id);
  }
  for (const [key, ids] of groups) {
    if (ids.length > 1) {
      const what = key.startsWith("store") ? "data stores" : "processes with the same parent";
      out.push({ message: `Two or more ${what} share the same number.`, ids });
    }
  }
  return out;
}

/** SPEC.md section 3.5: occurrences and routes agree with the elements they show. */
export function checkViews(doc: ProjectDocument): Violation[] {
  const out: Violation[] = [];
  for (const o of Object.values(doc.views.occurrences)) {
    if (kindOf(doc, o.diagramId) !== "diagram") {
      out.push({ message: `The occurrence "${o.id}" is on "${o.diagramId}", which is not a diagram.`, ids: [o.id, o.diagramId] });
    }
    if (!isNode(doc, o.elementId)) {
      out.push({ message: `The occurrence "${o.id}" shows "${o.elementId}", which is not a process, data store or external entity.`, ids: [o.id, o.elementId] });
    }
  }
  const routeCount = new Map<Id, Id[]>();
  for (const r of Object.values(doc.views.routes)) {
    const flow = doc.elements[r.flowId];
    if (flow?.kind !== "dataFlow" && flow?.kind !== "controlFlow") {
      out.push({ message: `The route "${r.id}" draws "${r.flowId}", which is not a flow.`, ids: [r.id, r.flowId] });
      continue;
    }
    routeCount.set(flow.id, [...(routeCount.get(flow.id) ?? []), r.id]);
    if (r.diagramId !== flow.diagramId) {
      out.push({ message: `The route "${r.id}" is on a different diagram from its flow "${flow.id}".`, ids: [r.id, flow.id] });
    }
    const source = flow.kind === "dataFlow" ? flow.sourceId : null;
    const ends: [string, Id | null, Id | null][] = [
      ["source", source, r.sourceOccurrenceId],
      ["target", flow.targetId, r.targetOccurrenceId],
    ];
    for (const [label, end, occurrenceId] of ends) {
      const wantsOccurrence = end !== null && isShownOn(doc, end, r.diagramId);
      if (!wantsOccurrence) {
        if (occurrenceId !== null) {
          out.push({ message: `The route "${r.id}" attaches its ${label} end to an occurrence, but that end has none on this diagram.`, ids: [r.id, occurrenceId] });
        }
        continue;
      }
      const occurrence = occurrenceId === null ? undefined : doc.views.occurrences[occurrenceId];
      if (occurrence === undefined || occurrence.diagramId !== r.diagramId || occurrence.elementId !== end) {
        out.push({ message: `The route "${r.id}" does not attach its ${label} end to an occurrence of "${end}" on its diagram.`, ids: occurrenceId === null ? [r.id] : [r.id, occurrenceId] });
      }
    }
  }
  for (const flow of [...dataFlows(doc), ...controlFlows(doc)]) {
    const ids = routeCount.get(flow.id) ?? [];
    if (ids.length !== 1) {
      out.push({ message: `The flow "${flow.id}" must have exactly one route, but it has ${ids.length}.`, ids: [flow.id, ...ids] });
    }
  }
  return out;
}

export function findViolations(doc: ProjectDocument): Violation[] {
  return [
    ...checkMapKeys(doc),
    ...checkTopDiagram(doc),
    ...checkReferences(doc),
    ...checkFlowEndsShown(doc),
    ...checkFlowEndKinds(doc),
    ...checkDecomposition(doc),
    ...checkProcessTree(doc),
    ...checkProcessOccurrences(doc),
    ...checkOneContextDiagram(doc),
    ...checkOrdinals(doc),
    ...checkViews(doc),
  ];
}

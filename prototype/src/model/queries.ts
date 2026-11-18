import { chartOfModule, moduleNumber, requirementNumber } from './queries2';
import type {
  AlternativeMatrix,
  BinderSection,
  ControlFlow,
  Couple,
  Feasibility,
  Interface,
  InterfaceDiagram,
  Module,
  NavigationLink,
  Requirement,
  StructureChart,
  SystemRequest,
  Test,
  DataDefinition,
  DataElement,
  DataFlow,
  DataStore,
  DataStructure,
  Diagram,
  Element,
  ElementKind,
  Entity,
  ExternalEntity,
  Id,
  Model,
  NodeElement,
  NodeOccurrence,
  Process,
  Relationship,
  UseCase,
} from './types';

type KindMap = {
  process: Process;
  externalEntity: ExternalEntity;
  dataStore: DataStore;
  dataFlow: DataFlow;
  controlFlow: ControlFlow;
  dataStructure: DataStructure;
  dataElement: DataElement;
  diagram: Diagram;
  useCase: UseCase;
  entity: Entity;
  relationship: Relationship;
  systemRequest: SystemRequest;
  feasibility: Feasibility;
  requirement: Requirement;
  alternativeMatrix: AlternativeMatrix;
  test: Test;
  interfaceDiagram: InterfaceDiagram;
  interface: Interface;
  navigationLink: NavigationLink;
  binderSection: BinderSection;
  structureChart: StructureChart;
  module: Module;
  couple: Couple;
};

/** Every element of one kind, in creation order. */
export function all<K extends ElementKind>(model: Model, kind: K): KindMap[K][] {
  return Object.values(model.elements).filter((e) => e.kind === kind) as KindMap[K][];
}

/** One element of a known kind, or undefined if it is missing or of another kind. */
export function get<K extends ElementKind>(model: Model, id: Id | null | undefined, kind: K): KindMap[K] | undefined {
  if (!id) return undefined;
  const e = model.elements[id];
  return e && e.kind === kind ? (e as KindMap[K]) : undefined;
}

export function isNode(e: Element | undefined): e is NodeElement {
  return !!e && (e.kind === 'process' || e.kind === 'externalEntity' || e.kind === 'dataStore');
}

export function isData(e: Element | undefined): e is DataDefinition {
  return !!e && (e.kind === 'dataStructure' || e.kind === 'dataElement');
}

export function dataDefinitions(model: Model): DataDefinition[] {
  return Object.values(model.elements).filter(isData);
}

/** The words used for a kind in messages and lists. */
export const KIND_WORDS: Record<ElementKind, string> = {
  process: 'process',
  externalEntity: 'external entity',
  dataStore: 'data store',
  dataFlow: 'data flow',
  controlFlow: 'control flow',
  dataStructure: 'data structure',
  dataElement: 'data element',
  diagram: 'diagram',
  useCase: 'use case',
  entity: 'entity',
  relationship: 'relationship',
  systemRequest: 'system request',
  feasibility: 'feasibility analysis',
  requirement: 'requirement',
  alternativeMatrix: 'alternative matrix',
  test: 'test',
  interfaceDiagram: 'interface structure diagram',
  interface: 'interface',
  navigationLink: 'navigation link',
  binderSection: 'binder section',
  structureChart: 'structure chart',
  module: 'module',
  couple: 'couple',
};

const KIND_ORDER: Record<string, number> = { externalEntity: 0, process: 1, dataStore: 2 };

// ---- Diagrams and processes ----

export function contextDiagram(model: Model): Diagram | undefined {
  return all(model, 'diagram').find((d) => d.diagramKind === 'context');
}

export function rootProcess(model: Model): Process | undefined {
  return all(model, 'process').find((p) => p.parentProcessId === null);
}

/** The diagram that decomposes a process, if it has one. */
export function childDiagram(model: Model, processId: Id): Diagram | undefined {
  return all(model, 'diagram').find((d) => d.decomposesProcessId === processId);
}

/** The diagram a process is shown on. */
export function diagramOfProcess(model: Model, processId: Id): Diagram | undefined {
  const p = get(model, processId, 'process');
  if (!p) return undefined;
  return p.parentProcessId === null ? contextDiagram(model) : childDiagram(model, p.parentProcessId);
}

/** The diagram one level up, or undefined for the context diagram. */
export function parentDiagram(model: Model, diagramId: Id): Diagram | undefined {
  const d = get(model, diagramId, 'diagram');
  if (!d || !d.decomposesProcessId) return undefined;
  return diagramOfProcess(model, d.decomposesProcessId);
}

/** The processes drawn on a diagram, in number order. */
export function processesOn(model: Model, diagramId: Id): Process[] {
  const d = get(model, diagramId, 'diagram');
  if (!d) return [];
  return all(model, 'process')
    .filter((p) => p.parentProcessId === d.decomposesProcessId)
    .sort((a, b) => a.ordinal - b.ordinal);
}

/** "0", "1", "1.2". */
export function processNumber(model: Model, processId: Id): string {
  const p = get(model, processId, 'process');
  if (!p) return '?';
  if (p.parentProcessId === null) return String(p.ordinal);
  const parent = get(model, p.parentProcessId, 'process');
  if (!parent || parent.parentProcessId === null) return String(p.ordinal);
  return `${processNumber(model, parent.id)}.${p.ordinal}`;
}

/** True if `ancestorId` is above `processId` in the hierarchy. */
export function isAncestor(model: Model, ancestorId: Id, processId: Id): boolean {
  let p = get(model, processId, 'process');
  const seen = new Set<Id>();
  while (p && p.parentProcessId && !seen.has(p.id)) {
    seen.add(p.id);
    if (p.parentProcessId === ancestorId) return true;
    p = get(model, p.parentProcessId, 'process');
  }
  return false;
}

/** "D1", "D2", from creation order. */
export function storeLabel(model: Model, storeId: Id): string {
  const i = all(model, 'dataStore').findIndex((s) => s.id === storeId);
  return i < 0 ? 'D?' : `D${i + 1}`;
}

/** "Context diagram", "Level 0", or "1 Schedule Appointment". */
export function diagramTitle(model: Model, diagramId: Id): string {
  const d = get(model, diagramId, 'diagram');
  if (!d) return 'Unknown diagram';
  if (d.diagramKind === 'context') return 'Context diagram';
  const p = get(model, d.decomposesProcessId, 'process');
  if (!p) return d.name || 'Diagram';
  if (p.parentProcessId === null) return 'Level 0';
  return `${processNumber(model, p.id)} ${p.name}`.trim();
}

/** The short tag of a node: "1.2" for a process, "D1" for a data store, "" otherwise. */
export function nodeTag(model: Model, id: Id): string {
  const e = model.elements[id];
  if (!e) return '';
  if (e.kind === 'process') return processNumber(model, id);
  if (e.kind === 'dataStore') return storeLabel(model, id);
  return '';
}

/** A name to show for any element: "1.2 Book Slot", "D1 Appointments", "UC-1 ...", a flow's data name. */
export function elementLabel(model: Model, id: Id | null | undefined): string {
  if (!id) return 'Not attached';
  const e = model.elements[id];
  if (!e) return 'Unknown';
  switch (e.kind) {
    case 'process':
    case 'dataStore':
      return `${nodeTag(model, id)} ${e.name}`.trim();
    case 'dataFlow':
      return model.elements[e.dataId]?.name ?? '';
    case 'diagram':
      return diagramTitle(model, id);
    case 'useCase':
      return `UC-${e.ordinal} ${e.name}`.trim();
    case 'relationship':
      return e.ends.map((end) => model.elements[end.entityId]?.name ?? '?').join(' – ');
    case 'systemRequest':
      return 'System request';
    case 'feasibility':
      return 'Feasibility analysis';
    case 'requirement':
      return `${requirementNumber(model, id)} ${e.name}`.trim();
    case 'test':
      return `T-${e.ordinal} ${e.name}`.trim();
    case 'interface':
      return `${e.number} ${e.name}`.trim();
    case 'navigationLink':
      return [e.aId, e.bId].map((end) => model.elements[end]?.name ?? '?').join(' – ');
    case 'module':
      return `${moduleNumber(model, id)} ${(e.repeatsId ? model.elements[e.repeatsId]?.name : e.name) ?? ''}`.trim();
    case 'couple':
      return e.coupleKind === 'data' ? (model.elements[e.dataId ?? '']?.name ?? '') : e.name;
    default:
      return e.name;
  }
}

export interface DiagramRow {
  diagram: Diagram;
  title: string;
  /** 0 for the context diagram, 1 for Level 0, and so on. */
  depth: number;
}

/** Every diagram as a tree in reading order: context, Level 0, then each child under its parent. */
export function diagramsInOrder(model: Model): DiagramRow[] {
  const rows: DiagramRow[] = [];
  const visit = (d: Diagram, depth: number) => {
    rows.push({ diagram: d, title: diagramTitle(model, d.id), depth });
    for (const p of processesOn(model, d.id)) {
      const child = childDiagram(model, p.id);
      if (child) visit(child, depth + 1);
    }
  };
  const ctx = contextDiagram(model);
  if (ctx) visit(ctx, 0);
  return rows;
}

/** The diagrams from the context diagram down to this one, for a breadcrumb. */
export function diagramPath(model: Model, diagramId: Id): Diagram[] {
  const path: Diagram[] = [];
  let d = get(model, diagramId, 'diagram');
  while (d && path.length < 50) {
    path.unshift(d);
    d = parentDiagram(model, d.id);
  }
  return path;
}

/** Processes with no child diagram, in diagram order. These are the columns of the CRUD matrix. */
export function leafProcesses(model: Model): Process[] {
  const out: Process[] = [];
  for (const row of diagramsInOrder(model)) {
    for (const p of processesOn(model, row.diagram.id)) {
      if (!childDiagram(model, p.id)) out.push(p);
    }
  }
  return out;
}

// ---- The top of the project (SPEC 3.7) ----

/** The highest diagram the project is expected to contain: the setting, or the context diagram. */
export function topDiagram(model: Model): Diagram | undefined {
  return get(model, model.settings.topDiagramId, 'diagram') ?? contextDiagram(model);
}

/** True for a diagram that lies above the top diagram. Nothing is reported there. */
export function isAboveProject(model: Model, diagramId: Id): boolean {
  const top = topDiagram(model);
  if (!top || top.id === diagramId) return false;
  return diagramPath(model, top.id).some((d) => d.id === diagramId);
}

// ---- Occurrences and flows ----

export function occurrencesOn(model: Model, diagramId: Id): NodeOccurrence[] {
  return Object.values(model.views.occurrences).filter((o) => o.diagramId === diagramId);
}

export function occurrencesOf(model: Model, elementId: Id): NodeOccurrence[] {
  return Object.values(model.views.occurrences).filter((o) => o.elementId === elementId);
}

export function isShownOn(model: Model, elementId: Id, diagramId: Id): boolean {
  return Object.values(model.views.occurrences).some((o) => o.elementId === elementId && o.diagramId === diagramId);
}

export function flowsOn(model: Model, diagramId: Id): DataFlow[] {
  return all(model, 'dataFlow').filter((f) => f.diagramId === diagramId);
}

export function controlFlowsOn(model: Model, diagramId: Id): ControlFlow[] {
  return all(model, 'controlFlow').filter((f) => f.diagramId === diagramId);
}

/** Data flows into and out of a node, on every diagram. */
export function flowsOf(model: Model, nodeId: Id): { into: DataFlow[]; out: DataFlow[] } {
  const flows = all(model, 'dataFlow');
  return {
    into: flows.filter((f) => f.targetId === nodeId),
    out: flows.filter((f) => f.sourceId === nodeId),
  };
}

/** True if this end of a flow is a process that is not drawn on the flow's diagram. */
export function isOffDiagramEnd(model: Model, flow: DataFlow, endId: Id | null): boolean {
  if (!endId) return false;
  return model.elements[endId]?.kind === 'process' && !isShownOn(model, endId, flow.diagramId);
}

export interface EdgeFlows {
  /** The diagram the process is drawn on, and the diagram that expands it. */
  parent: Diagram;
  child: Diagram;
  /** The flows into and out of the process on its own diagram. */
  parentIn: DataFlow[];
  parentOut: DataFlow[];
  /** The flows on the child diagram that cross its edge, inwards and outwards. */
  childIn: DataFlow[];
  childOut: DataFlow[];
}

/**
 * The flows that balancing compares for one process (SPEC 5.5): those touching it on its
 * own diagram, and those crossing the edge of its child diagram. undefined when the
 * process has no child diagram. An unattached end counts as inside.
 */
export function edgeFlows(model: Model, processId: Id): EdgeFlows | undefined {
  const child = childDiagram(model, processId);
  const parent = diagramOfProcess(model, processId);
  if (!child || !parent) return undefined;
  const below = (diagramId: Id) => {
    const d = get(model, diagramId, 'diagram');
    return !!d?.decomposesProcessId && (d.decomposesProcessId === processId || isAncestor(model, processId, d.decomposesProcessId));
  };
  const inside = (id: Id | null): boolean => {
    if (id === null) return true;
    const e = model.elements[id];
    if (e?.kind === 'process') return isAncestor(model, processId, id);
    if (e?.kind === 'dataStore') {
      const occs = occurrencesOf(model, id);
      return occs.length > 0 && occs.every((o) => below(o.diagramId));
    }
    return false;
  };
  const touching = flowsOn(model, parent.id).filter((f) => (f.sourceId === processId) !== (f.targetId === processId));
  const crossing = flowsOn(model, child.id).filter((f) => inside(f.sourceId) !== inside(f.targetId));
  return {
    parent,
    child,
    parentIn: touching.filter((f) => f.targetId === processId),
    parentOut: touching.filter((f) => f.sourceId === processId),
    childIn: crossing.filter((f) => inside(f.targetId)),
    childOut: crossing.filter((f) => !inside(f.targetId)),
  };
}

export interface FragmentFlow {
  flow: DataFlow;
  /** Seen from the process. */
  direction: 'in' | 'out';
  dataName: string;
  /** The element at the other end, or null when that end is unattached. */
  other: NodeElement | null;
  otherLabel: string;
}

export interface Fragment {
  process: Process;
  /** The diagram the process is drawn on. */
  diagramId: Id;
  flows: FragmentFlow[];
  controlFlows: ControlFlow[];
  /** The elements at the other ends of the flows, each once: external entities, then processes, then data stores. */
  elements: NodeElement[];
}

/** One process with its flows on its own diagram and the elements at their other ends: the textbook's DFD fragment. */
export function getFragment(model: Model, processId: Id): Fragment | undefined {
  const process = get(model, processId, 'process');
  const diagram = process && diagramOfProcess(model, processId);
  if (!process || !diagram) return undefined;
  const flows: FragmentFlow[] = [];
  const elements: NodeElement[] = [];
  for (const flow of flowsOn(model, diagram.id)) {
    if (flow.sourceId !== processId && flow.targetId !== processId) continue;
    const direction = flow.targetId === processId ? 'in' : 'out';
    const otherId = direction === 'in' ? flow.sourceId : flow.targetId;
    const found = otherId ? model.elements[otherId] : undefined;
    const other = isNode(found) ? found : null;
    if (other && other.id !== processId && !elements.includes(other)) elements.push(other);
    flows.push({ flow, direction, dataName: model.elements[flow.dataId]?.name ?? '', other, otherLabel: elementLabel(model, otherId) });
  }
  elements.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
  return {
    process,
    diagramId: diagram.id,
    flows,
    controlFlows: controlFlowsOn(model, diagram.id).filter((c) => c.targetId === processId),
    elements,
  };
}

// ---- The data dictionary ----

/**
 * The contents of a definition as section 5.5 defines them: the ids of the data elements
 * it comes to in the end. A structure with no components counts as one item (itself).
 * Stops safely when a structure contains itself.
 */
export function contents(model: Model, dataId: Id, seen: Set<Id> = new Set()): Set<Id> {
  const out = new Set<Id>();
  const e = model.elements[dataId];
  if (!e || seen.has(dataId)) return out;
  if (e.kind === 'dataElement') return out.add(dataId);
  if (e.kind !== 'dataStructure') return out;
  if (e.components.length === 0) return out.add(dataId);
  const next = new Set(seen).add(dataId);
  for (const c of e.components) for (const id of contents(model, c.dataId, next)) out.add(id);
  return out;
}

export interface ExpandedElement {
  element: DataElement;
  /** The structure that directly holds the element, or null if the definition is the element. */
  fromId: Id | null;
}

/** The data elements a definition is ultimately made of, in order, each once. */
export function expandData(model: Model, dataId: Id): ExpandedElement[] {
  const out: ExpandedElement[] = [];
  const have = new Set<Id>();
  const visit = (id: Id, fromId: Id | null, seen: Set<Id>) => {
    const e = model.elements[id];
    if (!e || seen.has(id)) return;
    if (e.kind === 'dataElement') {
      if (!have.has(id)) {
        have.add(id);
        out.push({ element: e, fromId });
      }
    } else if (e.kind === 'dataStructure') {
      const next = new Set(seen).add(id);
      for (const c of e.components) visit(c.dataId, id, next);
    }
  };
  visit(dataId, null, new Set());
  return out;
}

export interface WhereUsed {
  /** Flows that carry it (for data), or flows attached to it (for a node). */
  flows: { flow: DataFlow; diagramId: Id; diagramTitle: string; fromLabel: string; toLabel: string }[];
  /** Diagrams it is drawn on (for a node), or that hold a flow carrying it (for data). */
  diagrams: { diagramId: Id; diagramTitle: string }[];
  /** Structures that list it as a component. */
  structures: DataStructure[];
  /** Entities that own it as an attribute, or that a data store holds. */
  entities: Entity[];
  /** Use cases that name it. */
  useCases: UseCase[];
}

/** Every diagram, flow, structure, entity and use case that refers to an element. */
export function whereUsed(model: Model, id: Id): WhereUsed {
  const e = model.elements[id];
  const out: WhereUsed = { flows: [], diagrams: [], structures: [], entities: [], useCases: [] };
  if (!e) return out;
  const order = diagramsInOrder(model).map((r) => r.diagram.id);
  const diagramIds = new Set<Id>();

  const flows = all(model, 'dataFlow').filter((f) =>
    isData(e) ? f.dataId === id : f.sourceId === id || f.targetId === id,
  );
  flows.sort((a, b) => order.indexOf(a.diagramId) - order.indexOf(b.diagramId));
  for (const flow of flows) {
    diagramIds.add(flow.diagramId);
    out.flows.push({
      flow,
      diagramId: flow.diagramId,
      diagramTitle: diagramTitle(model, flow.diagramId),
      fromLabel: elementLabel(model, flow.sourceId),
      toLabel: elementLabel(model, flow.targetId),
    });
  }
  if (isNode(e)) for (const o of occurrencesOf(model, id)) diagramIds.add(o.diagramId);
  out.diagrams = order.filter((d) => diagramIds.has(d)).map((d) => ({ diagramId: d, diagramTitle: diagramTitle(model, d) }));

  out.structures = all(model, 'dataStructure').filter((s) => s.components.some((c) => c.dataId === id));
  out.entities = all(model, 'entity').filter(
    (en) => en.attributes.some((a) => a.dataId === id) || en.storeId === id,
  );
  out.useCases = all(model, 'useCase').filter(
    (u) =>
      u.actorId === id ||
      u.processId === id ||
      u.steps.some((s) => s.information.some((i) => i.dataId === id)) ||
      u.summaryInputs.some((i) => i.dataId === id || i.sourceId === id) ||
      u.summaryOutputs.some((o) => o.dataId === id || o.destinationId === id),
  );
  return out;
}

// ---- The outline ----

export interface OutlineItem {
  occurrenceId: Id | null;
  element: NodeElement;
  label: string;
  flowsIn: number;
  flowsOut: number;
  /** True for a process at the far end of a flow that is not drawn on this diagram. */
  offDiagram: boolean;
}

export interface OutlineFlow {
  flow: DataFlow;
  dataName: string;
  fromLabel: string;
  toLabel: string;
}

export interface DiagramOutline {
  diagramId: Id;
  title: string;
  items: OutlineItem[];
  flows: OutlineFlow[];
  controlFlows: { flow: ControlFlow; toLabel: string }[];
}

/** One diagram as two lists: its items with their flow counts, and its flows. */
export function diagramOutline(model: Model, diagramId: Id): DiagramOutline {
  const flows = flowsOn(model, diagramId);
  const seen = new Set<Id>();
  const items: OutlineItem[] = [];
  for (const o of occurrencesOn(model, diagramId)) {
    const element = model.elements[o.elementId];
    if (!isNode(element) || seen.has(element.id)) continue;
    seen.add(element.id);
    items.push({
      occurrenceId: o.id,
      element,
      label: elementLabel(model, element.id),
      flowsIn: flows.filter((f) => f.targetId === element.id).length,
      flowsOut: flows.filter((f) => f.sourceId === element.id).length,
      offDiagram: false,
    });
  }
  items.sort((a, b) => {
    const k = KIND_ORDER[a.element.kind] - KIND_ORDER[b.element.kind];
    if (k !== 0) return k;
    if (a.element.kind === 'process' && b.element.kind === 'process') return a.element.ordinal - b.element.ordinal;
    return 0;
  });
  return {
    diagramId,
    title: diagramTitle(model, diagramId),
    items,
    flows: flows.map((flow) => ({
      flow,
      dataName: model.elements[flow.dataId]?.name ?? '',
      fromLabel: elementLabel(model, flow.sourceId),
      toLabel: elementLabel(model, flow.targetId),
    })),
    controlFlows: controlFlowsOn(model, diagramId).map((flow) => ({ flow, toLabel: elementLabel(model, flow.targetId) })),
  };
}

/** The whole model as indented plain text, in diagram order (query `getOutline`). */
export function getOutline(model: Model): string {
  const lines: string[] = [`Project: ${model.name}`];
  for (const row of diagramsInOrder(model)) {
    const o = diagramOutline(model, row.diagram.id);
    lines.push('', `${'  '.repeat(row.depth)}${o.title}`);
    const pad = '  '.repeat(row.depth + 1);
    for (const item of o.items) lines.push(`${pad}${KIND_WORDS[item.element.kind]}: ${item.label}`);
    for (const f of o.flows) lines.push(`${pad}flow: ${f.fromLabel} -> ${f.toLabel}: ${f.dataName}`);
    for (const c of o.controlFlows) lines.push(`${pad}control flow: ${c.flow.name} -> ${c.toLabel}`);
  }
  const defs = dataDefinitions(model);
  if (defs.length) {
    lines.push('', 'Data dictionary');
    for (const d of defs) {
      const detail =
        d.kind === 'dataElement'
          ? d.dataType
          : d.components.map((c) => model.elements[c.dataId]?.name ?? '?').join(' + ') || 'no contents';
      lines.push(`  ${d.name} = ${detail}`);
    }
  }
  return lines.join('\n');
}

// ---- The data model ----

export function entityOfAttribute(model: Model, dataId: Id): Entity | undefined {
  return all(model, 'entity').find((en) => en.attributes.some((a) => a.dataId === dataId));
}

/** 0 or 1: which end is the parent. null when both ends are "many", or while either `max` is not decided. */
export function parentEnd(rel: Relationship): 0 | 1 | null {
  const [a, b] = rel.ends;
  if (a.max === null || b.max === null) return null;
  if (a.max === 'one' && b.max === 'many') return 0;
  if (a.max === 'many' && b.max === 'one') return 1;
  if (a.max === 'one' && b.max === 'one') return 0;
  return null;
}

/** An entity's own identifier attributes, then those inherited through identifying relationships. */
export function fullIdentifier(model: Model, entityId: Id, seen: Set<Id> = new Set()): Id[] {
  const en = get(model, entityId, 'entity');
  if (!en || seen.has(entityId)) return [];
  const next = new Set(seen).add(entityId);
  const out = en.attributes.filter((a) => a.identifier).map((a) => a.dataId);
  for (const rel of all(model, 'relationship')) {
    if (!rel.identifying) continue;
    const p = parentEnd(rel);
    if (p === null) continue;
    const child = rel.ends[p === 0 ? 1 : 0].entityId;
    const parent = rel.ends[p].entityId;
    if (child !== entityId || parent === entityId) continue;
    for (const id of fullIdentifier(model, parent, next)) if (!out.includes(id)) out.push(id);
  }
  return out;
}

/** True if the entity is the child in at least one identifying relationship. */
export function isDependent(model: Model, entityId: Id): boolean {
  return all(model, 'relationship').some((rel) => {
    const p = parentEnd(rel);
    return rel.identifying && p !== null && rel.ends[p === 0 ? 1 : 0].entityId === entityId;
  });
}

// ---- Views worked out from the use cases (SPEC 8.4) ----

export interface EventResponseRow {
  /** The use case's id. */
  id: Id;
  /** The event: what starts the use case. */
  trigger: string;
  /** The response: the use case's name. */
  name: string;
}

/** The event-response list: one row for each use case, in number order. */
export function eventResponseList(model: Model): EventResponseRow[] {
  return all(model, 'useCase')
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((u) => ({ id: u.id, trigger: u.trigger, name: u.name }));
}

// ---- Search (SPEC 4.2) ----

export interface SearchOptions {
  /** Looked for in names, aliases, descriptions and notes, ignoring case. Empty matches everything. */
  text: string;
  kind?: ElementKind;
  /** Only what is on this diagram: its symbols, its flows, the data they carry, and the diagram itself. */
  diagramId?: Id;
  /** 'noDescription': only items with an empty description. 'unused': only items nothing refers to. */
  only?: 'noDescription' | 'unused';
}

export type SearchField = 'name' | 'alias' | 'description' | 'notes';

export interface SearchResult {
  element: Element;
  /** The name to show, from `elementLabel`. */
  label: string;
  /** Where the text was found. Empty when the search had no text. */
  matchedIn: SearchField[];
  /** The route that opens it, such as '/dictionary/d-phone'. */
  route: string;
  /** The place the route leads to, in words, such as 'Level 0' or 'Data dictionary'. */
  where: string;
}

/** The kinds that 'noDescription' looks at: those the textbook gives a described entry. */
const DESCRIBED: ElementKind[] = ['process', 'externalEntity', 'dataStore', 'dataStructure', 'dataElement', 'useCase', 'entity', 'relationship'];

function isUnused(model: Model, e: Element): boolean {
  if (!isNode(e) && !isData(e)) return false;
  const used = whereUsed(model, e.id);
  if (used.flows.length || used.structures.length || used.entities.length || used.useCases.length) return false;
  return e.kind !== 'process' || !all(model, 'controlFlow').some((c) => c.targetId === e.id);
}

/** The longer text of the second release's kinds, which search treats as a description. */
function moreText(e: Element): string[] {
  switch (e.kind) {
    case 'systemRequest':
      return [e.sponsor, e.businessNeed, e.specialIssues, ...e.businessRequirements, ...e.businessValue.map((v) => v.text)];
    case 'binderSection':
      return [e.body, ...e.attachments.map((a) => a.name)];
    case 'module':
      return [e.purpose, e.pseudocode, e.other];
    case 'test':
      return [e.objective, e.script, e.expectedResults, e.actualResults];
    case 'alternativeMatrix':
      return [e.recommendation, ...e.alternatives, ...e.criteria.map((c) => c.name)];
    default:
      return [];
  }
}

/** Where an element is opened, as a route and in words. */
function openAt(model: Model, e: Element): { route: string; where: string } {
  const diagram = (id: Id | undefined) => (id ? { route: `/diagram/${id}`, where: diagramTitle(model, id) } : { route: '/', where: '' });
  switch (e.kind) {
    case 'diagram':
      return diagram(e.id);
    case 'dataFlow':
    case 'controlFlow':
      return diagram(e.diagramId);
    case 'process':
      return diagram(diagramOfProcess(model, e.id)?.id);
    case 'externalEntity':
    case 'dataStore': {
      const on = new Set(occurrencesOf(model, e.id).map((o) => o.diagramId));
      const order = diagramsInOrder(model).map((r) => r.diagram.id).filter((id) => on.has(id));
      return diagram(order.find((id) => !isAboveProject(model, id)) ?? order[0] ?? topDiagram(model)?.id);
    }
    case 'dataStructure':
    case 'dataElement':
      return { route: `/dictionary/${e.id}`, where: 'Data dictionary' };
    case 'useCase':
      return { route: `/use-cases/${e.id}`, where: 'Use cases' };
    case 'entity':
    case 'relationship':
      return { route: '/data-model', where: 'Data model' };
    case 'systemRequest':
      return { route: '/system-request', where: 'System request' };
    case 'feasibility':
      return { route: '/feasibility', where: 'Feasibility analysis' };
    case 'requirement':
      return { route: '/requirements', where: 'Requirements definition' };
    case 'alternativeMatrix':
      return { route: `/alternatives/${e.id}`, where: 'Alternative matrix' };
    case 'test':
      return { route: `/test-plan/${e.id}`, where: 'Test plan' };
    case 'interfaceDiagram':
      return { route: `/interfaces/${e.id}`, where: 'Interface structure' };
    case 'interface':
    case 'navigationLink':
      return { route: `/interfaces/${e.diagramId}`, where: model.elements[e.diagramId]?.name || 'Interface structure' };
    case 'binderSection':
      return { route: `/binder/${e.id}`, where: 'Binder' };
    case 'structureChart':
      return { route: `/structure/${e.id}`, where: 'Structure charts' };
    case 'module': {
      const chart = chartOfModule(model, e.id);
      return { route: chart ? `/structure/${chart.id}` : '/structure', where: chart?.name || 'Structure charts' };
    }
    case 'couple': {
      const chart = chartOfModule(model, e.moduleId);
      return { route: chart ? `/structure/${chart.id}` : '/structure', where: chart?.name || 'Structure charts' };
    }
  }
}

/** The route that opens an element, and the place in words. The same answer `search` gives. */
export function routeOf(model: Model, id: Id): { route: string; where: string } | undefined {
  const e = model.elements[id];
  return e ? openAt(model, e) : undefined;
}

/**
 * Every element whose name, aliases, description or notes contain the text. A process's
 * longer description counts as a description. The results come in creation order.
 */
export function search(model: Model, options: SearchOptions): SearchResult[] {
  const text = options.text.trim().toLowerCase();
  const has = (value: string) => value.toLowerCase().includes(text);
  let onDiagram: Set<Id> | null = null;
  if (options.diagramId) {
    const flows = flowsOn(model, options.diagramId);
    onDiagram = new Set<Id>([
      options.diagramId,
      ...occurrencesOn(model, options.diagramId).map((o) => o.elementId),
      ...flows.map((f) => f.id),
      ...flows.map((f) => f.dataId),
      ...controlFlowsOn(model, options.diagramId).map((c) => c.id),
    ]);
  }
  const out: SearchResult[] = [];
  for (const e of Object.values(model.elements)) {
    if (options.kind && e.kind !== options.kind) continue;
    if (onDiagram && !onDiagram.has(e.id)) continue;
    if (options.only === 'noDescription' && (!DESCRIBED.includes(e.kind) || e.description.trim())) continue;
    if (options.only === 'unused' && !isUnused(model, e)) continue;
    const matchedIn: SearchField[] = [];
    if (text) {
      if (has(e.name)) matchedIn.push('name');
      if (e.aliases.some(has)) matchedIn.push('alias');
      if (has(e.description) || (e.kind === 'process' && has(e.processDescription)) || moreText(e).some(has)) matchedIn.push('description');
      if (has(e.notes)) matchedIn.push('notes');
      if (matchedIn.length === 0) continue;
    }
    out.push({ element: e, label: elementLabel(model, e.id), matchedIn, ...openAt(model, e) });
  }
  return out;
}

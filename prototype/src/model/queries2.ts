// Queries for the second release: SPEC sections 10 and 11. All are pure functions of the model.

import { recordSizeOf, tableVolume, type TableVolume } from './calc';
import { all, childDiagram, fullIdentifier, get, parentEnd } from './queries';
import type {
  BinderSection,
  Couple,
  DataElement,
  Element,
  Entity,
  Feasibility,
  Id,
  Interface,
  Mode,
  Model,
  Module,
  NavigationLink,
  NonfunctionalType,
  Phase,
  Process,
  Requirement,
  StructureChart,
  SystemRequest,
  Test,
} from './types';
import { NONFUNCTIONAL_TYPES } from './types';

// ---- Forms ----

/** The project's system request, or undefined while it has none. `updateSystemRequest` makes it. */
export function systemRequest(model: Model): SystemRequest | undefined {
  return all(model, 'systemRequest')[0];
}

/** The project's feasibility analysis, or undefined while it has none. `updateFeasibility` makes it. */
export function feasibility(model: Model): Feasibility | undefined {
  return all(model, 'feasibility')[0];
}

/** Every requirement, in outline order. */
export function requirementsInOrder(model: Model): Requirement[] {
  return all(model, 'requirement').sort((a, b) => a.order - b.order);
}

export interface NumberedRequirement {
  requirement: Requirement;
  /** "U1" for a user requirement, "1.2" for the others. */
  number: string;
}

export interface RequirementGroup {
  /** "1", "2", "3". */
  number: string;
  /** The business area. Empty for requirements that have none. */
  name: string;
  /** The heading the group sits under, or empty. Groups with the same heading are next to each other. */
  userGroup: string;
  requirements: NumberedRequirement[];
}

export interface NonfunctionalGroup {
  type: NonfunctionalType;
  /** "1" to "4". Nonfunctional numbering starts again at 1. */
  number: string;
  /** True when the form says that none are expected for this type. */
  noneExpected: boolean;
  requirements: NumberedRequirement[];
}

export interface RequirementsOutline {
  user: NumberedRequirement[];
  functional: RequirementGroup[];
  /** Always the four types, in the textbook's order. */
  nonfunctional: NonfunctionalGroup[];
}

/** The requirements definition as a numbered outline (SPEC 10.3). */
export function requirementsOutline(model: Model): RequirementsOutline {
  const ordered = requirementsInOrder(model);
  const user = ordered.filter((r) => r.requirementKind === 'user').map((requirement, i) => ({ requirement, number: `U${i + 1}` }));

  const functional = ordered.filter((r) => r.requirementKind === 'functional');
  const headings = [...new Set(functional.map((r) => r.userGroup.trim()))];
  const groups: RequirementGroup[] = [];
  for (const heading of headings) {
    const under = functional.filter((r) => r.userGroup.trim() === heading);
    for (const name of [...new Set(under.map((r) => r.group.trim()))]) {
      const number = String(groups.length + 1);
      groups.push({
        number,
        name,
        userGroup: heading,
        requirements: under.filter((r) => r.group.trim() === name).map((requirement, i) => ({ requirement, number: `${number}.${i + 1}` })),
      });
    }
  }

  const nonfunctional = NONFUNCTIONAL_TYPES.map((type, t) => ({
    type,
    number: String(t + 1),
    noneExpected: model.project.noneExpected.includes(type),
    requirements: ordered
      .filter((r) => r.requirementKind === 'nonfunctional' && r.nonfunctionalType === type)
      .map((requirement, i) => ({ requirement, number: `${t + 1}.${i + 1}` })),
  }));
  return { user, functional: groups, nonfunctional };
}

/** A requirement's number in the outline, or '' when there is no such requirement. */
export function requirementNumber(model: Model, id: Id): string {
  const o = requirementsOutline(model);
  const every = [...o.user, ...o.functional.flatMap((g) => g.requirements), ...o.nonfunctional.flatMap((g) => g.requirements)];
  return every.find((r) => r.requirement.id === id)?.number ?? '';
}

/** A process and every process below it. */
export function processesBelow(model: Model, processId: Id): Id[] {
  const out = [processId];
  for (let i = 0; i < out.length; i++) for (const p of all(model, 'process')) if (p.parentProcessId === out[i]) out.push(p.id);
  return out;
}

/** The requirements traced to a use case: to it directly, or to its process. */
export function requirementsFor(model: Model, useCaseId: Id): Requirement[] {
  const u = get(model, useCaseId, 'useCase');
  if (!u) return [];
  return requirementsInOrder(model).filter((r) => r.traceIds.includes(u.id) || (u.processId !== null && r.traceIds.includes(u.processId)));
}

/** Every test, in ID order. */
export function testsInOrder(model: Model): Test[] {
  return all(model, 'test').sort((a, b) => a.ordinal - b.ordinal);
}

// ---- The interface structure diagram ----

export function interfacesOn(model: Model, diagramId: Id): Interface[] {
  return all(model, 'interface').filter((i) => i.diagramId === diagramId);
}

export function linksOn(model: Model, diagramId: Id): NavigationLink[] {
  return all(model, 'navigationLink').filter((l) => l.diagramId === diagramId);
}

export interface InterfaceReach {
  /** Interface 0, the main menu, or undefined when the diagram has none. */
  menu: Interface | undefined;
  /** How many links each interface is from interface 0. An interface that cannot be reached is not in the map. */
  distance: Map<Id, number>;
  /** The interfaces directly below one: those linked to it that are one step further from interface 0. */
  below: (interfaceId: Id) => Id[];
}

/** How the interfaces of a diagram hang from interface 0. A link has no direction, so "below" means further from the main menu. */
export function interfaceReach(model: Model, diagramId: Id): InterfaceReach {
  const interfaces = interfacesOn(model, diagramId);
  const links = linksOn(model, diagramId);
  const neighbours = (id: Id) => links.filter((l) => l.aId === id || l.bId === id).map((l) => (l.aId === id ? l.bId : l.aId));
  const menu = interfaces.find((i) => i.number === '0');
  const distance = new Map<Id, number>();
  if (menu) {
    distance.set(menu.id, 0);
    const queue = [menu.id];
    for (let i = 0; i < queue.length; i++)
      for (const next of neighbours(queue[i]))
        if (!distance.has(next)) {
          distance.set(next, distance.get(queue[i])! + 1);
          queue.push(next);
        }
  }
  return {
    menu,
    distance,
    below: (id) => (distance.has(id) ? neighbours(id).filter((n) => distance.get(n) === distance.get(id)! + 1) : []),
  };
}

// ---- The binder ----

export const PHASES: Phase[] = ['planning', 'analysis', 'design', 'implementation'];

/** The binder sections in order, all of them or those of one phase. */
export function binderSections(model: Model, phase?: Phase): BinderSection[] {
  return all(model, 'binderSection')
    .filter((s) => !phase || s.phase === phase)
    .sort((a, b) => PHASES.indexOf(a.phase) - PHASES.indexOf(b.phase) || a.order - b.order);
}

// ---- The structure chart ----

/** The modules directly below a module, in number order. */
export function moduleChildren(model: Model, moduleId: Id): Module[] {
  return all(model, 'module')
    .filter((m) => m.parentModuleId === moduleId)
    .sort((a, b) => a.ordinal - b.ordinal);
}

export interface ModuleRow {
  module: Module;
  /** 0 for the top module. */
  depth: number;
  /** "1", "1.2". */
  number: string;
}

/** Every module of a chart as a tree in reading order, the top module first. */
export function modulesOf(model: Model, chartId: Id): ModuleRow[] {
  const chart = get(model, chartId, 'structureChart');
  const top = get(model, chart?.topModuleId, 'module');
  const rows: ModuleRow[] = [];
  const visit = (module: Module, depth: number, number: string) => {
    if (rows.some((r) => r.module.id === module.id)) return;
    rows.push({ module, depth, number });
    for (const child of moduleChildren(model, module.id)) visit(child, depth + 1, `${number}.${child.ordinal}`);
  };
  if (top) visit(top, 0, String(top.ordinal));
  return rows;
}

/** The top module above a module (or the module itself). */
function topOf(model: Model, moduleId: Id): Module | undefined {
  let m = get(model, moduleId, 'module');
  const seen = new Set<Id>();
  while (m && m.parentModuleId !== null && !seen.has(m.id)) {
    seen.add(m.id);
    m = get(model, m.parentModuleId, 'module');
  }
  return m;
}

/** The chart a module is drawn on. */
export function chartOfModule(model: Model, moduleId: Id): StructureChart | undefined {
  const top = topOf(model, moduleId);
  return top && all(model, 'structureChart').find((c) => c.topModuleId === top.id);
}

/** "1", "1.2", "1.2.1": built from ordinals, as a process number is. The top number has no ".0". */
export function moduleNumber(model: Model, moduleId: Id): string {
  const parts: number[] = [];
  let m = get(model, moduleId, 'module');
  const seen = new Set<Id>();
  while (m && !seen.has(m.id)) {
    seen.add(m.id);
    parts.unshift(m.ordinal);
    m = m.parentModuleId === null ? undefined : get(model, m.parentModuleId, 'module');
  }
  return parts.length ? parts.join('.') : '?';
}

/** The module a box stands for: the one it repeats, or itself. Read the name, the library mark and the specification from it. */
export function originalModule(model: Model, moduleId: Id): Module | undefined {
  const m = get(model, moduleId, 'module');
  return m?.repeatsId ? (get(model, m.repeatsId, 'module') ?? m) : m;
}

/** The number of modules directly below a module. */
export function fanOut(model: Model, moduleId: Id): number {
  return moduleChildren(model, moduleId).length;
}

/** One, plus the number of boxes that repeat the module. */
export function fanIn(model: Model, moduleId: Id): number {
  const original = originalModule(model, moduleId);
  return 1 + all(model, 'module').filter((m) => m.repeatsId === original?.id).length;
}

/** The couples on the line above a module. */
export function couplesOf(model: Model, moduleId: Id): Couple[] {
  return all(model, 'couple').filter((c) => c.moduleId === moduleId);
}

/** A couple's label: the name of its data, or its own name for a control couple. */
export function coupleLabel(model: Model, couple: Couple): string {
  return couple.coupleKind === 'data' ? (model.elements[couple.dataId ?? '']?.name ?? '') : couple.name;
}

export interface IoRow {
  couple: Couple;
  /** The couple's label. */
  name: string;
  /** The data type from the dictionary, "Structure" for a data structure, or "Flag" for a control couple. */
  type: string;
  /** The module at the other end of the line. */
  otherModuleId: Id;
  otherLabel: string;
  /** The notes typed for this row in the specification. */
  notes: string;
}

/**
 * The inputs and outputs of a module's program specification, listed from the chart
 * (SPEC 11.4). An input is a couple passed down to the module, or passed up to it from a
 * module below. An output is the reverse.
 */
export function programIo(model: Model, moduleId: Id): { inputs: IoRow[]; outputs: IoRow[] } {
  const module = get(model, moduleId, 'module');
  const inputs: IoRow[] = [];
  const outputs: IoRow[] = [];
  if (!module) return { inputs, outputs };
  const label = (id: Id) => `${moduleNumber(model, id)} ${originalModule(model, id)?.name ?? ''}`.trim();
  const row = (couple: Couple, otherModuleId: Id): IoRow => {
    const data = couple.dataId ? model.elements[couple.dataId] : undefined;
    return {
      couple,
      name: coupleLabel(model, couple),
      type: couple.coupleKind === 'control' ? 'Flag' : data?.kind === 'dataElement' ? data.dataType : 'Structure',
      otherModuleId,
      otherLabel: label(otherModuleId),
      notes: module.ioNotes.find((n) => n.coupleId === couple.id)?.notes ?? '',
    };
  };
  if (module.parentModuleId)
    for (const c of couplesOf(model, module.id)) (c.direction === 'down' ? inputs : outputs).push(row(c, module.parentModuleId));
  for (const child of moduleChildren(model, module.id))
    for (const c of couplesOf(model, child.id)) (c.direction === 'up' ? inputs : outputs).push(row(c, child.id));
  return { inputs, outputs };
}

// ---- The physical data model and the storage size estimate ----

export interface TableField {
  dataId: Id;
  element: DataElement;
  /** The field name, or the logical name while it has none. */
  name: string;
  /** Part of the primary key. */
  pk: boolean;
  /** A foreign key field: one of the parent table's primary key fields, shown here because the student placed the key. */
  fk: boolean;
  /** A field of another table that this table repeats. */
  copy: boolean;
  /** The table the field is owned by: this one, the parent of a foreign key, or the owner of a copy. */
  fromEntityId: Id | null;
  /** The relationship a foreign key field comes through. */
  relationshipId: Id | null;
}

/**
 * The fields of a table in physical mode (SPEC 11.5): its own attributes, then the
 * primary key fields of each parent whose foreign key the student has placed, then its
 * copies. Foreign keys are shown, not stored.
 */
export function tableFields(model: Model, entityId: Id): TableField[] {
  const en = get(model, entityId, 'entity');
  if (!en) return [];
  const out: TableField[] = [];
  const push = (dataId: Id, rest: Omit<TableField, 'dataId' | 'element' | 'name'>) => {
    const element = get(model, dataId, 'dataElement');
    if (element) out.push({ dataId, element, name: element.fieldName.trim() || element.name, ...rest });
  };
  for (const a of en.attributes) push(a.dataId, { pk: a.identifier, fk: false, copy: false, fromEntityId: en.id, relationshipId: null });
  for (const rel of all(model, 'relationship')) {
    const p = parentEnd(rel);
    if (!rel.foreignKey || p === null || rel.ends[p === 0 ? 1 : 0].entityId !== en.id) continue;
    const parentId = rel.ends[p].entityId;
    for (const dataId of fullIdentifier(model, parentId))
      push(dataId, { pk: rel.identifying, fk: true, copy: false, fromEntityId: parentId, relationshipId: rel.id });
  }
  for (const dataId of en.copies)
    push(dataId, { pk: false, fk: false, copy: true, fromEntityId: all(model, 'entity').find((o) => o.attributes.some((a) => a.dataId === dataId))?.id ?? null, relationshipId: null });
  return out;
}

export interface TableEstimate extends TableVolume {
  entity: Entity;
  /** The table name, or the entity's name while it has none. */
  name: string;
  fields: TableField[];
  /** True when the record size is the typed one, because the table has no fields. */
  typedSize: boolean;
  /** How the growth was given. */
  growthBy: 'month' | 'year' | 'none';
}

export interface StorageEstimate {
  /** The overhead rate and the months used. Each is 0 while the project has none. */
  overheadRate: number;
  months: number;
  tables: TableEstimate[];
  /** The database size at the start, and after the chosen months. */
  initialVolume: number;
  finalVolume: number;
}

/** The storage size estimate of SPEC 11.6, worked out for every table. */
export function storageEstimate(model: Model): StorageEstimate {
  const overheadRate = model.project.overheadRate ?? 0;
  const months = model.project.months ?? 0;
  const tables = all(model, 'entity').map((entity): TableEstimate => {
    const fields = tableFields(model, entity.id);
    const typedSize = fields.length === 0;
    const size = typedSize ? (entity.recordSize ?? 0) : recordSizeOf(fields.map((f) => f.element.averageWidth));
    return {
      entity,
      name: entity.tableName.trim() || entity.name,
      fields,
      typedSize,
      growthBy: entity.growthPerYear !== null ? 'year' : entity.growthPerMonth !== null ? 'month' : 'none',
      ...tableVolume(size, overheadRate, entity, months),
    };
  });
  return {
    overheadRate,
    months,
    tables,
    initialVolume: tables.reduce((a, t) => a + t.initialVolume, 0),
    finalVolume: tables.reduce((a, t) => a + t.finalVolume, 0),
  };
}

// ---- Logical and physical modes (SPEC 11.1) ----

const logicalCache = new WeakMap<Model, Model>();

/** True for an element marked as existing only for the way the system is built. */
export function isSystemRelated(e: Element | undefined): boolean {
  return !!e && 'systemRelated' in e && e.systemRelated === true;
}

/**
 * The model as a mode shows it. In physical mode that is the model itself. In logical
 * mode everything marked `systemRelated` is left out, with whatever cannot exist without
 * it: the flows at a removed process or data store, the flows that carry removed data,
 * the processes and diagrams below a removed process, and a data structure whose parts
 * are all left out. The result is a model like any
 * other, so every query works on it. It is the same object each time for the same model.
 */
export function modelForMode(model: Model, mode: Mode): Model {
  if (mode === 'physical') return model;
  const cached = logicalCache.get(model);
  if (cached) return cached;

  const gone = new Set<Id>();
  for (const e of Object.values(model.elements)) if (isSystemRelated(e)) gone.add(e.id);
  if (gone.size === 0) {
    logicalCache.set(model, model);
    return model;
  }
  // A structure has no mark of its own. One whose parts are all left out is left out with them.
  const structures = all(model, 'dataStructure');
  let shrank = true;
  while (shrank) {
    shrank = false;
    for (const s of structures)
      if (!gone.has(s.id) && s.components.length > 0 && s.components.every((c) => gone.has(c.dataId))) {
        gone.add(s.id);
        shrank = true;
      }
  }
  // Whatever hangs from a removed process.
  const processes = all(model, 'process');
  let grew = true;
  while (grew) {
    grew = false;
    for (const p of processes)
      if (!gone.has(p.id) && p.parentProcessId && gone.has(p.parentProcessId)) {
        gone.add(p.id);
        grew = true;
      }
  }
  for (const p of processes) {
    const child = gone.has(p.id) ? childDiagram(model, p.id) : undefined;
    if (child) gone.add(child.id);
  }
  for (const f of all(model, 'dataFlow'))
    if (gone.has(f.diagramId) || gone.has(f.dataId) || (f.sourceId && gone.has(f.sourceId)) || (f.targetId && gone.has(f.targetId))) gone.add(f.id);
  for (const c of all(model, 'controlFlow')) if (gone.has(c.diagramId) || gone.has(c.targetId)) gone.add(c.id);
  for (const r of all(model, 'relationship')) if (r.ends.some((end) => gone.has(end.entityId))) gone.add(r.id);
  for (const c of all(model, 'couple')) if (c.dataId && gone.has(c.dataId)) gone.add(c.id);

  const keep = <T extends Id | null>(id: T): T | null => (id !== null && gone.has(id) ? null : id);
  const elements: Record<Id, Element> = {};
  for (const e of Object.values(model.elements)) {
    if (gone.has(e.id)) continue;
    switch (e.kind) {
      case 'process':
        elements[e.id] = { ...e, crud: e.crud.filter((c) => !gone.has(c.dataId)) } satisfies Process;
        break;
      case 'dataStructure':
        elements[e.id] = { ...e, components: e.components.filter((c) => !gone.has(c.dataId)) };
        break;
      case 'entity':
        elements[e.id] = { ...e, attributes: e.attributes.filter((a) => !gone.has(a.dataId)), copies: e.copies.filter((c) => !gone.has(c)), storeId: keep(e.storeId) };
        break;
      case 'useCase':
        elements[e.id] = {
          ...e,
          processId: keep(e.processId),
          steps: e.steps.map((s) => ({ ...s, information: s.information.filter((i) => !gone.has(i.dataId)) })),
          summaryInputs: e.summaryInputs.filter((i) => !gone.has(i.dataId) && !gone.has(i.sourceId)),
          summaryOutputs: e.summaryOutputs.filter((o) => !gone.has(o.dataId) && !gone.has(o.destinationId)),
        };
        break;
      case 'requirement':
        elements[e.id] = { ...e, traceIds: e.traceIds.filter((t) => !gone.has(t)) };
        break;
      case 'interface':
        elements[e.id] = { ...e, processIds: e.processIds.filter((p) => !gone.has(p)) };
        break;
      case 'module':
        elements[e.id] = { ...e, processId: keep(e.processId), ioNotes: e.ioNotes.filter((n) => !gone.has(n.coupleId)) };
        break;
      default:
        elements[e.id] = e;
    }
  }
  const pick = <T>(record: Record<Id, T>, test: (value: T, id: Id) => boolean) =>
    Object.fromEntries(Object.entries(record).filter(([id, value]) => test(value, id)));
  const logical: Model = {
    ...model,
    elements,
    views: {
      occurrences: pick(model.views.occurrences, (o) => !gone.has(o.elementId) && !gone.has(o.diagramId)),
      routes: pick(model.views.routes, (_, id) => !gone.has(id)),
      erd: pick(model.views.erd, (_, id) => !gone.has(id)),
      isd: model.views.isd,
    },
    settings: { ...model.settings, topDiagramId: keep(model.settings.topDiagramId) },
  };
  logicalCache.set(model, logical);
  return logical;
}

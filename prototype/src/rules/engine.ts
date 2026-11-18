import {
  all,
  contents,
  contextDiagram,
  dataDefinitions,
  diagramOfProcess,
  diagramsInOrder,
  edgeFlows,
  elementLabel,
  entityOfAttribute,
  fullIdentifier,
  get,
  isAboveProject,
  nodeTag,
  occurrencesOf,
  processesOn,
  topDiagram,
} from '../model/queries';
import { modelForMode } from '../model/queries2';
import type { DataFlow, Id, Mode, Model, Process } from '../model/types';
import { RULES, type Severity } from './catalogue';
import { physicalDataModelStarted, release2Rules } from './engine2';

/** Where a finding is counted. The order is the order the areas are listed in. */
export const FINDING_AREAS = [
  'systemRequest',
  'feasibility',
  'requirements',
  'diagram',
  'dictionary',
  'dataModel',
  'alternatives',
  'interface',
  'structure',
  'storage',
  'testPlan',
] as const;
export type FindingArea = (typeof FINDING_AREAS)[number];

export interface Finding {
  /** Stable while the problem stays the same, so it can be used as a React key and for selection. */
  id: string;
  ruleId: string;
  severity: Severity;
  /** The elements involved, most relevant first. */
  elementIds: Id[];
  /** The data flow diagram the finding belongs to, or null when it belongs somewhere else. */
  diagramId: Id | null;
  /**
   * The form, interface structure diagram or structure chart the finding belongs to, for
   * the areas that hold several: a matrix, an interface diagram, a chart or a test. Otherwise null.
   */
  homeId: Id | null;
  /** Where the finding is counted. Each finding is counted in exactly one place. */
  area: FindingArea;
  /** Named values used to fill the message. Balancing findings also carry `BalanceValues`. */
  values: Record<string, unknown>;
  message: string;
  why: string;
  fix: string;
}

/** One row of the small table on a balancing problem card. */
export interface BalancePart {
  dataId: Id;
  name: string;
  /** True when all of this part crosses the edge of the child diagram. */
  crosses: boolean;
  /** The child items where flows carrying this part attach, such as "1.1". Empty when it is missing. */
  at: { elementId: Id; label: string }[];
}

/** The `values` of a BAL-01 or BAL-02 finding. */
export interface BalanceValues {
  data: string;
  process: string;
  missing: string;
  direction: 'in' | 'out';
  dataId: Id;
  processId: Id;
  missingIds: Id[];
  /** Every part of the parent data, and whether it crosses the edge of the child diagram. */
  parts: BalancePart[];
}

export function isBalanceFinding(f: Finding): f is Finding & { values: Record<string, unknown> & BalanceValues } {
  return (f.ruleId === 'BAL-01' || f.ruleId === 'BAL-02') && Array.isArray(f.values.parts);
}

function sentence(text: string): string {
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function fill(template: string, values: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
}

/**
 * Runs every rule on the whole model, as one mode shows it (SPEC 11.1). In logical mode
 * everything marked `systemRelated` is left out and the physical rules do not run. In
 * physical mode it is all included. Nothing is reported on a diagram above the project's
 * top diagram, or on an element shown only there (SPEC 3.7).
 */
export function runRules(full: Model, mode: Mode = 'logical'): Finding[] {
  const model = modelForMode(full, mode);
  const out: Finding[] = [];
  const order = diagramsInOrder(model).map((r) => r.diagram.id);
  const ctx = contextDiagram(model);
  const top = topDiagram(model);
  const above = new Set(order.filter((id) => isAboveProject(model, id)));

  const add = (
    ruleId: string,
    elementIds: Id[],
    where: Id | FindingArea,
    values: Record<string, unknown>,
    key = '',
    homeId: Id | null = null,
  ) => {
    const rule = RULES[ruleId];
    const isArea = (FINDING_AREAS as readonly string[]).includes(where);
    out.push({
      id: `${ruleId}:${elementIds.slice(0, 2).join(',')}${key ? `:${key}` : ''}`,
      ruleId,
      severity: rule.severity,
      elementIds,
      diagramId: isArea ? null : where,
      homeId,
      area: isArea ? (where as FindingArea) : 'diagram',
      values,
      message: fill(rule.message, values),
      why: sentence(fill(rule.why, values)),
      fix: sentence(fill(rule.fix, values)),
    });
  };

  /** The diagram where a finding about a node is shown. */
  const homeOf = (id: Id): Id | FindingArea => {
    const e = model.elements[id];
    if (e?.kind === 'process') return diagramOfProcess(model, id)?.id ?? top?.id ?? 'diagram';
    const on = order.filter((d) => occurrencesOf(model, id).some((o) => o.diagramId === d));
    // The first diagram inside the project that shows it. An item that is on no diagram counts on the top one.
    return on.find((d) => !above.has(d)) ?? on[0] ?? top?.id ?? 'diagram';
  };

  /** True for a diagram above the project, and for a symbol, a flow or a process that is only there. */
  const onlyAbove = (id: Id | undefined): boolean => {
    const e = id ? model.elements[id] : undefined;
    if (!e) return false;
    if (e.kind === 'diagram') return above.has(e.id);
    if (e.kind === 'dataFlow' || e.kind === 'controlFlow') return above.has(e.diagramId);
    if (e.kind !== 'process' && e.kind !== 'externalEntity' && e.kind !== 'dataStore') return false;
    const occs = occurrencesOf(model, e.id);
    return occs.length > 0 && occs.every((o) => above.has(o.diagramId));
  };

  const processes = all(model, 'process');
  const externals = all(model, 'externalEntity');
  const stores = all(model, 'dataStore');
  const flows = all(model, 'dataFlow');
  const controlFlows = all(model, 'controlFlow');
  const defs = dataDefinitions(model);
  const nameOf = (id: Id | null) => (id ? (model.elements[id]?.name ?? '') : '');

  // DFD-01: empty names.
  for (const e of [...processes, ...externals, ...stores])
    if (!e.name.trim()) add('DFD-01', [e.id], homeOf(e.id), { kind: kindWord(e.kind) });
  for (const e of defs) if (!e.name.trim()) add('DFD-01', [e.id], 'dictionary', { kind: 'data definition' });
  for (const e of controlFlows) if (!e.name.trim()) add('DFD-01', [e.id], e.diagramId, { kind: 'control flow' });

  // DFD-02: duplicate names.
  const duplicates = (items: { id: Id; name: string }[], kinds: string, where: (id: Id) => Id | FindingArea) => {
    const groups = new Map<string, { id: Id; name: string }[]>();
    for (const e of items) {
      const key = e.name.trim().toLowerCase();
      if (!key) continue;
      groups.set(key, [...(groups.get(key) ?? []), e]);
    }
    for (const group of groups.values())
      if (group.length > 1) add('DFD-02', group.map((e) => e.id), where(group[0].id), { kinds, name: group[0].name });
  };
  duplicates(processes, 'processes', homeOf);
  duplicates(externals, 'external entities', homeOf);
  duplicates(stores, 'data stores', homeOf);
  duplicates(defs, 'data definitions', () => 'dictionary');

  // DFD-03, 04, 07, 14, 15: processes.
  for (const p of processes) {
    const into = flows.filter((f) => f.targetId === p.id);
    const outOf = flows.filter((f) => f.sourceId === p.id);
    const control = controlFlows.filter((c) => c.targetId === p.id);
    const home = homeOf(p.id);
    const values = { name: p.name };
    if (outOf.length > 0 && into.length === 0 && control.length === 0) add('DFD-03', [p.id], home, values);
    if (into.length > 0 && outOf.length === 0) add('DFD-04', [p.id], home, values);
    if (into.length === 0 && outOf.length === 0 && control.length === 0) add('DFD-07', [p.id], home, values);
    if (/\band\b/i.test(p.name)) add('DFD-14', [p.id], home, values);
    const received = new Set(into.map((f) => f.dataId));
    for (const dataId of new Set(outOf.map((f) => f.dataId))) {
      if (!received.has(dataId)) continue;
      const involved = [...into, ...outOf].filter((f) => f.dataId === dataId).map((f) => f.id);
      add('DFD-15', [p.id, dataId, ...involved], home, { name: p.name, data: nameOf(dataId) }, dataId);
    }
  }

  // DFD-05, 06: flows.
  for (const f of flows) {
    const data = nameOf(f.dataId);
    const sourceKind = f.sourceId ? model.elements[f.sourceId]?.kind : undefined;
    const targetKind = f.targetId ? model.elements[f.targetId]?.kind : undefined;
    if (!f.sourceId || !f.targetId || (sourceKind !== 'process' && targetKind !== 'process'))
      add('DFD-05', [f.id, f.dataId], f.diagramId, { data });
    if (f.sourceId && f.sourceId === f.targetId)
      add('DFD-06', [f.id, f.sourceId, f.dataId], f.diagramId, { data, name: nameOf(f.sourceId) });
  }

  // DFD-08: external entities with no flows.
  for (const x of externals)
    if (!flows.some((f) => f.sourceId === x.id || f.targetId === x.id)) add('DFD-08', [x.id], homeOf(x.id), { name: x.name });

  // DFD-09: data stores used in one direction only.
  for (const s of stores) {
    const written = flows.some((f) => f.targetId === s.id);
    const read = flows.some((f) => f.sourceId === s.id);
    if (written !== read) add('DFD-09', [s.id], homeOf(s.id), { name: s.name, direction: written ? 'written to' : 'read from' });
  }

  // DFD-13: empty descriptions.
  for (const e of [...processes, ...externals, ...stores])
    if (!e.description.trim()) add('DFD-13', [e.id], homeOf(e.id), { name: e.name });
  for (const e of defs) if (!e.description.trim()) add('DFD-13', [e.id], 'dictionary', { name: e.name });

  // DFD-10, 11, 12: structure.
  if (ctx) {
    const shown = new Set<Id>();
    for (const s of stores) {
      if (shown.has(s.id) || !occurrencesOf(model, s.id).some((o) => o.diagramId === ctx.id)) continue;
      shown.add(s.id);
      add('DFD-10', [s.id], ctx.id, { name: s.name });
    }
  }
  for (const d of all(model, 'diagram')) {
    const count = processesOn(model, d.id).length;
    if (d.diagramKind === 'dfd' && count < 3) add('DFD-11', [d.id], d.id, { count });
    if (count > 7) add('DFD-12', [d.id], d.id, { count });
  }

  // DD-01, 02, 03: the dictionary.
  const structures = all(model, 'dataStructure');
  const hasEntities = all(model, 'entity').length > 0;
  for (const s of structures) {
    if (s.components.length === 0) add('DD-01', [s.id], 'dictionary', { name: s.name });
    if (containsItself(model, s.id)) add('DD-02', [s.id], 'dictionary', { name: s.name });
  }
  for (const d of defs) {
    const carried = flows.some((f) => f.dataId === d.id);
    const partOf = structures.some((s) => s.components.some((c) => c.dataId === d.id));
    // SPEC 9.4: a data element that an entity owns is left to the data model rules.
    const owned = hasEntities && !!entityOfAttribute(model, d.id);
    if (!carried && !partOf && !owned) add('DD-03', [d.id], 'dictionary', { name: d.name });
  }

  // BAL-01 to BAL-04. The top diagram is balanced against its parent process only when
  // that process has a flow: an empty parent means the level above was not asked for.
  for (const p of processes) {
    const isTop = top?.decomposesProcessId === p.id;
    if (isTop && !flows.some((f) => f.sourceId === p.id || f.targetId === p.id)) continue;
    balance(model, p, add);
  }

  // Provisional data model rules. They run only when the project has an entity.
  // ERD-04 counts an identifier that is system-related, so it reads the whole model. In
  // physical mode PDM-02 says the same thing about the table and takes its place.
  if (hasEntities) dataModelRules(model, add, full, mode === 'physical' && physicalDataModelStarted(model));

  // The rules of SPEC sections 10 and 11.
  release2Rules(model, mode, add, homeOf, top?.id ?? null);

  const rank = (f: Finding) =>
    (f.severity === 'error' ? 0 : 10000) + (f.diagramId ? 1000 + order.indexOf(f.diagramId) : FINDING_AREAS.indexOf(f.area) * 500);
  return out
    .filter((f) => !(f.diagramId && above.has(f.diagramId)) && !onlyAbove(f.elementIds[0]))
    .map((f, i) => ({ f, i }))
    .sort((a, b) => rank(a.f) - rank(b.f) || a.i - b.i)
    .map((x) => x.f);
}

export type Add = (
  ruleId: string,
  elementIds: Id[],
  where: Id | FindingArea,
  values: Record<string, unknown>,
  key?: string,
  homeId?: Id | null,
) => void;

function kindWord(kind: string): string {
  return kind === 'externalEntity' ? 'external entity' : kind === 'dataStore' ? 'data store' : kind;
}

function containsItself(model: Model, structureId: Id): boolean {
  const seen = new Set<Id>();
  const stack = [...(get(model, structureId, 'dataStructure')?.components.map((c) => c.dataId) ?? [])];
  while (stack.length) {
    const id = stack.pop()!;
    if (id === structureId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    const s = get(model, id, 'dataStructure');
    if (s) stack.push(...s.components.map((c) => c.dataId));
  }
  return false;
}

function union(model: Model, dataIds: Iterable<Id>): Set<Id> {
  const out = new Set<Id>();
  for (const id of dataIds) for (const c of contents(model, id)) out.add(c);
  return out;
}

/** The largest parts of a definition that are wholly missing. */
function missingParts(model: Model, dataId: Id, missing: Set<Id>, top = true, seen: Set<Id> = new Set()): Id[] {
  if (seen.has(dataId)) return [];
  const own = [...contents(model, dataId)];
  if (!own.some((id) => missing.has(id))) return [];
  const s = get(model, dataId, 'dataStructure');
  const whole = own.every((id) => missing.has(id));
  if (!s || s.components.length === 0 || (whole && !top)) return [dataId];
  const next = new Set(seen).add(dataId);
  const out: Id[] = [];
  for (const c of s.components) for (const id of missingParts(model, c.dataId, missing, false, next)) if (!out.includes(id)) out.push(id);
  return out;
}

/** SPEC 5.5, for one process and the diagram that decomposes it. */
function balance(model: Model, p: Process, add: Add): void {
  const edge = edgeFlows(model, p.id);
  if (!edge) return;
  const child = edge.child;
  const name = (id: Id) => model.elements[id]?.name ?? '';

  for (const direction of ['in', 'out'] as const) {
    const isIn = direction === 'in';
    const pFlows = isIn ? edge.parentIn : edge.parentOut;
    const cFlows = isIn ? edge.childIn : edge.childOut;
    const insideEnd = (f: DataFlow) => (isIn ? f.targetId : f.sourceId);
    const outsideEnd = (f: DataFlow) => (isIn ? f.sourceId : f.targetId);
    const parentData = [...new Set(pFlows.map((f) => f.dataId))];
    const childData = [...new Set(cFlows.map((f) => f.dataId))];
    const parentContents = union(model, parentData);
    const childContents = union(model, childData);

    // BAL-01 and BAL-02: parent data missing from the child diagram.
    for (const dataId of parentData) {
      const own = contents(model, dataId);
      const missing = new Set([...own].filter((id) => !childContents.has(id)));
      if (missing.size === 0) continue;
      const missingIds = missingParts(model, dataId, missing);
      const s = get(model, dataId, 'dataStructure');
      const partIds = s && s.components.length > 0 ? [...new Set(s.components.map((c) => c.dataId))] : [dataId];
      const parts = partIds.map((partId) => {
        const partContents = contents(model, partId);
        const at: { elementId: Id; label: string }[] = [];
        for (const f of cFlows) {
          const end = insideEnd(f);
          if (!end || at.some((a) => a.elementId === end)) continue;
          if ([...contents(model, f.dataId)].some((id) => partContents.has(id)))
            at.push({ elementId: end, label: nodeTag(model, end) || name(end) });
        }
        return { dataId: partId, name: name(partId), crosses: [...partContents].every((id) => childContents.has(id)), at };
      });
      const values: BalanceValues = {
        data: name(dataId),
        process: p.name,
        missing: missingIds.map(name).join(', '),
        direction,
        dataId,
        processId: p.id,
        missingIds,
        parts,
      };
      const carrying = pFlows.filter((f) => f.dataId === dataId).map((f) => f.id);
      add(isIn ? 'BAL-01' : 'BAL-02', [dataId, p.id, ...carrying], child.id, { ...values }, direction);
    }

    // BAL-03: child data the parent does not show.
    for (const dataId of childData) {
      if ([...contents(model, dataId)].every((id) => parentContents.has(id))) continue;
      const carrying = cFlows.filter((f) => f.dataId === dataId).map((f) => f.id);
      add('BAL-03', [...carrying, dataId, p.id], child.id, { data: name(dataId), process: p.name, direction, dataId, processId: p.id }, `${dataId}:${direction}`);
    }

    // BAL-04: the same data, attached to a different outside element.
    const reported = new Set<Id>();
    for (const f of cFlows) {
      if (reported.has(f.dataId)) continue;
      const own = contents(model, f.dataId);
      const overlapping = pFlows.filter((pf) => [...contents(model, pf.dataId)].some((id) => own.has(id)));
      if (overlapping.length === 0 || overlapping.some((pf) => outsideEnd(pf) === outsideEnd(f))) continue;
      reported.add(f.dataId);
      add(
        'BAL-04',
        [f.id, f.dataId, p.id, ...overlapping.map((pf) => pf.id)],
        child.id,
        {
          data: name(f.dataId),
          childEnd: elementLabel(model, outsideEnd(f)),
          parentEnd: elementLabel(model, outsideEnd(overlapping[0])),
          direction,
        },
        `${f.dataId}:${direction}`,
      );
    }
  }
}

/** ERD-01 to ERD-05, ERD-10, ERD-11, DM-01 and DM-02. The specification names them but has not settled their wording. */
function dataModelRules(model: Model, add: Add, full: Model, skipIdentifier: boolean): void {
  const entities = all(model, 'entity');
  const name = (id: Id) => model.elements[id]?.name ?? '';

  for (const en of entities) {
    if (!en.name.trim()) add('ERD-01', [en.id], 'dataModel', { what: 'This entity', missing: 'name' });
    if (en.attributes.length === 0) add('ERD-03', [en.id], 'dataModel', { name: en.name });
    if (!skipIdentifier && fullIdentifier(full, en.id).length === 0) add('ERD-04', [en.id], 'dataModel', { name: en.name });
    if (!en.storeId) add('DM-01', [en.id], 'dataModel', { name: en.name });
    const repeating = en.attributes.filter((a) => a.repeats).map((a) => a.dataId);
    if (repeating.length > 0)
      add('ERD-11', [en.id, ...repeating], 'dataModel', { name: en.name, attributes: repeating.map(name).join(', '), count: repeating.length });
  }

  const groups = new Map<string, Id[]>();
  for (const en of entities) {
    const key = en.name.trim().toLowerCase();
    if (key) groups.set(key, [...(groups.get(key) ?? []), en.id]);
  }
  for (const ids of groups.values()) if (ids.length > 1) add('ERD-02', ids, 'dataModel', { name: name(ids[0]) });

  for (const rel of all(model, 'relationship')) {
    const [a, b] = rel.ends;
    rel.ends.forEach((end, i) => {
      if (end.verbPhrase.trim()) return;
      const what = `The '${name(end.entityId)}' end of the relationship between '${name(a.entityId)}' and '${name(b.entityId)}'`;
      add('ERD-01', [rel.id, end.entityId], 'dataModel', { what, missing: 'verb phrase' }, String(i));
    });
    const between = { first: name(a.entityId), second: name(b.entityId) };
    if (a.max === 'many' && b.max === 'many') add('ERD-05', [rel.id, a.entityId, b.entityId], 'dataModel', between);
    // ERD-10: an end that does not yet say how many.
    const open = rel.ends
      .map((end, i) => ({ end: i, entityId: end.entityId, min: end.min === null, max: end.max === null }))
      .filter((x) => x.min || x.max);
    if (open.length > 0) add('ERD-10', [rel.id, a.entityId, b.entityId], 'dataModel', { ...between, undecided: open });
  }

  for (const s of all(model, 'dataStore'))
    if (!entities.some((en) => en.storeId === s.id)) add('DM-02', [s.id], 'dataModel', { name: s.name });
}

// ---- Helpers for screens ----

export interface Counts {
  errors: number;
  warnings: number;
}

export function countFindings(findings: Finding[]): Counts {
  const errors = findings.filter((f) => f.severity === 'error').length;
  return { errors, warnings: findings.length - errors };
}

/** The findings that belong to one diagram. */
export function findingsForDiagram(findings: Finding[], diagramId: Id): Finding[] {
  return findings.filter((f) => f.diagramId === diagramId);
}

/** The findings that name an element. */
export function findingsForElement(findings: Finding[], elementId: Id): Finding[] {
  return findings.filter((f) => f.elementIds.includes(elementId));
}

/** The worst severity among the findings that name an element, or null. */
export function worstFor(findings: Finding[], elementId: Id): Severity | null {
  const own = findingsForElement(findings, elementId);
  if (own.length === 0) return null;
  return own.some((f) => f.severity === 'error') ? 'error' : 'warning';
}

/** The findings that belong to one form, interface structure diagram, structure chart or test. */
export function findingsForHome(findings: Finding[], homeId: Id): Finding[] {
  return findings.filter((f) => f.homeId === homeId);
}

/** The findings counted in one area. */
export function findingsForArea(findings: Finding[], area: FindingArea): Finding[] {
  return findings.filter((f) => f.area === area);
}

/** The words for each area, as the navigator and the problems list name it. */
export const AREA_WORDS: Record<FindingArea, string> = {
  systemRequest: 'System request',
  feasibility: 'Feasibility analysis',
  requirements: 'Requirements definition',
  diagram: 'Diagrams',
  dictionary: 'Data dictionary',
  dataModel: 'Data model',
  alternatives: 'Alternative matrix',
  interface: 'Interface structure',
  structure: 'Structure charts',
  storage: 'Storage size estimate',
  testPlan: 'Test plan',
};

/** The route of the place where a finding is counted, and words for a link to it. */
export function findingPlace(finding: Finding): { to: string; text: string } {
  if (finding.diagramId) return { to: `/diagram/${finding.diagramId}`, text: 'Show on diagram' };
  const home = finding.homeId ? `/${finding.homeId}` : '';
  switch (finding.area) {
    case 'systemRequest':
      return { to: '/system-request', text: 'Open system request' };
    case 'feasibility':
      return { to: '/feasibility', text: 'Open feasibility analysis' };
    case 'requirements':
      return { to: '/requirements', text: 'Open requirements definition' };
    case 'alternatives':
      return { to: `/alternatives${home}`, text: 'Open alternative matrix' };
    case 'interface':
      return { to: `/interfaces${home}`, text: 'Open interface structure diagram' };
    case 'structure':
      return finding.ruleId === 'PS-01'
        ? { to: `/programs/${finding.elementIds[0]}`, text: 'Open program specification' }
        : { to: `/structure${home}`, text: 'Open structure chart' };
    case 'storage':
      return { to: '/storage', text: 'Open storage size estimate' };
    case 'testPlan':
      return { to: `/test-plan${home}`, text: 'Open test plan' };
    case 'dataModel':
      return { to: '/data-model', text: 'Open data model' };
    case 'dictionary':
      return { to: finding.elementIds[0] ? `/dictionary/${finding.elementIds[0]}` : '/dictionary', text: 'Open in data dictionary' };
    default:
      return { to: '/problems', text: 'Open problems' };
  }
}

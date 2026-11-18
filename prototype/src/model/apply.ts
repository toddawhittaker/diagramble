import type { AllowedValueInput, ApplyResult, Command, ExceptionInput, RelationshipEndInput } from './commands';
import {
  all,
  childDiagram,
  contents,
  contextDiagram,
  dataDefinitions,
  diagramOfProcess,
  edgeFlows,
  get,
  isAncestor,
  isData,
  isNode,
  isShownOn,
  occurrencesOf,
  occurrencesOn,
  parentEnd,
  processNumber,
} from './queries';
import type {
  AllowedValue,
  Component,
  DataFlow,
  Diagram,
  Element,
  Entity,
  Id,
  Model,
  NodeElement,
  NodeOccurrence,
  Origin,
  Process,
  Relationship,
  RelationshipEnd,
  UseCase,
  UseCaseException,
} from './types';
import { NODE_SIZE } from './types';
import { base, need, needData, newId, refuse, Refused } from './helpers';
import { checkRelease2, removeRelease2, runRelease2 } from './apply2';

/**
 * Applies one command. Returns a new model and the ids it created, or an error when
 * the command is not valid or would break an invariant of SPEC section 3.4.
 * The model passed in is never changed.
 */
export function apply(model: Model, command: Command): ApplyResult {
  const m = structuredClone(model);
  const created: Id[] = [];
  try {
    run(m, command, created);
  } catch (e) {
    if (e instanceof Refused) return { ok: false, error: e.message };
    throw e;
  }
  const broken = checkInvariants(m);
  if (broken) return { ok: false, error: broken };
  return { ok: true, model: m, created };
}

/** Applies a list of commands in order. Throws on the first one that is refused. For sample data and tests. */
export function applyAll(model: Model, commands: Command[]): Model {
  let m = model;
  for (const c of commands) {
    const r = apply(m, c);
    if (!r.ok) throw new Error(`${c.type} was refused: ${r.error}`);
    m = r.model;
  }
  return m;
}

// ---- Helpers ----

/** A plain string keeps the meaning that value already has. */
function allowedValues(input: AllowedValueInput[], existing: AllowedValue[] = []): AllowedValue[] {
  return input.map((v) =>
    typeof v === 'string'
      ? { value: v, meaning: existing.find((e) => e.value === v)?.meaning ?? '' }
      : { value: v.value, meaning: v.meaning ?? '' },
  );
}

function exceptions(input: ExceptionInput[]): UseCaseException[] {
  return input.map((e) => ({ stepNumber: e.stepNumber, text: e.text, steps: e.steps ?? [] }));
}

function checkLimit(limit: number): void {
  if (!Number.isInteger(limit) || limit < 1) refuse('A limit must be a whole number, 1 or more.');
}

/** A limit is kept only on a part that occurs many times. */
function component(c: Component): Component {
  if (c.occurs !== 'many' || c.limit === undefined || c.limit === null) return { dataId: c.dataId, occurs: c.occurs };
  checkLimit(c.limit);
  return { dataId: c.dataId, occurs: c.occurs, limit: c.limit };
}

function relationshipEnd(e: RelationshipEndInput): RelationshipEnd {
  return { entityId: e.entityId, verbPhrase: e.verbPhrase ?? '', min: e.min ?? null, max: e.max ?? null };
}

/**
 * Copies flows from a parent diagram down to the child diagram of process `p`, each with
 * its inner end unattached. An outside external entity or data store is placed on the
 * child diagram if it is not there yet. An outside process becomes an off-diagram end.
 */
function bringDown(m: Model, p: Process, child: Diagram, flows: DataFlow[], created: Id[]): void {
  const taken = occurrencesOn(m, child.id);
  let inRow = taken.filter((o) => o.x < 300).length;
  let outRow = taken.filter((o) => o.x >= 300).length;
  for (const f of flows) {
    const into = f.targetId === p.id;
    const otherId = into ? f.sourceId : f.targetId;
    if (!otherId) continue;
    const other = m.elements[otherId];
    let occId: Id | null = null;
    if (other && (other.kind === 'externalEntity' || other.kind === 'dataStore')) {
      occId =
        firstOccurrence(m, otherId, child.id) ??
        place(m, child.id, other, into ? 40 : 620, 60 + (into ? inRow++ : outRow++) * 130).id;
    }
    const id = newId(m, 'f');
    m.elements[id] = {
      id,
      kind: 'dataFlow',
      ...base({}, ''),
      diagramId: child.id,
      sourceId: into ? otherId : null,
      targetId: into ? null : otherId,
      dataId: f.dataId,
      physicalName: '',
      systemRelated: f.systemRelated,
    };
    m.views.routes[id] = {
      flowId: id,
      sourceOccurrenceId: into ? occId : null,
      targetOccurrenceId: into ? null : occId,
      points: [],
    };
    created.push(id);
  }
}

function place(m: Model, diagramId: Id, element: NodeElement, x = 40, y = 40, id?: Id): NodeOccurrence {
  const occ: NodeOccurrence = {
    id: newId(m, 'o', id),
    diagramId,
    elementId: element.id,
    x,
    y,
    ...NODE_SIZE[element.kind],
  };
  m.views.occurrences[occ.id] = occ;
  return occ;
}

function firstOccurrence(m: Model, elementId: Id | null, diagramId: Id): Id | null {
  if (!elementId) return null;
  return occurrencesOn(m, diagramId).find((o) => o.elementId === elementId)?.id ?? null;
}

/** Finds the definition a flow or attribute should carry, making a new one from a name if needed. */
function resolveData(
  m: Model,
  cmd: { dataId?: Id; dataName?: string },
  created: Id[],
  newKind: 'dataStructure' | 'dataElement' = 'dataStructure',
  dataType = 'Text',
  systemRelated = false,
): Id {
  if (cmd.dataId) return needData(m, cmd.dataId).id;
  const name = (cmd.dataName ?? '').trim();
  if (!name) refuse('Say which data this carries: give a data id or a data name.');
  const existing = dataDefinitions(m).find((d) => d.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing.id;
  const id = newId(m, 'd');
  m.elements[id] =
    newKind === 'dataStructure'
      ? { id, kind: 'dataStructure', ...base({}, name), components: [] }
      : { id, kind: 'dataElement', ...base({}, name), dataType, length: null, nullable: null, ...elementDefaults(systemRelated) };
  created.push(id);
  return id;
}

/** The physical and storage fields a new data element starts with. */
function elementDefaults(systemRelated: boolean) {
  return { systemRelated, fieldName: '', defaultValue: '', averageWidth: null };
}

function normalUses(uses: string): string {
  const up = uses.toUpperCase();
  return ['C', 'R', 'U', 'D'].filter((l) => up.includes(l)).join('');
}

/** Removes an element and everything that cannot exist without it. */
function removeElement(m: Model, id: Id): void {
  const e = m.elements[id];
  if (!e) return;
  switch (e.kind) {
    case 'dataFlow':
    case 'controlFlow':
      delete m.views.routes[id];
      break;
    case 'process': {
      const child = childDiagram(m, id);
      if (child) removeElement(m, child.id);
      for (const u of all(m, 'useCase')) if (u.processId === id) u.processId = null;
      removeNode(m, id);
      break;
    }
    case 'externalEntity':
    case 'dataStore':
      for (const u of all(m, 'useCase')) {
        if (u.actorId === id) u.actorId = null;
        u.summaryInputs = u.summaryInputs.filter((i) => i.sourceId !== id);
        u.summaryOutputs = u.summaryOutputs.filter((o) => o.destinationId !== id);
      }
      for (const en of all(m, 'entity')) if (en.storeId === id) en.storeId = null;
      removeNode(m, id);
      break;
    case 'diagram': {
      for (const p of all(m, 'process')) if (p.parentProcessId === e.decomposesProcessId) removeElement(m, p.id);
      for (const f of [...all(m, 'dataFlow'), ...all(m, 'controlFlow')]) if (f.diagramId === id) removeElement(m, f.id);
      for (const o of occurrencesOn(m, id)) delete m.views.occurrences[o.id];
      if (m.settings.topDiagramId === id) m.settings.topDiagramId = null;
      break;
    }
    case 'dataStructure':
    case 'dataElement':
      for (const f of all(m, 'dataFlow')) if (f.dataId === id) removeElement(m, f.id);
      for (const s of all(m, 'dataStructure')) s.components = s.components.filter((c) => c.dataId !== id);
      for (const en of all(m, 'entity')) en.attributes = en.attributes.filter((a) => a.dataId !== id);
      for (const p of all(m, 'process')) p.crud = p.crud.filter((c) => c.dataId !== id);
      for (const u of all(m, 'useCase')) {
        for (const s of u.steps) s.information = s.information.filter((i) => i.dataId !== id);
        u.summaryInputs = u.summaryInputs.filter((i) => i.dataId !== id);
        u.summaryOutputs = u.summaryOutputs.filter((o) => o.dataId !== id);
      }
      break;
    case 'entity':
      for (const r of all(m, 'relationship')) if (r.ends.some((end) => end.entityId === id)) delete m.elements[r.id];
      for (const p of all(m, 'process')) p.crud = p.crud.filter((c) => c.dataId !== id);
      delete m.views.erd[id];
      break;
    case 'useCase':
    case 'relationship':
      break;
    default:
      break;
  }
  removeRelease2(m, e, (other) => removeElement(m, other));
  delete m.elements[id];
}

function removeNode(m: Model, id: Id): void {
  for (const f of all(m, 'dataFlow')) if (f.sourceId === id || f.targetId === id) removeElement(m, f.id);
  for (const f of all(m, 'controlFlow')) if (f.targetId === id) removeElement(m, f.id);
  for (const o of occurrencesOf(m, id)) delete m.views.occurrences[o.id];
}

// ---- The commands ----

function run(m: Model, cmd: Command, created: Id[]): void {
  switch (cmd.type) {
    default:
      // Every command of the second release (SPEC sections 10 and 11).
      runRelease2(m, cmd, created, resolveData);
      return;

    case 'createProject': {
      if (contextDiagram(m)) refuse('This project already has a context diagram.');
      m.name = cmd.name;
      const process: Process = {
        id: newId(m, 'p', cmd.processId),
        kind: 'process',
        ...base(cmd, cmd.systemName ?? cmd.name),
        parentProcessId: null,
        ordinal: 0,
        processDescription: '',
        crud: [],
        implementation: '',
        human: false,
        systemRelated: false,
      };
      const diagram: Diagram = {
        id: newId(m, 'dg', cmd.id),
        kind: 'diagram',
        ...base(cmd, 'Context diagram'),
        description: '',
        diagramKind: 'context',
        decomposesProcessId: null,
      };
      m.elements[process.id] = process;
      m.elements[diagram.id] = diagram;
      place(m, diagram.id, process, 330, 210);
      created.push(diagram.id, process.id);
      return;
    }

    case 'addExternalEntity':
    case 'addDataStore': {
      need(m, cmd.diagramId, 'diagram');
      const el: NodeElement =
        cmd.type === 'addExternalEntity'
          ? { id: newId(m, 'x', cmd.id), kind: 'externalEntity', ...base(cmd, cmd.name), human: false }
          : { id: newId(m, 's', cmd.id), kind: 'dataStore', ...base(cmd, cmd.name), physicalName: '', systemRelated: cmd.systemRelated ?? false };
      m.elements[el.id] = el;
      created.push(el.id, place(m, cmd.diagramId, el, cmd.x, cmd.y).id);
      return;
    }

    case 'addProcess': {
      const d = need(m, cmd.diagramId, 'diagram');
      if (d.diagramKind === 'context') refuse('The context diagram shows the whole system as one process, so it cannot hold another.');
      const siblings = all(m, 'process').filter((p) => p.parentProcessId === d.decomposesProcessId);
      const ordinal = cmd.ordinal ?? Math.max(0, ...siblings.map((p) => p.ordinal)) + 1;
      if (siblings.some((p) => p.ordinal === ordinal)) refuse(`Another process here already has the number ${ordinal}.`);
      const el: Process = {
        id: newId(m, 'p', cmd.id),
        kind: 'process',
        ...base(cmd, cmd.name),
        parentProcessId: d.decomposesProcessId,
        ordinal,
        processDescription: '',
        crud: [],
        implementation: '',
        human: false,
        systemRelated: cmd.systemRelated ?? false,
      };
      m.elements[el.id] = el;
      created.push(el.id, place(m, cmd.diagramId, el, cmd.x, cmd.y).id);
      return;
    }

    case 'placeExisting': {
      need(m, cmd.diagramId, 'diagram');
      const el = m.elements[cmd.elementId];
      if (!el || (el.kind !== 'externalEntity' && el.kind !== 'dataStore'))
        refuse('Only an external entity or a data store can be placed on another diagram.');
      created.push(place(m, cmd.diagramId, el as NodeElement, cmd.x, cmd.y, cmd.occurrenceId).id);
      return;
    }

    case 'addControlFlow': {
      need(m, cmd.diagramId, 'diagram');
      need(m, cmd.targetId, 'process');
      const id = newId(m, 'c', cmd.id);
      m.elements[id] = { id, kind: 'controlFlow', ...base(cmd, cmd.name), diagramId: cmd.diagramId, targetId: cmd.targetId };
      m.views.routes[id] = {
        flowId: id,
        sourceOccurrenceId: null,
        targetOccurrenceId: firstOccurrence(m, cmd.targetId, cmd.diagramId),
        points: [],
      };
      created.push(id);
      return;
    }

    case 'setProcessNumber': {
      const p = need(m, cmd.processId, 'process');
      if (p.parentProcessId === null) refuse('The number of process 0 cannot be changed.');
      if (!Number.isInteger(cmd.ordinal) || cmd.ordinal < 1) refuse('A process number must be a whole number, 1 or more.');
      const clash = all(m, 'process').some(
        (o) => o.id !== p.id && o.parentProcessId === p.parentProcessId && o.ordinal === cmd.ordinal,
      );
      if (clash) refuse(`Another process here already has the number ${cmd.ordinal}.`);
      p.ordinal = cmd.ordinal;
      return;
    }

    case 'addFlow': {
      need(m, cmd.diagramId, 'diagram');
      const id = newId(m, 'f', cmd.id);
      const dataId = resolveData(m, cmd, created);
      m.elements[id] = {
        id,
        kind: 'dataFlow',
        ...base(cmd, ''),
        diagramId: cmd.diagramId,
        sourceId: cmd.sourceId,
        targetId: cmd.targetId,
        dataId,
        physicalName: '',
        systemRelated: cmd.systemRelated ?? false,
      };
      m.views.routes[id] = {
        flowId: id,
        sourceOccurrenceId: cmd.sourceOccurrenceId ?? firstOccurrence(m, cmd.sourceId, cmd.diagramId),
        targetOccurrenceId: cmd.targetOccurrenceId ?? firstOccurrence(m, cmd.targetId, cmd.diagramId),
        points: [],
        ...(cmd.sourceSide ? { sourceSide: cmd.sourceSide } : {}),
        ...(cmd.targetSide ? { targetSide: cmd.targetSide } : {}),
      };
      created.unshift(id);
      return;
    }

    case 'defineData': {
      const id = newId(m, 'd', cmd.id);
      m.elements[id] =
        cmd.dataKind === 'dataStructure'
          ? { id, kind: 'dataStructure', ...base(cmd, cmd.name), components: (cmd.components ?? []).map(component) }
          : {
              id,
              kind: 'dataElement',
              ...base(cmd, cmd.name),
              dataType: cmd.dataType ?? 'Text',
              ...(cmd.allowedValues ? { allowedValues: allowedValues(cmd.allowedValues) } : {}),
              length: cmd.length ?? null,
              nullable: cmd.nullable ?? null,
              ...elementDefaults(cmd.systemRelated ?? false),
            };
      created.push(id);
      return;
    }

    case 'setComposition': {
      const s = need(m, cmd.dataId, 'dataStructure');
      for (const c of cmd.components) needData(m, c.dataId);
      s.components = cmd.components.map(component);
      return;
    }

    case 'setOccurs': {
      const s = need(m, cmd.dataId, 'dataStructure');
      const c = s.components.find((x) => x.dataId === cmd.componentId);
      if (!c) refuse('That is not a part of this structure.');
      c!.occurs = cmd.occurs;
      if (cmd.limit !== undefined) {
        if (cmd.limit === null) delete c!.limit;
        else c!.limit = cmd.limit;
      }
      if (c!.occurs !== 'many') delete c!.limit;
      else if (c!.limit !== undefined) checkLimit(c!.limit);
      return;
    }

    case 'setLimit': {
      const s = need(m, cmd.dataId, 'dataStructure');
      const c = s.components.find((x) => x.dataId === cmd.componentId);
      if (!c) refuse('That is not a part of this structure.');
      if (cmd.limit === null) {
        delete c!.limit;
        return;
      }
      if (c!.occurs !== 'many') refuse('Only a part that occurs many times can have a limit.');
      checkLimit(cmd.limit);
      c!.limit = cmd.limit;
      return;
    }

    case 'rename': {
      const e = m.elements[cmd.id];
      if (!e) refuse(`There is nothing with the id '${cmd.id}'.`);
      e.name = cmd.name;
      return;
    }

    case 'describe': {
      const e = m.elements[cmd.id];
      if (!e) refuse(`There is nothing with the id '${cmd.id}'.`);
      e.description = cmd.description;
      return;
    }

    case 'setAliases': {
      const e = m.elements[cmd.id];
      if (!e) refuse(`There is nothing with the id '${cmd.id}'.`);
      const aliases: string[] = [];
      for (const raw of cmd.aliases) {
        const alias = raw.trim();
        if (alias && !aliases.some((a) => a.toLowerCase() === alias.toLowerCase())) aliases.push(alias);
      }
      e.aliases = aliases;
      return;
    }

    case 'setNotes': {
      const e = m.elements[cmd.id];
      if (!e) refuse(`There is nothing with the id '${cmd.id}'.`);
      e.notes = cmd.notes;
      return;
    }

    case 'setProcessDescription': {
      need(m, cmd.processId, 'process').processDescription = cmd.processDescription;
      return;
    }

    case 'setTopDiagram': {
      if (cmd.diagramId === null) {
        m.settings.topDiagramId = null;
        return;
      }
      const d = need(m, cmd.diagramId, 'diagram');
      m.settings.topDiagramId = d.diagramKind === 'context' ? null : d.id;
      return;
    }

    case 'setShowFindings': {
      if (cmd.showFindings !== 'always' && cmd.showFindings !== 'onRequest') refuse("Problems are shown 'always' or 'onRequest'.");
      m.settings.showFindings = cmd.showFindings;
      return;
    }

    case 'setFlowData': {
      const f = need(m, cmd.flowId, 'dataFlow');
      f.dataId = resolveData(m, cmd, created);
      return;
    }

    case 'setFlowEnds': {
      const f = need(m, cmd.flowId, 'dataFlow');
      const route = (m.views.routes[f.id] ??= { flowId: f.id, sourceOccurrenceId: null, targetOccurrenceId: null, points: [] });
      if (cmd.sourceId !== undefined) {
        f.sourceId = cmd.sourceId;
        route.sourceOccurrenceId = cmd.sourceOccurrenceId ?? firstOccurrence(m, cmd.sourceId, f.diagramId);
      } else if (cmd.sourceOccurrenceId) route.sourceOccurrenceId = cmd.sourceOccurrenceId;
      if (cmd.targetId !== undefined) {
        f.targetId = cmd.targetId;
        route.targetOccurrenceId = cmd.targetOccurrenceId ?? firstOccurrence(m, cmd.targetId, f.diagramId);
      } else if (cmd.targetOccurrenceId) route.targetOccurrenceId = cmd.targetOccurrenceId;
      return;
    }

    case 'setFlowRoute': {
      const route = m.views.routes[cmd.flowId];
      if (!route) refuse(`There is no flow with the id '${cmd.flowId}'.`);
      if (cmd.sourceSide) route.sourceSide = cmd.sourceSide;
      if (cmd.targetSide) route.targetSide = cmd.targetSide;
      if (cmd.points) route.points = cmd.points;
      return;
    }

    case 'expandProcess': {
      const p = need(m, cmd.processId, 'process');
      if (childDiagram(m, p.id)) refuse(`'${p.name}' already has a child diagram.`);
      const parent = diagramOfProcess(m, p.id);
      if (!parent) refuse('That process is not on any diagram.');
      const d: Diagram = {
        id: newId(m, 'dg', cmd.diagramId),
        kind: 'diagram',
        ...base({}, p.parentProcessId === null ? 'Level 0' : `${processNumber(m, p.id)} ${p.name}`),
        diagramKind: 'dfd',
        decomposesProcessId: p.id,
      };
      m.elements[d.id] = d;
      created.push(d.id);
      const touching = all(m, 'dataFlow').filter(
        (f) => f.diagramId === parent!.id && (f.sourceId === p.id) !== (f.targetId === p.id),
      );
      bringDown(m, p, d, touching, created);
      return;
    }

    case 'carryDown': {
      const p = need(m, cmd.processId, 'process');
      const edge = edgeFlows(m, p.id);
      if (!edge) refuse(`'${p.name}' has no child diagram yet. Expand it first.`);
      const bring: DataFlow[] = [];
      for (const isIn of [true, false]) {
        const parentFlows = isIn ? edge!.parentIn : edge!.parentOut;
        const childFlows = isIn ? edge!.childIn : edge!.childOut;
        const carried = new Set(childFlows.map((f) => f.dataId));
        const arriving = new Set<Id>();
        for (const dataId of carried) for (const id of contents(m, dataId)) arriving.add(id);
        for (const f of parentFlows) {
          // A flow of the same data already crosses the edge in this direction.
          if (carried.has(f.dataId)) continue;
          // All of it already crosses in parts, so it balances through the dictionary.
          if ([...contents(m, f.dataId)].every((id) => arriving.has(id))) continue;
          carried.add(f.dataId);
          bring.push(f);
        }
      }
      if (bring.length === 0)
        refuse(`Nothing to carry down. Every flow of '${p.name}' on the parent diagram already reaches its child diagram.`);
      bringDown(m, p, edge!.child, bring, created);
      return;
    }

    case 'removeOccurrence': {
      const o = m.views.occurrences[cmd.occurrenceId];
      if (!o) refuse(`There is no symbol with the id '${cmd.occurrenceId}'.`);
      if (m.elements[o.elementId]?.kind === 'process')
        refuse('A process is shown on one diagram only. Delete the process instead.');
      const others = occurrencesOn(m, o.diagramId).filter((x) => x.elementId === o.elementId && x.id !== o.id);
      for (const f of all(m, 'dataFlow')) {
        if (f.diagramId !== o.diagramId) continue;
        const r = m.views.routes[f.id];
        const attached =
          r?.sourceOccurrenceId === o.id ||
          r?.targetOccurrenceId === o.id ||
          (others.length === 0 && (f.sourceId === o.elementId || f.targetId === o.elementId));
        if (attached) removeElement(m, f.id);
      }
      delete m.views.occurrences[o.id];
      return;
    }

    case 'deleteElement': {
      const e = m.elements[cmd.id];
      if (!e) refuse(`There is nothing with the id '${cmd.id}'.`);
      if (e.kind === 'process' && e.parentProcessId === null) refuse('Process 0 stands for the whole system and cannot be deleted.');
      if (e.kind === 'diagram' && e.diagramKind === 'context') refuse('The context diagram cannot be deleted.');
      if (e.kind === 'module' && e.parentModuleId === null)
        refuse('This is the top module of its structure chart. Delete the chart instead.');
      if (isData(e) && !cmd.cascade) {
        const carried = all(m, 'dataFlow').filter((f) => f.dataId === e.id).length;
        const partOf = all(m, 'dataStructure').filter((s) => s.components.some((c) => c.dataId === e.id)).length;
        const attr = all(m, 'entity').some((en) => en.attributes.some((a) => a.dataId === e.id));
        const couples = all(m, 'couple').filter((c) => c.dataId === e.id).length;
        if (carried || partOf || attr || couples) {
          const why = [
            carried ? `${carried} ${carried === 1 ? 'flow carries' : 'flows carry'} it` : '',
            partOf ? `${partOf} ${partOf === 1 ? 'structure contains' : 'structures contain'} it` : '',
            attr ? 'an entity has it as an attribute' : '',
            couples ? `${couples} ${couples === 1 ? 'couple passes' : 'couples pass'} it on a structure chart` : '',
          ].filter(Boolean);
          refuse(`'${e.name}' is still in use: ${why.join(', and ')}.`);
        }
      }
      removeElement(m, cmd.id);
      return;
    }

    case 'setDataType': {
      const e = need(m, cmd.dataId, 'dataElement');
      e.dataType = cmd.dataType;
      if (cmd.allowedValues) e.allowedValues = allowedValues(cmd.allowedValues, e.allowedValues);
      return;
    }

    case 'setDataDetails': {
      const e = need(m, cmd.dataId, 'dataElement');
      if (cmd.length !== undefined) {
        if (cmd.length !== null && (!Number.isInteger(cmd.length) || cmd.length < 1))
          refuse('A length must be a whole number, 1 or more.');
        e.length = cmd.length;
      }
      if (cmd.nullable !== undefined) e.nullable = cmd.nullable;
      return;
    }

    case 'moveNode': {
      const o = m.views.occurrences[cmd.occurrenceId];
      if (!o) refuse(`There is no symbol with the id '${cmd.occurrenceId}'.`);
      o.x = cmd.x;
      o.y = cmd.y;
      return;
    }

    case 'resizeNode': {
      const o = m.views.occurrences[cmd.occurrenceId];
      if (!o) refuse(`There is no symbol with the id '${cmd.occurrenceId}'.`);
      o.width = cmd.width;
      o.height = cmd.height;
      return;
    }

    case 'addUseCase': {
      const { type: _type, id: wanted, name, description: _d, origin: _o, ...patch } = cmd;
      const id = newId(m, 'u', wanted);
      const u: UseCase = {
        id,
        kind: 'useCase',
        ...base(cmd, name),
        ordinal: Math.max(0, ...all(m, 'useCase').map((x) => x.ordinal)) + 1,
        priority: 'medium',
        actorId: null,
        trigger: '',
        triggerType: 'external',
        preconditions: [],
        postconditions: [],
        steps: [],
        summaryInputs: [],
        summaryOutputs: [],
        processId: null,
        ...patch,
        exceptions: exceptions(patch.exceptions ?? []),
      };
      m.elements[id] = u;
      created.push(id);
      return;
    }

    case 'updateUseCase': {
      const u = need(m, cmd.id, 'useCase');
      Object.assign(u, cmd.patch);
      if (cmd.patch.exceptions) u.exceptions = exceptions(cmd.patch.exceptions);
      return;
    }

    case 'addEntity': {
      const id = newId(m, 'en', cmd.id);
      const en: Entity = {
        id,
        kind: 'entity',
        ...base(cmd, cmd.name),
        code: cmd.code ?? '',
        attributes: [],
        storeId: cmd.storeId ?? null,
        systemRelated: cmd.systemRelated ?? false,
        tableName: '',
        copies: [],
        initialRecords: null,
        growthPerMonth: null,
        growthPerYear: null,
        recordSize: null,
      };
      m.elements[id] = en;
      m.views.erd[id] = { x: cmd.x ?? 60, y: cmd.y ?? 60 };
      created.push(id);
      return;
    }

    case 'updateEntity': {
      const en = need(m, cmd.id, 'entity');
      if (cmd.code !== undefined) en.code = cmd.code;
      if (cmd.storeId !== undefined) en.storeId = cmd.storeId;
      return;
    }

    case 'moveEntity': {
      need(m, cmd.entityId, 'entity');
      m.views.erd[cmd.entityId] = { x: cmd.x, y: cmd.y };
      return;
    }

    case 'addAttribute': {
      const en = need(m, cmd.entityId, 'entity');
      const dataId = resolveData(m, cmd, created, 'dataElement', cmd.dataType, cmd.systemRelated ?? false);
      if (m.elements[dataId]?.kind !== 'dataElement') refuse('An attribute must be a single data element, not a structure.');
      if (en.attributes.some((a) => a.dataId === dataId)) refuse('This entity already has that attribute.');
      en.attributes.push({ dataId, identifier: cmd.identifier ?? false, repeats: cmd.repeats ?? false });
      return;
    }

    case 'removeAttribute': {
      const en = need(m, cmd.entityId, 'entity');
      en.attributes = en.attributes.filter((a) => a.dataId !== cmd.dataId);
      for (const p of all(m, 'process')) p.crud = p.crud.filter((c) => c.dataId !== cmd.dataId);
      return;
    }

    case 'setAttributes': {
      const en = need(m, cmd.entityId, 'entity');
      const before = en.attributes;
      en.attributes = cmd.attributes.map((a) => ({
        dataId: a.dataId,
        identifier: a.identifier,
        repeats: a.repeats ?? before.find((b) => b.dataId === a.dataId)?.repeats ?? false,
      }));
      return;
    }

    case 'addRelationship': {
      const id = newId(m, 'r', cmd.id);
      const rel: Relationship = {
        id,
        kind: 'relationship',
        ...base(cmd, ''),
        ends: [relationshipEnd(cmd.ends[0]), relationshipEnd(cmd.ends[1])],
        identifying: cmd.identifying ?? false,
        foreignKey: false,
      };
      m.elements[id] = rel;
      created.push(id);
      return;
    }

    case 'updateRelationship': {
      const rel = need(m, cmd.id, 'relationship');
      if (cmd.ends) rel.ends = [relationshipEnd(cmd.ends[0]), relationshipEnd(cmd.ends[1])];
      if (cmd.identifying !== undefined) rel.identifying = cmd.identifying;
      return;
    }

    case 'setCrud': {
      const p = need(m, cmd.processId, 'process');
      const target = m.elements[cmd.dataId];
      if (!target || (target.kind !== 'dataElement' && target.kind !== 'entity'))
        refuse('A CRUD cell is for an attribute, or for an entity that has no attributes yet.');
      const uses = normalUses(cmd.uses);
      if (uses && target.kind === 'entity' && target.attributes.length > 0)
        refuse(`'${target.name}' has attributes, so fill in the cells of its attributes instead.`);
      p.crud = p.crud.filter((c) => c.dataId !== cmd.dataId);
      if (uses) p.crud.push({ dataId: cmd.dataId, uses });
      return;
    }
  }
}

// ---- Invariants (SPEC 3.4 and 9.1) ----

/** Returns a sentence naming the first broken invariant, or null if the model is sound. */
export function checkInvariants(m: Model): string | null {
  const els = Object.values(m.elements);
  if (els.length === 0) return null;
  const kindOf = (id: Id | null | undefined) => (id ? m.elements[id]?.kind : undefined);
  const dataKind = (id: Id) => isData(m.elements[id]);

  // 7. Exactly one context diagram.
  const diagrams = all(m, 'diagram');
  if (diagrams.filter((d) => d.diagramKind === 'context').length !== 1) return 'A project has exactly one context diagram.';
  const ctx = contextDiagram(m)!;
  if (m.settings.topDiagramId !== null && kindOf(m.settings.topDiagramId) !== 'diagram')
    return 'The top diagram of the project must be a diagram that exists.';

  // 4. A process is decomposed by at most one diagram.
  const decomposed = new Set<Id>();
  for (const d of diagrams) {
    if (d.diagramKind === 'context') {
      if (d.decomposesProcessId !== null) return 'The context diagram does not expand a process.';
      continue;
    }
    if (kindOf(d.decomposesProcessId) !== 'process') return 'A diagram must expand a process that exists.';
    if (decomposed.has(d.decomposesProcessId!)) return 'A process can have only one child diagram.';
    decomposed.add(d.decomposesProcessId!);
  }

  // 5, 6, 8. The process tree.
  const processes = all(m, 'process');
  if (processes.filter((p) => p.parentProcessId === null).length !== 1) return 'A project has exactly one process 0.';
  const ordinals = new Set<string>();
  for (const p of processes) {
    if (p.parentProcessId !== null) {
      if (kindOf(p.parentProcessId) !== 'process') return `The parent of '${p.name}' does not exist.`;
      let up: Process | undefined = p;
      const seen = new Set<Id>();
      while (up && up.parentProcessId !== null) {
        if (seen.has(up.id)) return 'A process cannot be its own ancestor.';
        seen.add(up.id);
        up = get(m, up.parentProcessId, 'process');
      }
    }
    const key = `${p.parentProcessId}/${p.ordinal}`;
    if (ordinals.has(key)) return `Two processes on one diagram cannot both have the number ${p.ordinal}.`;
    ordinals.add(key);
    const home = p.parentProcessId === null ? ctx : childDiagram(m, p.parentProcessId);
    const occs = occurrencesOf(m, p.id);
    if (!home || occs.length !== 1 || occs[0].diagramId !== home.id)
      return `'${p.name}' must be shown on exactly one diagram: the one that expands its parent.`;
  }

  // 1. References.
  for (const o of Object.values(m.views.occurrences)) {
    if (kindOf(o.diagramId) !== 'diagram' || !isNode(m.elements[o.elementId])) return 'A symbol refers to something that does not exist.';
  }
  for (const e of els) {
    switch (e.kind) {
      case 'dataFlow': {
        if (kindOf(e.diagramId) !== 'diagram') return 'A flow must belong to a diagram that exists.';
        if (!dataKind(e.dataId)) return 'A flow must carry a data definition that exists.';
        if (e.sourceId === null && e.targetId === null) return 'A flow needs at least one end attached.';
        const problem = checkFlowEnds(m, e);
        if (problem) return problem;
        break;
      }
      case 'controlFlow':
        if (kindOf(e.diagramId) !== 'diagram') return 'A control flow must belong to a diagram that exists.';
        if (kindOf(e.targetId) !== 'process' || !isShownOn(m, e.targetId, e.diagramId))
          return 'A control flow must lead into a process shown on its diagram.';
        break;
      case 'dataStructure':
        if (e.components.some((c) => !dataKind(c.dataId))) return `A part of '${e.name}' does not exist.`;
        break;
      case 'process':
        if (e.crud.some((c) => kindOf(c.dataId) !== 'dataElement' && kindOf(c.dataId) !== 'entity'))
          return 'A CRUD cell refers to data that does not exist.';
        break;
      case 'useCase': {
        if (e.actorId && kindOf(e.actorId) !== 'externalEntity') return 'The actor of a use case must be an external entity.';
        if (e.processId && kindOf(e.processId) !== 'process') return 'The process of a use case does not exist.';
        const ends = [...e.summaryInputs.map((i) => i.sourceId), ...e.summaryOutputs.map((o) => o.destinationId)];
        if (ends.some((id) => kindOf(id) !== 'externalEntity' && kindOf(id) !== 'dataStore'))
          return 'A source or destination on a use case must be an external entity or a data store.';
        const data = [
          ...e.summaryInputs.map((i) => i.dataId),
          ...e.summaryOutputs.map((o) => o.dataId),
          ...e.steps.flatMap((s) => s.information.map((i) => i.dataId)),
        ];
        if (data.some((id) => !dataKind(id))) return 'A use case names data that does not exist.';
        break;
      }
      case 'entity':
        // 9 and 10.
        if (e.storeId && kindOf(e.storeId) !== 'dataStore') return 'An entity can be held only in a data store.';
        for (const a of e.attributes) {
          if (kindOf(a.dataId) !== 'dataElement') return 'An attribute must be a data element that exists.';
          const owners = all(m, 'entity').filter((en) => en.attributes.some((x) => x.dataId === a.dataId));
          if (owners.length > 1 || e.attributes.filter((x) => x.dataId === a.dataId).length > 1)
            return `'${m.elements[a.dataId].name}' is already an attribute of '${owners[0].name}'. A data element can be an attribute of one entity only.`;
        }
        break;
      case 'relationship':
        if (e.ends.some((end) => kindOf(end.entityId) !== 'entity')) return 'Each end of a relationship must be an entity.';
        // 11.
        if (e.identifying && parentEnd(e) === null)
          return e.ends.some((end) => end.max === null)
            ? 'Say how many there can be at each end before making the relationship identifying.'
            : 'A many-to-many relationship has no parent, so it cannot be identifying.';
        break;
      default:
        break;
    }
  }

  // 11. No entity depends on itself through identifying relationships.
  const parentsOf = (id: Id) =>
    all(m, 'relationship')
      .filter((r) => r.identifying && parentEnd(r) !== null && r.ends[parentEnd(r) === 0 ? 1 : 0].entityId === id)
      .map((r) => r.ends[parentEnd(r)!].entityId);
  for (const en of all(m, 'entity')) {
    const stack = parentsOf(en.id);
    const seen = new Set<Id>();
    while (stack.length) {
      const id = stack.pop()!;
      if (id === en.id) return `'${en.name}' would depend on itself through identifying relationships.`;
      if (seen.has(id)) continue;
      seen.add(id);
      stack.push(...parentsOf(id));
    }
  }
  return checkRelease2(m);
}

/** Invariants 2 and 3 for one flow. */
function checkFlowEnds(m: Model, f: DataFlow): string | null {
  const diagram = get(m, f.diagramId, 'diagram')!;
  let offDiagram = 0;
  for (const endId of [f.sourceId, f.targetId]) {
    if (endId === null) continue;
    const end = m.elements[endId];
    if (!isNode(end)) return 'A flow must start and end at a process, a data store or an external entity.';
    if (isShownOn(m, endId, f.diagramId)) continue;
    const p = diagram.decomposesProcessId;
    const allowed =
      end.kind === 'process' && p !== null && endId !== p && !isAncestor(m, endId, p) && !isAncestor(m, p, endId);
    if (!allowed) return `'${end.name}' is not shown on this diagram, so a flow here cannot attach to it.`;
    offDiagram++;
  }
  if (offDiagram > 1) return 'Only one end of a flow can be a process on another diagram.';
  return null;
}

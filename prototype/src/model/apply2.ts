// The commands of the second release: SPEC sections 10 and 11. `apply.ts` hands every
// command it does not know to `runRelease2`, and calls the two other functions here when
// it deletes an element and when it checks the invariants.

import { BINDER_LAYOUTS, MIGRATION_PLAN } from './binder';
import type { CashLineInput, Release2Command, BusinessValueInput } from './commands';
import { amount, base, need, newId, refuse } from './helpers';
import { all, get, KIND_WORDS, parentEnd } from './queries';
import { NONFUNCTIONAL_SUBTYPES } from './forms';
import type {
  AlternativeMatrix,
  BusinessValue,
  CashLine,
  Element,
  Feasibility,
  Id,
  MatrixCell,
  Model,
  Module,
  Requirement,
  Test,
} from './types';
import { MAX_ATTACHMENT_BYTES, NONFUNCTIONAL_TYPES, ORGANIZATIONAL_FACTORS, TECHNICAL_FACTORS } from './types';

type ResolveData = (
  m: Model,
  cmd: { dataId?: Id; dataName?: string },
  created: Id[],
  newKind?: 'dataStructure' | 'dataElement',
  dataType?: string,
  systemRelated?: boolean,
) => Id;

// ---- Helpers ----

function businessValue(v: BusinessValue | BusinessValueInput): BusinessValue {
  return {
    text: v.text,
    tangible: v.tangible ?? false,
    amount: v.amount ?? null,
    estimates: (v.estimates ?? []).map((e) => ({ label: e.label ?? '', amount: e.amount ?? null, probability: e.probability ?? null })),
  };
}

function cashLine(input: CashLineInput, columns: number): CashLine {
  const amounts = (input.amounts ?? []).slice(0, columns).map((a) => (typeof a === 'number' && Number.isFinite(a) ? a : null));
  while (amounts.length < columns) amounts.push(null);
  return {
    name: input.name,
    amounts,
    quantity: input.quantity ?? null,
    unitAmount: input.unitAmount ?? null,
    growthRate: input.growthRate ?? null,
    valueIndex: input.valueIndex ?? null,
  };
}

function blankFeasibility(m: Model, id: Id, origin: Feasibility['origin']): Feasibility {
  return {
    id,
    kind: 'feasibility',
    ...base({ origin }, ''),
    technical: Object.fromEntries(TECHNICAL_FACTORS.map((f) => [f, { assessment: '', reasons: '' }])) as Feasibility['technical'],
    organizational: Object.fromEntries(ORGANIZATIONAL_FACTORS.map((f) => [f, ''])) as Feasibility['organizational'],
    economic: {
      firstYear: new Date().getFullYear(),
      years: 3,
      rate: null,
      benefits: [],
      developmentCosts: [],
      operationalCosts: [],
      intangibles: [],
      roi: null,
      breakEven: null,
      npv: null,
    },
  };
}

/** Makes the fields of a requirement agree with its kind. */
function tidyRequirement(r: Requirement): void {
  if (r.requirementKind !== 'functional') {
    r.functionalType = null;
    r.group = '';
    r.userGroup = '';
  }
  if (r.requirementKind !== 'nonfunctional') {
    r.nonfunctionalType = null;
    r.subtype = '';
  } else {
    r.nonfunctionalType ??= 'operational';
    if (r.subtype && !NONFUNCTIONAL_SUBTYPES[r.nonfunctionalType].includes(r.subtype)) r.subtype = '';
  }
  if (typeof r.priority === 'number' && (!Number.isInteger(r.priority) || r.priority < 1))
    refuse('A release number must be a whole number, 1 or more.');
}

function checkTrace(m: Model, ids: Id[]): Id[] {
  const out: Id[] = [];
  for (const id of ids) {
    const kind = m.elements[id]?.kind;
    if (kind !== 'useCase' && kind !== 'process') refuse('A requirement can be traced only to a use case or a process.');
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

/** Fits the cells of a matrix to its criteria and alternatives. */
function fitMatrix(x: AlternativeMatrix): void {
  const blank = (): MatrixCell => ({ supportingInformation: '', score: null });
  x.cells = x.criteria.map((_, c) =>
    x.alternatives.map((_, a) => {
      const cell = x.cells[c]?.[a];
      return cell ? { supportingInformation: cell.supportingInformation ?? '', score: cell.score ?? null } : blank();
    }),
  );
  x.criteria = x.criteria.map((c) => ({ name: c.name, group: c.group ?? 'technical', weight: c.weight ?? null }));
}

function tidyTest(m: Model, t: Test): void {
  if (!Number.isInteger(t.ordinal) || t.ordinal < 1) refuse('A test ID must be a whole number, 1 or more.');
  if (all(m, 'test').some((o) => o.id !== t.id && o.ordinal === t.ordinal)) refuse(`Another test already has the ID ${t.ordinal}.`);
  if (t.programId) need(m, t.programId, 'module');
  if (t.requirementId) need(m, t.requirementId, 'requirement');
  t.testCases = t.testCases.map((c) => {
    if (c.interfaceId) need(m, c.interfaceId, 'interface');
    return { interfaceId: c.interfaceId ?? null, interfaceText: c.interfaceText ?? '', dataField: c.dataField ?? '', valueEntered: c.valueEntered ?? '' };
  });
}

function childModules(m: Model, id: Id): Module[] {
  return all(m, 'module').filter((x) => x.parentModuleId === id);
}

function nextOrdinal(m: Model, parentId: Id): number {
  return Math.max(0, ...childModules(m, parentId).map((x) => x.ordinal)) + 1;
}

function blankModule(id: Id, cmd: { description?: string; origin?: Module['origin'] }, name: string): Module {
  return {
    id,
    kind: 'module',
    ...base(cmd, name),
    parentModuleId: null,
    ordinal: 1,
    conditional: false,
    repeated: false,
    library: false,
    repeatsId: null,
    processId: null,
    purpose: '',
    programmer: '',
    dateDue: '',
    language: '',
    events: '',
    ioNotes: [],
    pseudocode: '',
    other: '',
  };
}

/** The size in bytes of the file inside a data URL. */
function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  const header = dataUrl.slice(0, comma);
  const body = dataUrl.slice(comma + 1);
  if (!/;base64$/i.test(header)) return decodeURIComponent(body).length;
  const padding = body.endsWith('==') ? 2 : body.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((body.length * 3) / 4) - padding);
}

// ---- The commands ----

export function runRelease2(m: Model, cmd: Release2Command, created: Id[], resolveData: ResolveData): void {
  switch (cmd.type) {
    case 'renameProject': {
      const name = cmd.name.trim();
      if (!name) refuse('A project needs a name.');
      m.name = name;
      return;
    }

    case 'setPhysical': {
      const e = m.elements[cmd.id];
      if (!e) refuse(`There is nothing with the id '${cmd.id}'.`);
      const { type: _t, id: _i, ...fields } = cmd;
      const target = e as unknown as Record<string, unknown>;
      for (const [field, value] of Object.entries(fields)) {
        if (value === undefined) continue;
        if (!(field in target)) refuse(`This is ${/^[aeiou]/.test(KIND_WORDS[e.kind]) ? 'an' : 'a'} ${KIND_WORDS[e.kind]}, which has no field named '${field}'.`);
        if (field === 'averageWidth') target[field] = amount(value as number | null, 'An average width');
        else if (field === 'copies') {
          const ids = value as Id[];
          for (const id of ids) need(m, id, 'dataElement');
          target[field] = [...new Set(ids)];
        } else target[field] = value;
      }
      if (e.kind === 'process' && e.parentProcessId === null && e.systemRelated)
        refuse('Process 0 stands for the whole system, so it cannot be marked as system-related.');
      if (e.kind === 'relationship' && e.foreignKey && parentEnd(e) === null)
        refuse('A foreign key goes in the child table. This relationship has no child yet: it is many-to-many, or an end is not decided.');
      return;
    }

    case 'setStorage': {
      const en = need(m, cmd.entityId, 'entity');
      if (cmd.initialRecords !== undefined) en.initialRecords = amount(cmd.initialRecords, 'The number of records at the start', true);
      if (cmd.growthPerMonth !== undefined) en.growthPerMonth = amount(cmd.growthPerMonth, 'The growth for each month');
      if (cmd.growthPerYear !== undefined) en.growthPerYear = amount(cmd.growthPerYear, 'The growth for each year');
      if (cmd.recordSize !== undefined) en.recordSize = amount(cmd.recordSize, 'A record size');
      return;
    }

    case 'setStorageSettings': {
      if (cmd.overheadRate !== undefined) m.project.overheadRate = amount(cmd.overheadRate, 'The overhead rate');
      if (cmd.months !== undefined) m.project.months = amount(cmd.months, 'The number of months', true);
      return;
    }

    case 'updateSystemRequest': {
      let sr = all(m, 'systemRequest')[0];
      if (!sr) {
        const id = newId(m, 'sr', cmd.id);
        sr = { id, kind: 'systemRequest', ...base(cmd, ''), sponsor: '', businessNeed: '', businessRequirements: [], businessValue: [], specialIssues: '' };
        m.elements[id] = sr;
        created.push(id);
      }
      const { businessValue: values, ...rest } = cmd.patch;
      Object.assign(sr, rest);
      if (values) {
        sr.businessValue = values.map(businessValue);
        // A benefit that pointed at a value that is no longer there points at nothing.
        for (const fa of all(m, 'feasibility'))
          for (const line of fa.economic.benefits)
            if (line.valueIndex !== null && line.valueIndex >= sr.businessValue.length) line.valueIndex = null;
      }
      return;
    }

    case 'updateFeasibility': {
      let fa = all(m, 'feasibility')[0];
      if (!fa) {
        const id = newId(m, 'fa', cmd.id);
        fa = blankFeasibility(m, id, cmd.origin ?? 'student');
        m.elements[id] = fa;
        created.push(id);
      }
      for (const f of TECHNICAL_FACTORS) if (cmd.technical?.[f]) Object.assign(fa.technical[f], cmd.technical[f]);
      for (const f of ORGANIZATIONAL_FACTORS) if (cmd.organizational?.[f] !== undefined) fa.organizational[f] = cmd.organizational[f]!;
      if (cmd.economic) {
        const { benefits, developmentCosts, operationalCosts, ...rest } = cmd.economic;
        const ec = Object.assign(fa.economic, rest);
        if (!Number.isInteger(ec.firstYear)) refuse('The first year must be a whole number, such as 2027.');
        if (!Number.isInteger(ec.years) || ec.years < 1 || ec.years > 10) refuse('The table can forecast from 1 to 10 years after year 0.');
        const columns = ec.years + 1;
        ec.benefits = (benefits ?? ec.benefits).map((l) => cashLine(l, columns));
        ec.developmentCosts = (developmentCosts ?? ec.developmentCosts).map((l) => ({ ...cashLine(l, columns), valueIndex: null }));
        ec.operationalCosts = (operationalCosts ?? ec.operationalCosts).map((l) => ({ ...cashLine(l, columns), valueIndex: null }));
        const values = all(m, 'systemRequest')[0]?.businessValue ?? [];
        for (const line of ec.benefits)
          if (line.valueIndex !== null && !values[line.valueIndex]) refuse('That benefit points at a value that is not in the system request.');
      }
      return;
    }

    case 'addRequirement': {
      const { type: _t, id: wanted, name, description: _d, origin: _o, ...patch } = cmd;
      const id = newId(m, 'rq', wanted);
      const r: Requirement = {
        id,
        kind: 'requirement',
        ...base(cmd, name),
        requirementKind: 'functional',
        order: Math.max(0, ...all(m, 'requirement').map((x) => x.order)) + 1,
        functionalType: null,
        group: '',
        userGroup: '',
        nonfunctionalType: null,
        subtype: '',
        priority: null,
        ...patch,
        traceIds: checkTrace(m, patch.traceIds ?? []),
      };
      tidyRequirement(r);
      m.elements[id] = r;
      created.push(id);
      return;
    }

    case 'updateRequirement': {
      const r = need(m, cmd.id, 'requirement');
      Object.assign(r, cmd.patch);
      if (cmd.patch.traceIds) r.traceIds = checkTrace(m, cmd.patch.traceIds);
      tidyRequirement(r);
      return;
    }

    case 'reorderRequirements': {
      const every = all(m, 'requirement');
      if (cmd.ids.length !== every.length || new Set(cmd.ids).size !== every.length || every.some((r) => !cmd.ids.includes(r.id)))
        refuse('To put the requirements in a new order, list every requirement once.');
      cmd.ids.forEach((id, i) => (need(m, id, 'requirement').order = i + 1));
      return;
    }

    case 'setNoneExpected': {
      if (!NONFUNCTIONAL_TYPES.includes(cmd.nonfunctionalType)) refuse('That is not one of the four types of nonfunctional requirement.');
      const kept = m.project.noneExpected.filter((t) => t !== cmd.nonfunctionalType);
      m.project.noneExpected = cmd.noneExpected ? [...kept, cmd.nonfunctionalType] : kept;
      return;
    }

    case 'addAlternativeMatrix': {
      const id = newId(m, 'am', cmd.id);
      const x: AlternativeMatrix = {
        id,
        kind: 'alternativeMatrix',
        ...base(cmd, cmd.name),
        alternatives: cmd.alternatives ?? [],
        criteria: cmd.criteria ?? [],
        cells: cmd.cells ?? [],
        recommendation: cmd.recommendation ?? '',
      };
      fitMatrix(x);
      m.elements[id] = x;
      created.push(id);
      return;
    }

    case 'updateAlternativeMatrix': {
      const x = need(m, cmd.id, 'alternativeMatrix');
      if (cmd.alternatives) x.alternatives = cmd.alternatives;
      if (cmd.criteria) x.criteria = cmd.criteria;
      if (cmd.cells) x.cells = cmd.cells;
      if (cmd.recommendation !== undefined) x.recommendation = cmd.recommendation;
      fitMatrix(x);
      return;
    }

    case 'removeAlternative': {
      const x = need(m, cmd.id, 'alternativeMatrix');
      if (!(cmd.index in x.alternatives)) refuse('There is no such alternative in this matrix.');
      x.alternatives.splice(cmd.index, 1);
      for (const row of x.cells) row.splice(cmd.index, 1);
      return;
    }

    case 'removeCriterion': {
      const x = need(m, cmd.id, 'alternativeMatrix');
      if (!(cmd.index in x.criteria)) refuse('There is no such criterion in this matrix.');
      x.criteria.splice(cmd.index, 1);
      x.cells.splice(cmd.index, 1);
      return;
    }

    case 'addTest': {
      const { type: _t, id: wanted, name, description: _d, origin: _o, ...patch } = cmd;
      const id = newId(m, 't', wanted);
      const t: Test = {
        id,
        kind: 'test',
        ...base(cmd, name),
        ordinal: Math.max(0, ...all(m, 'test').map((x) => x.ordinal)) + 1,
        stage: 'unit',
        testType: '',
        programId: null,
        programText: '',
        version: '',
        tester: '',
        dateDesigned: '',
        dateConducted: '',
        requirementId: null,
        requirementText: '',
        objective: '',
        testCases: [],
        script: '',
        expectedResults: '',
        actualResults: '',
        result: '',
        ...patch,
      };
      tidyTest(m, t);
      m.elements[id] = t;
      created.push(id);
      return;
    }

    case 'updateTest': {
      const t = need(m, cmd.id, 'test');
      Object.assign(t, cmd.patch);
      tidyTest(m, t);
      return;
    }

    case 'addInterfaceDiagram': {
      const id = newId(m, 'isd', cmd.id);
      m.elements[id] = { id, kind: 'interfaceDiagram', ...base(cmd, cmd.name) };
      created.push(id);
      return;
    }

    case 'addInterface': {
      need(m, cmd.diagramId, 'interfaceDiagram');
      const taken = new Set(all(m, 'interface').filter((i) => i.diagramId === cmd.diagramId).map((i) => i.number));
      let number = cmd.number?.trim();
      if (!number) {
        let n = 0;
        while (taken.has(String(n))) n++;
        number = String(n);
      }
      const id = newId(m, 'if', cmd.id);
      for (const p of cmd.processIds ?? []) need(m, p, 'process');
      m.elements[id] = { id, kind: 'interface', ...base(cmd, cmd.name), diagramId: cmd.diagramId, number, processIds: [...new Set(cmd.processIds ?? [])] };
      m.views.isd[id] = { x: cmd.x ?? 60, y: cmd.y ?? 60 };
      created.push(id);
      return;
    }

    case 'updateInterface': {
      const i = need(m, cmd.id, 'interface');
      if (cmd.number !== undefined) {
        if (!cmd.number.trim()) refuse('An interface needs a number. The main menu is interface 0.');
        i.number = cmd.number.trim();
      }
      if (cmd.processIds) {
        for (const p of cmd.processIds) need(m, p, 'process');
        i.processIds = [...new Set(cmd.processIds)];
      }
      return;
    }

    case 'moveInterface': {
      need(m, cmd.interfaceId, 'interface');
      m.views.isd[cmd.interfaceId] = { x: cmd.x, y: cmd.y };
      return;
    }

    case 'addNavigationLink': {
      need(m, cmd.diagramId, 'interfaceDiagram');
      need(m, cmd.aId, 'interface');
      need(m, cmd.bId, 'interface');
      if (cmd.aId === cmd.bId) refuse('A navigation link joins two different interfaces.');
      const same = all(m, 'navigationLink').some(
        (l) => (l.aId === cmd.aId && l.bId === cmd.bId) || (l.aId === cmd.bId && l.bId === cmd.aId),
      );
      if (same) refuse('These two interfaces are already linked.');
      const id = newId(m, 'nl', cmd.id);
      m.elements[id] = { id, kind: 'navigationLink', ...base(cmd, ''), diagramId: cmd.diagramId, aId: cmd.aId, bId: cmd.bId };
      created.push(id);
      return;
    }

    case 'addBinderSection': {
      const layout = cmd.layout ? BINDER_LAYOUTS.find((l) => l.key === cmd.layout) : undefined;
      if (cmd.layout && !layout) refuse(`There is no starting layout named '${cmd.layout}'.`);
      const id = newId(m, 'b', cmd.id);
      m.elements[id] = {
        id,
        kind: 'binderSection',
        ...base(cmd, cmd.name.trim() || layout?.title || 'Untitled section'),
        phase: cmd.phase ?? layout?.phase ?? 'planning',
        order: Math.max(0, ...all(m, 'binderSection').map((s) => s.order)) + 1,
        body: cmd.body ?? layout?.body ?? '',
        attachments: [],
        layout: layout?.key ?? null,
        conversion: layout?.key === MIGRATION_PLAN ? { style: null, location: null, modules: null, reasons: '' } : null,
      };
      created.push(id);
      return;
    }

    case 'updateBinderSection': {
      const s = need(m, cmd.id, 'binderSection');
      if (cmd.phase) s.phase = cmd.phase;
      if (cmd.body !== undefined) s.body = cmd.body;
      return;
    }

    case 'reorderBinderSections': {
      const every = all(m, 'binderSection');
      if (cmd.ids.length !== every.length || new Set(cmd.ids).size !== every.length || every.some((s) => !cmd.ids.includes(s.id)))
        refuse('To put the binder in a new order, list every section once.');
      cmd.ids.forEach((id, i) => (need(m, id, 'binderSection').order = i + 1));
      return;
    }

    case 'addAttachment': {
      const s = need(m, cmd.sectionId, 'binderSection');
      const header = /^data:([^;,]*)[^,]*,/.exec(cmd.dataUrl);
      if (!header) refuse(`'${cmd.name}' could not be read as a file.`);
      const size = dataUrlBytes(cmd.dataUrl);
      if (size > MAX_ATTACHMENT_BYTES)
        refuse(
          `'${cmd.name}' is too big to keep here. This prototype saves the project in the browser, so a file can be at most ${Math.round(MAX_ATTACHMENT_BYTES / 1024)} KB, and this one is ${Math.ceil(size / 1024)} KB.`,
        );
      const attachmentId = cmd.attachmentId ?? `at${m.nextId++}`;
      if (s.attachments.some((a) => a.id === attachmentId)) refuse(`The id '${attachmentId}' is already in use.`);
      s.attachments.push({
        id: attachmentId,
        name: cmd.name,
        mimeType: cmd.mimeType || header![1] || 'application/octet-stream',
        size,
        dataUrl: cmd.dataUrl,
      });
      return;
    }

    case 'removeAttachment': {
      const s = need(m, cmd.sectionId, 'binderSection');
      if (!s.attachments.some((a) => a.id === cmd.attachmentId)) refuse('That file is not attached to this section.');
      s.attachments = s.attachments.filter((a) => a.id !== cmd.attachmentId);
      return;
    }

    case 'setConversion': {
      const s = need(m, cmd.sectionId, 'binderSection');
      if (!s.conversion) refuse('Only a migration plan has a conversion strategy. Add a section from the "Migration plan" layout.');
      const { type: _t, sectionId: _s, ...patch } = cmd;
      Object.assign(s.conversion!, patch);
      return;
    }

    case 'addStructureChart': {
      if (cmd.processId) need(m, cmd.processId, 'process');
      if (cmd.ordinal !== undefined && (!Number.isInteger(cmd.ordinal) || cmd.ordinal < 0)) refuse('A module number must be a whole number.');
      const chartId = newId(m, 'sc', cmd.id);
      const moduleId = newId(m, 'm', cmd.moduleId);
      m.elements[moduleId] = {
        ...blankModule(moduleId, { origin: cmd.origin }, cmd.moduleName ?? cmd.name),
        ordinal: cmd.ordinal ?? 1,
        processId: cmd.processId ?? null,
      };
      m.elements[chartId] = { id: chartId, kind: 'structureChart', ...base(cmd, cmd.name), topModuleId: moduleId };
      created.push(chartId, moduleId);
      return;
    }

    case 'addModule': {
      const parent = need(m, cmd.parentModuleId, 'module');
      if (parent.repeatsId) refuse(`'${parent.name}' is one more appearance of another module, so it has nothing below it.`);
      const { type: _t, id: wanted, name, description: _d, origin: _o, parentModuleId, ...patch } = cmd;
      const id = newId(m, 'm', wanted);
      const mod: Module = { ...blankModule(id, cmd, name), parentModuleId, ...patch, ordinal: patch.ordinal ?? nextOrdinal(m, parentModuleId) };
      m.elements[id] = mod;
      tidyModule(m, mod);
      created.push(id);
      return;
    }

    case 'updateModule': {
      const mod = need(m, cmd.id, 'module');
      if (cmd.patch.parentModuleId !== undefined && cmd.patch.parentModuleId !== mod.parentModuleId) {
        if (mod.parentModuleId === null) refuse('The top module of a chart cannot be moved under another module.');
        if (cmd.patch.parentModuleId === null) refuse('A chart has one top module. To start another chart, add a structure chart.');
        if (need(m, cmd.patch.parentModuleId, 'module').repeatsId) refuse('A box that repeats another module has nothing below it.');
      }
      Object.assign(mod, cmd.patch);
      tidyModule(m, mod);
      return;
    }

    case 'setProgramSpec': {
      const mod = need(m, cmd.moduleId, 'module');
      if (mod.repeatsId) refuse('This box repeats another module. Write the specification on that module.');
      Object.assign(mod, cmd.patch);
      if (cmd.patch.ioNotes) {
        for (const n of mod.ioNotes) need(m, n.coupleId, 'couple');
        mod.ioNotes = mod.ioNotes.filter((n) => n.notes.trim());
      }
      return;
    }

    case 'addCouple': {
      const mod = need(m, cmd.moduleId, 'module');
      if (mod.parentModuleId === null) refuse('The top module has no line above it, so nothing can be passed along one.');
      const id = newId(m, 'cp', cmd.id);
      const dataId = cmd.coupleKind === 'data' ? resolveData(m, cmd, created, 'dataElement') : null;
      m.elements[id] = {
        id,
        kind: 'couple',
        ...base(cmd, cmd.coupleKind === 'control' ? (cmd.name ?? '') : ''),
        moduleId: cmd.moduleId,
        direction: cmd.direction,
        coupleKind: cmd.coupleKind,
        dataId,
      };
      created.unshift(id);
      return;
    }

    case 'updateCouple': {
      const c = need(m, cmd.id, 'couple');
      if (cmd.direction) c.direction = cmd.direction;
      const kind = cmd.coupleKind ?? c.coupleKind;
      if (kind === 'control') {
        c.coupleKind = 'control';
        c.dataId = null;
      } else if (cmd.dataId || cmd.dataName || c.coupleKind !== 'data') {
        c.dataId = resolveData(m, cmd, created, 'dataElement');
        c.coupleKind = 'data';
        c.name = '';
      }
      return;
    }
  }
}

function tidyModule(m: Model, mod: Module): void {
  if (!Number.isInteger(mod.ordinal) || mod.ordinal < 0) refuse('A module number must be a whole number.');
  if (mod.parentModuleId && childModules(m, mod.parentModuleId).some((x) => x.id !== mod.id && x.ordinal === mod.ordinal))
    refuse(`Another module under the same control module already has the number ${mod.ordinal}.`);
  if (mod.processId) need(m, mod.processId, 'process');
  if (mod.repeatsId) {
    const original = need(m, mod.repeatsId, 'module');
    if (original.id === mod.id) refuse('A module cannot repeat itself.');
    if (original.repeatsId) refuse(`'${original.name}' is itself a repeat. Choose the module it repeats.`);
    if (mod.parentModuleId === null) refuse('The top module of a chart cannot repeat another module.');
    if (childModules(m, mod.id).length > 0) refuse('A box that repeats another module has nothing below it. Remove the modules below it first.');
    if (all(m, 'module').some((x) => x.repeatsId === mod.id)) refuse('Other boxes repeat this module, so it cannot itself repeat another.');
  }
}

// ---- Deleting ----

/**
 * Called just before an element is removed. Clears what points at it, and removes what
 * cannot exist without it through `remove`.
 */
export function removeRelease2(m: Model, e: Element, remove: (id: Id) => void): void {
  const id = e.id;
  switch (e.kind) {
    case 'process':
      for (const i of all(m, 'interface')) i.processIds = i.processIds.filter((p) => p !== id);
      for (const mod of all(m, 'module')) if (mod.processId === id) mod.processId = null;
      for (const r of all(m, 'requirement')) r.traceIds = r.traceIds.filter((t) => t !== id);
      break;
    case 'useCase':
      for (const r of all(m, 'requirement')) r.traceIds = r.traceIds.filter((t) => t !== id);
      break;
    case 'dataStructure':
    case 'dataElement':
      for (const c of all(m, 'couple')) if (c.dataId === id) remove(c.id);
      for (const en of all(m, 'entity')) en.copies = en.copies.filter((c) => c !== id);
      break;
    case 'systemRequest':
      for (const fa of all(m, 'feasibility')) for (const line of fa.economic.benefits) line.valueIndex = null;
      break;
    case 'requirement':
      for (const t of all(m, 'test'))
        if (t.requirementId === id) {
          t.requirementId = null;
          t.requirementText ||= e.name;
        }
      break;
    case 'interfaceDiagram':
      for (const l of all(m, 'navigationLink')) if (l.diagramId === id) delete m.elements[l.id];
      for (const i of all(m, 'interface')) if (i.diagramId === id) remove(i.id);
      break;
    case 'interface':
      for (const l of all(m, 'navigationLink')) if (l.aId === id || l.bId === id) delete m.elements[l.id];
      for (const t of all(m, 'test'))
        for (const c of t.testCases)
          if (c.interfaceId === id) {
            c.interfaceId = null;
            c.interfaceText ||= e.name;
          }
      delete m.views.isd[id];
      break;
    case 'structureChart':
      remove(e.topModuleId);
      break;
    case 'module':
      for (const child of childModules(m, id)) remove(child.id);
      for (const other of all(m, 'module')) if (other.repeatsId === id) remove(other.id);
      for (const c of all(m, 'couple')) if (c.moduleId === id) remove(c.id);
      for (const t of all(m, 'test'))
        if (t.programId === id) {
          t.programId = null;
          t.programText ||= e.name;
        }
      break;
    case 'couple':
      for (const mod of all(m, 'module')) mod.ioNotes = mod.ioNotes.filter((n) => n.coupleId !== id);
      break;
    default:
      break;
  }
}

// ---- Invariants (SPEC 10.6 and 11.3, and the references of the forms) ----

export function checkRelease2(m: Model): string | null {
  const kindOf = (id: Id | null | undefined) => (id ? m.elements[id]?.kind : undefined);
  if (all(m, 'systemRequest').length > 1) return 'A project has one system request.';
  if (all(m, 'feasibility').length > 1) return 'A project has one feasibility analysis.';

  for (const r of all(m, 'requirement'))
    if (r.traceIds.some((id) => kindOf(id) !== 'useCase' && kindOf(id) !== 'process'))
      return 'A requirement is traced to something that does not exist.';

  for (const t of all(m, 'test')) {
    if (t.programId && kindOf(t.programId) !== 'module') return 'A test names a program that does not exist.';
    if (t.requirementId && kindOf(t.requirementId) !== 'requirement') return 'A test names a requirement that does not exist.';
    if (t.testCases.some((c) => c.interfaceId && kindOf(c.interfaceId) !== 'interface')) return 'A test case names an interface that does not exist.';
  }

  const numbers = new Set<string>();
  for (const i of all(m, 'interface')) {
    if (kindOf(i.diagramId) !== 'interfaceDiagram') return 'An interface must belong to an interface structure diagram that exists.';
    if (i.processIds.some((p) => kindOf(p) !== 'process')) return 'An interface names a process that does not exist.';
    const key = `${i.diagramId}/${i.number}`;
    if (numbers.has(key)) return `Two interfaces on one diagram cannot both have the number ${i.number}.`;
    numbers.add(key);
  }
  for (const l of all(m, 'navigationLink')) {
    const a = get(m, l.aId, 'interface');
    const b = get(m, l.bId, 'interface');
    if (!a || !b || a.diagramId !== l.diagramId || b.diagramId !== l.diagramId || a.id === b.id)
      return 'A navigation link joins two interfaces on its own diagram.';
  }

  for (const en of all(m, 'entity'))
    if (en.copies.some((c) => kindOf(c) !== 'dataElement')) return 'A table repeats a field that does not exist.';

  const modules = all(m, 'module');
  const tops = new Map<Id, number>();
  for (const c of all(m, 'structureChart')) {
    const top = get(m, c.topModuleId, 'module');
    if (!top || top.parentModuleId !== null) return 'A structure chart must have a top module.';
    tops.set(top.id, (tops.get(top.id) ?? 0) + 1);
  }
  const ordinals = new Set<string>();
  for (const mod of modules) {
    if (mod.parentModuleId === null) {
      if (tops.get(mod.id) !== 1) return 'Every module belongs to one structure chart.';
    } else {
      const parent = get(m, mod.parentModuleId, 'module');
      if (!parent) return `The control module of '${mod.name}' does not exist.`;
      if (parent.repeatsId) return 'A box that repeats another module has nothing below it.';
      let up: Module | undefined = mod;
      const seen = new Set<Id>();
      while (up && up.parentModuleId !== null) {
        if (seen.has(up.id)) return 'A module cannot be below itself.';
        seen.add(up.id);
        up = get(m, up.parentModuleId, 'module');
      }
      const key = `${mod.parentModuleId}/${mod.ordinal}`;
      if (ordinals.has(key)) return `Two modules under one control module cannot both have the number ${mod.ordinal}.`;
      ordinals.add(key);
    }
    if (mod.repeatsId) {
      const original = get(m, mod.repeatsId, 'module');
      if (!original || original.repeatsId || original.id === mod.id) return 'A box can repeat only a module that is not itself a repeat.';
    }
    if (mod.processId && kindOf(mod.processId) !== 'process') return 'A module names a process that does not exist.';
  }
  for (const c of all(m, 'couple')) {
    const mod = get(m, c.moduleId, 'module');
    if (!mod) return 'A couple must belong to a module that exists.';
    if (mod.parentModuleId === null) return 'The top module has no line above it, so it has no couples.';
    if (c.coupleKind === 'data' && kindOf(c.dataId) !== 'dataStructure' && kindOf(c.dataId) !== 'dataElement')
      return 'A data couple must carry a data definition that exists.';
  }
  return null;
}

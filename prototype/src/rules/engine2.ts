// The rules of SPEC sections 10 and 11: the forms, the interface structure diagram, the
// physical data flow diagram, the structure chart, the program specification, the
// physical data model and the storage size estimate.

import { cashFlow, checkMeasures, expectedValue, formatNumber, matrixScores, probabilityTotal, type MeasureCheck } from '../model/calc';
import { all, childDiagram, contextDiagram, fullIdentifier, leafProcesses, parentEnd, processesOn, rootProcess } from '../model/queries';
import {
  chartOfModule,
  feasibility,
  interfaceReach,
  interfacesOn,
  moduleChildren,
  moduleNumber,
  originalModule,
  processesBelow,
  requirementsFor,
  requirementsOutline,
  systemRequest,
  tableFields,
} from '../model/queries2';
import { FACTOR_WORDS, ORGANIZATIONAL_FACTORS, TECHNICAL_FACTORS, type Id, type Mode, type Model } from '../model/types';
import type { Add, FindingArea } from './engine';

function joinWords(words: string[], last = 'and'): string {
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} ${last} ${words[words.length - 1]}`;
}

/** True once any physical field of the data flow diagrams has been filled in. */
export function physicalDfdStarted(model: Model): boolean {
  return (
    all(model, 'process').some((p) => p.implementation.trim() || p.human || p.systemRelated) ||
    all(model, 'externalEntity').some((x) => x.human) ||
    all(model, 'dataStore').some((s) => s.physicalName.trim() || s.systemRelated) ||
    all(model, 'dataFlow').some((f) => f.physicalName.trim() || f.systemRelated)
  );
}

/** True once any physical field of the data model has been filled in. */
export function physicalDataModelStarted(model: Model): boolean {
  const entities = all(model, 'entity');
  const attributes = new Set(entities.flatMap((en) => en.attributes.map((a) => a.dataId)));
  return (
    entities.some((en) => en.tableName.trim() || en.systemRelated || en.copies.length > 0) ||
    all(model, 'relationship').some((r) => r.foreignKey) ||
    all(model, 'dataElement').some((e) => attributes.has(e.id) && (e.fieldName.trim() || e.systemRelated))
  );
}

/** True once any figure of the storage size estimate has been typed. */
export function storageStarted(model: Model): boolean {
  return (
    model.project.overheadRate !== null ||
    model.project.months !== null ||
    all(model, 'entity').some((en) => en.initialRecords !== null || en.growthPerMonth !== null || en.growthPerYear !== null || en.recordSize !== null) ||
    all(model, 'dataElement').some((e) => e.averageWidth !== null)
  );
}

export function release2Rules(model: Model, mode: Mode, add: Add, homeOf: (id: Id) => Id | FindingArea, topDiagramId: Id | null): void {
  const name = (id: Id | null | undefined) => (id ? (model.elements[id]?.name ?? '') : '');

  // ---- System request: SR-01 to SR-03 ----
  const sr = systemRequest(model);
  if (sr) {
    const empty: [string, boolean][] = [
      ['project sponsor', !sr.sponsor.trim()],
      ['business need', !sr.businessNeed.trim()],
      ['business requirements', !sr.businessRequirements.some((r) => r.trim())],
      ['business value', !sr.businessValue.some((v) => v.text.trim())],
      ['special issues or constraints', !sr.specialIssues.trim()],
    ];
    for (const [field, isEmpty] of empty) if (isEmpty) add('SR-01', [sr.id], 'systemRequest', { field }, field);
    sr.businessValue.forEach((v, index) => {
      if (v.estimates.length === 0) return;
      const total = probabilityTotal(v.estimates);
      if (Math.abs(total - 100) > 1e-9) add('SR-02', [sr.id], 'systemRequest', { text: v.text, total: formatNumber(total, total % 1 ? 1 : 0), index }, String(index));
      const expected = expectedValue(v.estimates);
      if (v.amount === null || Math.abs(v.amount - expected) > 1 + 1e-9) {
        const steps = v.estimates.map((e) => `${formatNumber(e.amount ?? 0)} × ${formatNumber(e.probability ?? 0)}%`);
        add(
          'SR-03',
          [sr.id],
          'systemRequest',
          {
            text: v.text,
            typed: v.amount === null ? 'empty' : formatNumber(v.amount),
            expected,
            index,
            working: `${steps.join(' + ')} = ${formatNumber(expected)}`,
          },
          String(index),
        );
      }
    });
  }

  // ---- Feasibility analysis: FA-01 to FA-05 ----
  const fa = feasibility(model);
  if (fa) {
    const noTechnical = TECHNICAL_FACTORS.filter((f) => !fa.technical[f].assessment.trim());
    const noOrganizational = ORGANIZATIONAL_FACTORS.filter((f) => !fa.organizational[f].trim());
    const whollyEmpty =
      noTechnical.length === TECHNICAL_FACTORS.length &&
      noOrganizational.length === ORGANIZATIONAL_FACTORS.length &&
      TECHNICAL_FACTORS.every((f) => !fa.technical[f].reasons.trim());
    // A cost-benefit analysis alone leaves both parts empty, and that is not a problem.
    if (!whollyEmpty) {
      if (noTechnical.length)
        add('FA-01', [fa.id], 'feasibility', { part: 'technical', factors: joinWords(noTechnical.map((f) => FACTOR_WORDS[f])), missing: noTechnical }, 'technical');
      if (noOrganizational.length)
        add(
          'FA-01',
          [fa.id],
          'feasibility',
          { part: 'organizational', factors: joinWords(noOrganizational.map((f) => FACTOR_WORDS[f])), missing: noOrganizational },
          'organizational',
        );
    }
    const checks = checkMeasures(fa.economic);
    const report = (ruleId: string, check: MeasureCheck, mismatch = '') => {
      if (check.status !== 'mismatch' && check.status !== 'none') return;
      add(ruleId, [fa.id], 'feasibility', {
        typed: check.typedText,
        expected: check.expected,
        mismatch,
        working: check.working.join(' '),
        steps: check.working,
      });
    };
    report('FA-02', checks.roi);
    report(
      'FA-03',
      checks.breakEven,
      checks.breakEven.status === 'none' ? 'cannot be right, because the cumulative net cash flow never turns positive' : 'does not match the table',
    );
    report('FA-04', checks.npv);
    if (sr) {
      const flow = cashFlow(fa.economic);
      fa.economic.benefits.forEach((line, index) => {
        const value = line.valueIndex === null ? undefined : sr.businessValue[line.valueIndex];
        if (!value || value.amount === null) return;
        const first = flow.lines.benefits[index][1] ?? 0;
        if (Math.abs(first - value.amount) > 1 + 1e-9)
          add(
            'FA-05',
            [fa.id, sr.id],
            'feasibility',
            { name: line.name, amount: formatNumber(first), value: formatNumber(value.amount), text: value.text, index },
            String(index),
          );
      });
    }
  }

  // ---- Requirements definition: RQ-01 to RQ-03 ----
  const outline = requirementsOutline(model);
  const functional = outline.functional.flatMap((g) => g.requirements);
  const hasRequirements = all(model, 'requirement').length > 0;
  for (const { requirement, number } of functional)
    if (requirement.traceIds.length === 0) add('RQ-01', [requirement.id], 'requirements', { number, name: requirement.name });
  if (hasRequirements) {
    for (const u of all(model, 'useCase')) if (requirementsFor(model, u.id).length === 0) add('RQ-02', [u.id], 'requirements', { name: u.name });
    for (const group of outline.nonfunctional)
      if (group.requirements.length === 0 && !group.noneExpected) add('RQ-03', [], 'requirements', { type: group.type }, group.type);
  }

  // ---- Alternative matrix: AM-01 to AM-03 ----
  for (const x of all(model, 'alternativeMatrix')) {
    const { weightTotal } = matrixScores(x);
    if (Math.abs(weightTotal - 100) > 1e-9) add('AM-01', [x.id], 'alternatives', { name: x.name, total: formatNumber(weightTotal, weightTotal % 1 ? 1 : 0) }, '', x.id);
    const badScores: { criterion: number; alternative: number }[] = [];
    const noSupport: { criterion: number; alternative: number }[] = [];
    x.cells.forEach((row, criterion) =>
      row.forEach((cell, alternative) => {
        const s = cell.score;
        if (s === null || !Number.isInteger(s) || s < 1 || s > 5) badScores.push({ criterion, alternative });
        if (!cell.supportingInformation.trim()) noSupport.push({ criterion, alternative });
      }),
    );
    if (badScores.length)
      add('AM-02', [x.id], 'alternatives', { name: x.name, count: badScores.length, scores: badScores.length === 1 ? 'score' : 'scores', cells: badScores }, '', x.id);
    if (noSupport.length)
      add('AM-03', [x.id], 'alternatives', { name: x.name, count: noSupport.length, cells: noSupport.length === 1 ? 'cell' : 'cells', where: noSupport }, '', x.id);
  }

  // ---- Test plan: TP-01 and TP-02 ----
  const tests = all(model, 'test');
  for (const t of tests) {
    const missing = [
      !t.objective.trim() && 'objective',
      t.testCases.length === 0 && !t.script.trim() && 'test cases or script',
      !t.expectedResults.trim() && 'expected results',
    ].filter((x): x is string => !!x);
    if (missing.length) add('TP-01', [t.id], 'testPlan', { number: `T-${t.ordinal}`, name: t.name, missing: joinWords(missing, 'and no'), fields: missing }, '', t.id);
  }
  if (tests.length > 0)
    for (const { requirement, number } of functional)
      if (!tests.some((t) => t.requirementId === requirement.id)) add('TP-02', [requirement.id], 'testPlan', { number, name: requirement.name });

  // ---- Interface structure diagram: ISD-01 to ISD-04 ----
  const diagrams = all(model, 'interfaceDiagram');
  const root = rootProcess(model);
  const level0 = root ? childDiagram(model, root.id) : undefined;
  const level0Processes = level0 ? processesOn(model, level0.id) : [];
  for (const d of diagrams) {
    const reach = interfaceReach(model, d.id);
    if (!reach.menu) {
      add('ISD-01', [d.id], 'interface', { name: d.name }, '', d.id);
      continue;
    }
    for (const i of interfacesOn(model, d.id)) {
      if (!reach.distance.has(i.id)) add('ISD-02', [i.id], 'interface', { name: i.name, number: i.number }, '', d.id);
      else if (level0Processes.length > 0 && reach.below(i.id).length === 0 && i.processIds.length === 0)
        add('ISD-03', [i.id], 'interface', { name: i.name, number: i.number }, '', d.id);
    }
  }
  if (diagrams.length > 0) {
    const carried = new Set(all(model, 'interface').flatMap((i) => i.processIds));
    for (const p of level0Processes)
      if (!processesBelow(model, p.id).some((id) => carried.has(id))) add('ISD-04', [p.id], 'interface', { name: p.name });
  }

  // ---- Structure chart and program specification: SC-01 to SC-07 and PS-01 ----
  const modules = all(model, 'module');
  const chartId = (moduleId: Id) => chartOfModule(model, moduleId)?.id ?? null;
  const groups = new Map<string, Id[]>();
  for (const m of modules) {
    const home = chartId(m.id);
    const children = moduleChildren(model, m.id);
    if (children.length > 7 && !children.every((c) => c.conditional)) add('SC-03', [m.id], 'structure', { name: m.name, count: children.length }, '', home);
    if (m.repeatsId) continue;
    // A box that repeats another module takes its name and its specification from it.
    if (!m.name.trim()) add('SC-01', [m.id], 'structure', { what: `Module ${moduleNumber(model, m.id)}` }, '', home);
    else groups.set(m.name.trim().toLowerCase(), [...(groups.get(m.name.trim().toLowerCase()) ?? []), m.id]);
    if (/\band\b/i.test(m.name)) add('SC-04', [m.id], 'structure', { name: m.name }, '', home);
    const boxes = modules.filter((o) => o.repeatsId === m.id);
    if (boxes.length > 0 && !m.library) add('SC-06', [m.id, ...boxes.map((b) => b.id)], 'structure', { name: m.name, count: boxes.length + 1 }, '', home);
    const missing = [!m.purpose.trim() && 'purpose', !m.pseudocode.trim() && 'pseudocode'].filter((x): x is string => !!x);
    if (missing.length) add('PS-01', [m.id], 'structure', { name: m.name, missing: joinWords(missing, 'and no'), fields: missing }, '', home);
  }
  for (const ids of groups.values()) if (ids.length > 1) add('SC-05', ids, 'structure', { name: name(ids[0]) }, '', chartId(ids[0]));
  for (const c of all(model, 'couple')) {
    if (c.coupleKind !== 'control') continue;
    const module = originalModule(model, c.moduleId)?.name ?? '';
    const home = chartId(c.moduleId);
    if (!c.name.trim()) add('SC-01', [c.id, c.moduleId], 'structure', { what: `A control couple on the line above '${module}'` }, '', home);
    if (c.direction === 'down') add('SC-02', [c.id, c.moduleId], 'structure', { name: c.name, module }, '', home);
  }
  if (all(model, 'structureChart').length > 0) {
    const carried = new Set(modules.map((m) => m.processId).filter(Boolean));
    for (const p of leafProcesses(model)) if (!carried.has(p.id)) add('SC-07', [p.id], 'structure', { name: p.name });
  }

  if (mode !== 'physical') return;

  // ---- Physical data flow diagram: PD-01 to PD-03 ----
  if (physicalDfdStarted(model)) {
    const processes = all(model, 'process');
    for (const p of processes) if (!p.implementation.trim() && !p.human) add('PD-01', [p.id], homeOf(p.id), { name: p.name });
    for (const s of all(model, 'dataStore'))
      if (!s.physicalName.trim()) add('PD-02', [s.id], homeOf(s.id), { what: `The data store '${s.name}'`, name: s.name });
    for (const f of all(model, 'dataFlow'))
      if (!f.physicalName.trim()) add('PD-02', [f.id, f.dataId], f.diagramId, { what: `The flow '${name(f.dataId)}'`, name: name(f.dataId) });
    const where = topDiagramId ?? contextDiagram(model)?.id;
    if (where && !processes.some((p) => p.human) && !all(model, 'externalEntity').some((x) => x.human)) add('PD-03', [where], where, {});
  }

  // ---- Physical data model: PDM-01 to PDM-04 ----
  const entities = all(model, 'entity');
  if (physicalDataModelStarted(model)) {
    const tableNames = new Map<string, Id[]>();
    for (const en of entities) {
      const own = en.attributes.map((a) => model.elements[a.dataId]).filter((e) => e?.kind === 'dataElement');
      const noFieldName = own.filter((e) => !e.fieldName.trim());
      const noType = own.filter((e) => !e.dataType.trim());
      const missing = [
        !en.tableName.trim() && 'table name',
        noFieldName.length > 0 && `field name for ${joinWords(noFieldName.map((e) => e.name))}`,
        noType.length > 0 && `data type for ${joinWords(noType.map((e) => e.name))}`,
      ].filter((x): x is string => !!x);
      if (missing.length)
        add('PDM-01', [en.id, ...new Set([...noFieldName, ...noType].map((e) => e.id))], 'dataModel', { name: en.name, missing: joinWords(missing, 'and no') });
      if (fullIdentifier(model, en.id).length === 0) add('PDM-02', [en.id], 'dataModel', { name: en.name });
      const table = en.tableName.trim().toLowerCase();
      if (table) tableNames.set(table, [...(tableNames.get(table) ?? []), en.id]);
      const fieldNames = new Map<string, Id[]>();
      for (const f of tableFields(model, en.id)) {
        const field = f.element.fieldName.trim().toLowerCase();
        if (field) fieldNames.set(field, [...(fieldNames.get(field) ?? []), f.dataId]);
      }
      for (const ids of fieldNames.values())
        if (ids.length > 1)
          add('PDM-04', [en.id, ...ids], 'dataModel', { what: `Two fields of '${en.name}'`, name: (model.elements[ids[0]] as { fieldName: string }).fieldName }, ids[0]);
    }
    for (const ids of tableNames.values())
      if (ids.length > 1) add('PDM-04', ids, 'dataModel', { what: 'Two tables', name: (model.elements[ids[0]] as { tableName: string }).tableName });
    for (const rel of all(model, 'relationship')) {
      const p = parentEnd(rel);
      if (p === null || rel.foreignKey) continue;
      const [a, b] = rel.ends;
      add('PDM-03', [rel.id, a.entityId, b.entityId], 'dataModel', { first: name(a.entityId), second: name(b.entityId), child: name(rel.ends[p === 0 ? 1 : 0].entityId) });
    }
  }

  // ---- Storage size estimate: VOL-01 ----
  if (storageStarted(model)) {
    for (const en of entities) {
      const fields = tableFields(model, en.id);
      const noWidth = fields.filter((f) => f.element.averageWidth === null);
      const missing = [
        fields.length === 0 && en.recordSize === null && 'record size',
        noWidth.length > 0 && `average width for ${joinWords(noWidth.map((f) => f.element.name))}`,
        en.initialRecords === null && 'number of records at the start',
      ].filter((x): x is string => !!x);
      if (missing.length) add('VOL-01', [en.id, ...noWidth.map((f) => f.dataId)], 'storage', { name: en.name, missing: joinWords(missing, 'and no') });
    }
  }
}

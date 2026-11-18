// The rule engine against the cases of docs/SPEC.md section 6, and the sample data.

import { describe, expect, it } from 'vitest';
import { apply, checkInvariants } from '../model/apply';
import type { Command } from '../model/commands';
import { all, childDiagram, dataDefinitions, flowsOn, getOutline } from '../model/queries';
import { emptyModel, type Id, type Model } from '../model/types';
import { buildClinic, CLINIC, dataIdOf, sampleModel } from '../sample/clinic';
import { isBalanceFinding, runRules, type Finding } from './engine';

function run(model: Model, command: Command): Model {
  const r = apply(model, command);
  if (!r.ok) throw new Error(`${command.type} was refused: ${r.error}`);
  return r.model;
}

function created(model: Model, command: Command): { model: Model; ids: Id[] } {
  const r = apply(model, command);
  if (!r.ok) throw new Error(`${command.type} was refused: ${r.error}`);
  return { model: r.model, ids: r.created };
}

/** The rule ids of the findings, sorted, for comparing with what a case expects. */
function ids(findings: Finding[]): string[] {
  return findings.map((f) => f.ruleId).sort();
}

function only(findings: Finding[], ruleId: string): Finding[] {
  return findings.filter((f) => f.ruleId === ruleId);
}

const did = (name: string) => `d-${name.toLowerCase().replace(/ /g, '-')}`;

type FlowRow = [from: string, to: string, data: string];

interface TwoLevel {
  project: string;
  system: string;
  externals: string[];
  stores: string[];
  processes: string[];
  context: FlowRow[];
  level0: FlowRow[];
}

/**
 * Builds a two-level model by commands. Every data definition is a structure with one
 * element of its own, and every element has a description. Ids: process n is "p<n>",
 * an external entity or data store is its name in lower case, a diagram is "ctx" or "l0".
 */
function buildTwoLevel(spec: TwoLevel): Model {
  let m = emptyModel();
  const node = (name: string) => (/^\d+$/.test(name) ? `p${name}` : name.toLowerCase());
  m = run(m, { type: 'createProject', name: spec.project, systemName: spec.system, id: 'ctx', processId: 'p0', description: 'The system.' });
  const names = new Set([...spec.context, ...spec.level0].map((r) => r[2]));
  for (const name of names) {
    m = run(m, { type: 'defineData', dataKind: 'dataElement', id: `${did(name)}-item`, name: `${name} Item`, description: 'An item.' });
    m = run(m, {
      type: 'defineData',
      dataKind: 'dataStructure',
      id: did(name),
      name,
      description: 'A structure.',
      components: [{ dataId: `${did(name)}-item`, occurs: 'once' }],
    });
  }
  for (const name of spec.externals)
    m = run(m, { type: 'addExternalEntity', diagramId: 'ctx', id: node(name), name, description: 'An outside party.' });
  for (const [from, to, data] of spec.context)
    m = run(m, { type: 'addFlow', diagramId: 'ctx', sourceId: node(from), targetId: node(to), dataId: did(data) });

  // Level 0. expandProcess copies the context flows down unattached, so attach each one.
  m = run(m, { type: 'expandProcess', processId: 'p0', diagramId: 'l0' });
  spec.processes.forEach((name, i) => {
    m = run(m, { type: 'addProcess', diagramId: 'l0', id: `p${i + 1}`, name, description: 'A process.' });
  });
  for (const name of spec.stores)
    m = run(m, { type: 'addDataStore', diagramId: 'l0', id: node(name), name, description: 'A data store.' });
  const inherited = flowsOn(m, 'l0');
  for (const [from, to, data] of spec.level0) {
    const match = inherited.find(
      (f) => f.dataId === did(data) && (f.sourceId === node(from) || f.targetId === node(to)) && (!f.sourceId || !f.targetId),
    );
    if (match) {
      m = run(m, { type: 'setFlowEnds', flowId: match.id, sourceId: node(from), targetId: node(to) });
      inherited.splice(inherited.indexOf(match), 1);
    } else {
      m = run(m, { type: 'addFlow', diagramId: 'l0', sourceId: node(from), targetId: node(to), dataId: did(data) });
    }
  }
  return m;
}

function flowBetween(m: Model, diagramId: Id, from: Id, to: Id): Id {
  const f = flowsOn(m, diagramId).find((x) => x.sourceId === from && x.targetId === to);
  if (!f) throw new Error(`No flow from ${from} to ${to}`);
  return f.id;
}

const library = (): Model =>
  buildTwoLevel({
    project: 'Library loans',
    system: 'Library System',
    externals: ['Member', 'Librarian'],
    stores: ['Books', 'Loans'],
    processes: ['Lend Book', 'Maintain Catalog', 'Report Overdue Loans'],
    context: [
      ['Member', '0', 'Loan Request'],
      ['0', 'Member', 'Loan Receipt'],
      ['Librarian', '0', 'Book Details'],
      ['0', 'Librarian', 'Overdue Report'],
    ],
    level0: [
      ['Member', '1', 'Loan Request'],
      ['1', 'Member', 'Loan Receipt'],
      ['Books', '1', 'Book Record'],
      ['1', 'Loans', 'Loan Record'],
      ['Librarian', '2', 'Book Details'],
      ['2', 'Books', 'Book Record'],
      ['Loans', '3', 'Loan Record'],
      ['3', 'Librarian', 'Overdue Report'],
    ],
  });

const registration = (): Model =>
  buildTwoLevel({
    project: 'Course registration',
    system: 'Registration System',
    externals: ['Student', 'Registrar'],
    stores: ['Courses', 'Enrollments'],
    processes: ['Enroll Student', 'Maintain Courses', 'Produce Class List'],
    context: [
      ['Student', '0', 'Enrollment Request'],
      ['0', 'Student', 'Enrollment Confirmation'],
      ['Registrar', '0', 'Course Details'],
      ['0', 'Registrar', 'Class List'],
    ],
    level0: [
      ['Student', '1', 'Enrollment Request'],
      ['1', 'Student', 'Enrollment Confirmation'],
      ['Courses', '1', 'Course Record'],
      ['1', 'Enrollments', 'Enrollment Record'],
      ['Registrar', '2', 'Course Details'],
      ['2', 'Courses', 'Course Record'],
      ['Enrollments', '3', 'Enrollment Record'],
      ['3', 'Registrar', 'Class List'],
    ],
  });

/** Case B1: the clinic model with no student mistakes, no use cases and no data model. */
const clinic = (): Model => buildClinic({ mistakes: false, useCases: false, dataModel: false });

describe('Case A: library loans', () => {
  it('a correct two-level model produces no findings', () => {
    const m = library();
    expect(checkInvariants(m)).toBeNull();
    expect(runRules(m)).toEqual([]);
  });
});

describe('Case B: clinic appointments', () => {
  it('B1: balances through the dictionary, with no findings', () => {
    expect(runRules(clinic())).toEqual([]);
  });

  it('B2: deleting the "Visit Details" flow gives BAL-01 and DFD-03', () => {
    let m = clinic();
    m = run(m, { type: 'deleteElement', id: flowBetween(m, CLINIC.child1, CLINIC.client, CLINIC.p11) });
    const findings = runRules(m);
    expect(ids(findings)).toEqual(['BAL-01', 'DFD-03']);
    const bal = only(findings, 'BAL-01')[0];
    expect(bal.diagramId).toBe(CLINIC.child1);
    expect(bal.elementIds).toContain(CLINIC.p1);
    expect(bal.values.data).toBe('Appointment Request');
    expect(bal.values.missing).toBe('Visit Details');
    expect(only(findings, 'DFD-03')[0].elementIds).toEqual([CLINIC.p11]);
  });

  it('B3: carrying "Booking Info" in place of "Client Details" gives BAL-01 and BAL-03', () => {
    let m = clinic();
    const flowId = flowBetween(m, CLINIC.child1, CLINIC.client, CLINIC.p12);
    const made = created(m, { type: 'setFlowData', flowId, dataName: 'Booking Info' });
    m = made.model;
    const infoId = made.ids[0];
    m = run(m, { type: 'describe', id: infoId, description: 'What the client gives to hold a time.' });
    const code = created(m, { type: 'defineData', dataKind: 'dataElement', name: 'Booking Code', description: 'A short code.' });
    m = run(code.model, { type: 'setComposition', dataId: infoId, components: [{ dataId: code.ids[0], occurs: 'once' }] });

    const findings = runRules(m);
    expect(ids(findings)).toEqual(['BAL-01', 'BAL-03']);
    const bal1 = only(findings, 'BAL-01')[0];
    expect(bal1.severity).toBe('error');
    expect(bal1.values.missing).toBe('Client Details');
    const bal3 = only(findings, 'BAL-03')[0];
    expect(bal3.severity).toBe('warning');
    expect(bal3.values.data).toBe('Booking Info');
    expect(bal3.elementIds[0]).toBe(flowId);
  });

  it('B5: emptying "Visit Details" gives DD-01 and three DD-03, and no balancing finding', () => {
    let m = clinic();
    m = run(m, { type: 'setComposition', dataId: dataIdOf('Visit Details'), components: [] });
    const findings = runRules(m);
    expect(ids(findings)).toEqual(['DD-01', 'DD-03', 'DD-03', 'DD-03']);
    expect(only(findings, 'DD-01')[0].elementIds).toEqual([dataIdOf('Visit Details')]);
    expect(only(findings, 'DD-03').map((f) => f.values.name).sort()).toEqual(['Pet Name', 'Preferred Date', 'Reason for Visit']);
  });
});

describe('Case C: course registration', () => {
  it('the unchanged model produces no findings', () => {
    expect(runRules(registration())).toEqual([]);
  });

  it('C1: a flow between two external entities gives DFD-05', () => {
    let m = registration();
    m = run(m, { type: 'addFlow', diagramId: 'ctx', sourceId: 'student', targetId: 'registrar', dataId: did('Course Details') });
    const findings = runRules(m);
    expect(ids(findings)).toEqual(['DFD-05']);
    expect(findings[0].message).toBe("'Course Details' does not start or end at a process.");
    expect(findings[0].diagramId).toBe('ctx');
  });

  it('C3: removing every flow into process 3 gives DFD-03 and DFD-09', () => {
    let m = registration();
    for (const f of all(m, 'dataFlow').filter((x) => x.targetId === 'p3')) m = run(m, { type: 'deleteElement', id: f.id });
    const findings = runRules(m);
    expect(ids(findings)).toEqual(['DFD-03', 'DFD-09']);
    expect(only(findings, 'DFD-03')[0].elementIds).toEqual(['p3']);
    expect(only(findings, 'DFD-09')[0].message).toBe("'Enrollments' is only written to.");
  });

  it('C4: removing every flow out of process 2 gives DFD-04 and DFD-09', () => {
    let m = registration();
    for (const f of all(m, 'dataFlow').filter((x) => x.sourceId === 'p2')) m = run(m, { type: 'deleteElement', id: f.id });
    const findings = runRules(m);
    expect(ids(findings)).toEqual(['DFD-04', 'DFD-09']);
    expect(only(findings, 'DFD-04')[0].elementIds).toEqual(['p2']);
    expect(only(findings, 'DFD-09')[0].message).toBe("'Courses' is only read from.");
  });

  it('C9: placing D1 on the context diagram gives DFD-10 and two BAL-03', () => {
    let m = registration();
    m = run(m, { type: 'placeExisting', diagramId: 'ctx', elementId: 'courses' });
    const findings = runRules(m);
    expect(ids(findings)).toEqual(['BAL-03', 'BAL-03', 'DFD-10']);
    const bal = only(findings, 'BAL-03');
    expect(bal.map((f) => f.values.data)).toEqual(['Course Record', 'Course Record']);
    expect(bal.map((f) => f.values.direction).sort()).toEqual(['in', 'out']);
    expect(bal.every((f) => f.diagramId === 'l0')).toBe(true);
  });

  it('C10: expanding process 1 with one unconnected child gives DFD-11, DFD-07 and four DFD-05', () => {
    let m = registration();
    m = run(m, { type: 'expandProcess', processId: 'p1', diagramId: 'c1' });
    const made = created(m, { type: 'addProcess', diagramId: 'c1', name: 'Check Prerequisites', description: 'A process.' });
    m = made.model;
    const findings = runRules(m);
    expect(ids(findings)).toEqual(['DFD-05', 'DFD-05', 'DFD-05', 'DFD-05', 'DFD-07', 'DFD-11']);
    expect(only(findings, 'DFD-07')[0].elementIds).toEqual([made.ids[0]]);
    expect(only(findings, 'DFD-11')[0].diagramId).toBe('c1');
    expect(flowsOn(m, 'c1')).toHaveLength(4);
  });
});

describe('The sample data', () => {
  it('gives exactly BAL-01, BAL-03, DFD-13 and DM-01 twice, before the second-release content is added', () => {
    const m = buildClinic({ secondRelease: false });
    const findings = runRules(m);
    expect(ids(findings)).toEqual(['BAL-01', 'BAL-03', 'DFD-13', 'DM-01', 'DM-01']);

    const bal1 = only(findings, 'BAL-01')[0];
    expect(bal1.severity).toBe('error');
    expect(bal1.diagramId).toBe(CLINIC.child1);
    expect(bal1.message).toBe(
      "'Appointment Request' enters 'Schedule Appointment' on the parent diagram but does not fully enter this diagram. Missing: Client Details.",
    );
    expect(bal1.why).toBe('A child diagram is a closer look at one process, so the same data must cross its edge.');
    expect(bal1.fix).toBe('Add a flow carrying the missing data, or remove it from the parent.');
    if (!isBalanceFinding(bal1)) throw new Error('BAL-01 should carry the parts table');
    expect(bal1.values.parts.map((p) => [p.name, p.crosses, p.at.map((a) => a.label)])).toEqual([
      ['Client Details', false, []],
      ['Visit Details', true, ['1.1']],
    ]);

    const bal3 = only(findings, 'BAL-03')[0];
    expect(bal3.severity).toBe('warning');
    expect(bal3.diagramId).toBe(CLINIC.child1);
    expect(bal3.message).toBe("'Booking Info' crosses the edge of this diagram but not 'Schedule Appointment' on the parent diagram.");

    const dfd13 = only(findings, 'DFD-13')[0];
    expect(dfd13.diagramId).toBe(CLINIC.level0);
    expect(dfd13.message).toBe("'Produce Daily Schedule' has no description.");

    expect(only(findings, 'DM-01').map((f) => f.values.name)).toEqual(['Client', 'Pet']);
    expect(only(findings, 'DM-01').every((f) => f.severity === 'warning' && f.area === 'dataModel')).toBe(true);
  });

  it('holds what the briefs say it holds', () => {
    const m = sampleModel();
    expect(checkInvariants(m)).toBeNull();
    expect(all(m, 'diagram')).toHaveLength(3);
    expect(all(m, 'process')).toHaveLength(7);
    expect(all(m, 'externalEntity')).toHaveLength(2);
    expect(all(m, 'dataStore')).toHaveLength(1);
    expect(all(m, 'dataFlow')).toHaveLength(19);
    expect(flowsOn(m, CLINIC.context)).toHaveLength(5);
    expect(flowsOn(m, CLINIC.level0)).toHaveLength(8);
    expect(flowsOn(m, CLINIC.child1)).toHaveLength(6);
    expect(dataDefinitions(m)).toHaveLength(27);
    expect(all(m, 'dataStructure')).toHaveLength(11);
    expect(all(m, 'useCase')).toHaveLength(3);
    expect(all(m, 'entity')).toHaveLength(3);
    expect(childDiagram(m, CLINIC.p1)?.id).toBe(CLINIC.child1);
    expect(getOutline(m)).toContain('1 Schedule Appointment');
  });
});

describe('Invariants', () => {
  it('refuses a second process on the context diagram', () => {
    const r = apply(clinic(), { type: 'addProcess', diagramId: CLINIC.context, name: 'Another' });
    expect(r.ok).toBe(false);
  });

  it('refuses a process number that a sibling already has', () => {
    const r = apply(clinic(), { type: 'setProcessNumber', processId: CLINIC.p2, ordinal: 1 });
    expect(r.ok).toBe(false);
  });

  it('refuses a flow to an element that is not on the diagram', () => {
    const r = apply(clinic(), {
      type: 'addFlow',
      diagramId: CLINIC.context,
      sourceId: CLINIC.client,
      targetId: CLINIC.d1,
      dataId: dataIdOf('Visit Notes'),
    });
    expect(r.ok).toBe(false);
  });

  it('refuses to delete data that is still in use, unless cascade is set', () => {
    const m = clinic();
    expect(apply(m, { type: 'deleteElement', id: dataIdOf('Visit Details') }).ok).toBe(false);
    expect(apply(m, { type: 'deleteElement', id: dataIdOf('Visit Details'), cascade: true }).ok).toBe(true);
  });

  it('refuses a data element as an attribute of two entities', () => {
    const r = apply(sampleModel(), { type: 'addAttribute', entityId: 'en-pet', dataId: dataIdOf('Client Name') });
    expect(r.ok).toBe(false);
  });
});

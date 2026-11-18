// The second release (docs/SPEC.md sections 10 and 11): each new rule firing and not
// firing, the new commands and invariants, the two modes, and the sample's exact findings.

import { describe, expect, it } from 'vitest';
import { apply, applyAll, checkInvariants } from '../model/apply';
import { conversionEffects } from '../model/binder';
import type { Command } from '../model/commands';
import { normalizeModel } from '../model/normalize';
import { all, get, routeOf, search } from '../model/queries';
import {
  binderSections,
  fanIn,
  fanOut,
  feasibility,
  interfaceReach,
  modelForMode,
  moduleNumber,
  modulesOf,
  programIo,
  requirementsOutline,
  storageEstimate,
  systemRequest,
  tableFields,
} from '../model/queries2';
import { emptyModel, MAX_ATTACHMENT_BYTES, type Mode, type Model } from '../model/types';
import { buildClinic, CLINIC, CLINIC2, dataIdOf, sampleModel } from '../sample/clinic';
import { STARTERS } from '../sample/starters';
import { RULES } from './catalogue';
import { countFindings, findingPlace, runRules, type Finding } from './engine';

function run(model: Model, ...commands: Command[]): Model {
  return applyAll(model, commands);
}

function refused(model: Model, command: Command): string {
  const r = apply(model, command);
  if (r.ok) throw new Error(`${command.type} should have been refused`);
  return r.error;
}

const ids = (model: Model, mode: Mode = 'logical') => runRules(model, mode).map((f) => f.ruleId).sort();
const only = (model: Model, ruleId: string, mode: Mode = 'logical'): Finding[] => runRules(model, mode).filter((f) => f.ruleId === ruleId);
const count = (model: Model, ruleId: string, mode: Mode = 'logical') => only(model, ruleId, mode).length;

/** A project with a context diagram and nothing else. Its own findings are DFD-07 and DFD-13 on process 0. */
const blank = () => run(emptyModel(), { type: 'createProject', name: 'Test', id: 'ctx', processId: 'p0', description: 'The system.' });
/** The whole sample with none of its deliberate slips. Its only findings are DM-01 twice. */
const clean = () => buildClinic({ mistakes: false });
const C = CLINIC2;

const cash = (name: string, amounts: number[], valueIndex: number | null = null) => ({ name, amounts, valueIndex });
/** The worked example of SPEC 10.2 as a command. */
const workedExample = (typed: { roi?: number; breakEven?: number; npv?: number } = {}): Command => ({
  type: 'updateFeasibility',
  economic: {
    firstYear: 2027,
    years: 3,
    rate: 8,
    benefits: [cash('Benefits', [0, 40000, 50000, 60000])],
    developmentCosts: [cash('Development', [80000, 0, 0, 0])],
    operationalCosts: [cash('Operations', [0, 10000, 10000, 10000])],
    ...typed,
  },
});

describe('System request: SR-01 to SR-03', () => {
  it('reports nothing while the project has no system request', () => {
    expect(ids(blank()).some((id) => id.startsWith('SR-'))).toBe(false);
  });

  it('SR-01 reports each empty field, and stops when it is filled', () => {
    let m = run(blank(), { type: 'updateSystemRequest', patch: {} });
    expect(only(m, 'SR-01').map((f) => f.values.field)).toEqual([
      'project sponsor',
      'business need',
      'business requirements',
      'business value',
      'special issues or constraints',
    ]);
    expect(only(m, 'SR-01')[0].area).toBe('systemRequest');
    m = run(m, {
      type: 'updateSystemRequest',
      patch: { sponsor: 'A', businessNeed: 'B', businessRequirements: ['C'], businessValue: [{ text: 'D' }], specialIssues: 'None.' },
    });
    expect(count(m, 'SR-01')).toBe(0);
    expect(all(m, 'systemRequest')).toHaveLength(1);
  });

  it('SR-02 and SR-03 check the estimates of a value', () => {
    const value = (amount: number | null, last: number) => ({
      type: 'updateSystemRequest' as const,
      patch: {
        businessValue: [
          { text: 'Sales', tangible: true, amount, estimates: [{ label: 'Low', amount: 1000, probability: 40 }, { label: 'High', amount: 3000, probability: last }] },
        ],
      },
    });
    // 1,000 x 40% + 3,000 x 60% = 2,200.
    expect(ids(run(blank(), value(2200, 60))).filter((id) => /SR-0[23]/.test(id))).toEqual([]);
    const wrongTotal = run(blank(), value(1900, 50));
    expect(only(wrongTotal, 'SR-02')[0].message).toBe("The probabilities for 'Sales' add up to 90%, not 100%.");
    expect(count(wrongTotal, 'SR-03')).toBe(0);
    const wrongAmount = only(run(blank(), value(2000, 60)), 'SR-03')[0];
    expect(wrongAmount.message).toBe("The amount for 'Sales' is 2,000, which is not the expected value of its estimates.");
    expect(wrongAmount.fix).toBe('Work it through again. 1,000 × 40% + 3,000 × 60% = 2,200.');
    expect(count(run(blank(), value(null, 60)), 'SR-03')).toBe(1);
  });
});

describe('Feasibility analysis: FA-01 to FA-05', () => {
  it('FA-01 is silent for a cost-benefit analysis alone, and reports each part once one factor is assessed', () => {
    let m = run(blank(), workedExample());
    expect(count(m, 'FA-01')).toBe(0);
    m = run(m, { type: 'updateFeasibility', technical: { projectSize: { assessment: 'Low risk' } } });
    const found = only(m, 'FA-01');
    expect(found.map((f) => f.message)).toEqual([
      'The technical feasibility has no assessment for familiarity with the application, familiarity with the technology and compatibility.',
      'The organizational feasibility has no assessment for strategic alignment, project champions, senior management, users and other stakeholders.',
    ]);
    expect(count(clean(), 'FA-01')).toBe(0);
  });

  it('FA-02, FA-03 and FA-04 pass the right answers of the worked example', () => {
    const m = run(blank(), workedExample({ roi: 36.4, breakEven: 2.2, npv: 21763 }));
    expect(ids(m).filter((id) => id.startsWith('FA-'))).toEqual([]);
    // Nothing is reported for a measure that has not been typed.
    expect(ids(run(blank(), workedExample())).filter((id) => id.startsWith('FA-'))).toEqual([]);
  });

  it('each reports a wrong answer and shows its working', () => {
    const m = run(blank(), workedExample({ roi: 26.7, breakEven: 3, npv: 40000 }));
    expect(ids(m).filter((id) => id.startsWith('FA-'))).toEqual(['FA-02', 'FA-03', 'FA-04']);
    const roi = only(m, 'FA-02')[0];
    expect(roi.severity).toBe('error');
    expect(roi.message).toBe('The return on investment you typed, 26.7%, does not match the table.');
    expect(roi.fix).toContain('40,000 ÷ 110,000 = 36.4%.');
    expect(only(m, 'FA-03')[0].message).toBe('The break-even point you typed, 3.00 years, does not match the table.');
    expect(only(m, 'FA-04')[0].fix).toContain('127,534 − 105,771 = 21,763.');
  });

  it('FA-03 reports a break-even point typed when the cumulative figure never turns positive', () => {
    let m = run(blank(), workedExample({ breakEven: 2.5 }));
    m = run(m, { type: 'updateFeasibility', economic: { benefits: [cash('Benefits', [0, 20000, 20000, 20000])] } });
    expect(only(m, 'FA-03')[0].message).toBe(
      'The break-even point you typed, 2.50 years, cannot be right, because the cumulative net cash flow never turns positive.',
    );
  });

  it('FA-05 compares a linked benefit with the value in the system request', () => {
    const request: Command = { type: 'updateSystemRequest', patch: { businessValue: [{ text: 'More sales', tangible: true, amount: 40000 }] } };
    let m = run(blank(), request, workedExample());
    m = run(m, { type: 'updateFeasibility', economic: { benefits: [cash('Benefits', [0, 40000, 50000, 60000], 0)] } });
    expect(count(m, 'FA-05')).toBe(0);
    m = run(m, { type: 'updateSystemRequest', patch: { businessValue: [{ text: 'More sales', tangible: true, amount: 45000 }] } });
    expect(only(m, 'FA-05')[0].message).toBe("The benefit 'Benefits' is 40,000 in its first year, but the system request gives 45,000 for 'More sales'.");
    // A value that is removed takes the link with it.
    m = run(m, { type: 'updateSystemRequest', patch: { businessValue: [] } });
    expect(feasibility(m)!.economic.benefits[0].valueIndex).toBeNull();
    expect(refused(m, { type: 'updateFeasibility', economic: { benefits: [cash('Benefits', [0], 3)] } })).toContain('not in the system request');
  });

  it('fits every line to the table when the number of years changes', () => {
    const m = run(blank(), workedExample(), { type: 'updateFeasibility', economic: { years: 5 } });
    expect(feasibility(m)!.economic.benefits[0].amounts).toEqual([0, 40000, 50000, 60000, null, null]);
    expect(refused(m, { type: 'updateFeasibility', economic: { years: 0 } })).toContain('1 to 10 years');
  });
});

describe('Requirements definition: RQ-01 to RQ-03', () => {
  it('reports nothing about use cases or types while the project has no requirement', () => {
    const m = buildClinic({ secondRelease: false });
    expect(all(m, 'useCase')).toHaveLength(3);
    expect(ids(m).some((id) => id.startsWith('RQ-'))).toBe(false);
  });

  it('RQ-01 reports a functional requirement traced to nothing', () => {
    expect(count(clean(), 'RQ-01')).toBe(0);
    const m = run(clean(), { type: 'updateRequirement', id: C.fBook, patch: { traceIds: [] } });
    expect(only(m, 'RQ-01')[0].message).toBe('Requirement 1.2 is not traced to a use case or a process.');
    // User and nonfunctional requirements are not traced.
    expect(count(run(clean(), { type: 'addRequirement', name: 'Staff need a quiet desk.', requirementKind: 'user' }), 'RQ-01')).toBe(0);
  });

  it('RQ-02 reports a use case that no requirement is traced to, directly or through its process', () => {
    expect(count(clean(), 'RQ-02')).toBe(0);
    let m = run(clean(), { type: 'addUseCase', id: 'uc-9', name: 'Cancel Appointment' });
    expect(only(m, 'RQ-02')[0].message).toBe("No requirement is traced to the use case 'Cancel Appointment'.");
    m = run(m, { type: 'updateUseCase', id: 'uc-9', patch: { processId: CLINIC.p13 } });
    expect(count(m, 'RQ-02')).toBe(0);
  });

  it('RQ-03 reports a nonfunctional type with nothing in it, unless it is marked as none expected', () => {
    expect(count(clean(), 'RQ-03')).toBe(0);
    const m = run(clean(), { type: 'setNoneExpected', nonfunctionalType: 'cultural and political', noneExpected: false });
    expect(only(m, 'RQ-03')[0].message).toBe('There are no cultural and political requirements, and the definition does not say that none are expected.');
  });

  it('numbers the outline: user requirements, then groups, then the four nonfunctional types from 1 again', () => {
    const o = requirementsOutline(sampleModel());
    expect(o.user.map((r) => r.number)).toEqual(['U1', 'U2']);
    expect(o.functional.map((g) => [g.number, g.userGroup, g.name, g.requirements.map((r) => r.number)])).toEqual([
      ['1', 'Front desk', 'Schedule appointments', ['1.1', '1.2', '1.3', '1.4']],
      ['2', 'Veterinarians', 'Record visits', ['2.1']],
      ['3', 'Veterinarians', 'Produce schedules', ['3.1']],
    ]);
    expect(o.nonfunctional.map((g) => [g.number, g.type, g.requirements.length, g.noneExpected])).toEqual([
      ['1', 'operational', 1, false],
      ['2', 'performance', 2, false],
      ['3', 'security', 1, false],
      ['4', 'cultural and political', 0, true],
    ]);
  });

  it('keeps a requirement’s fields in step with its kind, and reorders', () => {
    let m = run(sampleModel(), { type: 'updateRequirement', id: C.fBook, patch: { requirementKind: 'nonfunctional' } });
    const r = get(m, C.fBook, 'requirement')!;
    expect([r.group, r.functionalType, r.nonfunctionalType]).toEqual(['', null, 'operational']);
    expect(refused(m, { type: 'reorderRequirements', ids: [C.fBook] })).toContain('list every requirement once');
    const order = all(m, 'requirement').map((x) => x.id).reverse();
    m = run(m, { type: 'reorderRequirements', ids: order });
    expect(requirementsOutline(m).user.map((x) => x.requirement.id)).toEqual(['rq-u2', 'rq-u1']);
    expect(refused(m, { type: 'updateRequirement', id: C.fFreeTimes, patch: { traceIds: [CLINIC.d1] } })).toContain('use case or a process');
  });
});

describe('Alternative matrix: AM-01 to AM-03', () => {
  it('AM-01 reports weights that do not add up to 100', () => {
    let m = run(blank(), { type: 'addAlternativeMatrix', id: 'am', name: 'Options' });
    expect(ids(m).filter((id) => id.startsWith('AM-'))).toEqual(['AM-01']);
    m = run(m, {
      type: 'updateAlternativeMatrix',
      id: 'am',
      alternatives: ['Build', 'Buy'],
      criteria: [
        { name: 'Fit', group: 'technical', weight: 60 },
        { name: 'Cost', group: 'economic', weight: 30 },
      ],
    });
    expect(only(m, 'AM-01')[0].message).toBe("The weights in 'Options' add up to 90, not 100.");
    expect(only(m, 'AM-01')[0].homeId).toBe('am');
    m = run(m, { type: 'updateAlternativeMatrix', id: 'am', criteria: [{ name: 'Fit', group: 'technical', weight: 60 }, { name: 'Cost', group: 'economic', weight: 40 }] });
    expect(count(m, 'AM-01')).toBe(0);
  });

  it('AM-02 and AM-03 report empty cells, and a score outside 1 to 5', () => {
    const start: Command = {
      type: 'addAlternativeMatrix',
      id: 'am',
      name: 'Options',
      alternatives: ['Build', 'Buy'],
      criteria: [{ name: 'Fit', group: 'technical', weight: 100 }],
    };
    let m = run(blank(), start);
    expect(get(m, 'am', 'alternativeMatrix')!.cells).toEqual([[{ supportingInformation: '', score: null }, { supportingInformation: '', score: null }]]);
    expect(only(m, 'AM-02')[0].message).toBe("'Options' has 2 scores missing or not from 1 to 5.");
    expect(only(m, 'AM-03')[0].message).toBe("'Options' has 2 cells with no supporting information.");
    m = run(m, { type: 'updateAlternativeMatrix', id: 'am', cells: [[{ supportingInformation: 'Tried it.', score: 4 }, { supportingInformation: 'Read the brochure.', score: 6 }]] });
    expect(only(m, 'AM-02')[0].message).toBe("'Options' has 1 score missing or not from 1 to 5.");
    expect(count(m, 'AM-03')).toBe(0);
    expect(ids(clean()).some((id) => id.startsWith('AM-'))).toBe(false);
  });

  it('removes an alternative or a criterion with its cells', () => {
    let m = run(sampleModel(), { type: 'removeAlternative', id: C.matrix, index: 1 });
    let x = get(m, C.matrix, 'alternativeMatrix')!;
    expect(x.alternatives).toEqual(['Custom development', 'Outsourced development']);
    expect(x.cells.every((row) => row.length === 2)).toBe(true);
    expect(x.cells[2][1].supportingInformation).toBe('Quoted at 58,000.');
    m = run(m, { type: 'removeCriterion', id: C.matrix, index: 0 });
    x = get(m, C.matrix, 'alternativeMatrix')!;
    expect(x.criteria).toHaveLength(4);
    expect(x.cells).toHaveLength(4);
  });
});

describe('Test plan: TP-01 and TP-02', () => {
  it('TP-01 reports what a test is missing', () => {
    let m = run(blank(), { type: 'addTest', id: 't', name: 'First test' });
    expect(only(m, 'TP-01')[0].message).toBe('Test T-1 has no objective, test cases or script and no expected results.');
    m = run(m, { type: 'updateTest', id: 't', patch: { objective: 'Try it.', script: 'Press the button.', expectedResults: 'It works.' } });
    expect(count(m, 'TP-01')).toBe(0);
    // The requirement and the interface may be text, for a test plan that stands alone.
    m = run(m, { type: 'updateTest', id: 't', patch: { requirementText: 'Orders can be placed.', testCases: [{ interfaceId: null, interfaceText: 'Order form', dataField: 'Quantity', valueEntered: '0' }] } });
    expect(ids(m).some((id) => id.startsWith('TP-'))).toBe(false);
  });

  it('TP-02 reports a functional requirement with no test, but only once the project has a test', () => {
    expect(count(clean(), 'TP-02')).toBe(0);
    const m = run(clean(), { type: 'deleteElement', id: 't-6' });
    expect(only(m, 'TP-02').map((f) => f.elementIds[0])).toEqual([C.fDailyList]);
    let none = clean();
    for (const t of all(none, 'test')) none = run(none, { type: 'deleteElement', id: t.id });
    expect(count(none, 'TP-02')).toBe(0);
  });

  it('deleting a requirement, a module or an interface leaves its name behind as text', () => {
    let m = run(sampleModel(), { type: 'deleteElement', id: C.fFreeTimes });
    const t = get(m, 't-1', 'test')!;
    expect([t.requirementId, t.requirementText]).toEqual([null, 'The system will show the free times on the date a client prefers.']);
    m = run(m, { type: 'deleteElement', id: C.ifBook }, { type: 'deleteElement', id: C.mCheck });
    const after = get(m, 't-1', 'test')!;
    expect(after.testCases[0]).toMatchObject({ interfaceId: null, interfaceText: 'Book Appointment' });
    expect([after.programId, after.programText]).toEqual([null, 'Check Availability']);
    expect(checkInvariants(m)).toBeNull();
  });
});

describe('Interface structure diagram: ISD-01 to ISD-04', () => {
  const diagram: Command = { type: 'addInterfaceDiagram', id: 'isd', name: 'Screens' };

  it('ISD-01 reports a diagram with no interface 0', () => {
    let m = run(blank(), diagram);
    expect(only(m, 'ISD-01')[0].message).toBe("'Screens' has no interface numbered 0.");
    m = run(m, { type: 'addInterface', diagramId: 'isd', id: 'a', name: 'Main Menu' });
    expect(get(m, 'a', 'interface')!.number).toBe('0');
    expect(count(m, 'ISD-01')).toBe(0);
  });

  it('ISD-02 reports an interface that cannot be reached from interface 0', () => {
    let m = run(blank(), diagram, { type: 'addInterface', diagramId: 'isd', id: 'a', name: 'Main Menu' }, { type: 'addInterface', diagramId: 'isd', id: 'b', name: 'Orders' });
    expect(get(m, 'b', 'interface')!.number).toBe('1');
    expect(only(m, 'ISD-02')[0].message).toBe("'Orders' cannot be reached from the main menu.");
    m = run(m, { type: 'addNavigationLink', diagramId: 'isd', aId: 'b', bId: 'a' });
    expect(count(m, 'ISD-02')).toBe(0);
  });

  it('ISD-03 and ISD-04 are silent when the project has no processes on level 0', () => {
    const m = run(blank(), diagram, { type: 'addInterface', diagramId: 'isd', id: 'a', name: 'Main Menu' });
    expect(ids(m).filter((id) => id.startsWith('ISD-'))).toEqual([]);
  });

  it('ISD-03 reports an interface with nothing below it that names no process', () => {
    expect(count(clean(), 'ISD-03')).toBe(0);
    const found = only(sampleModel(), 'ISD-03');
    expect(found.map((f) => f.elementIds[0])).toEqual([C.ifFindClient]);
    expect(found[0].homeId).toBe(C.interfaceDiagram);
    // A menu with interfaces below it needs no process.
    const reach = interfaceReach(sampleModel(), C.interfaceDiagram);
    expect(reach.below(C.ifAppointments)).toEqual([C.ifBook, C.ifFindClient]);
    expect(reach.distance.get(C.ifConfirm)).toBe(3);
  });

  it('ISD-04 reports a level 0 process that no interface carries out, counting the processes below it', () => {
    expect(count(clean(), 'ISD-04')).toBe(0);
    const m = run(clean(), { type: 'updateInterface', id: C.ifVisit, processIds: [] });
    expect(only(m, 'ISD-04')[0].message).toBe("No interface carries out 'Record Visit'.");
    // Process 1 is carried out through 1.1, 1.2 and 1.3. With no interface diagram the rule is silent.
    expect(count(buildClinic({ secondRelease: false }), 'ISD-04')).toBe(0);
  });

  it('keeps the invariants of the diagram', () => {
    const m = sampleModel();
    expect(refused(m, { type: 'updateInterface', id: C.ifVisit, number: '3' })).toBe('Two interfaces on one diagram cannot both have the number 3.');
    expect(refused(m, { type: 'addNavigationLink', diagramId: C.interfaceDiagram, aId: C.ifVisit, bId: C.ifMenu })).toBe('These two interfaces are already linked.');
    expect(refused(m, { type: 'addNavigationLink', diagramId: C.interfaceDiagram, aId: C.ifVisit, bId: C.ifVisit })).toContain('two different interfaces');
    const gone = run(m, { type: 'deleteElement', id: C.interfaceDiagram });
    expect(all(gone, 'interface')).toHaveLength(0);
    expect(all(gone, 'navigationLink')).toHaveLength(0);
    expect(gone.views.isd).toEqual({});
  });
});

describe('Structure chart: SC-01 to SC-07, and PS-01', () => {
  // Process 0 has no child diagram in the blank project, so the top module carries it out and SC-07 is satisfied.
  const chart: Command = { type: 'addStructureChart', id: 'sc', moduleId: 'top', name: 'Payroll', moduleName: 'Run Payroll', processId: 'p0' };
  const fill = (moduleId: string): Command => ({ type: 'setProgramSpec', moduleId, patch: { purpose: 'A purpose.', pseudocode: 'do it' } });
  /** A chart with a top module and one module below it, both specified. */
  const small = () => run(blank(), chart, fill('top'), { type: 'addModule', parentModuleId: 'top', id: 'a', name: 'Read Timesheets' }, fill('a'));
  const sc = (m: Model) => ids(m).filter((id) => id.startsWith('SC-') || id === 'PS-01');

  it('a small, complete chart has no findings', () => {
    expect(sc(small())).toEqual([]);
    expect(moduleNumber(small(), 'a')).toBe('1.1');
  });

  it('SC-01 reports a module or a control couple with no name', () => {
    let m = run(small(), { type: 'rename', id: 'a', name: '' });
    expect(only(m, 'SC-01')[0].message).toBe('Module 1.1 has no name.');
    m = run(small(), { type: 'addCouple', id: 'c', moduleId: 'a', direction: 'up', coupleKind: 'control' });
    expect(only(m, 'SC-01')[0].message).toBe("A control couple on the line above 'Read Timesheets' has no name.");
    expect(sc(run(m, { type: 'rename', id: 'c', name: 'End of file' }))).toEqual([]);
  });

  it('SC-02 reports a control couple passed down', () => {
    const m = run(small(), { type: 'addCouple', id: 'c', moduleId: 'a', direction: 'down', coupleKind: 'control', name: 'Print totals' });
    expect(only(m, 'SC-02')[0].message).toBe("The control couple 'Print totals' is passed down to 'Read Timesheets'.");
    expect(sc(run(m, { type: 'updateCouple', id: 'c', direction: 'up' }))).toEqual([]);
    // A data couple may go either way.
    expect(sc(run(small(), { type: 'addCouple', moduleId: 'a', direction: 'down', coupleKind: 'data', dataName: 'Pay Period' }))).toEqual([]);
  });

  it('SC-03 reports more than seven modules below one, unless every one is conditional', () => {
    let m = small();
    for (let i = 2; i <= 8; i++) m = run(m, { type: 'addModule', parentModuleId: 'top', id: `m${i}`, name: `Step ${i}` }, fill(`m${i}`));
    expect(fanOut(m, 'top')).toBe(8);
    expect(only(m, 'SC-03')[0].message).toBe("'Run Payroll' has 8 modules directly below it.");
    for (const child of ['a', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8']) m = run(m, { type: 'updateModule', id: child, patch: { conditional: true } });
    expect(count(m, 'SC-03')).toBe(0);
  });

  it('SC-04 reports "and" in a name', () => {
    expect(sc(run(small(), { type: 'rename', id: 'a', name: 'Read and Sort Timesheets' }))).toEqual(['SC-04']);
    expect(sc(run(small(), { type: 'rename', id: 'a', name: 'Read Brand Codes' }))).toEqual([]);
  });

  it('SC-05 reports two modules with one name, unless one repeats the other', () => {
    let m = run(small(), { type: 'addModule', parentModuleId: 'top', id: 'b', name: 'read timesheets' }, fill('b'));
    expect(sc(m)).toEqual(['SC-05']);
    m = run(m, { type: 'updateModule', id: 'b', patch: { repeatsId: 'a' } }, { type: 'updateModule', id: 'a', patch: { library: true } });
    expect(sc(m)).toEqual([]);
  });

  it('SC-06 reports a repeated module that is not a library module, and does not check the repeat itself', () => {
    const m = run(small(), { type: 'addModule', parentModuleId: 'top', id: 'b', name: '', repeatsId: 'a' });
    expect(sc(m)).toEqual(['SC-06']);
    expect(only(m, 'SC-06')[0].message).toBe("'Read Timesheets' is used in 2 places but is not marked as a library module.");
    expect(fanIn(m, 'a')).toBe(2);
    expect(search(m, { text: '', kind: 'module' }).map((r) => r.label)).toEqual(['1 Run Payroll', '1.1 Read Timesheets', '1.2 Read Timesheets']);
  });

  it('SC-07 reports a lowest-level process that no module carries out, only when there is a chart', () => {
    const noChart = buildClinic({ secondRelease: false });
    expect(count(noChart, 'SC-07')).toBe(0);
    expect(only(run(noChart, { type: 'addStructureChart', name: 'Empty chart' }), 'SC-07').map((f) => f.values.name)).toEqual([
      'Record Visit',
      'Produce Daily Schedule',
      'Check Availability',
      'Book Slot',
      'Send Confirmation',
    ]);
    expect(count(clean(), 'SC-07')).toBe(0);
    const m = run(clean(), { type: 'updateModule', id: C.mDaily, patch: { processId: null } });
    expect(only(m, 'SC-07')[0].message).toBe("No module carries out 'Produce Daily Schedule'.");
  });

  it('PS-01 reports a module with no purpose or no pseudocode', () => {
    const m = run(blank(), chart);
    expect(only(m, 'PS-01')[0].message).toBe("The program specification of 'Run Payroll' has no purpose and no pseudocode.");
    expect(findingPlace(only(m, 'PS-01')[0])).toEqual({ to: '/programs/top', text: 'Open program specification' });
    expect(sc(run(m, fill('top')))).toEqual([]);
  });

  it('keeps the invariants of the chart', () => {
    const m = sampleModel();
    expect(refused(m, { type: 'addCouple', moduleId: C.mTop, direction: 'down', coupleKind: 'control', name: 'x' })).toContain('no line above it');
    expect(refused(m, { type: 'addModule', parentModuleId: C.mReadAgain1, name: 'Below a repeat' })).toContain('nothing below it');
    expect(refused(m, { type: 'updateModule', id: C.mRecord, patch: { repeatsId: C.mReadAgain1 } })).toContain('itself a repeat');
    expect(refused(m, { type: 'updateModule', id: C.mRecord, patch: { ordinal: 1 } })).toContain('already has the number 1');
    expect(refused(m, { type: 'updateModule', id: C.mSchedule, patch: { parentModuleId: C.mBook } })).toBe('A module cannot be below itself.');
    expect(refused(m, { type: 'deleteElement', id: C.mTop })).toContain('Delete the chart instead');
    expect(refused(m, { type: 'deleteElement', id: dataIdOf('Booking') })).toContain('2 couples pass it on a structure chart');
    const gone = run(m, { type: 'deleteElement', id: C.chart });
    expect(all(gone, 'module')).toHaveLength(0);
    expect(all(gone, 'couple')).toHaveLength(0);
    expect(get(gone, 't-2', 'test')!.programText).toBe('Book Slot');
  });

  it('lists a program’s inputs and outputs from its couples', () => {
    const m = sampleModel();
    expect(modulesOf(m, C.chart).map((r) => `${r.number} ${r.module.name}`)).toEqual([
      '1 Run Clinic System',
      '1.1 Schedule Appointment',
      '1.1.1 Check Availability',
      '1.1.1.1 Read Appointments',
      '1.1.2 Book Slot',
      '1.1.3 Send Confirmation',
      '1.2 Record Visit',
      '1.2.1 Read Appointments',
      '1.3 Produce Daily Schedule',
      '1.3.1 Read Appointments',
    ]);
    expect(fanIn(m, C.mRead)).toBe(3);
    const book = programIo(m, C.mBook);
    expect(book.inputs.map((r) => [r.name, r.type, r.otherLabel])).toEqual([
      ['Available Slot', 'Structure', '1.1 Schedule Appointment'],
      ['Client Details', 'Structure', '1.1 Schedule Appointment'],
    ]);
    expect(book.inputs[0].notes).toContain('Check Availability returned');
    expect(book.outputs.map((r) => r.name)).toEqual(['Booking']);
    // A control module takes in what the modules below pass up, and a flag is shown as one.
    const check = programIo(m, C.mCheck);
    expect(check.inputs.map((r) => [r.name, r.type])).toEqual([
      ['Visit Details', 'Structure'],
      ['Appointment Record', 'Structure'],
      ['End of appointments', 'Flag'],
    ]);
    expect(check.outputs.map((r) => [r.name, r.type])).toEqual([
      ['Available Slot', 'Structure'],
      ['No free time', 'Flag'],
      ['Preferred Date', 'Date'],
    ]);
  });
});

describe('The physical model: PD, PDM and VOL rules', () => {
  /** The first-release sample: nothing physical has been filled in. */
  const untouched = () => buildClinic({ secondRelease: false });
  const physical = (m: Model, prefix: string) => ids(m, 'physical').filter((id) => id.startsWith(prefix));

  it('no physical rule runs in logical mode, or before the physical work is started', () => {
    const m = sampleModel();
    expect(ids(m).filter((id) => RULES[id].physicalOnly)).toEqual([]);
    expect(ids(untouched(), 'physical')).toEqual(ids(untouched()));
    for (const s of STARTERS) expect(ids(s.build(), 'physical')).toEqual(ids(s.build()));
  });

  it('PD-01 and PD-02 report what has no implementation or physical name, once one has been given', () => {
    const m = run(untouched(), { type: 'setPhysical', id: CLINIC.p12, implementation: 'Python' });
    // Seven processes less the one filled in. One data store and 19 flows.
    expect(count(m, 'PD-01', 'physical')).toBe(6);
    expect(count(m, 'PD-02', 'physical')).toBe(20);
    expect(only(m, 'PD-02', 'physical').map((f) => f.message)).toContain("The data store 'Appointments' has no physical name.");
    const human = run(m, { type: 'setPhysical', id: CLINIC.p2, human: true });
    expect(count(human, 'PD-01', 'physical')).toBe(5);
    expect(physical(clean(), 'PD-')).toEqual([]);
  });

  it('PD-03 reports that nothing is marked as human work', () => {
    const m = run(untouched(), { type: 'setPhysical', id: CLINIC.p12, implementation: 'Python' });
    const found = only(m, 'PD-03', 'physical');
    expect(found).toHaveLength(1);
    expect(found[0].diagramId).toBe(CLINIC.context);
    expect(count(run(m, { type: 'setPhysical', id: CLINIC.client, human: true }), 'PD-03', 'physical')).toBe(0);
  });

  it('nothing physical is reported on a diagram above the project', () => {
    const m = run(sampleModel(), { type: 'setTopDiagram', diagramId: CLINIC.child1 });
    const found = runRules(m, 'physical').filter((f) => f.ruleId.startsWith('PD-'));
    expect(found.map((f) => [f.ruleId, f.diagramId])).toEqual([['PD-02', CLINIC.child1]]);
  });

  it('PDM-01 reports missing names once a table has been named', () => {
    const m = run(untouched(), { type: 'setPhysical', id: 'en-pet', tableName: 'pet' });
    expect(only(m, 'PDM-01', 'physical').map((f) => f.message)).toEqual([
      "'Client' has no table name and no field name for Client Number, Client Name and Phone.",
      "'Pet' has no field name for Pet Number and Pet Name.",
      "'Appointment' has no table name and no field name for Appointment Number, Preferred Date and Reason for Visit.",
    ]);
    expect(physical(clean(), 'PDM-')).toEqual([]);
  });

  it('PDM-02 reports a table with no primary key, in place of ERD-04', () => {
    let m = run(clean(), { type: 'addEntity', id: 'en-log', name: 'Change Log', storeId: CLINIC.d1 }, { type: 'setPhysical', id: 'en-log', tableName: 'change_log' });
    m = run(m, { type: 'setStorage', entityId: 'en-log', initialRecords: 0, recordSize: 80 });
    expect(ids(m).filter((id) => id.startsWith('ERD-'))).toEqual(['ERD-03', 'ERD-04']);
    expect(ids(m, 'physical').filter((id) => id === 'ERD-04' || id === 'PDM-02')).toEqual(['PDM-02']);
    // A generated key is a system-related identifier. ERD-04 counts it, even in logical mode, where it is not shown.
    m = run(m, { type: 'addAttribute', entityId: 'en-log', dataName: 'Log Number', identifier: true, systemRelated: true });
    m = run(m, { type: 'setPhysical', id: get(m, 'en-log', 'entity')!.attributes[0].dataId, fieldName: 'log_number', averageWidth: 8 });
    expect(ids(m).filter((id) => id === 'ERD-04')).toEqual([]);
    expect(ids(m, 'physical').filter((id) => id === 'PDM-02')).toEqual([]);
    expect(get(modelForMode(m, 'logical'), 'en-log', 'entity')!.attributes).toEqual([]);
  });

  it('PDM-03 reports a relationship with no foreign key, and the key shows the parent’s primary key in the child', () => {
    const found = only(sampleModel(), 'PDM-03', 'physical');
    expect(found[0].message).toBe("The relationship between 'Pet' and 'Appointment' has no foreign key.");
    expect(found[0].fix).toBe("Place the foreign key in 'Appointment', the child table.");
    const fields = (m: Model, id: string) => tableFields(m, id).map((f) => `${f.name}${f.pk ? ' PK' : ''}${f.fk ? ' FK' : ''}${f.copy ? ' copy' : ''}`);
    expect(fields(sampleModel(), 'en-pet')).toEqual(['pet_number PK', 'pet_name', 'client_number FK']);
    expect(fields(sampleModel(), 'en-appointment')).toEqual(['appointment_number PK', 'preferred_date', 'reason_for_visit', 'pet_name copy']);
    expect(fields(clean(), 'en-appointment')).toContain('pet_number FK');
    // In an identifying relationship the foreign key is part of the primary key too.
    const identifying = run(clean(), { type: 'updateRelationship', id: 'r-pet-appointment', identifying: true });
    expect(fields(identifying, 'en-appointment')).toContain('pet_number PK FK');
    // A many-to-many relationship cannot have one.
    const many = run(clean(), {
      type: 'addRelationship',
      id: 'r-many',
      ends: [{ entityId: 'en-client', verbPhrase: 'a', min: 0, max: 'many' }, { entityId: 'en-appointment', verbPhrase: 'b', min: 0, max: 'many' }],
    });
    expect(count(many, 'PDM-03', 'physical')).toBe(0);
    expect(refused(many, { type: 'setPhysical', id: 'r-many', foreignKey: true })).toContain('no child yet');
  });

  it('PDM-04 reports two tables, or two fields of one table, with the same name', () => {
    const tables = run(clean(), { type: 'setPhysical', id: 'en-pet', tableName: 'Client' });
    expect(only(tables, 'PDM-04', 'physical')[0].message).toBe("Two tables are both named 'client'.");
    const fields = run(clean(), { type: 'setPhysical', id: dataIdOf('Phone'), fieldName: 'client_name' });
    expect(only(fields, 'PDM-04', 'physical')[0].message).toBe("Two fields of 'Client' are both named 'client_name'.");
    expect(only(fields, 'PDM-04', 'physical')[0].severity).toBe('error');
  });

  it('VOL-01 reports a missing width or number of records, once a storage figure has been typed', () => {
    const m = run(untouched(), { type: 'setStorageSettings', overheadRate: 20 });
    expect(only(m, 'VOL-01', 'physical').map((f) => f.message)).toEqual([
      "'Client' has no average width for Client Number, Client Name and Phone and no number of records at the start.",
      "'Pet' has no average width for Pet Number and Pet Name and no number of records at the start.",
      "'Appointment' has no average width for Appointment Number, Preferred Date and Reason for Visit and no number of records at the start.",
    ]);
    expect(only(m, 'VOL-01', 'physical')[0].area).toBe('storage');
    expect(physical(clean(), 'VOL-')).toEqual([]);
    // A table with no fields needs a typed record size instead.
    const bare = run(clean(), { type: 'addEntity', id: 'en-x', name: 'Archive', storeId: CLINIC.d1 }, { type: 'setStorage', entityId: 'en-x', initialRecords: 10 });
    expect(only(bare, 'VOL-01', 'physical')[0].message).toBe("'Archive' has no record size.");
  });

  it('the storage size estimate of the sample is worked out table by table', () => {
    const e = storageEstimate(clean());
    // client: 6 + 22 + 12 = 40, with 30% overhead 52. pet: 6 + 10 + 6 (foreign key) = 22.
    // appointment: 8 + 10 + 1 + 6 (foreign key) + 10 (copy) = 35.
    expect(e.tables.map((t) => [t.name, t.recordSize, t.growthBy])).toEqual([['client', 40, 'month'], ['pet', 22, 'month'], ['appointment', 35, 'year']]);
    expect(e.tables[0]).toMatchObject({ totalRecordSize: 52, initialVolume: 93600, finalRecords: 2400, finalVolume: 124800 });
    // 9,000 appointments growing 12% a year for two years: 11,289.6.
    expect(e.tables[2].finalRecords).toBeCloseTo(11289.6, 6);
    expect(e.finalVolume).toBeCloseTo(124800 + 28.6 * 3560 + 45.5 * 11289.6, 4);
    const typed = run(clean(), { type: 'addEntity', id: 'en-x', name: 'Archive' }, { type: 'setStorage', entityId: 'en-x', initialRecords: 10, recordSize: 200 });
    expect(storageEstimate(typed).tables[3]).toMatchObject({ typedSize: true, recordSize: 200, totalRecordSize: 260, initialVolume: 2600 });
  });

  it('refuses a physical field the element does not have', () => {
    expect(refused(sampleModel(), { type: 'setPhysical', id: CLINIC.client, implementation: 'Python' })).toBe("This is an external entity, which has no field named 'implementation'.");
    expect(refused(sampleModel(), { type: 'setPhysical', id: CLINIC.p0, systemRelated: true })).toContain('Process 0');
    expect(refused(sampleModel(), { type: 'setStorage', entityId: 'en-pet', initialRecords: 1.5 })).toContain('whole number');
  });
});

describe('Logical and physical modes', () => {
  /** The clean sample with a system-related process, data store and flows on level 0, and a system-related data element. */
  const withAudit = () => {
    let m = run(clean(), { type: 'addProcess', diagramId: CLINIC.level0, id: 'p-audit', name: 'Write Audit Trail', description: 'Records who changed what.', systemRelated: true });
    m = run(m, { type: 'addDataStore', diagramId: CLINIC.level0, id: 's-audit', name: 'Audit Trail', description: 'Every change.', systemRelated: true });
    m = run(m, { type: 'defineData', dataKind: 'dataElement', id: 'd-changed', name: 'Changed On', description: 'When it changed.', systemRelated: true });
    // A structure has no mark of its own: it is left out because its only part is.
    m = run(m, { type: 'defineData', dataKind: 'dataStructure', id: 'd-audit', name: 'Audit Entry', description: 'One change.', components: [{ dataId: 'd-changed', occurs: 'once' }] });
    m = run(m, { type: 'addFlow', diagramId: CLINIC.level0, id: 'f-audit-in', sourceId: CLINIC.p2, targetId: 'p-audit', dataId: 'd-audit', systemRelated: true });
    m = run(m, { type: 'addFlow', diagramId: CLINIC.level0, id: 'f-audit-out', sourceId: 'p-audit', targetId: 's-audit', dataId: 'd-audit', systemRelated: true });
    return run(m, { type: 'setPhysical', id: 'p-audit', implementation: 'Database trigger' }, { type: 'setPhysical', id: 's-audit', physicalName: 'PostgreSQL: audit table' });
  };

  it('logical mode leaves out everything system-related, and what hangs from it', () => {
    const m = withAudit();
    const logical = modelForMode(m, 'logical');
    for (const id of ['p-audit', 's-audit', 'd-changed', 'd-audit', 'f-audit-in', 'f-audit-out']) expect(logical.elements[id]).toBeUndefined();
    expect(Object.values(logical.views.occurrences).some((o) => o.elementId === 'p-audit')).toBe(false);
    expect(all(logical, 'process')).toHaveLength(7);
    expect(checkInvariants(logical)).toBeNull();
    expect(modelForMode(m, 'physical')).toBe(m);
    expect(modelForMode(m, 'logical')).toBe(logical);
    // A model with nothing system-related is its own logical model.
    const plain = clean();
    expect(modelForMode(plain, 'logical')).toBe(plain);
  });

  it('the rules run on each mode’s own model', () => {
    const m = withAudit();
    // Logical: the audit parts are not there, so nothing is said about them.
    expect(ids(m)).toEqual(['DM-01', 'DM-01']);
    // Physical: every rule sees the audit parts. The store is written and never read (DFD-09)
    // and holds no entity (DM-02). The process passes its data on unchanged (DFD-15), and no
    // interface (ISD-04) or module (SC-07) carries it out. Its two flows have no physical name.
    expect(ids(m, 'physical')).toEqual(['DFD-09', 'DFD-15', 'DM-01', 'DM-01', 'DM-02', 'ISD-04', 'PD-02', 'PD-02', 'SC-07']);
  });
});

describe('The binder and the project', () => {
  it('starts a section from a layout, and keeps the conversion strategy on the migration plan only', () => {
    let m = run(blank(), { type: 'addBinderSection', id: 'b1', name: '', layout: 'staffing-plan' }, { type: 'addBinderSection', id: 'b2', name: 'Our plan to switch', layout: 'migration-plan' });
    const [staffing, migration] = binderSections(m);
    expect([staffing.name, staffing.phase, staffing.conversion]).toEqual(['Staffing plan', 'planning', null]);
    expect(staffing.body).toContain('| Role | Description | Person assigned |');
    expect([migration.name, migration.phase]).toEqual(['Our plan to switch', 'implementation']);
    expect(migration.conversion).toEqual({ style: null, location: null, modules: null, reasons: '' });
    expect(refused(m, { type: 'setConversion', sectionId: 'b1', style: 'direct' })).toContain('Only a migration plan');
    m = run(m, { type: 'setConversion', sectionId: 'b2', style: 'direct', location: 'simultaneous' });
    expect(conversionEffects(get(m, 'b2', 'binderSection')!.conversion).map((e) => [e.choice, e.title, e.risk, e.cost, e.time])).toEqual([
      ['style', 'Direct conversion', 'high', 'low', 'low'],
      ['location', 'Simultaneous conversion', 'high', 'high', 'low'],
    ]);
    // Nothing in the binder is checked.
    expect(ids(m)).toEqual(ids(blank()));
  });

  it('keeps a small attachment and refuses a big one in plain words', () => {
    const m = run(blank(), { type: 'addBinderSection', id: 'b', name: 'Notes' });
    const small = `data:text/plain;base64,${'QUJD'.repeat(100)}`;
    const kept = run(m, { type: 'addAttachment', sectionId: 'b', name: 'notes.txt', dataUrl: small });
    expect(get(kept, 'b', 'binderSection')!.attachments[0]).toMatchObject({ name: 'notes.txt', mimeType: 'text/plain', size: 300 });
    const big = `data:application/pdf;base64,${'QUJD'.repeat(MAX_ATTACHMENT_BYTES / 3 + 1)}`;
    expect(refused(m, { type: 'addAttachment', sectionId: 'b', name: 'report.pdf', dataUrl: big })).toBe(
      "'report.pdf' is too big to keep here. This prototype saves the project in the browser, so a file can be at most 300 KB, and this one is 301 KB.",
    );
    const id = get(kept, 'b', 'binderSection')!.attachments[0].id;
    expect(get(run(kept, { type: 'removeAttachment', sectionId: 'b', attachmentId: id }), 'b', 'binderSection')!.attachments).toEqual([]);
  });

  it('renames the project', () => {
    expect(run(sampleModel(), { type: 'renameProject', name: '  Harbour Road clinic ' }).name).toBe('Harbour Road clinic');
    expect(refused(sampleModel(), { type: 'renameProject', name: ' ' })).toBe('A project needs a name.');
  });

  it('opens a file saved before the second release, with the new fields filled in', () => {
    const old = JSON.parse(JSON.stringify(buildClinic({ secondRelease: false })));
    delete old.project;
    delete old.views.isd;
    const added = ['implementation', 'human', 'systemRelated', 'physicalName', 'fieldName', 'defaultValue', 'averageWidth', 'tableName', 'copies', 'initialRecords', 'growthPerMonth', 'growthPerYear', 'recordSize', 'foreignKey'];
    for (const e of Object.values(old.elements) as Record<string, unknown>[]) for (const field of added) delete e[field];
    const opened = normalizeModel(old);
    expect(opened).toEqual(buildClinic({ secondRelease: false }));
    expect(ids(opened, 'physical')).toEqual(['BAL-01', 'BAL-03', 'DFD-13', 'DM-01', 'DM-01']);
    // The whole sample survives being saved and opened again.
    expect(normalizeModel(JSON.parse(JSON.stringify(sampleModel())))).toEqual(sampleModel());
  });
});

describe('The whole sample', () => {
  it('has exactly these eleven findings in logical mode', () => {
    const findings = runRules(sampleModel());
    expect(countFindings(findings)).toEqual({ errors: 2, warnings: 9 });
    expect(findings.map((f) => [f.ruleId, f.severity, f.diagramId ?? f.area, f.message])).toEqual([
      ['FA-02', 'error', 'feasibility', 'The return on investment you typed, 42.9%, does not match the table.'],
      ['BAL-01', 'error', CLINIC.child1, "'Appointment Request' enters 'Schedule Appointment' on the parent diagram but does not fully enter this diagram. Missing: Client Details."],
      ['RQ-01', 'warning', 'requirements', 'Requirement 1.4 is not traced to a use case or a process.'],
      ['DFD-13', 'warning', CLINIC.level0, "'Produce Daily Schedule' has no description."],
      ['BAL-03', 'warning', CLINIC.child1, "'Booking Info' crosses the edge of this diagram but not 'Schedule Appointment' on the parent diagram."],
      ['DM-01', 'warning', 'dataModel', "'Client' is not held in any data store."],
      ['DM-01', 'warning', 'dataModel', "'Pet' is not held in any data store."],
      ['AM-03', 'warning', 'alternatives', "'How to get the appointment system' has 1 cell with no supporting information."],
      ['ISD-03', 'warning', 'interface', "'Find Client' has nothing below it and names no process."],
      ['PS-01', 'warning', 'structure', "The program specification of 'Send Confirmation' has no pseudocode."],
      ['TP-02', 'warning', 'testPlan', 'No test addresses requirement 3.1.'],
    ]);
  });

  it('has four more in physical mode', () => {
    const logical = new Set(runRules(sampleModel()).map((f) => f.id));
    const extra = runRules(sampleModel(), 'physical').filter((f) => !logical.has(f.id));
    expect(runRules(sampleModel(), 'physical')).toHaveLength(15);
    expect(extra.map((f) => [f.ruleId, f.severity, f.diagramId ?? f.area, f.message])).toEqual([
      ['PD-01', 'warning', CLINIC.level0, "'Record Visit' has no implementation and is not marked as human work."],
      ['PD-02', 'warning', CLINIC.child1, "The flow 'Available Slot' has no physical name."],
      ['PDM-03', 'warning', 'dataModel', "The relationship between 'Pet' and 'Appointment' has no foreign key."],
      ['VOL-01', 'warning', 'storage', "'Appointment' has no average width for Reason for Visit."],
    ]);
  });

  it('has only DM-01 twice when its deliberate slips are left out, in both modes', () => {
    expect(ids(clean())).toEqual(['DM-01', 'DM-01']);
    expect(ids(clean(), 'physical')).toEqual(['DM-01', 'DM-01']);
  });

  it('holds something of every new kind, and adds nothing to the first-release counts', () => {
    const m = sampleModel();
    expect(checkInvariants(m)).toBeNull();
    const n = (kind: Parameters<typeof all>[1]) => all(m, kind).length;
    expect([n('systemRequest'), n('feasibility'), n('requirement'), n('alternativeMatrix'), n('test')]).toEqual([1, 1, 12, 1, 5]);
    expect([n('interfaceDiagram'), n('interface'), n('navigationLink'), n('binderSection')]).toEqual([1, 7, 7, 4]);
    expect([n('structureChart'), n('module'), n('couple')]).toEqual([1, 10, 16]);
    expect([n('process'), n('dataStore'), n('dataFlow'), n('dataElement'), n('dataStructure'), n('entity')]).toEqual([7, 1, 19, 16, 11, 3]);
    const added = ['systemRequest', 'feasibility', 'requirement', 'alternativeMatrix', 'test', 'interface', 'binderSection', 'module', 'couple'];
    expect(Object.values(m.elements).filter((e) => added.includes(e.kind)).every((e) => e.origin === 'starter')).toBe(true);
    expect(systemRequest(m)!.businessValue[0].estimates).toHaveLength(3);
    const interviews = get(m, C.binderInterviews, 'binderSection')!;
    expect(interviews.attachments.map((a) => [a.name, a.mimeType, a.size < 1000])).toEqual([['diary-page-sketch.svg', 'image/svg+xml', true]]);
    expect(get(m, C.binderMigration, 'binderSection')!.conversion).toMatchObject({ style: 'parallel', location: 'pilot', modules: 'whole-system' });
    expect(m.project).toEqual({ noneExpected: ['cultural and political'], overheadRate: 30, months: 24 });
    expect(get(m, CLINIC.p12, 'process')!.implementation).toBe('Python and SQL transaction');
    expect(get(m, CLINIC.client, 'externalEntity')!.human).toBe(true);
    // Small enough to save in the browser many times over.
    expect(JSON.stringify(m).length).toBeLessThan(100_000);
  });

  it('search and routes reach the new kinds', () => {
    const m = sampleModel();
    expect(search(m, { text: 'paper diary' }).map((r) => [r.element.id, r.route])).toEqual([
      [C.systemRequest, '/system-request'],
      [C.binderMigration, `/binder/${C.binderMigration}`],
    ]);
    expect(routeOf(m, C.mBook)).toEqual({ route: `/structure/${C.chart}`, where: 'Clinic System' });
    expect(routeOf(m, C.ifVisit)).toEqual({ route: `/interfaces/${C.interfaceDiagram}`, where: 'Clinic System interfaces' });
    expect(search(m, { text: 'free times', kind: 'requirement' }).map((r) => r.label)).toEqual([
      '1.1 The system will show the free times on the date a client prefers.',
      '2.1 The free times for a date will be shown within two seconds.',
    ]);
  });
});

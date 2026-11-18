// Tests for what the revised specification added: carryDown, the top diagram, findings
// for undecided and repeating data model items, search, fragments, and the starters.

import { describe, expect, it } from 'vitest';
import { apply, applyAll } from '../model/apply';
import type { Command } from '../model/commands';
import { asStarter, normalizeModel } from '../model/normalize';
import { all, eventResponseList, flowsOn, get, getFragment, isAboveProject, parentEnd, search, topDiagram } from '../model/queries';
import { emptyModel, type Model } from '../model/types';
import { buildClinic, CLINIC, dataIdOf, sampleModel } from '../sample/clinic';
import { starterById, STARTER_IDS, STARTERS } from '../sample/starters';
import { runRules } from './engine';

function run(model: Model, command: Command): Model {
  const r = apply(model, command);
  if (!r.ok) throw new Error(`${command.type} was refused: ${r.error}`);
  return r.model;
}

const ruleIds = (model: Model) => runRules(model).map((f) => f.ruleId).sort();
const starter = (id: string) => starterById(id)!.build();

describe('carryDown', () => {
  it('is refused for a process with no child diagram', () => {
    const r = apply(sampleModel(), { type: 'carryDown', processId: CLINIC.p2 });
    expect(r.ok).toBe(false);
  });

  it('expandProcess is refused when the process already has a child diagram', () => {
    expect(apply(sampleModel(), { type: 'expandProcess', processId: CLINIC.p1 }).ok).toBe(false);
  });

  it('brings down a parent flow that was added after the child diagram was made', () => {
    let m = buildClinic({ mistakes: false });
    m = run(m, { type: 'addFlow', diagramId: CLINIC.level0, sourceId: CLINIC.p1, targetId: CLINIC.vet, dataName: 'Booking Alert' });
    const before = flowsOn(m, CLINIC.child1).length;
    const r = apply(m, { type: 'carryDown', processId: CLINIC.p1 });
    if (!r.ok) throw new Error(r.error);
    // One new flow, carrying the same data, out to the veterinarian, with its inner end unattached.
    expect(r.created).toHaveLength(1);
    const flow = get(r.model, r.created[0], 'dataFlow')!;
    expect(flow.diagramId).toBe(CLINIC.child1);
    expect(flow.sourceId).toBeNull();
    expect(flow.targetId).toBe(CLINIC.vet);
    expect(r.model.elements[flow.dataId].name).toBe('Booking Alert');
    expect(flowsOn(r.model, CLINIC.child1)).toHaveLength(before + 1);
    // The veterinarian was placed on the child diagram.
    expect(Object.values(r.model.views.occurrences).some((o) => o.diagramId === CLINIC.child1 && o.elementId === CLINIC.vet)).toBe(true);
    // A second time there is nothing left to bring.
    expect(apply(r.model, { type: 'carryDown', processId: CLINIC.p1 }).ok).toBe(false);
  });

  it('leaves alone a flow whose data already arrives in parts', () => {
    // In the correct clinic, "Appointment Request" arrives as "Client Details" and "Visit Details".
    const r = apply(buildClinic({ mistakes: false }), { type: 'carryDown', processId: CLINIC.p1 });
    expect(r.ok).toBe(false);
  });

  it('brings down a flow of which a part is missing, which clears BAL-01', () => {
    const r = apply(sampleModel(), { type: 'carryDown', processId: CLINIC.p1 });
    if (!r.ok) throw new Error(r.error);
    expect(r.created).toHaveLength(1);
    expect(get(r.model, r.created[0], 'dataFlow')!.dataId).toBe(dataIdOf('Appointment Request'));
    expect(runRules(r.model).some((f) => f.ruleId === 'BAL-01')).toBe(false);
  });
});

describe('The top diagram', () => {
  it('"Level 0 alone" reports nothing about the context diagram or process 0', () => {
    const m = starter('level-0-alone');
    expect(topDiagram(m)!.id).toBe(STARTER_IDS.level0);
    expect(isAboveProject(m, STARTER_IDS.context)).toBe(true);
    expect(isAboveProject(m, STARTER_IDS.level0)).toBe(false);
    const findings = runRules(m);
    expect(findings.some((f) => f.diagramId === STARTER_IDS.context)).toBe(false);
    expect(findings.some((f) => f.elementIds.includes(STARTER_IDS.p0))).toBe(false);
    expect(findings.every((f) => f.diagramId === STARTER_IDS.level0)).toBe(true);
  });

  it('the same project reports the context diagram once it is the top diagram again', () => {
    const m = run(starter('level-0-alone'), { type: 'setTopDiagram', diagramId: null });
    expect(isAboveProject(m, STARTER_IDS.context)).toBe(false);
    expect(runRules(m).some((f) => f.diagramId === STARTER_IDS.context && f.ruleId === 'DFD-07')).toBe(true);
  });

  it('balances the top diagram against its parent only when the parent has a flow', () => {
    // The clinic's child diagram as the top: its parent, process 1, has flows, so BAL-01 stays.
    const m = run(sampleModel(), { type: 'setTopDiagram', diagramId: CLINIC.child1 });
    const findings = runRules(m);
    expect(findings.some((f) => f.ruleId === 'BAL-01')).toBe(true);
    // Nothing is reported on level 0, which is now above the project.
    expect(findings.some((f) => f.diagramId === CLINIC.level0)).toBe(false);
    expect(findings.some((f) => f.ruleId === 'DFD-13' && f.elementIds[0] === CLINIC.p3)).toBe(false);
  });

  it('deleting the top diagram puts the top back at the context diagram', () => {
    let m = run(sampleModel(), { type: 'setTopDiagram', diagramId: CLINIC.child1 });
    m = run(m, { type: 'deleteElement', id: CLINIC.child1 });
    expect(m.settings.topDiagramId).toBeNull();
  });
});

describe('ERD-10 and ERD-11', () => {
  const twoEntities = (): Model =>
    applyAll(emptyModel(), [
      { type: 'createProject', name: 'P', id: 'ctx', processId: 'p0' },
      { type: 'addEntity', id: 'a', name: 'Order' },
      { type: 'addEntity', id: 'b', name: 'Customer' },
    ]);

  it('a new relationship starts undecided, has no parent, and gives ERD-10 and not ERD-05', () => {
    const m = run(twoEntities(), { type: 'addRelationship', id: 'r', ends: [{ entityId: 'a' }, { entityId: 'b' }] });
    const rel = get(m, 'r', 'relationship')!;
    expect(rel.ends.map((e) => [e.min, e.max])).toEqual([
      [null, null],
      [null, null],
    ]);
    expect(parentEnd(rel)).toBeNull();
    const ids = ruleIds(m);
    expect(ids.filter((id) => id === 'ERD-10')).toHaveLength(1);
    expect(ids).not.toContain('ERD-05');
    const finding = runRules(m).find((f) => f.ruleId === 'ERD-10')!;
    expect(finding.severity).toBe('warning');
    expect(finding.elementIds[0]).toBe('r');
    expect(finding.message).toContain("'Order'");
  });

  it('ERD-10 stays while one value is missing and goes when all four are set', () => {
    let m = run(twoEntities(), { type: 'addRelationship', id: 'r', ends: [{ entityId: 'a' }, { entityId: 'b' }] });
    m = run(m, {
      type: 'updateRelationship',
      id: 'r',
      ends: [
        { entityId: 'a', verbPhrase: 'is placed by', min: 0, max: 'many' },
        { entityId: 'b', verbPhrase: 'places', min: null, max: 'one' },
      ],
    });
    expect(ruleIds(m)).toContain('ERD-10');
    expect(parentEnd(get(m, 'r', 'relationship')!)).toBe(1);
    m = run(m, {
      type: 'updateRelationship',
      id: 'r',
      ends: [
        { entityId: 'a', verbPhrase: 'is placed by', min: 0, max: 'many' },
        { entityId: 'b', verbPhrase: 'places', min: 1, max: 'one' },
      ],
    });
    expect(ruleIds(m)).not.toContain('ERD-10');
  });

  it('an undecided relationship cannot be made identifying', () => {
    const m = run(twoEntities(), { type: 'addRelationship', id: 'r', ends: [{ entityId: 'a' }, { entityId: 'b' }] });
    expect(apply(m, { type: 'updateRelationship', id: 'r', identifying: true }).ok).toBe(false);
  });

  it('a repeating attribute gives ERD-11, naming the entity and the attributes', () => {
    let m = run(twoEntities(), { type: 'addAttribute', entityId: 'a', dataName: 'Order Number', identifier: true });
    expect(ruleIds(m)).not.toContain('ERD-11');
    m = run(m, { type: 'addAttribute', entityId: 'a', dataName: 'Item Code', repeats: true });
    const finding = runRules(m).find((f) => f.ruleId === 'ERD-11')!;
    expect(finding.severity).toBe('warning');
    expect(finding.elementIds).toEqual(['a', all(m, 'dataElement').find((e) => e.name === 'Item Code')!.id]);
    expect(finding.message).toBe("'Order' holds repeating data: Item Code.");
  });

  it('setAttributes keeps `repeats` when it is left out', () => {
    let m = run(twoEntities(), { type: 'addAttribute', entityId: 'a', dataName: 'Item Code', repeats: true });
    const dataId = get(m, 'a', 'entity')!.attributes[0].dataId;
    m = run(m, { type: 'setAttributes', entityId: 'a', attributes: [{ dataId, identifier: true }] });
    expect(get(m, 'a', 'entity')!.attributes[0]).toEqual({ dataId, identifier: true, repeats: true });
  });

  it('"Normalize a file" has one entity with three repeating attributes and one ERD-11', () => {
    const m = starter('normalize-a-file');
    const [file] = all(m, 'entity');
    expect(all(m, 'entity')).toHaveLength(1);
    expect(all(m, 'relationship')).toHaveLength(0);
    expect(file.attributes).toHaveLength(8);
    expect(file.attributes.filter((a) => a.repeats)).toHaveLength(3);
    expect(ruleIds(m).filter((id) => id === 'ERD-11')).toHaveLength(1);
  });
});

describe('search', () => {
  const m = sampleModel();

  it('finds by name, alias, description and notes', () => {
    expect(search(m, { text: 'veterinarian' }).map((r) => r.element.id)).toContain(CLINIC.vet);
    const byAlias = search(m, { text: 'pet owner' });
    expect(byAlias.map((r) => r.element.id)).toEqual([CLINIC.client]);
    expect(byAlias[0].matchedIn).toEqual(['alias']);
    const byNotes = search(m, { text: 'front desk' });
    expect(byNotes.map((r) => r.element.id)).toEqual([dataIdOf('Appointment Request')]);
    expect(byNotes[0].matchedIn).toEqual(['notes']);
    expect(byNotes[0].route).toBe(`/dictionary/${dataIdOf('Appointment Request')}`);
    // A process's longer description counts as a description.
    expect(search(m, { text: 'IF the slot is still free' }).map((r) => r.element.id)).toEqual([CLINIC.p12]);
  });

  it('gives each result a label and a route', () => {
    const [book] = search(m, { text: 'Book Slot', kind: 'process' });
    expect(book.label).toBe('1.2 Book Slot');
    expect(book.route).toBe(`/diagram/${CLINIC.child1}`);
    expect(book.where).toBe('1 Schedule Appointment');
    expect(search(m, { text: 'Schedule Appointment', kind: 'useCase' })[0].route).toBe('/use-cases/uc-1');
    expect(search(m, { text: 'Pet', kind: 'entity' })[0].route).toBe('/data-model');
  });

  it('narrows to a kind and to a diagram', () => {
    expect(search(m, { text: '', kind: 'dataStore' }).map((r) => r.element.id)).toEqual([CLINIC.d1]);
    const onContext = search(m, { text: '', diagramId: CLINIC.context, kind: 'process' });
    expect(onContext.map((r) => r.element.id)).toEqual([CLINIC.p0]);
    const data = search(m, { text: 'Booking', diagramId: CLINIC.level0 });
    expect(data).toHaveLength(0);
  });

  it('finds what has no description, and what is used nowhere', () => {
    expect(search(m, { text: '', only: 'noDescription' }).map((r) => r.element.id)).toEqual([CLINIC.p3, 'r-client-pet', 'r-pet-appointment']);
    expect(search(m, { text: '', only: 'unused' })).toHaveLength(0);
    const more = run(m, { type: 'defineData', dataKind: 'dataElement', id: 'd-spare', name: 'Spare', description: 'Left over.' });
    expect(search(more, { text: '', only: 'unused' }).map((r) => r.element.id)).toEqual(['d-spare']);
  });
});

describe('getFragment and eventResponseList', () => {
  const m = sampleModel();

  it('gives a process with its flows and the elements at their other ends', () => {
    const fragment = getFragment(m, CLINIC.p2)!;
    expect(fragment.process.id).toBe(CLINIC.p2);
    expect(fragment.diagramId).toBe(CLINIC.level0);
    expect(fragment.flows.map((f) => `${f.direction} ${f.dataName} ${f.otherLabel}`)).toEqual([
      'in Appointment Record D1 Appointments',
      'in Visit Notes Veterinarian',
      'out Visit Summary Veterinarian',
    ]);
    expect(fragment.elements.map((e) => e.id)).toEqual([CLINIC.vet, CLINIC.d1]);
    expect(fragment.controlFlows).toHaveLength(0);
  });

  it('takes only the flows on the process’s own diagram, and control flows too', () => {
    // Process 1 has flows on level 0. The flows of its child diagram are not part of its fragment.
    const withTimer = run(m, { type: 'addControlFlow', diagramId: CLINIC.level0, targetId: CLINIC.p1, name: 'Start of Day' });
    const fragment = getFragment(withTimer, CLINIC.p1)!;
    expect(fragment.flows).toHaveLength(3);
    expect(fragment.flows.every((f) => f.flow.diagramId === CLINIC.level0)).toBe(true);
    expect(fragment.controlFlows.map((c) => c.name)).toEqual(['Start of Day']);
    expect(getFragment(m, 'nothing')).toBeUndefined();
  });

  it('lists one event and response for each use case', () => {
    expect(eventResponseList(m)).toEqual([
      { id: 'uc-1', trigger: 'A client asks for an appointment.', name: 'Schedule Appointment' },
      { id: 'uc-2', trigger: 'A veterinarian finishes seeing a pet.', name: 'Record Visit' },
      { id: 'uc-3', trigger: 'A veterinarian asks for the day’s schedule.', name: 'Produce Daily Schedule' },
    ]);
  });
});

describe('The sample and the starters', () => {
  it('the sample keeps exactly its five findings', () => {
    expect(ruleIds(sampleModel())).toEqual(['BAL-01', 'BAL-03', 'DFD-13', 'DM-01', 'DM-01']);
  });

  it('the sample shows the new entry fields', () => {
    const m = sampleModel();
    expect(m.elements[CLINIC.client].aliases).toEqual(['Pet owner']);
    expect(m.elements[dataIdOf('Appointment Request')].notes).not.toBe('');
    expect(get(m, CLINIC.p12, 'process')!.processDescription).not.toBe('');
    expect(get(m, dataIdOf('Reason for Visit'), 'dataElement')!.allowedValues![0]).toEqual({ value: 'C', meaning: 'Check-up' });
  });

  it('every starter builds, and every element in it is marked as given', () => {
    expect(STARTERS.map((s) => s.id)).toEqual(['blank', 'level-0-alone', 'find-the-errors', 'normalize-a-file']);
    for (const s of STARTERS) {
      const m = s.build();
      expect(Object.values(m.elements).every((e) => e.origin === 'starter')).toBe(true);
      // A project file made from it opens again as the same model.
      expect(normalizeModel(JSON.parse(JSON.stringify(m)))).toEqual(m);
    }
  });

  it('"Find the errors" holds its five seeded problems and shows them on request', () => {
    const m = starter('find-the-errors');
    expect(m.settings.showFindings).toBe('onRequest');
    expect(ruleIds(m)).toEqual(['DFD-03', 'DFD-04', 'DFD-05', 'DFD-13', 'DFD-14']);
  });

  it('asStarter marks everything as given without changing the model passed in', () => {
    const m = run(sampleModel(), { type: 'addEntity', id: 'en-new', name: 'Invoice' });
    expect(m.elements['en-new'].origin).toBe('student');
    expect(asStarter(m).elements['en-new'].origin).toBe('starter');
    expect(m.elements['en-new'].origin).toBe('student');
  });

  it('a file from before the revision opens with the new fields filled in', () => {
    const old = JSON.parse(JSON.stringify(sampleModel()));
    delete old.settings;
    for (const e of Object.values(old.elements) as Record<string, unknown>[]) {
      delete e.aliases;
      delete e.notes;
      delete e.processDescription;
      if (Array.isArray(e.allowedValues)) e.allowedValues = (e.allowedValues as { value: string }[]).map((v) => v.value);
    }
    const m = normalizeModel(old);
    expect(m.settings).toEqual({ topDiagramId: null, showFindings: 'always' });
    expect(m.elements[CLINIC.p1].aliases).toEqual([]);
    expect(get(m, dataIdOf('Reason for Visit'), 'dataElement')!.allowedValues![0]).toEqual({ value: 'C', meaning: '' });
    expect(() => normalizeModel({ hello: 'world' })).toThrow('This file is not a Diagramble project.');
  });
});

describe('Other new commands', () => {
  it('sets aliases, notes and a limit, and keeps a meaning when a value is given as text', () => {
    let m = sampleModel();
    m = run(m, { type: 'setAliases', id: CLINIC.vet, aliases: [' Vet ', 'vet', '', 'Doctor'] });
    expect(m.elements[CLINIC.vet].aliases).toEqual(['Vet', 'Doctor']);
    m = run(m, { type: 'setDataType', dataId: dataIdOf('Reason for Visit'), dataType: 'Code', allowedValues: ['C', 'X'] });
    expect(get(m, dataIdOf('Reason for Visit'), 'dataElement')!.allowedValues).toEqual([
      { value: 'C', meaning: 'Check-up' },
      { value: 'X', meaning: '' },
    ]);
    const structure = dataIdOf('Client Details');
    const part = dataIdOf('Phone');
    expect(apply(m, { type: 'setLimit', dataId: structure, componentId: part, limit: 3 }).ok).toBe(false);
    m = run(m, { type: 'setOccurs', dataId: structure, componentId: part, occurs: 'many', limit: 3 });
    expect(get(m, structure, 'dataStructure')!.components[1]).toEqual({ dataId: part, occurs: 'many', limit: 3 });
    m = run(m, { type: 'setOccurs', dataId: structure, componentId: part, occurs: 'once' });
    expect(get(m, structure, 'dataStructure')!.components[1]).toEqual({ dataId: part, occurs: 'once' });
    m = run(m, { type: 'setDataDetails', dataId: part, length: 12, nullable: true });
    expect(get(m, part, 'dataElement')).toMatchObject({ length: 12, nullable: true });
  });

  it('keeps a CRUD cell under an entity that has no attributes', () => {
    let m = run(sampleModel(), { type: 'addEntity', id: 'en-invoice', name: 'Invoice' });
    m = run(m, { type: 'setCrud', processId: CLINIC.p2, dataId: 'en-invoice', uses: 'rc' });
    expect(get(m, CLINIC.p2, 'process')!.crud).toContainEqual({ dataId: 'en-invoice', uses: 'CR' });
    // An entity that has attributes takes its cells on the attributes.
    expect(apply(m, { type: 'setCrud', processId: CLINIC.p2, dataId: 'en-client', uses: 'R' }).ok).toBe(false);
    m = run(m, { type: 'deleteElement', id: 'en-invoice' });
    expect(get(m, CLINIC.p2, 'process')!.crud.some((c) => c.dataId === 'en-invoice')).toBe(false);
  });
});

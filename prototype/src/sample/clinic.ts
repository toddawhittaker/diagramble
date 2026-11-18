// The sample project "Clinic appointments": docs/mockups/BRIEFS.md section 1.4,
// which is case B of docs/SPEC.md section 6.2 with two student mistakes, plus use
// cases and a small data model. `clinic2.ts` adds the content of the second release.
// It is built with commands only.

import { apply } from '../model/apply';
import type { Command } from '../model/commands';
import { occurrencesOn } from '../model/queries';
import { emptyModel, type Id, type Model, type Side } from '../model/types';
import { addSecondRelease } from './clinic2';

export { CLINIC2 } from './clinic2';

export interface ClinicOptions {
  /** The two student mistakes: the "Booking Info" flow, and no description on process 3. */
  mistakes?: boolean;
  useCases?: boolean;
  dataModel?: boolean;
  /**
   * The content of the second release: forms, interface diagram, binder, physical details,
   * structure chart and storage figures. It needs the use cases and the data model, and is
   * left out without them. `mistakes` also decides whether it holds its deliberate slips.
   */
  secondRelease?: boolean;
}

/** Stable ids, so that screens and tests can point at the sample's items. */
export const CLINIC = {
  context: 'dg-context',
  level0: 'dg-level0',
  child1: 'dg-1',
  p0: 'p0',
  p1: 'p1',
  p2: 'p2',
  p3: 'p3',
  p11: 'p1-1',
  p12: 'p1-2',
  p13: 'p1-3',
  client: 'x-client',
  vet: 'x-vet',
  d1: 's-appointments',
} as const;

/** The id of a data definition in the sample, from its name: "Visit Details" gives "d-visit-details". */
export function dataIdOf(name: string): Id {
  return `d-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

export function buildClinic(options: ClinicOptions = {}): Model {
  const { mistakes = true, useCases = true, dataModel = true, secondRelease = true } = options;
  let m = emptyModel();
  const run = (c: Command) => {
    const r = apply(m, c);
    if (!r.ok) throw new Error(`Sample data: ${c.type} was refused: ${r.error}`);
    m = r.model;
  };
  const origin = 'starter' as const;

  run({
    type: 'createProject',
    name: 'Clinic appointments',
    systemName: 'Clinic System',
    id: CLINIC.context,
    processId: CLINIC.p0,
    description: 'Books appointments, records visits and produces the daily schedule for a veterinary clinic.',
    origin,
  });

  // ---- Dictionary ----
  const element = (name: string, dataType: string, description: string) =>
    run({ type: 'defineData', dataKind: 'dataElement', id: dataIdOf(name), name, dataType, description, origin });
  const structure = (name: string, parts: string[], description: string) =>
    run({
      type: 'defineData',
      dataKind: 'dataStructure',
      id: dataIdOf(name),
      name,
      description,
      origin,
      components: parts.map((p) => ({ dataId: dataIdOf(p), occurs: 'once' })),
    });

  element('Appointment Entry', 'Text', 'One line in the appointment book: who is coming, with which pet, and when.');
  if (mistakes) element('Booking Code', 'Text', 'A short code the clinic gives a client when a time is held for them.');
  element('Booking Reference', 'Text', 'The reference that identifies one booked time.');
  element('Client Name', 'Text', 'The full name of the person who owns the pet.');
  element('Confirmation Text', 'Text', 'The wording that tells the client the date and time of the appointment.');
  element('Notes Text', 'Text', 'What the veterinarian writes down about a visit.');
  element('Pet Name', 'Text', 'The name of the animal to be seen.');
  element('Phone', 'Text', 'The telephone number the clinic uses to reach the client.');
  element('Preferred Date', 'Date', 'The day the client would like to come in.');
  run({
    type: 'defineData',
    dataKind: 'dataElement',
    id: dataIdOf('Reason for Visit'),
    name: 'Reason for Visit',
    dataType: 'Text',
    description: 'Why the pet needs to be seen.',
    allowedValues: [
      { value: 'C', meaning: 'Check-up' },
      { value: 'V', meaning: 'Vaccination' },
      { value: 'I', meaning: 'Illness or injury' },
      { value: 'F', meaning: 'Follow-up visit' },
    ],
    origin,
  });
  element('Schedule Listing', 'Text', 'The appointments for one day, in time order.');
  element('Slot Time', 'Date and time', 'The start of one free appointment time.');
  element('Summary Text', 'Text', 'A short account of what was done at a visit.');

  structure('Client Details', ['Client Name', 'Phone'], 'Who the client is and how to reach them.');
  structure('Visit Details', ['Pet Name', 'Preferred Date', 'Reason for Visit'], 'Which pet is to be seen, when, and why.');
  structure('Appointment Confirmation', ['Confirmation Text'], 'What the clinic sends a client once an appointment is booked.');
  structure('Appointment Record', ['Appointment Entry'], 'One booked appointment, as the clinic keeps it.');
  structure('Appointment Request', ['Client Details', 'Visit Details'], 'What a client gives the clinic to ask for an appointment.');
  structure('Available Slot', ['Slot Time'], 'A free time on the preferred date that can be offered to the client.');
  structure('Booking', ['Booking Reference'], 'A time that has been booked, passed on so the client can be told.');
  if (mistakes) structure('Booking Info', ['Booking Code'], 'What the client gives the clinic to hold a time.');
  structure('Daily Schedule', ['Schedule Listing'], 'The list of one day’s appointments, given to the veterinarian.');
  structure('Visit Notes', ['Notes Text'], 'What the veterinarian records about a visit.');
  structure('Visit Summary', ['Summary Text'], 'A summary of a visit, given back to the veterinarian.');

  // ---- Diagrams ----
  const flow = (diagramId: Id, sourceId: Id, sourceSide: Side, targetId: Id, targetSide: Side, data: string) =>
    run({ type: 'addFlow', diagramId, sourceId, targetId, dataId: dataIdOf(data), sourceSide, targetSide, origin });
  /** expandProcess copies the parent's flows down unattached. The sample draws its own, so clear them. */
  const expand = (processId: Id, diagramId: Id) => {
    run({ type: 'expandProcess', processId, diagramId });
    for (const o of occurrencesOn(m, diagramId)) run({ type: 'removeOccurrence', occurrenceId: o.id });
  };

  run({ type: 'moveNode', occurrenceId: occurrencesOn(m, CLINIC.context)[0].id, x: 335, y: 212 });
  run({
    type: 'addExternalEntity',
    diagramId: CLINIC.context,
    id: CLINIC.client,
    name: 'Client',
    description: 'A person who brings a pet to the clinic.',
    x: 60,
    y: 215,
    origin,
  });
  run({
    type: 'addExternalEntity',
    diagramId: CLINIC.context,
    id: CLINIC.vet,
    name: 'Veterinarian',
    description: 'The clinic’s doctor, who sees the pets and writes up each visit.',
    x: 660,
    y: 215,
    origin,
  });
  flow(CLINIC.context, CLINIC.client, 'right', CLINIC.p0, 'left', 'Appointment Request');
  flow(CLINIC.context, CLINIC.p0, 'bottom', CLINIC.client, 'bottom', 'Appointment Confirmation');
  flow(CLINIC.context, CLINIC.vet, 'left', CLINIC.p0, 'right', 'Visit Notes');
  flow(CLINIC.context, CLINIC.p0, 'top', CLINIC.vet, 'top', 'Visit Summary');
  flow(CLINIC.context, CLINIC.p0, 'bottom', CLINIC.vet, 'bottom', 'Daily Schedule');

  // Level 0.
  expand(CLINIC.p0, CLINIC.level0);
  const L0 = CLINIC.level0;
  run({ type: 'placeExisting', diagramId: L0, elementId: CLINIC.client, x: 40, y: 63 });
  run({ type: 'placeExisting', diagramId: L0, elementId: CLINIC.vet, x: 40, y: 348 });
  run({
    type: 'addProcess',
    diagramId: L0,
    id: CLINIC.p1,
    name: 'Schedule Appointment',
    description: 'Finds a free time for a client’s pet, books it and confirms it to the client.',
    x: 300,
    y: 60,
    origin,
  });
  run({
    type: 'addProcess',
    diagramId: L0,
    id: CLINIC.p2,
    name: 'Record Visit',
    description: 'Takes the veterinarian’s notes on a visit and gives back a summary.',
    x: 300,
    y: 250,
    origin,
  });
  run({
    type: 'addProcess',
    diagramId: L0,
    id: CLINIC.p3,
    name: 'Produce Daily Schedule',
    description: mistakes ? '' : 'Lists the day’s appointments for the veterinarian.',
    x: 300,
    y: 440,
    origin,
  });
  run({
    type: 'addDataStore',
    diagramId: L0,
    id: CLINIC.d1,
    name: 'Appointments',
    description: 'Every appointment the clinic has booked.',
    x: 590,
    y: 270,
    origin,
  });
  flow(L0, CLINIC.client, 'right', CLINIC.p1, 'left', 'Appointment Request');
  flow(L0, CLINIC.p1, 'top', CLINIC.client, 'top', 'Appointment Confirmation');
  flow(L0, CLINIC.p1, 'right', CLINIC.d1, 'top', 'Appointment Record');
  flow(L0, CLINIC.d1, 'left', CLINIC.p2, 'right', 'Appointment Record');
  flow(L0, CLINIC.vet, 'top', CLINIC.p2, 'left', 'Visit Notes');
  flow(L0, CLINIC.p2, 'bottom', CLINIC.vet, 'right', 'Visit Summary');
  flow(L0, CLINIC.d1, 'bottom', CLINIC.p3, 'right', 'Appointment Record');
  flow(L0, CLINIC.p3, 'left', CLINIC.vet, 'bottom', 'Daily Schedule');

  // 1 Schedule Appointment, laid out as screen 1 of the briefs describes.
  expand(CLINIC.p1, CLINIC.child1);
  const C1 = CLINIC.child1;
  run({ type: 'placeExisting', diagramId: C1, elementId: CLINIC.client, x: 50, y: 303 });
  run({
    type: 'addProcess',
    diagramId: C1,
    id: CLINIC.p11,
    name: 'Check Availability',
    description: 'Looks up which times are free on the client’s preferred date.',
    x: 300,
    y: 100,
    origin,
  });
  run({
    type: 'addProcess',
    diagramId: C1,
    id: CLINIC.p12,
    name: 'Book Slot',
    description: 'Books a free time for the client and records the appointment.',
    x: 300,
    y: 300,
    origin,
  });
  run({
    type: 'addProcess',
    diagramId: C1,
    id: CLINIC.p13,
    name: 'Send Confirmation',
    description: 'Tells the client the date and time that was booked.',
    x: 300,
    y: 500,
    origin,
  });
  run({ type: 'placeExisting', diagramId: C1, elementId: CLINIC.d1, x: 590, y: 320 });
  flow(C1, CLINIC.client, 'top', CLINIC.p11, 'left', 'Visit Details');
  flow(C1, CLINIC.client, 'right', CLINIC.p12, 'left', mistakes ? 'Booking Info' : 'Client Details');
  flow(C1, CLINIC.p11, 'bottom', CLINIC.p12, 'top', 'Available Slot');
  flow(C1, CLINIC.p12, 'bottom', CLINIC.p13, 'top', 'Booking');
  flow(C1, CLINIC.p12, 'right', CLINIC.d1, 'left', 'Appointment Record');
  flow(C1, CLINIC.p13, 'left', CLINIC.client, 'bottom', 'Appointment Confirmation');

  // ---- A few entry fields, so that the screens have something to show ----
  run({ type: 'setAliases', id: CLINIC.client, aliases: ['Pet owner'] });
  run({
    type: 'setNotes',
    id: dataIdOf('Appointment Request'),
    notes: 'Ask the front desk whether one request can cover more than one pet.',
  });
  run({
    type: 'setProcessDescription',
    processId: CLINIC.p12,
    processDescription: [
      'For the slot the client chose:',
      '  IF the slot is still free THEN',
      '    record the appointment with the client details and the slot',
      '    pass the booking on to be confirmed',
      '  ELSE',
      '    ask Check Availability for the free slots again',
    ].join('\n'),
  });

  // ---- Use cases ----
  if (useCases) {
    const d = dataIdOf;
    run({
      type: 'addUseCase',
      id: 'uc-1',
      name: 'Schedule Appointment',
      description: 'A client asks the clinic for an appointment and is given a confirmed time.',
      origin,
      priority: 'high',
      actorId: CLINIC.client,
      trigger: 'A client asks for an appointment.',
      triggerType: 'external',
      preconditions: ['The clinic is open for bookings.'],
      steps: [
        {
          text: 'The clinic checks which times are free on the preferred date.',
          substeps: [],
          information: [
            { direction: 'in', dataId: d('Visit Details') },
            { direction: 'out', dataId: d('Available Slot') },
          ],
        },
        {
          text: 'The clinic books a free time for the client.',
          substeps: [],
          information: [
            { direction: 'in', dataId: d('Client Details') },
            { direction: 'in', dataId: d('Available Slot') },
            { direction: 'out', dataId: d('Appointment Record') },
            { direction: 'out', dataId: d('Booking') },
          ],
        },
        {
          text: 'The clinic sends the client a confirmation.',
          substeps: [],
          information: [
            { direction: 'in', dataId: d('Booking') },
            { direction: 'out', dataId: d('Appointment Confirmation') },
          ],
        },
      ],
      postconditions: ['The appointment is recorded.', 'The client has a confirmation.'],
      exceptions: [
        { stepNumber: 1, text: 'No time is free on the preferred date. The clinic offers the nearest free dates.' },
      ],
      summaryInputs: [{ dataId: d('Appointment Request'), sourceId: CLINIC.client }],
      summaryOutputs: [
        { dataId: d('Appointment Confirmation'), destinationId: CLINIC.client },
        { dataId: d('Appointment Record'), destinationId: CLINIC.d1 },
      ],
      processId: CLINIC.p1,
    });
    run({
      type: 'addUseCase',
      id: 'uc-2',
      name: 'Record Visit',
      description: 'A veterinarian records what happened at a visit and is given a summary of it.',
      origin,
      priority: 'high',
      actorId: CLINIC.vet,
      trigger: 'A veterinarian finishes seeing a pet.',
      triggerType: 'external',
      preconditions: ['The appointment for the visit is recorded.'],
      steps: [
        {
          text: 'The clinic finds the appointment for the visit.',
          substeps: [],
          information: [{ direction: 'in', dataId: d('Appointment Record') }],
        },
        {
          text: 'The veterinarian gives the notes on the visit.',
          substeps: [],
          information: [{ direction: 'in', dataId: d('Visit Notes') }],
        },
        {
          text: 'The clinic gives the veterinarian a summary of the visit.',
          substeps: [],
          information: [{ direction: 'out', dataId: d('Visit Summary') }],
        },
      ],
      postconditions: ['The veterinarian has a summary of the visit.'],
      exceptions: [
        { stepNumber: 1, text: 'No appointment is found for the visit. The veterinarian is asked to check the pet and the date.' },
      ],
      summaryInputs: [
        { dataId: d('Visit Notes'), sourceId: CLINIC.vet },
        { dataId: d('Appointment Record'), sourceId: CLINIC.d1 },
      ],
      summaryOutputs: [{ dataId: d('Visit Summary'), destinationId: CLINIC.vet }],
      processId: CLINIC.p2,
    });
    run({
      type: 'addUseCase',
      id: 'uc-3',
      name: 'Produce Daily Schedule',
      description: 'The clinic lists the day’s appointments for the veterinarian.',
      origin,
      priority: 'medium',
      actorId: CLINIC.vet,
      trigger: 'A veterinarian asks for the day’s schedule.',
      triggerType: 'external',
      preconditions: ['Appointments are recorded for the day.'],
      steps: [
        {
          text: 'The clinic gathers the appointments booked for the day.',
          substeps: [],
          information: [{ direction: 'in', dataId: d('Appointment Record') }],
        },
        {
          text: 'The clinic puts them in time order and gives the schedule to the veterinarian.',
          substeps: [],
          information: [{ direction: 'out', dataId: d('Daily Schedule') }],
        },
      ],
      postconditions: ['The veterinarian has the schedule for the day.'],
      exceptions: [{ stepNumber: 1, text: 'No appointments are booked for the day. The schedule says so.' }],
      summaryInputs: [{ dataId: d('Appointment Record'), sourceId: CLINIC.d1 }],
      summaryOutputs: [{ dataId: d('Daily Schedule'), destinationId: CLINIC.vet }],
      processId: CLINIC.p3,
    });
  }

  // ---- Data model ----
  if (dataModel) {
    element('Client Number', 'Number', 'The number the clinic gives each client. No two clients share one.');
    element('Pet Number', 'Number', 'The number the clinic gives each pet. No two pets share one.');
    element('Appointment Number', 'Number', 'The number the clinic gives each appointment. No two appointments share one.');

    const entity = (id: Id, name: string, description: string, x: number, attributes: string[], storeId: Id | null) => {
      run({ type: 'addEntity', id, name, description, x, y: 140, storeId, origin });
      attributes.forEach((a, i) => run({ type: 'addAttribute', entityId: id, dataId: dataIdOf(a), identifier: i === 0 }));
    };
    entity('en-client', 'Client', 'A person who brings pets to the clinic.', 60, ['Client Number', 'Client Name', 'Phone'], null);
    entity('en-pet', 'Pet', 'An animal the clinic sees.', 400, ['Pet Number', 'Pet Name'], null);
    entity(
      'en-appointment',
      'Appointment',
      'A time booked for a pet to be seen.',
      740,
      ['Appointment Number', 'Preferred Date', 'Reason for Visit'],
      CLINIC.d1,
    );
    run({
      type: 'addRelationship',
      id: 'r-client-pet',
      origin,
      ends: [
        { entityId: 'en-client', verbPhrase: 'owns', min: 1, max: 'one' },
        { entityId: 'en-pet', verbPhrase: 'is owned by', min: 0, max: 'many' },
      ],
    });
    run({
      type: 'addRelationship',
      id: 'r-pet-appointment',
      origin,
      ends: [
        { entityId: 'en-pet', verbPhrase: 'has', min: 1, max: 'one' },
        { entityId: 'en-appointment', verbPhrase: 'is for', min: 0, max: 'many' },
      ],
    });

    const crud = (processId: Id, uses: string, names: string[]) =>
      names.forEach((n) => run({ type: 'setCrud', processId, dataId: dataIdOf(n), uses }));
    crud(CLINIC.p11, 'R', ['Preferred Date']);
    crud(CLINIC.p12, 'C', ['Appointment Number', 'Preferred Date', 'Reason for Visit']);
    crud(CLINIC.p12, 'R', ['Client Number', 'Client Name', 'Phone', 'Pet Number', 'Pet Name']);
    crud(CLINIC.p13, 'R', ['Appointment Number', 'Client Name']);
    crud(CLINIC.p2, 'R', ['Appointment Number', 'Preferred Date']);
    crud(CLINIC.p2, 'RU', ['Reason for Visit']);
    crud(CLINIC.p3, 'R', ['Appointment Number', 'Preferred Date', 'Pet Name', 'Client Name']);
  }

  if (secondRelease && useCases && dataModel) addSecondRelease(run, () => m, CLINIC, dataIdOf, mistakes);

  return m;
}

/** The project every screen starts from. */
export function sampleModel(): Model {
  return buildClinic();
}

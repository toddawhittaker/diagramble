// The second-release content of the sample project "Clinic appointments": the forms,
// the interface structure diagram, the binder, the physical details, a structure chart
// with its program specifications, and the storage figures (docs/SPEC.md sections 10 and
// 11). Everything here is invented for this project. It is built with commands only.

import type { Command } from '../model/commands';
import { all } from '../model/queries';
import type { Id, Model } from '../model/types';

/** Stable ids of the second-release content, so that screens and tests can point at it. */
export const CLINIC2 = {
  systemRequest: 'sr',
  feasibility: 'fa',
  /** Functional requirements. `fClientDetails` is traced to nothing, and `fDailyList` has no test. */
  fFreeTimes: 'rq-f1',
  fBook: 'rq-f2',
  fConfirm: 'rq-f3',
  fClientDetails: 'rq-f4',
  fVisitNotes: 'rq-f5',
  fDailyList: 'rq-f6',
  matrix: 'am-1',
  interfaceDiagram: 'isd-1',
  ifMenu: 'if-menu',
  ifAppointments: 'if-appointments',
  ifBook: 'if-book',
  ifConfirm: 'if-confirm',
  /** Names no process. */
  ifFindClient: 'if-find-client',
  ifVisit: 'if-visit',
  ifSchedule: 'if-schedule',
  binderCharter: 'b-charter',
  binderRisk: 'b-risk',
  /** Has one small attachment. */
  binderInterviews: 'b-interviews',
  /** The migration plan, with its conversion strategy. */
  binderMigration: 'b-migration',
  chart: 'sc-1',
  mTop: 'm-top',
  mSchedule: 'm-schedule',
  mCheck: 'm-check',
  /** Has the fullest program specification. */
  mBook: 'm-book',
  /** Has no pseudocode. */
  mConfirm: 'm-confirm',
  /** The library module. `mReadAgain1` and `mReadAgain2` repeat it. */
  mRead: 'm-read',
  mRecord: 'm-record',
  mDaily: 'm-daily',
  mReadAgain1: 'm-read-2',
  mReadAgain2: 'm-read-3',
} as const;

const C = CLINIC2;

const SKETCH =
  '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120" viewBox="0 0 240 120" fill="none" stroke="black" stroke-width="2">' +
  '<rect x="10" y="10" width="220" height="100"/><line x1="10" y1="36" x2="230" y2="36"/>' +
  '<line x1="84" y1="36" x2="84" y2="110"/><line x1="158" y1="36" x2="158" y2="110"/>' +
  '<line x1="10" y1="62" x2="230" y2="62"/><line x1="10" y1="86" x2="230" y2="86"/>' +
  '<path d="M96 70l10 10 20-24"/></svg>';

/**
 * Adds the second-release content to the clinic project. `ids` are the ids the first
 * part of the sample uses. With `mistakes` false, the six deliberate slips of the logical
 * model and the four of the physical model are left out.
 */
export function addSecondRelease(
  run: (c: Command) => void,
  model: () => Model,
  ids: { p0: Id; p1: Id; p2: Id; p3: Id; p11: Id; p12: Id; p13: Id; client: Id; vet: Id; d1: Id },
  d: (name: string) => Id,
  mistakes: boolean,
): void {
  const origin = 'starter' as const;

  // ---- System request (10.1) ----
  run({
    type: 'updateSystemRequest',
    id: C.systemRequest,
    origin,
    patch: {
      sponsor: 'Dr. Imani Okafor, clinic director',
      businessNeed:
        'The front desk books appointments in a paper diary. Double bookings and unanswered calls cost the clinic visits, and the veterinarians start each day without a list they can trust of who is coming.',
      businessRequirements: [
        'Let front-desk staff book, change and cancel appointments from any desk.',
        'Send each client a confirmation of the date and time.',
        'Give each veterinarian a schedule for the day.',
        'Keep a short record of what was done at each visit.',
      ],
      businessValue: [
        {
          text: 'Fewer missed appointments, because every client gets a confirmation',
          tangible: true,
          amount: 18000,
          estimates: [
            { label: 'Cautious', amount: 12000, probability: 30 },
            { label: 'Likely', amount: 18000, probability: 50 },
            { label: 'Hopeful', amount: 27000, probability: 20 },
          ],
        },
        { text: 'Less front-desk time spent on the diary and on returning calls', tangible: true, amount: 9000 },
        { text: 'Clients find the clinic organised and easy to deal with', tangible: false },
      ],
      specialIssues: 'The system must be in use before the spring vaccination season. The clinic has no IT staff of its own.',
    },
  });

  // ---- Feasibility analysis (10.2) ----
  // Return on investment is 75.3%, the break-even point is 1.42 years and the net present
  // value is 28,112. The sample types the first one wrongly: the gain divided by the
  // benefits, where it should be divided by the costs.
  run({
    type: 'updateFeasibility',
    id: C.feasibility,
    origin,
    technical: {
      familiarityWithApplication: { assessment: 'Low risk', reasons: 'Front-desk staff book appointments every day and know the rules well.' },
      familiarityWithTechnology: {
        assessment: 'Medium risk',
        reasons: 'The clinic has used only a paper diary and email. The developers have built web systems of this kind before.',
      },
      projectSize: { assessment: 'Low risk', reasons: 'Three use cases, one small team and about four months of work.' },
      compatibility: { assessment: 'Low risk', reasons: 'The system stands alone. It only sends email through the account the clinic already has.' },
    },
    organizational: {
      strategicAlignment: 'Strong. The plan for the year is to see more pets without hiring more front-desk staff.',
      projectChampions: 'Dr. Okafor sponsors the project and chairs the weekly review.',
      seniorManagement: 'Both partners have approved the budget.',
      users: 'Front-desk staff asked for the system. Two veterinarians are wary of reading the schedule from a screen.',
      otherStakeholders: 'Clients gain from the confirmations. Nobody outside the clinic is affected.',
    },
    economic: {
      firstYear: 2027,
      years: 3,
      rate: 6,
      benefits: [
        { name: 'Fewer missed appointments', amounts: [0, 18000, 18000, 18000], valueIndex: 0 },
        { name: 'Front-desk time saved (hours at the hourly cost)', quantity: 450, unitAmount: 20, growthRate: 5, valueIndex: 1 },
      ],
      developmentCosts: [
        { name: 'Contract development', amounts: [28000, 0, 0, 0] },
        { name: 'Staff training (hours at the hourly cost)', quantity: 40, unitAmount: 25 },
        { name: 'Two desk tablets', amounts: [1800, 0, 0, 0] },
      ],
      operationalCosts: [
        { name: 'Hosting and backups', amounts: [0, 2400, 2400, 2400] },
        { name: 'Support contract', amounts: [0, 3000, 3000, 3000] },
      ],
      intangibles: ['Clients find the clinic organised and easy to deal with', 'Veterinarians start the day knowing who is coming'],
      roi: mistakes ? 42.9 : 75.3,
      breakEven: 1.42,
      npv: 28112,
    },
  });

  // ---- Requirements definition (10.3) ----
  run({ type: 'addRequirement', id: 'rq-u1', origin, requirementKind: 'user', name: 'Front-desk staff need to book an appointment while the client is still on the phone.' });
  run({ type: 'addRequirement', id: 'rq-u2', origin, requirementKind: 'user', name: 'A veterinarian needs to see the day’s appointments before the first one starts.' });
  const functional = (id: Id, userGroup: string, group: string, functionalType: 'process-oriented' | 'information-oriented', priority: 'high' | 'medium', traceIds: Id[], name: string) =>
    run({ type: 'addRequirement', id, origin, requirementKind: 'functional', userGroup, group, functionalType, priority, traceIds, name });
  functional(C.fFreeTimes, 'Front desk', 'Schedule appointments', 'process-oriented', 'high', ['uc-1', ids.p11], 'The system will show the free times on the date a client prefers.');
  functional(C.fBook, 'Front desk', 'Schedule appointments', 'process-oriented', 'high', ['uc-1', ids.p12], 'The system will record an appointment for a client’s pet at a free time.');
  functional(C.fConfirm, 'Front desk', 'Schedule appointments', 'process-oriented', 'high', [ids.p13], 'The system will send the client a confirmation of the date and time.');
  functional(C.fClientDetails, 'Front desk', 'Schedule appointments', 'information-oriented', 'medium', mistakes ? [] : [ids.p12], 'The system will keep each client’s name and phone number.');
  functional(C.fVisitNotes, 'Veterinarians', 'Record visits', 'process-oriented', 'high', ['uc-2'], 'The system will store the veterinarian’s notes on each visit and give back a summary.');
  functional(C.fDailyList, 'Veterinarians', 'Produce schedules', 'process-oriented', 'medium', ['uc-3'], 'The system will list a day’s appointments in time order.');
  const nonfunctional = (id: Id, nonfunctionalType: 'operational' | 'performance' | 'security', subtype: string, name: string) =>
    run({ type: 'addRequirement', id, origin, requirementKind: 'nonfunctional', nonfunctionalType, subtype, name });
  nonfunctional('rq-n1', 'operational', 'technical environment', 'The system will run in a web browser on the clinic’s desk computers and tablets.');
  nonfunctional('rq-n2', 'performance', 'speed', 'The free times for a date will be shown within two seconds.');
  nonfunctional('rq-n3', 'performance', 'availability and reliability', 'The system will be available from 7 a.m. to 8 p.m. on every day the clinic is open.');
  nonfunctional('rq-n4', 'security', 'access control', 'Only staff who have signed in can see client details.');
  run({ type: 'setNoneExpected', nonfunctionalType: 'cultural and political', noneExpected: true });

  // ---- Alternative matrix (10.4) ----
  run({
    type: 'addAlternativeMatrix',
    id: C.matrix,
    origin,
    name: 'How to get the appointment system',
    alternatives: ['Custom development', 'Packaged clinic software', 'Outsourced development'],
    criteria: [
      { name: 'Fits the way the clinic books', group: 'technical', weight: 30 },
      { name: 'Works on the clinic’s tablets', group: 'technical', weight: 15 },
      { name: 'Cost over three years', group: 'economic', weight: 25 },
      { name: 'Ready before the spring season', group: 'organizational', weight: 20 },
      { name: 'Can be run without IT staff', group: 'organizational', weight: 10 },
    ],
    cells: [
      [
        { supportingInformation: 'Built around the clinic’s own booking rules.', score: 5 },
        { supportingInformation: 'Assumes fixed 30-minute slots. The clinic uses 20 and 40.', score: 2 },
        { supportingInformation: 'Built to the clinic’s rules, but by people who have not seen the front desk.', score: 4 },
      ],
      [
        { supportingInformation: 'A web application, tested on the two tablets.', score: 4 },
        { supportingInformation: 'The maker lists the tablets as supported.', score: 5 },
        { supportingInformation: mistakes ? '' : 'A web application. Testing on the tablets is in the contract.', score: 4 },
      ],
      [
        { supportingInformation: 'About 47,000 with hosting and support.', score: 3 },
        { supportingInformation: 'About 31,000 in licence fees.', score: 5 },
        { supportingInformation: 'Quoted at 58,000.', score: 2 },
      ],
      [
        { supportingInformation: 'Four months, which ends three weeks before the season.', score: 3 },
        { supportingInformation: 'Could be installed within a month.', score: 5 },
        { supportingInformation: 'The supplier cannot start for two months.', score: 2 },
      ],
      [
        { supportingInformation: 'Hosted, with a support contract.', score: 4 },
        { supportingInformation: 'Hosted and supported by the maker.', score: 5 },
        { supportingInformation: 'Hosted, but support is charged by the hour.', score: 3 },
      ],
    ],
    recommendation:
      'Custom development. The packaged software scores highest overall, but it cannot book the clinic’s 20 and 40 minute slots, and that is the one thing the system must do. Custom development is the best fit and can still be ready in time.',
  });

  // ---- Interface structure diagram (10.6) ----
  run({ type: 'addInterfaceDiagram', id: C.interfaceDiagram, origin, name: 'Clinic System interfaces', description: 'Every screen and report of the appointment system, and how staff move between them.' });
  const face = (id: Id, number: string, name: string, processIds: Id[], x: number, y: number, description: string) =>
    run({ type: 'addInterface', diagramId: C.interfaceDiagram, id, number, name, processIds, x, y, description, origin });
  face(C.ifMenu, '0', 'Main Menu', [], 400, 30, 'What staff see after signing in.');
  face(C.ifAppointments, '1', 'Appointments Menu', [], 150, 190, 'The front desk’s choices for appointments.');
  face(C.ifBook, '1.1', 'Book Appointment', [ids.p11, ids.p12], 40, 350, 'Shows the free times on a date and books one.');
  face(C.ifConfirm, '1.1.1', 'Confirmation', [ids.p13], 40, 510, 'Shows the confirmation that is sent to the client.');
  face(C.ifFindClient, '1.2', 'Find Client', mistakes ? [] : [ids.p12], 260, 350, 'Looks a client up by name or phone number.');
  face(C.ifVisit, '2', 'Record Visit', [ids.p2], 480, 190, 'Where a veterinarian writes up a visit.');
  face(C.ifSchedule, '3', 'Daily Schedule', [ids.p3], 700, 190, 'The day’s appointments in time order. It can be printed.');
  const link = (aId: Id, bId: Id) => run({ type: 'addNavigationLink', diagramId: C.interfaceDiagram, aId, bId, origin });
  link(C.ifMenu, C.ifAppointments);
  link(C.ifAppointments, C.ifBook);
  link(C.ifBook, C.ifConfirm);
  link(C.ifAppointments, C.ifFindClient);
  link(C.ifMenu, C.ifVisit);
  link(C.ifMenu, C.ifSchedule);
  // A shortcut that cuts across the tree: from an appointment on the schedule straight to its visit.
  link(C.ifSchedule, C.ifVisit);

  // ---- Structure chart and program specifications (11.3 and 11.4) ----
  run({ type: 'addStructureChart', id: C.chart, moduleId: C.mTop, origin, name: 'Clinic System', moduleName: 'Run Clinic System', processId: ids.p0, description: 'The program design of the whole appointment system.' });
  const module = (id: Id, parentModuleId: Id, name: string, rest: { processId?: Id; conditional?: boolean; library?: boolean; repeatsId?: Id } = {}) =>
    run({ type: 'addModule', id, parentModuleId, name, origin, ...rest });
  module(C.mSchedule, C.mTop, 'Schedule Appointment', { processId: ids.p1, conditional: true });
  module(C.mRecord, C.mTop, 'Record Visit', { processId: ids.p2, conditional: true });
  module(C.mDaily, C.mTop, 'Produce Daily Schedule', { processId: ids.p3, conditional: true });
  module(C.mCheck, C.mSchedule, 'Check Availability', { processId: ids.p11 });
  module(C.mBook, C.mSchedule, 'Book Slot', { processId: ids.p12 });
  module(C.mConfirm, C.mSchedule, 'Send Confirmation', { processId: ids.p13 });
  module(C.mRead, C.mCheck, 'Read Appointments', { library: true });
  module(C.mReadAgain1, C.mRecord, 'Read Appointments', { repeatsId: C.mRead });
  module(C.mReadAgain2, C.mDaily, 'Read Appointments', { repeatsId: C.mRead });

  const data = (id: Id, moduleId: Id, direction: 'down' | 'up', name: string) =>
    run({ type: 'addCouple', id, moduleId, direction, coupleKind: 'data', dataId: d(name), origin });
  const flag = (id: Id, moduleId: Id, name: string) => run({ type: 'addCouple', id, moduleId, direction: 'up', coupleKind: 'control', name, origin });
  data('cp-schedule-in', C.mSchedule, 'down', 'Appointment Request');
  data('cp-schedule-out', C.mSchedule, 'up', 'Appointment Confirmation');
  data('cp-check-in', C.mCheck, 'down', 'Visit Details');
  data('cp-check-out', C.mCheck, 'up', 'Available Slot');
  flag('cp-check-none', C.mCheck, 'No free time');
  data('cp-book-slot', C.mBook, 'down', 'Available Slot');
  data('cp-book-client', C.mBook, 'down', 'Client Details');
  data('cp-book-out', C.mBook, 'up', 'Booking');
  data('cp-confirm-in', C.mConfirm, 'down', 'Booking');
  data('cp-confirm-out', C.mConfirm, 'up', 'Appointment Confirmation');
  data('cp-read-in', C.mRead, 'down', 'Preferred Date');
  data('cp-read-out', C.mRead, 'up', 'Appointment Record');
  flag('cp-read-end', C.mRead, 'End of appointments');
  data('cp-record-in', C.mRecord, 'down', 'Visit Notes');
  data('cp-record-out', C.mRecord, 'up', 'Visit Summary');
  data('cp-daily-out', C.mDaily, 'up', 'Daily Schedule');

  const spec = (moduleId: Id, purpose: string, pseudocode: string[]) =>
    run({ type: 'setProgramSpec', moduleId, patch: { purpose, pseudocode: pseudocode.join('\n'), language: 'Python' } });
  spec(C.mTop, 'Shows the main menu and starts the part of the system the user chooses.', [
    'show the main menu',
    'CASE the choice OF',
    '  appointments: CALL Schedule Appointment',
    '  visit: CALL Record Visit',
    '  schedule: CALL Produce Daily Schedule',
  ]);
  spec(C.mSchedule, 'Takes one appointment request from the front desk through to a confirmed booking.', [
    'CALL Check Availability with the visit details',
    'IF no free time THEN tell the user and stop',
    'CALL Book Slot with the chosen slot and the client details',
    'CALL Send Confirmation with the booking',
  ]);
  spec(C.mCheck, 'Finds the times that are still free on the date the client prefers.', [
    'CALL Read Appointments for the preferred date',
    'start with every time the clinic is open on that date',
    'FOR each appointment read: remove its time from the list',
    'IF the list is empty THEN set the flag "No free time"',
    'RETURN the list',
  ]);
  spec(C.mRead, 'Reads the appointments booked for one date from the appointment table, in time order.', [
    'open the appointment table',
    'FOR each row whose date is the date asked for, in time order: RETURN the row',
    'set the flag "End of appointments"',
  ]);
  spec(C.mRecord, 'Stores the veterinarian’s notes against the right appointment and gives back a summary.', [
    'CALL Read Appointments for today',
    'find the appointment the notes are for',
    'store the notes with that appointment',
    'RETURN a summary of the visit',
  ]);
  spec(C.mDaily, 'Builds the list of one day’s appointments for a veterinarian.', [
    'CALL Read Appointments for the date asked for',
    'FOR each appointment read: add a line with the time, the pet and the client',
    'RETURN the schedule',
  ]);
  run({
    type: 'setProgramSpec',
    moduleId: C.mBook,
    patch: {
      purpose: 'Books one free time for a client’s pet and records the appointment.',
      programmer: 'R. Halvorsen',
      dateDue: '2027-02-05',
      language: 'Python',
      events: 'The user presses "Book" on the Book Appointment screen.',
      ioNotes: [
        { coupleId: 'cp-book-slot', notes: 'Must be one of the slots that Check Availability returned in this session.' },
        { coupleId: 'cp-book-out', notes: 'Carries the new booking reference.' },
      ],
      pseudocode: [
        'IF the slot is no longer free THEN',
        '  RETURN an error so that the free times are shown again',
        'make a new booking reference',
        'write the appointment with the client details and the slot',
        'RETURN the booking',
      ].join('\n'),
      other: 'Two desks may try to book the same slot. Check that the slot is free and write the appointment in one database transaction.',
    },
  });
  run({
    type: 'setProgramSpec',
    moduleId: C.mConfirm,
    patch: {
      purpose: 'Tells the client the date and time that was booked.',
      language: 'Python',
      pseudocode: mistakes ? '' : ['build the confirmation text from the booking', 'send it to the client by email', 'RETURN the confirmation'].join('\n'),
    },
  });

  // ---- Test plan (10.5) ----
  run({
    type: 'addTest',
    id: 't-1',
    origin,
    name: 'Free times on a preferred date',
    stage: 'unit',
    testType: 'black-box',
    programId: C.mCheck,
    version: '0.3',
    tester: 'R. Halvorsen',
    dateDesigned: '2027-02-08',
    dateConducted: '2027-02-15',
    requirementId: C.fFreeTimes,
    objective: 'Check that only free times are offered for the date asked for.',
    testCases: [
      { interfaceId: C.ifBook, interfaceText: '', dataField: 'Preferred date', valueEntered: '2 March 2027, when two times are already booked' },
      { interfaceId: C.ifBook, interfaceText: '', dataField: 'Preferred date', valueEntered: '7 March 2027, a Sunday, when the clinic is closed' },
    ],
    expectedResults: 'The first date shows every time except the two that are booked. The Sunday shows no times and says the clinic is closed.',
    actualResults: 'As expected.',
    result: 'passed',
  });
  run({
    type: 'addTest',
    id: 't-2',
    origin,
    name: 'Book a free time',
    stage: 'integration',
    testType: 'use scenario',
    programId: C.mBook,
    version: '0.3',
    tester: 'R. Halvorsen',
    dateDesigned: '2027-02-08',
    dateConducted: '2027-02-16',
    requirementId: C.fBook,
    objective: 'Check that a booked time is recorded and is not offered again.',
    testCases: [
      { interfaceId: C.ifBook, interfaceText: '', dataField: 'Pet', valueEntered: 'Biscuit' },
      { interfaceId: C.ifBook, interfaceText: '', dataField: 'Time', valueEntered: '10:20' },
    ],
    script: 'Find the client. Choose the pet. Choose the date. Pick 10:20. Press "Book". Open Book Appointment again for the same date.',
    expectedResults: 'The appointment is on the day’s list, and 10:20 is no longer offered.',
    actualResults: '10:20 was still offered until the page was reloaded.',
    result: 'open items',
  });
  run({
    type: 'addTest',
    id: 't-3',
    origin,
    name: 'The confirmation reaches the client',
    stage: 'system',
    testType: 'requirements',
    programId: C.mConfirm,
    version: '0.3',
    tester: 'M. Abara',
    dateDesigned: '2027-02-10',
    requirementId: C.fConfirm,
    objective: 'Check that a client is sent the right date and time after a booking.',
    script: 'Book an appointment for a test client whose email address is the tester’s own. Wait one minute. Read the email.',
    expectedResults: 'One email arrives. It gives the pet’s name and the date and time that were booked.',
  });
  run({
    type: 'addTest',
    id: 't-4',
    origin,
    name: 'Visit notes and summary',
    stage: 'integration',
    testType: 'user interface',
    programId: C.mRecord,
    version: '0.2',
    tester: 'M. Abara',
    dateDesigned: '2027-02-10',
    requirementId: C.fVisitNotes,
    objective: 'Check that notes are stored against the right appointment.',
    testCases: [{ interfaceId: C.ifVisit, interfaceText: '', dataField: 'Notes', valueEntered: 'Vaccination given. Next one due in a year.' }],
    expectedResults: 'The summary shows the notes under the appointment that was open, and under no other.',
  });
  run({
    type: 'addTest',
    id: 't-5',
    origin,
    name: 'Client details are kept',
    stage: 'unit',
    testType: 'black-box',
    programId: C.mBook,
    version: '0.3',
    tester: 'R. Halvorsen',
    dateDesigned: '2027-02-09',
    requirementId: C.fClientDetails,
    objective: 'Check that a client’s name and phone number are stored as they were typed.',
    testCases: [
      { interfaceId: C.ifFindClient, interfaceText: '', dataField: 'Client name', valueEntered: 'Séamus O’Dowd-Nakamura' },
      { interfaceId: C.ifFindClient, interfaceText: '', dataField: 'Phone', valueEntered: '+353 61 555 0142' },
    ],
    expectedResults: 'Both are shown again exactly as typed, with the accent, the apostrophe, the hyphen and the plus sign.',
  });
  if (!mistakes)
    run({
      type: 'addTest',
      id: 't-6',
      origin,
      name: 'The schedule is in time order',
      stage: 'system',
      testType: 'requirements',
      programId: C.mDaily,
      tester: 'M. Abara',
      requirementId: C.fDailyList,
      objective: 'Check that a day’s appointments are listed from the earliest to the latest.',
      script: 'Book 14:00, then 9:20, then 11:40 for one date. Open the Daily Schedule for that date.',
      expectedResults: 'The list reads 9:20, 11:40, 14:00.',
    });

  // ---- Binder (10.7) ----
  run({
    type: 'addBinderSection',
    id: C.binderCharter,
    origin,
    name: 'Project charter',
    layout: 'project-charter',
    body: [
      '# Project objective',
      'Replace the paper appointment diary with a system the front desk and the veterinarians both trust, before the spring vaccination season.',
      '',
      '# Team rules',
      '1. We meet every Tuesday at 8:30, before the clinic opens, for no more than half an hour.',
      '2. Anyone who will miss a date they agreed to says so as soon as they know.',
      '3. A question from the front desk is answered the same day.',
      '4. Nothing reaches the clinic’s computers until two of us have tried it.',
    ].join('\n'),
  });
  run({
    type: 'addBinderSection',
    id: C.binderRisk,
    origin,
    name: 'Risk assessment',
    layout: 'risk-assessment',
    body: [
      '# Risk 1: the system is not ready for the spring season',
      '- Description: Development runs past the end of February.',
      '- Likelihood: Medium.',
      '- Potential impact: High. The busiest weeks of the year would be booked on paper again.',
      '- Ways to address it: Build booking first. Leave the daily schedule to last, because it can be printed from a list.',
      '',
      '# Risk 2: veterinarians keep using their own lists',
      '- Description: Two veterinarians prefer a printed sheet.',
      '- Likelihood: High.',
      '- Potential impact: Low.',
      '- Ways to address it: Make the daily schedule print well on one page.',
    ].join('\n'),
  });
  run({
    type: 'addBinderSection',
    id: C.binderInterviews,
    origin,
    name: 'Interview notes: front desk',
    phase: 'analysis',
    body: [
      '# Who',
      'The two front-desk staff, together, on a quiet Wednesday afternoon.',
      '',
      '# What we heard',
      '- Most double bookings happen when both desks answer the phone at once.',
      '- Slots are 20 minutes for a vaccination and 40 for anything else.',
      '- They sketched the diary page they would like to see on screen. The sketch is attached.',
    ].join('\n'),
  });
  run({
    type: 'addAttachment',
    sectionId: C.binderInterviews,
    attachmentId: 'at-diary-sketch',
    name: 'diary-page-sketch.svg',
    mimeType: 'image/svg+xml',
    dataUrl: `data:image/svg+xml,${encodeURIComponent(SKETCH)}`,
  });
  run({
    type: 'addBinderSection',
    id: C.binderMigration,
    origin,
    name: 'Migration plan',
    layout: 'migration-plan',
    body: [
      '# Preparing the business',
      'From the first Monday of March, every new appointment is entered in the system. The paper diary stays on the desk for two weeks.',
      '',
      '# Preparing the technology',
      'The two tablets are set up and tried at the front desk the week before. Appointments already in the diary for March and April are typed in over one weekend.',
      '',
      '# Preparing the people',
      'Each member of the front desk has an hour of practice with made-up clients. Veterinarians are shown the daily schedule at the Tuesday meeting.',
    ].join('\n'),
  });
  run({
    type: 'setConversion',
    sectionId: C.binderMigration,
    style: 'parallel',
    location: 'pilot',
    modules: 'whole-system',
    reasons:
      'The paper diary costs almost nothing to keep for two more weeks, so running both is cheap insurance. The Harbour Road branch is small and goes first. The system is too small to be worth installing in parts.',
  });

  // ---- Physical data flow diagram (11.2) ----
  const implementation: [Id, string][] = [
    [ids.p0, 'Web application'],
    [ids.p1, 'Python: booking service'],
    [ids.p11, 'Python and SQL query'],
    [ids.p12, 'Python and SQL transaction'],
    [ids.p13, 'Python: email sender'],
    [ids.p3, 'Python: report page'],
  ];
  if (!mistakes) implementation.push([ids.p2, 'Python: visit service']);
  for (const [id, text] of implementation) run({ type: 'setPhysical', id, implementation: text });
  run({ type: 'setPhysical', id: ids.client, human: true });
  run({ type: 'setPhysical', id: ids.vet, human: true });
  run({ type: 'setPhysical', id: ids.d1, physicalName: 'PostgreSQL: appointment table' });
  const physicalNames: Record<string, string> = {
    'Appointment Request': 'Booking web form',
    'Appointment Confirmation': 'Confirmation email',
    'Visit Notes': 'Visit notes form',
    'Visit Summary': 'Visit summary page',
    'Daily Schedule': 'Daily schedule page, which can be printed',
    'Appointment Record': 'SQL: appointment row',
    'Visit Details': 'Booking form: visit section',
    'Client Details': 'Booking form: client section',
    'Booking Info': 'Booking form: hold code',
    Booking: 'Booking object, in memory',
    'Available Slot': mistakes ? '' : 'List of free times, as JSON',
  };
  for (const f of all(model(), 'dataFlow')) {
    const physicalName = physicalNames[model().elements[f.dataId]?.name ?? ''];
    if (physicalName) run({ type: 'setPhysical', id: f.id, physicalName });
  }

  // ---- Physical data model (11.5) and storage figures (11.6) ----
  run({ type: 'setPhysical', id: 'en-client', tableName: 'client' });
  run({ type: 'setPhysical', id: 'en-pet', tableName: 'pet' });
  // The appointment table repeats the pet's name, so that the daily schedule needs no join.
  run({ type: 'setPhysical', id: 'en-appointment', tableName: 'appointment', copies: [d('Pet Name')] });
  const field = (name: string, fieldName: string, length: number, nullable: boolean, averageWidth: number | null, defaultValue = '') => {
    run({ type: 'setPhysical', id: d(name), fieldName, defaultValue, averageWidth });
    run({ type: 'setDataDetails', dataId: d(name), length, nullable });
  };
  field('Client Number', 'client_number', 6, false, 6);
  field('Client Name', 'client_name', 60, false, 22);
  field('Phone', 'phone', 20, true, 12);
  field('Pet Number', 'pet_number', 6, false, 6);
  field('Pet Name', 'pet_name', 30, false, 10);
  field('Appointment Number', 'appointment_number', 8, false, 8);
  field('Preferred Date', 'preferred_date', 10, false, 10);
  field('Reason for Visit', 'reason_for_visit', 1, false, mistakes ? null : 1, 'C');
  run({ type: 'setPhysical', id: 'r-client-pet', foreignKey: true });
  if (!mistakes) run({ type: 'setPhysical', id: 'r-pet-appointment', foreignKey: true });

  run({ type: 'setStorageSettings', overheadRate: 30, months: 24 });
  run({ type: 'setStorage', entityId: 'en-client', initialRecords: 1800, growthPerMonth: 25 });
  run({ type: 'setStorage', entityId: 'en-pet', initialRecords: 2600, growthPerMonth: 40 });
  // Appointments are given as a yearly percentage, to show the other way of stating growth.
  run({ type: 'setStorage', entityId: 'en-appointment', initialRecords: 9000, growthPerYear: 12 });
}

// The starter cases: projects to begin from (docs/SPEC.md section 3.8). Each is original,
// with an invented business. Each is built with commands only.

import { applyAll } from '../model/apply';
import type { Command } from '../model/commands';
import { asStarter } from '../model/normalize';
import { emptyModel, type Id, type Model } from '../model/types';

export interface Starter {
  id: string;
  title: string;
  /** One or two sentences saying what the project holds and what it is for. */
  summary: string;
  /** A fresh copy of the project. Every element in it has the origin 'starter'. */
  build(): Model;
}

function build(commands: Command[]): Model {
  return asStarter(applyAll(emptyModel(), commands));
}

/** Ids used by the starters, for tests and for a screen's starting state. */
export const STARTER_IDS = {
  context: 'dg-context',
  level0: 'dg-level0',
  p0: 'p0',
  file: 'en-file',
} as const;

const S = STARTER_IDS;

function blank(): Model {
  return build([{ type: 'createProject', name: 'Untitled project', systemName: 'System', id: S.context, processId: S.p0 }]);
}

function level0Alone(): Model {
  return build([
    {
      type: 'createProject',
      name: 'Bike repair shop',
      systemName: 'Repair Shop System',
      id: S.context,
      processId: S.p0,
      description: 'Takes in bicycles for repair, orders the parts and tells the customer when the bicycle is ready.',
    },
    { type: 'expandProcess', processId: S.p0, diagramId: S.level0 },
    {
      type: 'addExternalEntity',
      diagramId: S.level0,
      id: 'x-customer',
      name: 'Customer',
      description: 'A person who brings a bicycle in to be repaired.',
      x: 40,
      y: 120,
    },
    {
      type: 'addExternalEntity',
      diagramId: S.level0,
      id: 'x-supplier',
      name: 'Parts Supplier',
      description: 'A company the shop orders bicycle parts from.',
      x: 40,
      y: 340,
    },
    { type: 'setTopDiagram', diagramId: S.level0 },
  ]);
}

function findTheErrors(): Model {
  const L0 = S.level0;
  const dataId = (name: string) => `d-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const data = (name: string, description: string): Command => ({
    type: 'defineData',
    dataKind: 'dataElement',
    id: dataId(name),
    name,
    description,
  });
  const flow = (sourceId: Id, targetId: Id, name: string): Command => ({
    type: 'addFlow',
    diagramId: L0,
    sourceId,
    targetId,
    dataId: dataId(name),
  });
  return build([
    {
      type: 'createProject',
      name: 'Tool library: find the errors',
      systemName: 'Tool Library System',
      id: S.context,
      processId: S.p0,
      description: 'Lends tools to the members of a neighbourhood tool library and keeps track of what is out on loan.',
    },
    { type: 'expandProcess', processId: S.p0, diagramId: L0 },
    { type: 'setTopDiagram', diagramId: L0 },
    { type: 'setShowFindings', showFindings: 'onRequest' },

    data('Membership Form', 'What a neighbour fills in to join the library.'),
    data('Loan Request', 'Which tool a member wants to borrow, and for how long.'),
    data('Tool Details', 'What the library knows about one tool, and whether it is in.'),
    data('Loan Record', 'One tool lent to one member, with the date it is due back.'),
    data('Loan Slip', 'The note a member takes away with a borrowed tool.'),
    data('Return Details', 'Which tool a member is bringing back, and when.'),
    data('Closed Loan', 'A loan marked as finished once the tool is back.'),
    data('Late Fee Notice', 'What a member owes for bringing a tool back late.'),
    data('Overdue List', 'The loans that are past their due date.'),
    data('Tool Donation', 'A tool a member gives to the library.'),

    { type: 'addExternalEntity', diagramId: L0, id: 'x-member', name: 'Member', description: 'A neighbour who has joined the library and may borrow tools.', x: 40, y: 250 },
    { type: 'addExternalEntity', diagramId: L0, id: 'x-volunteer', name: 'Volunteer', description: 'A person who staffs the library desk.', x: 40, y: 640 },
    { type: 'addProcess', diagramId: L0, id: 'p1', name: 'Register Member', description: 'Signs a neighbour up as a member.', x: 320, y: 40 },
    { type: 'addProcess', diagramId: L0, id: 'p2', name: 'Lend Tool', description: 'Checks that a tool is in and lends it to a member.', x: 320, y: 220 },
    { type: 'addProcess', diagramId: L0, id: 'p3', name: 'Return Tool and Charge Fee', description: 'Takes a tool back, closes the loan and charges for a late return.', x: 320, y: 420 },
    { type: 'addProcess', diagramId: L0, id: 'p4', name: 'List Overdue Loans', description: 'Lists the loans that are past their due date.', x: 320, y: 620 },
    // Seeded: this data store has no description.
    { type: 'addDataStore', diagramId: L0, id: 's-tools', name: 'Tools', x: 640, y: 140 },
    { type: 'addDataStore', diagramId: L0, id: 's-loans', name: 'Loans', description: 'Every loan, open or closed.', x: 640, y: 380 },

    // Seeded: 'Register Member' receives data and sends nothing out.
    flow('x-member', 'p1', 'Membership Form'),
    flow('x-member', 'p2', 'Loan Request'),
    flow('s-tools', 'p2', 'Tool Details'),
    flow('p2', 's-loans', 'Loan Record'),
    flow('p2', 'x-member', 'Loan Slip'),
    flow('x-member', 'p3', 'Return Details'),
    flow('s-loans', 'p3', 'Loan Record'),
    flow('p3', 's-loans', 'Closed Loan'),
    flow('p3', 'x-member', 'Late Fee Notice'),
    // Seeded: 'List Overdue Loans' sends data out and receives none.
    flow('p4', 'x-volunteer', 'Overdue List'),
    // Seeded: this flow runs from an external entity straight into a data store.
    flow('x-member', 's-tools', 'Tool Donation'),
    // Seeded: the name of process 3 holds the word "and".
  ]);
}

function normalizeAFile(): Model {
  const attribute = (
    name: string,
    dataType: string,
    description: string,
    options: { identifier?: boolean; repeats?: boolean } = {},
  ): Command[] => {
    const id = `d-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    return [
      { type: 'defineData', dataKind: 'dataElement', id, name, dataType, description },
      { type: 'addAttribute', entityId: S.file, dataId: id, ...options },
    ];
  };
  return build([
    {
      type: 'createProject',
      name: 'Music school: normalize a file',
      systemName: 'Music School System',
      id: S.context,
      processId: S.p0,
      description: 'Keeps the lesson sign-ups of a small music school.',
    },
    {
      type: 'addEntity',
      id: S.file,
      name: 'Lesson Sign-up File',
      description: 'The school’s one file, as it is kept today: a line for each student, with every lesson the student takes.',
      x: 120,
      y: 100,
    },
    ...attribute('Student Number', 'Number', 'The number the school gives each student. No two students share one.', { identifier: true }),
    ...attribute('Student Name', 'Text', 'The student’s full name.'),
    ...attribute('Guardian Phone', 'Text', 'The telephone number of the adult to call about the student.'),
    ...attribute('Date Joined', 'Date', 'The day the student first signed up.'),
    ...attribute('Instrument', 'Text', 'An instrument the student takes lessons on.', { repeats: true }),
    ...attribute('Teacher Name', 'Text', 'The teacher who gives the lesson on that instrument.', { repeats: true }),
    ...attribute('Lesson Day', 'Text', 'The day of the week of that lesson.', { repeats: true }),
    ...attribute('Term Fee Paid', 'Yes or no', 'Whether this term’s fee has been paid.'),
  ]);
}

export const STARTERS: Starter[] = [
  {
    id: 'blank',
    title: 'Blank project',
    summary: 'An empty context diagram and nothing else.',
    build: blank,
  },
  {
    id: 'level-0-alone',
    title: 'Level 0 alone',
    summary:
      'A bike repair shop. The project starts at the level 0 diagram, with two external entities placed, so the context diagram can be left alone.',
    build: level0Alone,
  },
  {
    id: 'find-the-errors',
    title: 'Find the errors',
    summary:
      'A level 0 diagram for a tool library with five mistakes in it. The problems stay hidden until you ask for them, so you can look for the mistakes first.',
    build: findTheErrors,
  },
  {
    id: 'normalize-a-file',
    title: 'Normalize a file',
    summary:
      'A music school’s sign-up file as one entity with eight attributes, three of them repeating, ready to be split into normal form.',
    build: normalizeAFile,
  },
];

export function starterById(id: string): Starter | undefined {
  return STARTERS.find((s) => s.id === id);
}

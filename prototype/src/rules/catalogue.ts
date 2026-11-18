export type Severity = 'error' | 'warning';

export interface RuleInfo {
  id: string;
  severity: Severity;
  /** When the rule reports a finding. */
  when: string;
  /** The message, with {names} filled from the finding's values. */
  message: string;
  why: string;
  fix: string;
  /** True for the nine data model rules, whose wording the specification has not settled. */
  provisional?: boolean;
}

const SAME_AS_BAL_01 = 'A child diagram is a closer look at one process, so the same data must cross its edge';

const list: RuleInfo[] = [
  // ---- SPEC 5.2 ----
  {
    id: 'DFD-01',
    severity: 'error',
    when: 'A process, external entity, data store, data definition or control flow has an empty name',
    message: 'This {kind} has no name.',
    why: 'Nobody can tell what an unnamed item stands for',
    fix: 'Give it a name that says what it is',
  },
  {
    id: 'DFD-02',
    severity: 'error',
    when: 'Two processes, two external entities, two data stores or two data definitions have the same name, ignoring case',
    message: "Two {kinds} are both named '{name}'.",
    why: 'The same name must always mean the same thing',
    fix: 'Rename one, or delete the duplicate and reuse the first',
  },
  {
    id: 'DFD-03',
    severity: 'error',
    when: 'A process has at least one data flow out, no data flow in and no control flow in',
    message: "'{name}' produces data from nothing.",
    why: 'Every output must be made from data the process receives. The textbook calls this a miracle',
    fix: 'Add the flows this process needs as input. If only the passing of time starts it, add a control flow',
  },
  {
    id: 'DFD-04',
    severity: 'error',
    when: 'A process has at least one data flow in and no data flow out',
    message: "'{name}' receives data and produces nothing.",
    why: 'A process exists to turn inputs into outputs. The textbook calls this a black hole',
    fix: 'Add the output, or remove the process',
  },
  {
    id: 'DFD-05',
    severity: 'error',
    when: 'Neither end of a flow is a process, or one end is unattached',
    message: "'{data}' does not start or end at a process.",
    why: "A DFD shows only data that the system's processes handle",
    fix: 'Route the flow through a process, or remove it',
  },
  {
    id: 'DFD-06',
    severity: 'error',
    when: "A flow's source and target are the same element",
    message: "'{data}' flows from '{name}' back to itself.",
    why: 'A flow moves data from one place to another',
    fix: 'Attach one end elsewhere',
  },
  {
    id: 'DFD-07',
    severity: 'error',
    when: 'A process has no flows at all',
    message: "'{name}' is not connected to anything.",
    why: 'Every process needs at least one input and one output',
    fix: 'Connect it, or remove it',
  },
  {
    id: 'DFD-08',
    severity: 'error',
    when: 'An external entity has no flows on any diagram',
    message: "'{name}' neither sends nor receives data.",
    why: 'An outside party belongs on the diagram only if it exchanges data with the system',
    fix: 'Add a flow, or remove it',
  },
  {
    id: 'DFD-09',
    severity: 'warning',
    when: 'Across the whole model, a data store has flows in but none out, or out but none in',
    message: "'{name}' is only {direction}.",
    why: 'Stored data must come from somewhere and be used somewhere',
    fix: 'Add the missing flow on whichever diagram it belongs. If another system keeps this data, show that system as an external entity instead',
  },
  {
    id: 'DFD-13',
    severity: 'warning',
    when: 'A process, external entity, data store or data definition has an empty description',
    message: "'{name}' has no description.",
    why: 'The name says what an item is called and the description says what it is. The textbook asks for one on every item',
    fix: 'Write a sentence or two saying what it is or does',
  },
  {
    id: 'DFD-14',
    severity: 'warning',
    when: 'A process name contains the word "and"',
    message: "'{name}' may be doing more than one job.",
    why: 'A process should do one activity, so its name should not need "and"',
    fix: 'Split it into two processes, or name it for the one thing it does',
  },
  {
    id: 'DFD-15',
    severity: 'warning',
    when: 'A process sends out a data definition that it also receives',
    message: "'{name}' sends out '{data}' unchanged.",
    why: 'A process changes data, so what leaves it usually has a different name from what entered',
    fix: 'Name the output for what the process did to it, such as "Approved Order"',
  },
  // ---- SPEC 5.3 ----
  {
    id: 'DFD-10',
    severity: 'error',
    when: 'The context diagram shows a data store',
    message: "The context diagram shows the data store '{name}'.",
    why: 'The context diagram shows the system as one process and only what lies outside it',
    fix: 'Move the data store to the level 0 diagram. If another system keeps this data, show that system as an external entity',
  },
  {
    id: 'DFD-11',
    severity: 'warning',
    when: 'A level 0 or lower diagram has fewer than three processes',
    message: 'This diagram has {count} processes. It should have at least three.',
    why: 'With only one or two processes, the extra diagram adds little',
    fix: 'Add the processes that make it up, or remove this diagram and show the detail on its parent',
  },
  {
    id: 'DFD-12',
    severity: 'warning',
    when: 'A diagram has more than seven processes',
    message: 'This diagram has {count} processes. It should have no more than seven.',
    why: 'A crowded diagram is hard to read',
    fix: 'Combine related processes into one and expand it',
  },
  // ---- SPEC 5.4 ----
  {
    id: 'DD-01',
    severity: 'warning',
    when: 'A data structure has no components',
    message: "'{name}' has no contents defined.",
    why: 'Without contents, the tool cannot tell whether two flows carry the same data',
    fix: 'List what it is made of, or change it to a single data element',
  },
  {
    id: 'DD-02',
    severity: 'error',
    when: 'A data structure contains itself, directly or through other structures',
    message: "'{name}' is defined in terms of itself.",
    why: 'A definition must end in single data elements',
    fix: 'Remove the component that leads back',
  },
  {
    id: 'DD-03',
    severity: 'warning',
    when: 'A data definition is not carried by any flow and is not a component of anything',
    message: "'{name}' is defined but never used.",
    why: 'Unused definitions are usually leftovers or mistakes',
    fix: 'Use it or delete it',
  },
  // ---- SPEC 5.5 ----
  {
    id: 'BAL-01',
    severity: 'error',
    when: 'Some contents of the parent inputs are missing from the child inputs',
    message: "'{data}' enters '{process}' on the parent diagram but does not fully enter this diagram. Missing: {missing}.",
    why: SAME_AS_BAL_01,
    fix: 'Add a flow carrying the missing data, or remove it from the parent',
  },
  {
    id: 'BAL-02',
    severity: 'error',
    when: 'Some contents of the parent outputs are missing from the child outputs',
    message: "'{data}' leaves '{process}' on the parent diagram but does not fully leave this diagram. Missing: {missing}.",
    why: SAME_AS_BAL_01,
    fix: 'Add a flow carrying the missing data, or remove it from the parent',
  },
  {
    id: 'BAL-03',
    severity: 'warning',
    when: "Some contents of the child inputs or outputs are not in the parent's",
    message: "'{data}' crosses the edge of this diagram but not '{process}' on the parent diagram.",
    why: 'A child diagram adds detail, so it may show flows its parent leaves out. But data that enters or leaves the process usually belongs on the parent too',
    fix: 'If the parent should show this data, add the flow there or define it as part of a parent flow. If it is detail the parent leaves out, no change is needed',
  },
  {
    id: 'BAL-04',
    severity: 'warning',
    when: "At least one parent flow carries contents that overlap a boundary flow's, and none of those parent flows has the same outside element as the boundary flow",
    message: "'{data}' comes from '{childEnd}' here but from '{parentEnd}' on the parent diagram.",
    why: 'The same data should come from, or go to, the same place at every level',
    fix: 'Attach the flow to the same outside element',
  },
  // ---- Provisional: the specification lists these rules (9.3, 9.4) but not their wording ----
  {
    id: 'ERD-01',
    severity: 'warning',
    provisional: true,
    when: 'An entity has no name, or an end of a relationship has no verb phrase',
    message: '{what} has no {missing}.',
    why: 'A reader needs the name to know what the entity is, and the verb phrase to read the relationship aloud',
    fix: 'Name the entity, or write a short verb phrase such as "owns" at each end of the relationship',
  },
  {
    id: 'ERD-02',
    severity: 'warning',
    provisional: true,
    when: 'Two entities have the same name, ignoring case',
    message: "Two entities are both named '{name}'.",
    why: 'The same name must always mean the same thing',
    fix: 'Rename one, or delete the duplicate and reuse the first',
  },
  {
    id: 'ERD-03',
    severity: 'warning',
    provisional: true,
    when: 'An entity has no attributes',
    message: "'{name}' has no attributes.",
    why: 'An entity is something the system keeps data about, so it needs at least one piece of data',
    fix: 'Add the attributes the system must keep about it, or remove the entity',
  },
  {
    id: 'ERD-04',
    severity: 'warning',
    provisional: true,
    when: 'An entity has no identifier, either its own or an inherited one',
    message: "'{name}' has no identifier.",
    why: 'Without an identifier, nothing tells one instance of the entity from another',
    fix: 'Mark the attribute or attributes that identify one instance, or add one such as a number',
  },
  {
    id: 'ERD-05',
    severity: 'warning',
    provisional: true,
    when: 'A relationship is many-to-many',
    message: "The relationship between '{first}' and '{second}' is many-to-many.",
    why: 'A many-to-many relationship has nowhere to keep data about each pairing. The textbook resolves it with an intersection entity',
    fix: 'Add an entity between the two, and relate it to each of them as the "many" end',
  },
  {
    id: 'ERD-10',
    severity: 'warning',
    provisional: true,
    when: 'An end of a relationship does not yet say the least or the most',
    message: "The relationship between '{first}' and '{second}' does not yet say how many of each there can be.",
    why: 'Until both ends say the least and the most, the relationship cannot be read aloud and its parent cannot be worked out',
    fix: 'At each end, choose the least (zero or one) and the most (one or many)',
  },
  {
    id: 'ERD-11',
    severity: 'warning',
    provisional: true,
    when: 'An entity has a repeating attribute',
    message: "'{name}' holds repeating data: {attributes}.",
    why: 'An attribute that holds several values for one instance means the entity is not in first normal form',
    fix: 'Move the repeating attributes to a new entity of their own, and relate it to this one as the "many" end',
  },
  {
    id: 'DM-01',
    severity: 'warning',
    provisional: true,
    when: 'An entity has no data store',
    message: "'{name}' is not held in any data store.",
    why: 'The data model and the process model describe the same data, so every entity should be kept in a data store on the diagrams',
    fix: 'Choose the data store that holds this entity, or add one to a diagram',
  },
  {
    id: 'DM-02',
    severity: 'warning',
    provisional: true,
    when: 'A data store holds no entity',
    message: "'{name}' holds no entity.",
    why: 'The data model and the process model describe the same data, so every data store should hold at least one entity',
    fix: 'Set this data store as the store of the entity or entities it holds',
  },
];

export const RULE_LIST: readonly RuleInfo[] = list;
export const RULES: Record<string, RuleInfo> = Object.fromEntries(list.map((r) => [r.id, r]));

// The semantic model. See docs/SPEC.md sections 3, 8.1, 9.1, 9.5, 10 and 11.

export type Id = string;
export type Origin = 'student' | 'starter' | 'ai';

export type ElementKind =
  | 'process'
  | 'externalEntity'
  | 'dataStore'
  | 'dataFlow'
  | 'controlFlow'
  | 'dataStructure'
  | 'dataElement'
  | 'diagram'
  | 'useCase'
  | 'entity'
  | 'relationship'
  // ---- The second release: SPEC sections 10 and 11 ----
  | 'systemRequest'
  | 'feasibility'
  | 'requirement'
  | 'alternativeMatrix'
  | 'test'
  | 'interfaceDiagram'
  | 'interface'
  | 'navigationLink'
  | 'binderSection'
  | 'structureChart'
  | 'module'
  | 'couple';

/** The two ways of showing the one model (SPEC 11.1). A session setting, kept by the store, not by the model. */
export type Mode = 'logical' | 'physical';

interface Base {
  id: Id;
  name: string;
  description: string;
  /** Other names the business uses for the same thing. Never a second name: no rule reads them. */
  aliases: string[];
  /** Working notes and open questions. Never checked. */
  notes: string;
  origin: Origin;
}

/**
 * One cell of the CRUD matrix. `uses` holds any of the letters C, R, U, D, in that order.
 * `dataId` is an attribute (a data element), or the id of an entity that has no attributes yet.
 */
export interface CrudCell {
  dataId: Id;
  uses: string;
}

export interface Process extends Base {
  kind: 'process';
  /** null for process 0 only. */
  parentProcessId: Id | null;
  /** The last part of the process number. */
  ordinal: number;
  /** The longer text of the process entry: what it does, step by step. No rule reads it. */
  processDescription: string;
  crud: CrudCell[];
  /** Physical: what carries the process out, such as "Python". Shown on the last line of the symbol. */
  implementation: string;
  /** Physical: true when a person does the work. Such a process is inside the human-machine boundary. */
  human: boolean;
  /** True when it exists only for the way the system is built. Shown in physical mode only. */
  systemRelated: boolean;
}

export interface ExternalEntity extends Base {
  kind: 'externalEntity';
  /** Physical: true when it is a person. */
  human: boolean;
}

export interface DataStore extends Base {
  kind: 'dataStore';
  /** Physical: the name shown in place of the logical one, such as "PostgreSQL: appointment table". */
  physicalName: string;
  systemRelated: boolean;
}

export interface DataFlow extends Base {
  kind: 'dataFlow';
  diagramId: Id;
  /** null means the end is unattached (an inherited flow not yet connected). */
  sourceId: Id | null;
  targetId: Id | null;
  dataId: Id;
  /** Physical: the name shown in place of the logical one, such as "Booking web form". */
  physicalName: string;
  systemRelated: boolean;
}

export interface ControlFlow extends Base {
  kind: 'controlFlow';
  diagramId: Id;
  targetId: Id;
}

export type Occurs = 'once' | 'optional' | 'many';

export interface Component {
  dataId: Id;
  occurs: Occurs;
  /** The most times the part can occur. A whole number, kept only when `occurs` is 'many'. */
  limit?: number;
}

export interface DataStructure extends Base {
  kind: 'dataStructure';
  components: Component[];
}

/** One allowed value of a data element, and what it stands for, such as "A" for "Active". */
export interface AllowedValue {
  value: string;
  meaning: string;
}

export interface DataElement extends Base {
  kind: 'dataElement';
  dataType: string;
  allowedValues?: AllowedValue[];
  /** The length shown in an entity's dictionary entry. null until it is filled in. */
  length: number | null;
  /** Whether the value may be left empty ("null"). null until it is decided. */
  nullable: boolean | null;
  systemRelated: boolean;
  /** Physical: the name of the field in its table. */
  fieldName: string;
  /** Physical: the value a new record starts with. */
  defaultValue: string;
  /** Storage: the average width of the values, in characters. null until it is filled in. */
  averageWidth: number | null;
}

export interface Diagram extends Base {
  kind: 'diagram';
  diagramKind: 'context' | 'dfd';
  /** null for the context diagram only. */
  decomposesProcessId: Id | null;
}

export interface StepInformation {
  direction: 'in' | 'out';
  dataId: Id;
}

export interface UseCaseStep {
  text: string;
  substeps: string[];
  information: StepInformation[];
}

export interface UseCaseException {
  /** The step where the exception can happen. */
  stepNumber: number;
  text: string;
  /** What is done about it, as a numbered list. */
  steps: string[];
}

export interface UseCase extends Base {
  kind: 'useCase';
  /** Shown as UC-1, UC-2. */
  ordinal: number;
  priority: 'high' | 'medium' | 'low';
  actorId: Id | null;
  trigger: string;
  triggerType: 'external' | 'temporal';
  preconditions: string[];
  postconditions: string[];
  steps: UseCaseStep[];
  exceptions: UseCaseException[];
  summaryInputs: { dataId: Id; sourceId: Id }[];
  summaryOutputs: { dataId: Id; destinationId: Id }[];
  processId: Id | null;
}

export interface Attribute {
  dataId: Id;
  identifier: boolean;
  /** True when the attribute can hold several values for one instance of the entity. */
  repeats: boolean;
}

export interface Entity extends Base {
  kind: 'entity';
  code: string;
  attributes: Attribute[];
  storeId: Id | null;
  systemRelated: boolean;
  /** Physical: the name of the table or file. */
  tableName: string;
  /** Physical: data elements owned by another entity that this table repeats (denormalization). Never checked. */
  copies: Id[];
  /** Storage: the number of records loaded at the start. */
  initialRecords: number | null;
  /** Storage: records added each month. A number of records, not a percentage. */
  growthPerMonth: number | null;
  /** Storage: growth as a percentage for each year. When set, it is used in place of `growthPerMonth`. */
  growthPerYear: number | null;
  /** Storage: the size of one record, typed. Used only while the entity has no fields. */
  recordSize: number | null;
}

export interface RelationshipEnd {
  entityId: Id;
  /** Read from this entity towards the other. */
  verbPhrase: string;
  /** How many of this entity go with one of the other: at least `min`, at most `max`. null means not decided yet. */
  min: 0 | 1 | null;
  max: 'one' | 'many' | null;
}

export interface Relationship extends Base {
  kind: 'relationship';
  ends: [RelationshipEnd, RelationshipEnd];
  identifying: boolean;
  /** Physical: true once the student has placed the foreign key in the child table. */
  foreignKey: boolean;
}

// ---- Forms (SPEC section 10) ----

/** One estimate behind a tangible value: an amount and how likely it is, as a percentage. */
export interface ValueEstimate {
  label: string;
  amount: number | null;
  probability: number | null;
}

export interface BusinessValue {
  text: string;
  tangible: boolean;
  /** For tangible value only. With estimates, the student types their expected value here. */
  amount: number | null;
  estimates: ValueEstimate[];
}

/** The system request (SPEC 10.1). At most one in a project. Its `name` is not used. */
export interface SystemRequest extends Base {
  kind: 'systemRequest';
  sponsor: string;
  businessNeed: string;
  businessRequirements: string[];
  businessValue: BusinessValue[];
  specialIssues: string;
}

export const TECHNICAL_FACTORS = ['familiarityWithApplication', 'familiarityWithTechnology', 'projectSize', 'compatibility'] as const;
export type TechnicalFactor = (typeof TECHNICAL_FACTORS)[number];
export const ORGANIZATIONAL_FACTORS = ['strategicAlignment', 'projectChampions', 'seniorManagement', 'users', 'otherStakeholders'] as const;
export type OrganizationalFactor = (typeof ORGANIZATIONAL_FACTORS)[number];

/** The words for each feasibility factor. */
export const FACTOR_WORDS: Record<TechnicalFactor | OrganizationalFactor, string> = {
  familiarityWithApplication: 'familiarity with the application',
  familiarityWithTechnology: 'familiarity with the technology',
  projectSize: 'project size',
  compatibility: 'compatibility',
  strategicAlignment: 'strategic alignment',
  projectChampions: 'project champions',
  seniorManagement: 'senior management',
  users: 'users',
  otherStakeholders: 'other stakeholders',
};

export interface TechnicalAssessment {
  assessment: string;
  reasons: string;
}

/**
 * One line of the cash flow table. It has one amount for each column, year 0 first.
 * When `quantity` and `unitAmount` are both set the tool fills the line in and the
 * typed amounts are ignored: see `lineAmounts`.
 */
export interface CashLine {
  name: string;
  amounts: (number | null)[];
  quantity: number | null;
  unitAmount: number | null;
  /** A yearly percentage, for a line given as a quantity and a unit amount. */
  growthRate: number | null;
  /** On a benefit only: the index of the tangible value in the system request that it comes from. */
  valueIndex: number | null;
}

export interface Economic {
  /** The calendar year of the first column, year 0. */
  firstYear: number;
  /** The number of years forecast after year 0. The table has `years + 1` columns. */
  years: number;
  /** The required rate of return, as a percentage. */
  rate: number | null;
  benefits: CashLine[];
  developmentCosts: CashLine[];
  operationalCosts: CashLine[];
  /** Listed, not added up. */
  intangibles: string[];
  /** Typed by the student, as a percentage. Checked by FA-02. */
  roi: number | null;
  /** Typed by the student, in years. Checked by FA-03. */
  breakEven: number | null;
  /** Typed by the student, in money. Checked by FA-04. */
  npv: number | null;
}

/** The feasibility analysis (SPEC 10.2). At most one in a project. Its `name` is not used. */
export interface Feasibility extends Base {
  kind: 'feasibility';
  technical: Record<TechnicalFactor, TechnicalAssessment>;
  organizational: Record<OrganizationalFactor, string>;
  economic: Economic;
}

export const NONFUNCTIONAL_TYPES = ['operational', 'performance', 'security', 'cultural and political'] as const;
export type NonfunctionalType = (typeof NONFUNCTIONAL_TYPES)[number];

/** A requirement (SPEC 10.3). Its sentence is its `name`. Its number comes from `requirementsOutline`. */
export interface Requirement extends Base {
  kind: 'requirement';
  requirementKind: 'user' | 'functional' | 'nonfunctional';
  /** Its place in the outline. Lower comes first. Set by `reorderRequirements`. */
  order: number;
  /** Functional only. */
  functionalType: 'process-oriented' | 'information-oriented' | null;
  /** Functional only: the business area, such as "Book appointments". */
  group: string;
  /** Functional only: an optional heading the group sits under, such as "Clients". */
  userGroup: string;
  /** Nonfunctional only. */
  nonfunctionalType: NonfunctionalType | null;
  /** Nonfunctional only: one of `NONFUNCTIONAL_SUBTYPES` for its type, or empty. */
  subtype: string;
  /** 'high', 'medium', 'low', a release number, or null. */
  priority: 'high' | 'medium' | 'low' | number | null;
  /** The use cases and processes that carry this requirement out. */
  traceIds: Id[];
}

export interface Criterion {
  name: string;
  group: 'technical' | 'economic' | 'organizational';
  weight: number | null;
}

export interface MatrixCell {
  supportingInformation: string;
  /** A whole number from 1 (poor fit) to 5 (perfect fit). null until it is filled in. */
  score: number | null;
}

/** An alternative matrix (SPEC 10.4). `cells[c][a]` belongs to criterion `c` and alternative `a`. */
export interface AlternativeMatrix extends Base {
  kind: 'alternativeMatrix';
  alternatives: string[];
  criteria: Criterion[];
  cells: MatrixCell[][];
  recommendation: string;
}

export type TestStage = 'unit' | 'integration' | 'system' | 'acceptance';

export interface TestCase {
  /** An interface on an interface structure diagram, or null when `interfaceText` is used. */
  interfaceId: Id | null;
  /** The interface in words, for a project with no interface structure diagram. */
  interfaceText: string;
  dataField: string;
  valueEntered: string;
}

/** One test of the test plan (SPEC 10.5). Its `name` is a short title. */
export interface Test extends Base {
  kind: 'test';
  /** The test ID, shown as T-1. */
  ordinal: number;
  stage: TestStage;
  /** One of `TEST_TYPES` for its stage, or empty. */
  testType: string;
  /** The module whose program specification is under test, or null when `programText` is used. */
  programId: Id | null;
  programText: string;
  version: string;
  tester: string;
  /** Dates are text as typed, such as "2027-03-14". */
  dateDesigned: string;
  dateConducted: string;
  /** The requirement addressed, or null when `requirementText` is used. */
  requirementId: Id | null;
  requirementText: string;
  objective: string;
  testCases: TestCase[];
  script: string;
  expectedResults: string;
  actualResults: string;
  result: '' | 'passed' | 'open items';
}

// ---- The interface structure diagram (SPEC 10.6) ----

/** One interface structure diagram. Its `name` is its title. */
export interface InterfaceDiagram extends Base {
  kind: 'interfaceDiagram';
}

/** A screen, form or report. */
export interface Interface extends Base {
  kind: 'interface';
  diagramId: Id;
  /** Shown at the top of the box, such as "0" or "1.2". Interface 0 is the main menu. */
  number: string;
  /** The DFD processes it carries out. May be empty. */
  processIds: Id[];
}

/** The user can move between these two interfaces. It has no direction. Its `name` is empty. */
export interface NavigationLink extends Base {
  kind: 'navigationLink';
  diagramId: Id;
  aId: Id;
  bId: Id;
}

// ---- The binder (SPEC 10.7) ----

export type Phase = 'planning' | 'analysis' | 'design' | 'implementation';

/** A file kept inside the model as a data URL. See `MAX_ATTACHMENT_BYTES`. */
export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  /** The size of the file in bytes. */
  size: number;
  dataUrl: string;
}

/** The three choices of the conversion strategy, and the student's reasons. null means not chosen yet. */
export interface ConversionStrategy {
  style: 'direct' | 'parallel' | null;
  location: 'pilot' | 'phased' | 'simultaneous' | null;
  modules: 'whole-system' | 'modular' | null;
  reasons: string;
}

/** A binder section: free text with attachments. Nothing in it is checked. Its `name` is its title. */
export interface BinderSection extends Base {
  kind: 'binderSection';
  phase: Phase;
  /** Its place within its phase. Lower comes first. */
  order: number;
  /** Plain text. A line starting with "#" is a heading, "-" a list item, and "|" a table row. */
  body: string;
  attachments: Attachment[];
  /** The key of the starting layout it was made from (`BINDER_LAYOUTS`), or null. */
  layout: string | null;
  /** The conversion strategy form. Present only on a migration plan (layout 'migration-plan'). */
  conversion: ConversionStrategy | null;
}

// ---- The structure chart and the program specification (SPEC 11.3 and 11.4) ----

/** One structure chart. Its `name` is its title. It shows the tree of modules under `topModuleId`. */
export interface StructureChart extends Base {
  kind: 'structureChart';
  topModuleId: Id;
}

/** One row of notes in a program specification's table of inputs and outputs. */
export interface IoNote {
  coupleId: Id;
  notes: string;
}

/** A module on a structure chart, with the fields of its program specification. */
export interface Module extends Base {
  kind: 'module';
  /** null for the top module of a chart. */
  parentModuleId: Id | null;
  /** The last part of the module number. */
  ordinal: number;
  /** Its control module calls it only in some cases. Drawn as a diamond on the line. */
  conditional: boolean;
  /** Its control module calls it more than once. Drawn as a curved arrow across the line. */
  repeated: boolean;
  /** A standard module used in many places. Drawn with a bar inside each side. */
  library: boolean;
  /** Set when this box is one more appearance of another module. It then takes that module's name, library mark and specification. */
  repeatsId: Id | null;
  /** The DFD process it comes from, if any. */
  processId: Id | null;
  // The program specification.
  purpose: string;
  programmer: string;
  dateDue: string;
  language: string;
  /** What starts the program. Empty for one that runs in a fixed order. */
  events: string;
  ioNotes: IoNote[];
  pseudocode: string;
  /** Calculations, business rules, calls to library modules, and changes the chart needs. */
  other: string;
}

/** Information passed along the line between a module and its control module. */
export interface Couple extends Base {
  kind: 'couple';
  /** The lower module of the line. */
  moduleId: Id;
  direction: 'down' | 'up';
  coupleKind: 'data' | 'control';
  /** A data couple carries this definition and takes its label from it. null for a control couple, which has a `name`. */
  dataId: Id | null;
}

export type Element =
  | Process
  | ExternalEntity
  | DataStore
  | DataFlow
  | ControlFlow
  | DataStructure
  | DataElement
  | Diagram
  | UseCase
  | Entity
  | Relationship
  | SystemRequest
  | Feasibility
  | Requirement
  | AlternativeMatrix
  | Test
  | InterfaceDiagram
  | Interface
  | NavigationLink
  | BinderSection
  | StructureChart
  | Module
  | Couple;

export type NodeElement = Process | ExternalEntity | DataStore;
export type DataDefinition = DataStructure | DataElement;

// ---- Views (section 3.5). They hold no meaning. ----

export interface NodeOccurrence {
  id: Id;
  diagramId: Id;
  elementId: Id;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Side = 'top' | 'right' | 'bottom' | 'left';

export interface FlowRoute {
  flowId: Id;
  /** null for an off-diagram end, an unattached end, or the source of a control flow. */
  sourceOccurrenceId: Id | null;
  targetOccurrenceId: Id | null;
  points: { x: number; y: number }[];
  /** A hint for the canvas: which side of each symbol the line leaves and enters. */
  sourceSide?: Side;
  targetSide?: Side;
}

export interface Views {
  occurrences: Record<Id, NodeOccurrence>;
  routes: Record<Id, FlowRoute>;
  /** Positions on the one entity relationship diagram, keyed by entity id. */
  erd: Record<Id, { x: number; y: number }>;
  /** Positions of interfaces on their interface structure diagrams, keyed by interface id. */
  isd: Record<Id, { x: number; y: number }>;
}

/** The project settings of SPEC section 3.7. */
export interface Settings {
  /** The highest diagram the project is expected to contain. null means the context diagram. */
  topDiagramId: Id | null;
  /** 'onRequest' holds the findings back until the student asks for them. */
  showFindings: 'always' | 'onRequest';
}

/** Fields that belong to the project as a whole (SPEC 10.3 and 11.6). */
export interface ProjectFields {
  /** The nonfunctional types marked "none expected" in the requirements definition. */
  noneExpected: NonfunctionalType[];
  /** Storage: the share added for the database's own needs, as a percentage. */
  overheadRate: number | null;
  /** Storage: how many months ahead to estimate. */
  months: number | null;
}

export interface Model {
  schemaVersion: 1;
  /** The project name. */
  name: string;
  /** Counter for new identifiers. An id is never reused. */
  nextId: number;
  elements: Record<Id, Element>;
  views: Views;
  settings: Settings;
  project: ProjectFields;
}

/** The largest file a binder section will keep, because the project is saved in the browser's localStorage. */
export const MAX_ATTACHMENT_BYTES = 300 * 1024;

/** The default size of an interface box on an interface structure diagram. */
export const INTERFACE_SIZE = { width: 150, height: 90 };

export const NODE_SIZE: Record<NodeElement['kind'], { width: number; height: number }> = {
  process: { width: 170, height: 96 },
  externalEntity: { width: 120, height: 90 },
  dataStore: { width: 200, height: 56 },
};

export function emptyModel(): Model {
  return {
    schemaVersion: 1,
    name: '',
    nextId: 1,
    elements: {},
    views: { occurrences: {}, routes: {}, erd: {}, isd: {} },
    settings: { topDiagramId: null, showFindings: 'always' },
    project: { noneExpected: [], overheadRate: null, months: null },
  };
}

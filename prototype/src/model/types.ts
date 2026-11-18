// The semantic model. See docs/SPEC.md sections 3, 8.1, 9.1 and 9.5.

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
  | 'relationship';

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
}

export interface ExternalEntity extends Base {
  kind: 'externalEntity';
}

export interface DataStore extends Base {
  kind: 'dataStore';
}

export interface DataFlow extends Base {
  kind: 'dataFlow';
  diagramId: Id;
  /** null means the end is unattached (an inherited flow not yet connected). */
  sourceId: Id | null;
  targetId: Id | null;
  dataId: Id;
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
  | Relationship;

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
}

/** The project settings of SPEC section 3.7. */
export interface Settings {
  /** The highest diagram the project is expected to contain. null means the context diagram. */
  topDiagramId: Id | null;
  /** 'onRequest' holds the findings back until the student asks for them. */
  showFindings: 'always' | 'onRequest';
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
}

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
    views: { occurrences: {}, routes: {}, erd: {} },
    settings: { topDiagramId: null, showFindings: 'always' },
  };
}

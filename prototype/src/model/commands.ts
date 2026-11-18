import type {
  AllowedValue,
  Component,
  Id,
  Model,
  Occurs,
  Origin,
  Settings,
  Side,
  UseCase,
} from './types';

/** An allowed value given to a command. A plain string keeps the meaning that value already has. */
export type AllowedValueInput = string | AllowedValue;

/** An attribute given to `setAttributes`. Leave `repeats` out to keep what the attribute has now. */
export interface AttributeInput {
  dataId: Id;
  identifier: boolean;
  repeats?: boolean;
}

/** A relationship end given to a command. `min` and `max` left out mean "not decided yet". */
export interface RelationshipEndInput {
  entityId: Id;
  verbPhrase?: string;
  min?: 0 | 1 | null;
  max?: 'one' | 'many' | null;
}

/** Fields every "create" command accepts. `id` lets the sample data use readable ids. */
interface New {
  id?: Id;
  description?: string;
  origin?: Origin;
}

interface At {
  x?: number;
  y?: number;
}

/** A flow carries an existing definition (`dataId`) or a structure made from `dataName`. */
interface Carries {
  dataId?: Id;
  dataName?: string;
}

/** An exception given to a command. `steps` left out means an empty list. */
export interface ExceptionInput {
  stepNumber: number;
  text: string;
  steps?: string[];
}

export type UseCasePatch = Partial<
  Pick<
    UseCase,
    | 'ordinal'
    | 'priority'
    | 'actorId'
    | 'trigger'
    | 'triggerType'
    | 'preconditions'
    | 'postconditions'
    | 'steps'
    | 'summaryInputs'
    | 'summaryOutputs'
    | 'processId'
  >
> & { exceptions?: ExceptionInput[] };

export type Command =
  // ---- Section 4.1 ----
  | ({ type: 'createProject'; name: string; systemName?: string; processId?: Id } & New)
  | ({ type: 'addExternalEntity'; diagramId: Id; name: string } & New & At)
  | ({ type: 'addDataStore'; diagramId: Id; name: string } & New & At)
  | ({ type: 'addProcess'; diagramId: Id; name: string; ordinal?: number } & New & At)
  | ({ type: 'placeExisting'; diagramId: Id; elementId: Id; occurrenceId?: Id } & At)
  | ({ type: 'addControlFlow'; diagramId: Id; targetId: Id; name: string } & New)
  | { type: 'setProcessNumber'; processId: Id; ordinal: number }
  | ({
      type: 'addFlow';
      diagramId: Id;
      sourceId: Id | null;
      targetId: Id | null;
      sourceOccurrenceId?: Id;
      targetOccurrenceId?: Id;
      sourceSide?: Side;
      targetSide?: Side;
    } & Carries &
      New)
  | ({
      type: 'defineData';
      dataKind: 'dataStructure' | 'dataElement';
      name: string;
      dataType?: string;
      allowedValues?: AllowedValueInput[];
      length?: number | null;
      nullable?: boolean | null;
      components?: Component[];
    } & New)
  | { type: 'setComposition'; dataId: Id; components: Component[] }
  | { type: 'rename'; id: Id; name: string }
  | { type: 'describe'; id: Id; description: string }
  | { type: 'setAliases'; id: Id; aliases: string[] }
  | { type: 'setNotes'; id: Id; notes: string }
  | { type: 'setProcessDescription'; processId: Id; processDescription: string }
  | ({ type: 'setFlowData'; flowId: Id } & Carries)
  | { type: 'expandProcess'; processId: Id; diagramId?: Id }
  | { type: 'carryDown'; processId: Id }
  | { type: 'setTopDiagram'; diagramId: Id | null }
  | { type: 'setShowFindings'; showFindings: Settings['showFindings'] }
  | { type: 'removeOccurrence'; occurrenceId: Id }
  | { type: 'deleteElement'; id: Id; cascade?: boolean }
  // ---- Added for the prototype ----
  | {
      type: 'setFlowEnds';
      flowId: Id;
      /** Leave a field out to keep that end as it is. null detaches it. */
      sourceId?: Id | null;
      targetId?: Id | null;
      sourceOccurrenceId?: Id;
      targetOccurrenceId?: Id;
    }
  | { type: 'setFlowRoute'; flowId: Id; sourceSide?: Side; targetSide?: Side; points?: { x: number; y: number }[] }
  | { type: 'setDataType'; dataId: Id; dataType: string; allowedValues?: AllowedValueInput[] }
  | { type: 'setDataDetails'; dataId: Id; length?: number | null; nullable?: boolean | null }
  | { type: 'setOccurs'; dataId: Id; componentId: Id; occurs: Occurs; limit?: number | null }
  | { type: 'setLimit'; dataId: Id; componentId: Id; limit: number | null }
  | { type: 'moveNode'; occurrenceId: Id; x: number; y: number }
  | { type: 'resizeNode'; occurrenceId: Id; width: number; height: number }
  | ({ type: 'addUseCase'; name: string } & New & UseCasePatch)
  | { type: 'updateUseCase'; id: Id; patch: UseCasePatch }
  | ({ type: 'addEntity'; name: string; code?: string; storeId?: Id | null } & New & At)
  | { type: 'updateEntity'; id: Id; code?: string; storeId?: Id | null }
  | { type: 'moveEntity'; entityId: Id; x: number; y: number }
  | ({ type: 'addAttribute'; entityId: Id; identifier?: boolean; repeats?: boolean; dataType?: string } & Carries)
  | { type: 'removeAttribute'; entityId: Id; dataId: Id }
  | { type: 'setAttributes'; entityId: Id; attributes: AttributeInput[] }
  | ({ type: 'addRelationship'; ends: [RelationshipEndInput, RelationshipEndInput]; identifying?: boolean } & New)
  | { type: 'updateRelationship'; id: Id; ends?: [RelationshipEndInput, RelationshipEndInput]; identifying?: boolean }
  | { type: 'setCrud'; processId: Id; dataId: Id; uses: string };

export type ApplyResult =
  | { ok: true; model: Model; /** Ids of the elements and occurrences this command made, in order. */ created: Id[] }
  | { ok: false; error: string };

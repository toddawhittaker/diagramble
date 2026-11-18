import type {
  AllowedValue,
  AlternativeMatrix,
  BusinessValue,
  CashLine,
  Component,
  ConversionStrategy,
  Couple,
  Economic,
  Id,
  Model,
  Module,
  NonfunctionalType,
  Occurs,
  OrganizationalFactor,
  Origin,
  Phase,
  Requirement,
  Settings,
  Side,
  SystemRequest,
  TechnicalAssessment,
  TechnicalFactor,
  Test,
  UseCase,
  ValueEstimate,
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

export type CoreCommand =
  // ---- Section 4.1 ----
  | ({ type: 'createProject'; name: string; systemName?: string; processId?: Id } & New)
  | ({ type: 'addExternalEntity'; diagramId: Id; name: string } & New & At)
  | ({ type: 'addDataStore'; diagramId: Id; name: string; systemRelated?: boolean } & New & At)
  | ({ type: 'addProcess'; diagramId: Id; name: string; ordinal?: number; systemRelated?: boolean } & New & At)
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
      systemRelated?: boolean;
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
      systemRelated?: boolean;
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
  | ({ type: 'addEntity'; name: string; code?: string; storeId?: Id | null; systemRelated?: boolean } & New & At)
  | { type: 'updateEntity'; id: Id; code?: string; storeId?: Id | null }
  | { type: 'moveEntity'; entityId: Id; x: number; y: number }
  | ({ type: 'addAttribute'; entityId: Id; identifier?: boolean; repeats?: boolean; dataType?: string; systemRelated?: boolean } & Carries)
  | { type: 'removeAttribute'; entityId: Id; dataId: Id }
  | { type: 'setAttributes'; entityId: Id; attributes: AttributeInput[] }
  | ({ type: 'addRelationship'; ends: [RelationshipEndInput, RelationshipEndInput]; identifying?: boolean } & New)
  | { type: 'updateRelationship'; id: Id; ends?: [RelationshipEndInput, RelationshipEndInput]; identifying?: boolean }
  | { type: 'setCrud'; processId: Id; dataId: Id; uses: string };

// ---- The second release: SPEC sections 10 and 11 ----

/** A value given to `updateSystemRequest`. Fields left out start empty. */
export interface BusinessValueInput {
  text: string;
  tangible?: boolean;
  amount?: number | null;
  estimates?: Partial<ValueEstimate>[];
}

export type SystemRequestPatch = Partial<Pick<SystemRequest, 'sponsor' | 'businessNeed' | 'businessRequirements' | 'specialIssues'>> & {
  businessValue?: (BusinessValue | BusinessValueInput)[];
};

/** A line of the cash flow table given to a command. Fields left out are empty. `amounts` is fitted to the table. */
export type CashLineInput = Partial<CashLine> & { name: string };

export type EconomicPatch = Partial<Pick<Economic, 'firstYear' | 'years' | 'rate' | 'intangibles' | 'roi' | 'breakEven' | 'npv'>> & {
  benefits?: CashLineInput[];
  developmentCosts?: CashLineInput[];
  operationalCosts?: CashLineInput[];
};

export type RequirementPatch = Partial<
  Pick<Requirement, 'requirementKind' | 'functionalType' | 'group' | 'userGroup' | 'nonfunctionalType' | 'subtype' | 'priority' | 'traceIds'>
>;

export type MatrixPatch = Partial<Pick<AlternativeMatrix, 'alternatives' | 'criteria' | 'cells' | 'recommendation'>>;

export type TestPatch = Partial<
  Pick<
    Test,
    | 'ordinal'
    | 'stage'
    | 'testType'
    | 'programId'
    | 'programText'
    | 'version'
    | 'tester'
    | 'dateDesigned'
    | 'dateConducted'
    | 'requirementId'
    | 'requirementText'
    | 'objective'
    | 'testCases'
    | 'script'
    | 'expectedResults'
    | 'actualResults'
    | 'result'
  >
>;

export type ModulePatch = Partial<
  Pick<Module, 'parentModuleId' | 'ordinal' | 'conditional' | 'repeated' | 'library' | 'repeatsId' | 'processId'>
>;

export type ProgramSpecPatch = Partial<
  Pick<Module, 'purpose' | 'programmer' | 'dateDue' | 'language' | 'events' | 'ioNotes' | 'pseudocode' | 'other'>
>;

export type Release2Command =
  | { type: 'renameProject'; name: string }
  // The physical fields of SPEC 11.2 and 11.5. Give only the fields the element's kind has.
  | {
      type: 'setPhysical';
      id: Id;
      implementation?: string;
      physicalName?: string;
      human?: boolean;
      systemRelated?: boolean;
      fieldName?: string;
      defaultValue?: string;
      averageWidth?: number | null;
      tableName?: string;
      copies?: Id[];
      foreignKey?: boolean;
    }
  | {
      type: 'setStorage';
      entityId: Id;
      initialRecords?: number | null;
      growthPerMonth?: number | null;
      growthPerYear?: number | null;
      recordSize?: number | null;
    }
  | { type: 'setStorageSettings'; overheadRate?: number | null; months?: number | null }
  // Forms.
  | { type: 'updateSystemRequest'; id?: Id; origin?: Origin; patch: SystemRequestPatch }
  | {
      type: 'updateFeasibility';
      id?: Id;
      origin?: Origin;
      technical?: Partial<Record<TechnicalFactor, Partial<TechnicalAssessment>>>;
      organizational?: Partial<Record<OrganizationalFactor, string>>;
      economic?: EconomicPatch;
    }
  | ({ type: 'addRequirement'; name: string } & New & RequirementPatch)
  | { type: 'updateRequirement'; id: Id; patch: RequirementPatch }
  | { type: 'reorderRequirements'; ids: Id[] }
  | { type: 'setNoneExpected'; nonfunctionalType: NonfunctionalType; noneExpected: boolean }
  | ({ type: 'addAlternativeMatrix'; name: string } & New & MatrixPatch)
  | ({ type: 'updateAlternativeMatrix'; id: Id } & MatrixPatch)
  | { type: 'removeAlternative'; id: Id; index: number }
  | { type: 'removeCriterion'; id: Id; index: number }
  | ({ type: 'addTest'; name: string } & New & TestPatch)
  | { type: 'updateTest'; id: Id; patch: TestPatch }
  // The interface structure diagram.
  | ({ type: 'addInterfaceDiagram'; name: string } & New)
  | ({ type: 'addInterface'; diagramId: Id; name: string; number?: string; processIds?: Id[] } & New & At)
  | { type: 'updateInterface'; id: Id; number?: string; processIds?: Id[] }
  | { type: 'moveInterface'; interfaceId: Id; x: number; y: number }
  | ({ type: 'addNavigationLink'; diagramId: Id; aId: Id; bId: Id } & New)
  // The binder.
  | ({ type: 'addBinderSection'; name: string; phase?: Phase; layout?: string; body?: string } & New)
  | { type: 'updateBinderSection'; id: Id; phase?: Phase; body?: string }
  | { type: 'reorderBinderSections'; ids: Id[] }
  | { type: 'addAttachment'; sectionId: Id; name: string; mimeType?: string; dataUrl: string; attachmentId?: string }
  | { type: 'removeAttachment'; sectionId: Id; attachmentId: string }
  | ({ type: 'setConversion'; sectionId: Id } & Partial<ConversionStrategy>)
  // The structure chart and the program specification.
  | ({ type: 'addStructureChart'; name: string; moduleName?: string; moduleId?: Id; ordinal?: number; processId?: Id | null } & New)
  | ({ type: 'addModule'; parentModuleId: Id; name: string } & New & Omit<ModulePatch, 'parentModuleId'>)
  | { type: 'updateModule'; id: Id; patch: ModulePatch }
  | { type: 'setProgramSpec'; moduleId: Id; patch: ProgramSpecPatch }
  | ({ type: 'addCouple'; moduleId: Id; direction: Couple['direction']; coupleKind: Couple['coupleKind']; name?: string } & Carries & New)
  | ({ type: 'updateCouple'; id: Id; direction?: Couple['direction']; coupleKind?: Couple['coupleKind'] } & Carries);

export type Command = CoreCommand | Release2Command;

export type ApplyResult =
  | { ok: true; model: Model; /** Ids of the elements and occurrences this command made, in order. */ created: Id[] }
  | { ok: false; error: string };

import { checkInvariants } from './apply';
import { emptyModel, type Element, type Model } from './types';

type Loose = Record<string, any>;

function isObject(v: unknown): v is Loose {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Turns parsed JSON into a model, filling in any field that an older file does not have.
 * Throws an Error with a plain message when the value is not a Diagramble project.
 */
export function normalizeModel(raw: unknown): Model {
  const notOne = 'This file is not a Diagramble project.';
  if (!isObject(raw) || raw.schemaVersion !== 1 || !isObject(raw.elements) || !isObject(raw.views)) throw new Error(notOne);
  const blank = emptyModel();
  const model: Model = {
    schemaVersion: 1,
    name: typeof raw.name === 'string' ? raw.name : '',
    nextId: typeof raw.nextId === 'number' ? raw.nextId : 1,
    elements: {},
    views: {
      occurrences: isObject(raw.views.occurrences) ? raw.views.occurrences : {},
      routes: isObject(raw.views.routes) ? raw.views.routes : {},
      erd: isObject(raw.views.erd) ? raw.views.erd : {},
      isd: isObject(raw.views.isd) ? raw.views.isd : {},
    },
    settings: {
      topDiagramId: typeof raw.settings?.topDiagramId === 'string' ? raw.settings.topDiagramId : blank.settings.topDiagramId,
      showFindings: raw.settings?.showFindings === 'onRequest' ? 'onRequest' : 'always',
    },
    project: {
      noneExpected: Array.isArray(raw.project?.noneExpected) ? raw.project.noneExpected : [],
      overheadRate: typeof raw.project?.overheadRate === 'number' ? raw.project.overheadRate : null,
      months: typeof raw.project?.months === 'number' ? raw.project.months : null,
    },
  };
  for (const [id, value] of Object.entries(raw.elements as Loose)) {
    if (!isObject(value) || typeof value.kind !== 'string') throw new Error(notOne);
    const e: Loose = { description: '', ...value, id, aliases: Array.isArray(value.aliases) ? value.aliases : [], notes: value.notes ?? '' };
    switch (e.kind) {
      case 'process':
        e.processDescription ??= '';
        e.crud ??= [];
        e.implementation ??= '';
        e.human ??= false;
        e.systemRelated ??= false;
        break;
      case 'externalEntity':
        e.human ??= false;
        break;
      case 'dataStore':
      case 'dataFlow':
        e.physicalName ??= '';
        e.systemRelated ??= false;
        break;
      case 'dataElement':
        if (Array.isArray(e.allowedValues))
          e.allowedValues = e.allowedValues.map((v: unknown) =>
            isObject(v) ? { value: String(v.value ?? ''), meaning: String(v.meaning ?? '') } : { value: String(v), meaning: '' },
          );
        e.length ??= null;
        e.nullable ??= null;
        e.systemRelated ??= false;
        e.fieldName ??= '';
        e.defaultValue ??= '';
        e.averageWidth ??= null;
        break;
      case 'useCase':
        e.exceptions = (e.exceptions ?? []).map((x: Loose) => ({ ...x, steps: Array.isArray(x.steps) ? x.steps : [] }));
        break;
      case 'entity':
        e.attributes = (e.attributes ?? []).map((a: Loose) => ({ ...a, repeats: a.repeats === true }));
        e.systemRelated ??= false;
        e.tableName ??= '';
        e.copies ??= [];
        e.initialRecords ??= null;
        e.growthPerMonth ??= null;
        e.growthPerYear ??= null;
        e.recordSize ??= null;
        break;
      case 'relationship':
        if (!Array.isArray(e.ends) || e.ends.length !== 2) throw new Error(notOne);
        e.ends = e.ends.map((end: Loose) => ({ ...end, min: end.min ?? null, max: end.max ?? null }));
        e.foreignKey ??= false;
        break;
    }
    model.elements[id] = e as Element;
  }
  let broken: string | null;
  try {
    broken = checkInvariants(model);
  } catch {
    throw new Error(notOne);
  }
  if (broken) throw new Error(`This project file cannot be opened. ${broken}`);
  return model;
}

/** A copy of the model with every element's origin set to 'starter': what a starter case holds (SPEC 3.8). */
export function asStarter(model: Model): Model {
  const copy = structuredClone(model);
  for (const e of Object.values(copy.elements)) e.origin = 'starter';
  return copy;
}

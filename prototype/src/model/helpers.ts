// Small helpers the command code shares. Not exported from the folder index.

import type { Element, ElementKind, Id, Model, Origin } from './types';

export class Refused extends Error {}

/** Stops a command with a plain sentence fit to show the user. */
export function refuse(message: string): never {
  throw new Refused(message);
}

export function newId(m: Model, prefix: string, wanted?: Id): Id {
  if (wanted) {
    if (m.elements[wanted] || m.views.occurrences[wanted]) refuse(`The id '${wanted}' is already in use.`);
    return wanted;
  }
  let id: Id;
  do id = `${prefix}${m.nextId++}`;
  while (m.elements[id] || m.views.occurrences[id]);
  return id;
}

export function need<K extends ElementKind>(m: Model, id: Id | null | undefined, kind: K): Extract<Element, { kind: K }> {
  const e = id ? m.elements[id] : undefined;
  if (!e || e.kind !== kind) refuse(`There is no ${kind} with the id '${id}'.`);
  return e as Extract<Element, { kind: K }>;
}

export function needData(m: Model, id: Id | undefined) {
  const e = id ? m.elements[id] : undefined;
  if (!e || (e.kind !== 'dataStructure' && e.kind !== 'dataElement')) refuse(`There is no data definition with the id '${id}'.`);
  return e as Extract<Element, { kind: 'dataStructure' | 'dataElement' }>;
}

export function base(cmd: { description?: string; origin?: Origin }, name: string) {
  return { name, description: cmd.description ?? '', aliases: [] as string[], notes: '', origin: cmd.origin ?? ('student' as Origin) };
}

/** A number field of a command: null clears it, and anything else must be a number that is not negative. */
export function amount(value: number | null, what: string, whole = false): number | null {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) refuse(`${what} must be a number, 0 or more.`);
  if (whole && !Number.isInteger(value)) refuse(`${what} must be a whole number.`);
  return value;
}

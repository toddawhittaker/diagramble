// Undo and redo within one editing session (docs/SPEC.md sections 3.6 and 3.9). Undo
// applies the last entry's inverse and redo its patch; neither runs a command again.
// Replay rebuilds a document from stored patches alone.
import { apply, asJson, type Command } from "./apply.ts";
import type { ProjectDocument } from "./document.ts";
import type { Id } from "./id.ts";
import type { Origin } from "./kinds/common.ts";
import { applyPatch, type Patch } from "./patch.ts";

export type LogEntry = { command: Command; origin: Origin; patch: Patch; inverse: Patch };

export type Session = { doc: ProjectDocument; undo: LogEntry[]; redo: LogEntry[] };

export type SessionResult =
  | { ok: true; session: Session; entry: LogEntry }
  | { ok: false; code: "invalid" | "idInUse" | "refused"; message: string; ids?: Id[] };

export function startSession(doc: ProjectDocument): Session {
  return { doc, undo: [], redo: [] };
}

function step(
  session: Session,
  entry: LogEntry,
  undo: LogEntry[],
  redo: LogEntry[],
): SessionResult {
  const result = applyPatch(asJson(session.doc), entry.patch);
  if (!result.ok) return { ok: false, code: "refused", message: result.message };
  return { ok: true, session: { doc: result.doc as unknown as ProjectDocument, undo, redo }, entry };
}

export function applyInSession(session: Session, command: Command, origin: Origin): SessionResult {
  if (command.type === "undo") {
    const last = session.undo.at(-1);
    if (!last) return { ok: false, code: "refused", message: "There is nothing to undo." };
    const entry = { command: { type: "undo" }, origin, patch: last.inverse, inverse: last.patch };
    return step(session, entry, session.undo.slice(0, -1), [...session.redo, last]);
  }
  if (command.type === "redo") {
    const last = session.redo.at(-1);
    if (!last) return { ok: false, code: "refused", message: "There is nothing to redo." };
    const entry = { command: { type: "redo" }, origin, patch: last.patch, inverse: last.inverse };
    return step(session, entry, [...session.undo, last], session.redo.slice(0, -1));
  }
  const result = apply(session.doc, command, origin);
  if (!result.ok) return result;
  const entry = { command, origin, patch: result.patch, inverse: result.inverse };
  return { ok: true, session: { doc: result.doc, undo: [...session.undo, entry], redo: [] }, entry };
}

export type ReplayResult =
  | { ok: true; doc: ProjectDocument }
  | { ok: false; index: number; message: string };

/** Apply each entry's patch in order; a later change to a command never changes an old project. */
export function replay(doc: ProjectDocument, entries: readonly LogEntry[]): ReplayResult {
  let current = asJson(doc);
  for (const [index, entry] of entries.entries()) {
    const result = applyPatch(current, entry.patch);
    if (!result.ok) return { ok: false, index, message: `Entry ${index + 1} does not apply: ${result.message}` };
    current = result.doc;
  }
  return { ok: true, doc: current as unknown as ProjectDocument };
}

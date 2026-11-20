// The one pure way a document changes (docs/SPEC.md sections 3.6 and 4): check the
// arguments, check new ids, run the command on a private copy, check every
// invariant, and describe the change as a JSON Patch and its inverse.
import type { z } from "zod";
import type { ProjectDocument } from "./document.ts";
import type { Id } from "./id.ts";
import type { Origin } from "./kinds/common.ts";
import { findViolations } from "./invariants.ts";
import { diff, type JsonValue, type Patch } from "./patch.ts";
import { findCommand } from "./registry.ts";

export type Command = { type: string; args?: unknown };

export type ApplyResult =
  | { ok: true; doc: ProjectDocument; patch: Patch; inverse: Patch }
  | { ok: false; code: "invalid" | "idInUse" | "refused"; message: string; ids?: Id[] };

/** A deep copy through JSON; the model avoids structuredClone (ES2024 library). */
export function copyDocument(doc: ProjectDocument): ProjectDocument {
  return JSON.parse(JSON.stringify(doc)) as ProjectDocument;
}

export function asJson(doc: ProjectDocument): JsonValue {
  return doc as unknown as JsonValue;
}

function argumentMessage(error: z.ZodError): string {
  const issue = error.issues[0];
  if (issue?.code === "unrecognized_keys") {
    return `The argument "${issue.keys.join('", "')}" is not one this command takes.`;
  }
  if (!issue || issue.path.length === 0) return "The arguments must be an object of named fields.";
  return `The argument "${issue.path.join(".")}" is missing or not valid.`;
}

function clashingIds(doc: ProjectDocument, ids: Id[]): Id[] {
  const seen = new Set<Id>();
  const clashes = new Set<Id>();
  for (const id of ids) {
    const inUse =
      Object.hasOwn(doc.elements, id) ||
      Object.hasOwn(doc.views.occurrences, id) ||
      Object.hasOwn(doc.views.routes, id);
    if (inUse || seen.has(id)) clashes.add(id);
    seen.add(id);
  }
  return [...clashes];
}

export function apply(doc: ProjectDocument, command: Command, origin: Origin): ApplyResult {
  const definition = findCommand(command.type);
  if (!definition) {
    return { ok: false, code: "invalid", message: `There is no command called "${command.type}".` };
  }
  const parsed = definition.args.safeParse(command.args);
  if (!parsed.success) return { ok: false, code: "invalid", message: argumentMessage(parsed.error) };

  const clashes = clashingIds(doc, definition.newIds(parsed.data));
  if (clashes.length > 0) {
    return { ok: false, code: "idInUse", message: "An id for a new item is already in use.", ids: clashes };
  }

  const result = definition.run(copyDocument(doc), parsed.data, { origin });
  if (!result.ok) return { ok: false, code: "refused", message: result.message };

  const violation = findViolations(result.doc)[0];
  if (violation) {
    // The violation's own message is for developers; the student gets one fixed sentence.
    return {
      ok: false,
      code: "refused",
      message: "This change would leave the project in a state the model does not allow.",
      ids: violation.ids,
    };
  }

  return {
    ok: true,
    doc: result.doc,
    patch: diff(asJson(doc), asJson(result.doc)),
    inverse: diff(asJson(result.doc), asJson(doc)),
  };
}

import { describe, expect, test } from "vitest";
import { apply } from "./apply.ts";
import { emptyDocument, type ProjectDocument } from "./document.ts";
import { applyPatch, type JsonValue } from "./patch.ts";

const args = { name: "Bike Rental", contextDiagramId: "ctx", processId: "p0", occurrenceId: "o-p0" };
const create = { type: "createProject", args };

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

const sentence = /^[A-Z][^]*\.$/;

describe("apply (SPEC.md sections 3.6 and 4)", () => {
  test("an unknown command type is invalid", () => {
    const result = apply(emptyDocument(), { type: "flyAway", args: {} }, "student");
    expect(result).toEqual({ ok: false, code: "invalid", message: expect.stringMatching(sentence) });
  });

  test("arguments that fail their schema are invalid, naming the field", () => {
    const wrongType = apply(emptyDocument(), { type: "createProject", args: { ...args, name: 7 } }, "student");
    expect(wrongType).toMatchObject({ ok: false, code: "invalid", message: expect.stringContaining('"name"') });
    const missing = apply(emptyDocument(), { type: "createProject", args: { name: "X" } }, "student");
    expect(missing).toMatchObject({ ok: false, code: "invalid", message: expect.stringContaining('"contextDiagramId"') });
    const extra = apply(emptyDocument(), { type: "createProject", args: { ...args, origin: "ai" } }, "student");
    expect(extra).toMatchObject({ ok: false, code: "invalid", message: expect.stringContaining('"origin"') });
    const notObject = apply(emptyDocument(), { type: "createProject" }, "student");
    expect(notObject).toMatchObject({ ok: false, code: "invalid", message: expect.stringMatching(sentence) });
  });

  test("a bad id in the arguments is invalid (SPEC.md section 3.1)", () => {
    const result = apply(emptyDocument(), { type: "createProject", args: { ...args, processId: "__proto__" } }, "student");
    expect(result).toMatchObject({ ok: false, code: "invalid", message: expect.stringContaining('"processId"') });
  });

  test("new ids repeated within one command are in use, listing them (SPEC.md section 3.2)", () => {
    const result = apply(emptyDocument(), { type: "createProject", args: { ...args, occurrenceId: "p0" } }, "student");
    expect(result).toEqual({ ok: false, code: "idInUse", message: expect.stringMatching(sentence), ids: ["p0"] });
  });

  test("new ids already used by an element, occurrence or route are in use", () => {
    const doc: ProjectDocument = {
      ...emptyDocument(),
      views: {
        occurrences: { "o-p0": { id: "o-p0", diagramId: "d", elementId: "e", x: 0, y: 0, width: 1, height: 1 } },
        routes: {
          ctx: { id: "ctx", flowId: "f", diagramId: "d", sourceOccurrenceId: null, targetOccurrenceId: null, points: [] },
        },
      },
    };
    const result = apply(doc, create, "student");
    expect(result).toMatchObject({ ok: false, code: "idInUse" });
    expect(result.ok ? [] : [...(result.ids ?? [])].sort()).toEqual(["ctx", "o-p0"]);
  });

  test("a command's own condition refuses with its sentence", () => {
    const first = apply(emptyDocument(), create, "student");
    if (!first.ok) throw new Error(first.message);
    const again = { name: "B", contextDiagramId: "c2", processId: "p2", occurrenceId: "o2" };
    const result = apply(first.doc, { type: "createProject", args: again }, "student");
    expect(result).toEqual({ ok: false, code: "refused", message: expect.stringMatching(sentence) });
  });

  test("a result that breaks an invariant is refused with the violation's ids (SPEC.md section 3.4)", () => {
    // An occurrence of an element that does not exist: createProject leaves it, so the
    // view consistency check refuses the result.
    const doc: ProjectDocument = {
      ...emptyDocument(),
      views: {
        occurrences: { stray: { id: "stray", diagramId: "ctx", elementId: "ghost", x: 0, y: 0, width: 1, height: 1 } },
        routes: {},
      },
    };
    const result = apply(doc, create, "student");
    expect(result).toMatchObject({ ok: false, code: "refused", message: expect.stringMatching(sentence) });
    expect(result.ok ? [] : result.ids).toContain("stray");
  });

  test("never changes its input", () => {
    const doc = deepFreeze(emptyDocument());
    const before = JSON.stringify(doc);
    const result = apply(doc, create, "student");
    expect(result.ok).toBe(true);
    expect(JSON.stringify(doc)).toBe(before);
  });

  test("patch turns the old document into the new one and inverse turns it back (SPEC.md section 3.6)", () => {
    const old = emptyDocument();
    const result = apply(old, create, "student");
    if (!result.ok) throw new Error(result.message);
    const forward = applyPatch(old as unknown as JsonValue, result.patch);
    expect(forward).toEqual({ ok: true, doc: result.doc });
    const back = applyPatch(result.doc as unknown as JsonValue, result.inverse);
    expect(back).toEqual({ ok: true, doc: old });
  });

  test("undo and redo are not commands of apply", () => {
    expect(apply(emptyDocument(), { type: "undo" }, "student")).toMatchObject({ ok: false, code: "invalid" });
    expect(apply(emptyDocument(), { type: "redo" }, "student")).toMatchObject({ ok: false, code: "invalid" });
  });
});

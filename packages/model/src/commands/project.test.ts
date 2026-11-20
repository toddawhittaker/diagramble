import { describe, expect, test } from "vitest";
import { apply } from "../apply.ts";
import { emptyDocument, ProjectDocument } from "../document.ts";
import { findViolations } from "../invariants.ts";

const args = { name: "Bike Rental", contextDiagramId: "ctx", processId: "p0", occurrenceId: "o-p0" };

describe("createProject (SPEC.md section 4)", () => {
  test("makes a valid document with the context diagram, process 0 and its occurrence", () => {
    const result = apply(emptyDocument(), { type: "createProject", args }, "student");
    if (!result.ok) throw new Error(result.message);
    const doc = result.doc;
    expect(ProjectDocument.parse(doc)).toEqual(doc);
    expect(findViolations(doc)).toEqual([]);
    expect(doc.settings).toEqual({ name: "Bike Rental", topDiagramId: "ctx", showFindings: "always", caseText: "" });
    expect(doc.elements.ctx).toEqual({
      kind: "diagram", id: "ctx", name: "Context diagram", description: "", aliases: [], notes: "",
      origin: "student", diagramKind: "context", decomposesProcessId: null,
    });
    expect(doc.elements.p0).toEqual({
      kind: "process", id: "p0", name: "Bike Rental", description: "", aliases: [], notes: "",
      origin: "student", parentProcessId: null, ordinal: 0, processDescription: "",
    });
    expect(doc.views).toEqual({
      occurrences: { "o-p0": { id: "o-p0", diagramId: "ctx", elementId: "p0", x: 0, y: 0, width: 160, height: 120 } },
      routes: {},
    });
  });

  test("takes origin from the caller (SPEC.md section 3.2)", () => {
    const result = apply(emptyDocument(), { type: "createProject", args }, "starter");
    expect(result.ok && result.doc.elements.p0?.origin).toBe("starter");
  });

  test("is refused on a document that already has elements", () => {
    const first = apply(emptyDocument(), { type: "createProject", args }, "student");
    if (!first.ok) throw new Error(first.message);
    const other = { name: "Again", contextDiagramId: "ctx2", processId: "p0b", occurrenceId: "o2" };
    const second = apply(first.doc, { type: "createProject", args: other }, "student");
    expect(second).toEqual({ ok: false, code: "refused", message: expect.stringMatching(/^[A-Z].*\.$/) });
  });

  test("is refused by its own sentence on a document with only an occurrence (SPEC.md section 4)", () => {
    const doc: ProjectDocument = {
      ...emptyDocument(),
      views: {
        occurrences: { stray: { id: "stray", diagramId: "x", elementId: "y", x: 0, y: 0, width: 1, height: 1 } },
        routes: {},
      },
    };
    expect(apply(doc, { type: "createProject", args }, "student")).toEqual({
      ok: false, code: "refused", message: "A project can be created only in an empty document.",
    });
  });
});

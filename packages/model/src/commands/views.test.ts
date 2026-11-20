import { describe, expect, test } from "vitest";
import type { ProjectDocument } from "../document.ts";
import { apply, asJson } from "../apply.ts";
import { findViolations } from "../invariants.ts";
import { applyPatch } from "../patch.ts";
import { findCommand } from "../registry.ts";
import { viewCommands } from "./views.ts";

const common = { description: "", aliases: [], notes: "", origin: "student" as const };

// A bakery: a context diagram with process 0, and a level 0 diagram with two
// processes and one data flow with its route (SPEC.md sections 3.1 and 3.5).
function bakery(): ProjectDocument {
  const process = (id: string, parentProcessId: string | null, ordinal: number) =>
    ({ ...common, id, kind: "process" as const, name: id, parentProcessId, ordinal, processDescription: "" });
  const diagram = (id: string, diagramKind: "context" | "dfd", decomposesProcessId: string | null) =>
    ({ ...common, id, kind: "diagram" as const, name: id, diagramKind, decomposesProcessId });
  const occ = (id: string, diagramId: string, elementId: string, x: number) =>
    ({ id, diagramId, elementId, x, y: 0, width: 160, height: 120 });
  const elements = [
    diagram("ctx", "context", null),
    diagram("level0", "dfd", "p0"),
    process("p0", null, 0),
    process("p1", "p0", 1),
    process("p2", "p0", 2),
    { ...common, id: "item", kind: "dataElement" as const, name: "Item", dataType: "text", allowedValues: [] },
    { ...common, id: "fBake", kind: "dataFlow" as const, name: "", diagramId: "level0", sourceId: "p1", targetId: "p2", dataId: "item" },
  ];
  const occurrences = [occ("oP0", "ctx", "p0", 0), occ("oP1", "level0", "p1", 0), occ("oP2", "level0", "p2", 300)];
  return {
    schemaVersion: 1,
    settings: { name: "Corner Bakery", topDiagramId: "ctx", showFindings: "always", caseText: "" },
    elements: Object.fromEntries(elements.map((e) => [e.id, e])),
    views: {
      occurrences: Object.fromEntries(occurrences.map((o) => [o.id, o])),
      routes: {
        rBake: { id: "rBake", flowId: "fBake", diagramId: "level0", sourceOccurrenceId: "oP1", targetOccurrenceId: "oP2", points: [] },
      },
    },
  };
}

function run(doc: ProjectDocument, type: string, args: unknown) {
  return apply(doc, { type, args }, "student");
}

/** The patch applies to the document and gives the new one; its inverse gives the old one back. */
function expectReversible(before: ProjectDocument, result: Extract<ReturnType<typeof run>, { ok: true }>): string[] {
  const forward = applyPatch(asJson(before), result.patch);
  expect(forward.ok && forward.doc).toEqual(result.doc);
  const back = applyPatch(asJson(result.doc), result.inverse);
  expect(back.ok && back.doc).toEqual(before);
  return result.patch.map((op) => op.path);
}

describe("the view commands are registered (SPEC.md section 7)", () => {
  test("both are in the registry with a sentence, a strict schema and no new ids", () => {
    expect(viewCommands.map((c) => c.name)).toEqual(["moveOccurrence", "setRoute"]);
    for (const command of viewCommands) {
      expect(findCommand(command.name)).toBe(command);
      expect(command.kind).toBe("command");
      expect(command.sentence).toMatch(/^[A-Z].*\.$/);
    }
    expect(viewCommands[0]?.newIds({})).toEqual([]);
    expect(viewCommands[1]?.newIds({})).toEqual([]);
  });
});

describe("moveOccurrence (SPEC.md sections 3.5 and 4.1)", () => {
  const args = { occurrenceId: "oP1", x: 40, y: 20, width: 200, height: 90 };

  test("sets the position and size and leaves the document valid", () => {
    const result = run(bakery(), "moveOccurrence", args);
    if (!result.ok) throw new Error(result.message);
    expect(result.doc.views.occurrences["oP1"]).toEqual({ id: "oP1", diagramId: "level0", elementId: "p1", x: 40, y: 20, width: 200, height: 90 });
    expect(findViolations(result.doc)).toEqual([]);
  });

  test("changes only paths under /views, never an element", () => {
    const before = bakery();
    const result = run(before, "moveOccurrence", args);
    if (!result.ok) throw new Error(result.message);
    const changed = expectReversible(before, result);
    expect(changed.length).toBeGreaterThan(0);
    for (const path of changed) expect(path.startsWith("/views/occurrences/oP1/")).toBe(true);
    expect(result.doc.elements).toEqual(before.elements);
  });

  test("is refused for an unknown occurrence, and the document is unchanged", () => {
    const before = bakery();
    const result = run(before, "moveOccurrence", { ...args, occurrenceId: "nope" });
    expect(result).toEqual({ ok: false, code: "refused", message: expect.stringMatching(/^[A-Z].*\.$/) });
    expect(before).toEqual(bakery());
  });

  test.each([["width", 0], ["width", -5], ["height", 0], ["height", -1]])("is invalid when %s is %d (SPEC.md section 3.5)", (field, value) => {
    const result = run(bakery(), "moveOccurrence", { ...args, [field]: value });
    expect(result).toEqual({ ok: false, code: "invalid", message: expect.stringContaining(`"${field}"`) });
  });

  test("is invalid when a size is not a number", () => {
    const result = run(bakery(), "moveOccurrence", { ...args, width: Number.NaN });
    expect(result).toMatchObject({ ok: false, code: "invalid" });
  });

  test("accepts negative positions", () => {
    expect(run(bakery(), "moveOccurrence", { ...args, x: -30, y: -10 }).ok).toBe(true);
  });

  test("refuses an unknown or missing argument as invalid", () => {
    expect(run(bakery(), "moveOccurrence", { ...args, extra: 1 })).toMatchObject({ ok: false, code: "invalid" });
    expect(run(bakery(), "moveOccurrence", { occurrenceId: "oP1" })).toMatchObject({ ok: false, code: "invalid" });
  });
});

describe("setRoute (SPEC.md sections 3.5 and 4.1)", () => {
  const args = { routeId: "rBake", points: [{ x: 160, y: 60 }, { x: 230, y: 90 }] };

  test("replaces the bend points and leaves the document valid", () => {
    const result = run(bakery(), "setRoute", args);
    if (!result.ok) throw new Error(result.message);
    expect(result.doc.views.routes["rBake"]?.points).toEqual(args.points);
    expect(result.doc.views.routes["rBake"]?.sourceOccurrenceId).toBe("oP1");
    expect(findViolations(result.doc)).toEqual([]);
  });

  test("changes only the route's points and can clear them again", () => {
    const before = bakery();
    const result = run(before, "setRoute", args);
    if (!result.ok) throw new Error(result.message);
    expect(expectReversible(before, result)).toEqual(["/views/routes/rBake/points"]);
    expect(result.doc.elements).toEqual(before.elements);
    const cleared = run(result.doc, "setRoute", { routeId: "rBake", points: [] });
    expect(cleared.ok && cleared.doc.views.routes["rBake"]?.points).toEqual([]);
  });

  test("is refused for an unknown route", () => {
    const result = run(bakery(), "setRoute", { ...args, routeId: "nope" });
    expect(result).toEqual({ ok: false, code: "refused", message: expect.stringMatching(/^[A-Z].*\.$/) });
  });

  test("refuses a malformed point as invalid", () => {
    expect(run(bakery(), "setRoute", { routeId: "rBake", points: [{ x: 1 }] })).toMatchObject({ ok: false, code: "invalid" });
    expect(run(bakery(), "setRoute", { ...args, extra: 1 })).toMatchObject({ ok: false, code: "invalid" });
  });
});

import { describe, expect, test } from "vitest";
import { apply, type Command } from "../apply.ts";
import { emptyDocument, type ProjectDocument } from "../document.ts";
import { findViolations } from "../invariants.ts";
import { findCommand } from "../registry.ts";
import type { DataFlow } from "../kinds/dfd.ts";

function run(doc: ProjectDocument, command: Command): ProjectDocument {
  const result = apply(doc, command, "student");
  if (!result.ok) throw new Error(result.message);
  return result.doc;
}

function refusal(doc: ProjectDocument, command: Command): string {
  const result = apply(doc, command, "student");
  if (result.ok) throw new Error("expected a refusal");
  expect(result.code).toBe("refused");
  expect(result.message).toMatch(/^["A-Z].*\.$/);
  return result.message;
}

const common = { description: "", aliases: [], notes: "", origin: "student" as const };

// A bike-repair shop: a customer, a repair-order structure carried by two flows on the
// context diagram, a parts store, a level 0 diagram with process 1 and a control flow.
function shop(): ProjectDocument {
  let doc = run(emptyDocument(), {
    type: "createProject",
    args: { name: "Bike Repair", contextDiagramId: "ctx", processId: "p0", occurrenceId: "o-p0" },
  });
  const box = { x: 0, y: 0, width: 100, height: 60 };
  const flow = (id: string, sourceId: string | null, targetId: string | null): DataFlow =>
    ({ ...common, id, kind: "dataFlow", name: "", diagramId: "ctx", sourceId, targetId, dataId: "repair-order" });
  doc = run(doc, { type: "defineData", args: { id: "repair-order", dataKind: "structure", name: "Repair Order" } });
  doc.elements.customer = { ...common, id: "customer", kind: "externalEntity", name: "Customer" };
  doc.elements.parts = { ...common, id: "parts", kind: "dataStore", name: "Parts", ordinal: 1 };
  doc.elements.f1 = flow("f1", "customer", "p0");
  doc.elements.f2 = flow("f2", "p0", "customer");
  doc.elements.level0 = { ...common, id: "level0", kind: "diagram", name: "Level 0", diagramKind: "dfd", decomposesProcessId: "p0" };
  doc.elements.p1 = {
    ...common, id: "p1", kind: "process", name: "Fix Bike", parentProcessId: "p0", ordinal: 1, processDescription: "",
  };
  doc.elements.c1 = { ...common, id: "c1", kind: "controlFlow", name: "Shop opens", diagramId: "level0", targetId: "p1" };
  doc.views.occurrences["o-customer"] = { id: "o-customer", diagramId: "ctx", elementId: "customer", ...box };
  doc.views.occurrences["o-p1"] = { id: "o-p1", diagramId: "level0", elementId: "p1", ...box };
  doc.views.routes.r1 = { id: "r1", flowId: "f1", diagramId: "ctx", sourceOccurrenceId: "o-customer", targetOccurrenceId: "o-p0", points: [] };
  doc.views.routes.r2 = { id: "r2", flowId: "f2", diagramId: "ctx", sourceOccurrenceId: "o-p0", targetOccurrenceId: "o-customer", points: [] };
  doc.views.routes.rc1 = { id: "rc1", flowId: "c1", diagramId: "level0", sourceOccurrenceId: null, targetOccurrenceId: "o-p1", points: [] };
  expect(findViolations(doc)).toEqual([]);
  return doc;
}

const ids = ["p0", "p1", "customer", "parts", "repair-order", "level0", "ctx", "c1"];

describe("rename (SPEC.md sections 3.2 and 4.1)", () => {
  test.each(ids)("changes the name of %s", (elementId) => {
    const doc = run(shop(), { type: "rename", args: { elementId, name: "Renamed" } });
    expect(doc.elements[elementId]?.name).toBe("Renamed");
    expect(findViolations(doc)).toEqual([]);
  });

  test("a control flow's name is its event", () => {
    const doc = run(shop(), { type: "rename", args: { elementId: "c1", name: "Closing time" } });
    expect(doc.elements.c1?.name).toBe("Closing time");
  });

  test("renaming a data structure carried by two flows changes both flows' labels", () => {
    const doc = run(shop(), { type: "rename", args: { elementId: "repair-order", name: "Service Ticket" } });
    expect(doc.elements["repair-order"]?.name).toBe("Service Ticket");
    for (const id of ["f1", "f2"]) {
      expect((doc.elements[id] as DataFlow).dataId).toBe("repair-order");
      expect(doc.elements[id]?.name).toBe("");
    }
  });

  test("is refused on a data flow, saying to rename its data or use setFlowData (SPEC.md section 3.3)", () => {
    const message = refusal(shop(), { type: "rename", args: { elementId: "f1", name: "Bill" } });
    expect(message).toContain("name of its data");
    expect(message).toContain("setFlowData");
  });

  test("is refused for an unknown element", () => {
    expect(refusal(shop(), { type: "rename", args: { elementId: "nothing", name: "X" } })).toContain("no element");
  });
});

describe("describe, setAliases and setNotes (SPEC.md sections 3.2 and 4.1)", () => {
  test.each(ids.concat(["f1"]))("work on %s", (elementId) => {
    let doc = run(shop(), { type: "describe", args: { elementId, description: "What it is." } });
    doc = run(doc, { type: "setAliases", args: { elementId, aliases: ["One", "Two"] } });
    doc = run(doc, { type: "setNotes", args: { elementId, notes: "Ask the owner." } });
    expect(doc.elements[elementId]).toMatchObject({ description: "What it is.", aliases: ["One", "Two"], notes: "Ask the owner." });
    expect(findViolations(doc)).toEqual([]);
  });

  test("a flow's description does not change its label", () => {
    const doc = run(shop(), { type: "describe", args: { elementId: "f1", description: "The bill." } });
    expect(doc.elements.f1?.name).toBe("");
  });

  test("setAliases replaces the list, and an empty list clears it", () => {
    let doc = run(shop(), { type: "setAliases", args: { elementId: "customer", aliases: ["Rider"] } });
    doc = run(doc, { type: "setAliases", args: { elementId: "customer", aliases: [] } });
    expect(doc.elements.customer?.aliases).toEqual([]);
  });

  test.each(["describe", "setAliases", "setNotes"])("%s is refused for an unknown element", (type) => {
    const args = { elementId: "nothing", description: "", aliases: [], notes: "" };
    const allowed = { describe: ["elementId", "description"], setAliases: ["elementId", "aliases"], setNotes: ["elementId", "notes"] }[type]!;
    const picked = Object.fromEntries(Object.entries(args).filter(([key]) => allowed.includes(key)));
    expect(refusal(shop(), { type, args: picked })).toContain("no element");
  });

  test("the arguments are strict", () => {
    const result = apply(shop(), { type: "describe", args: { elementId: "p1", description: "x", origin: "ai" } }, "student");
    expect(result).toMatchObject({ ok: false, code: "invalid" });
  });
});

describe("setProcessDescription (SPEC.md section 3.3)", () => {
  test("sets the longer text of a process", () => {
    const doc = run(shop(), { type: "setProcessDescription", args: { processId: "p1", text: "1. Look.\n2. Fix." } });
    expect(doc.elements.p1).toMatchObject({ processDescription: "1. Look.\n2. Fix.", description: "" });
  });

  test("is refused for anything but a process, naming it", () => {
    const message = refusal(shop(), { type: "setProcessDescription", args: { processId: "customer", text: "x" } });
    expect(message).toContain("Customer");
    expect(message).toContain("not a process");
    refusal(shop(), { type: "setProcessDescription", args: { processId: "nothing", text: "x" } });
  });
});

describe("the registry", () => {
  test("the five commands are registered with one-sentence descriptions", () => {
    for (const name of ["rename", "describe", "setAliases", "setNotes", "setProcessDescription"]) {
      expect(findCommand(name)?.sentence).toMatch(/^[A-Z][^.]*\.$/);
    }
  });
});

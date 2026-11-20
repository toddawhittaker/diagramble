import { expect, test } from "vitest";
import {
  ancestors, childDiagram, diagramShowing, flowsTouching, isShownOn, occurrencesOn, processNumber, storeLabel,
} from "./derive.ts";
import { emptyDocument, type ProjectDocument } from "./document.ts";

const common = { description: "", aliases: [], notes: "", origin: "student" as const };
const box = { x: 0, y: 0, width: 80, height: 50 };

// A bike-repair shop: process 0, processes 1 and 2 on level 0, process 1.2 on level 1.
function shop(): ProjectDocument {
  const doc = emptyDocument();
  const process = (id: string, parentProcessId: string | null, ordinal: number) => {
    doc.elements[id] = { ...common, id, kind: "process", name: id, parentProcessId, ordinal, processDescription: "" };
  };
  const diagram = (id: string, diagramKind: "context" | "dfd", decomposesProcessId: string | null) => {
    doc.elements[id] = { ...common, id, kind: "diagram", name: id, diagramKind, decomposesProcessId };
  };
  diagram("ctx", "context", null);
  diagram("level0", "dfd", "p0");
  diagram("level1", "dfd", "p1");
  process("p0", null, 0);
  process("p1", "p0", 1);
  process("p2", "p0", 2);
  process("p12", "p1", 2);
  doc.elements.rider = { ...common, id: "rider", kind: "externalEntity", name: "Rider" };
  doc.elements.parts = { ...common, id: "parts", kind: "dataStore", name: "Parts", ordinal: 4 };
  doc.elements.fixed = { ...common, id: "fixed", kind: "dataFlow", name: "", diagramId: "level0", sourceId: "p2", targetId: "rider", dataId: "x" };
  doc.elements.used = { ...common, id: "used", kind: "dataFlow", name: "", diagramId: "level0", sourceId: "parts", targetId: "p2", dataId: "x" };
  doc.elements.bell = { ...common, id: "bell", kind: "controlFlow", name: "Bell rings", diagramId: "level0", targetId: "p2" };
  doc.views.occurrences.oRider = { id: "oRider", diagramId: "level0", elementId: "rider", ...box };
  doc.views.occurrences.oP2 = { id: "oP2", diagramId: "level0", elementId: "p2", ...box };
  doc.views.occurrences.oP0 = { id: "oP0", diagramId: "ctx", elementId: "p0", ...box };
  return doc;
}

test("process numbers are built from ordinals up the tree (SPEC.md section 3.3)", () => {
  const doc = shop();
  expect(processNumber(doc, "p0")).toBe("0");
  expect(processNumber(doc, "p1")).toBe("1");
  expect(processNumber(doc, "p2")).toBe("2");
  expect(processNumber(doc, "p12")).toBe("1.2");
  expect(processNumber(doc, "rider")).toBe("");
});

test("a store's label is D and its ordinal", () => {
  expect(storeLabel(shop(), "parts")).toBe("D4");
  expect(storeLabel(shop(), "rider")).toBe("");
});

test("a process is shown on the diagram that decomposes its parent (SPEC.md section 3.4, invariant 6)", () => {
  const doc = shop();
  expect(diagramShowing(doc, "p0")).toBe("ctx");
  expect(diagramShowing(doc, "p2")).toBe("level0");
  expect(diagramShowing(doc, "p12")).toBe("level1");
  expect(diagramShowing(doc, "rider")).toBeNull();
  delete doc.elements.ctx;
  expect(diagramShowing(doc, "p0")).toBeNull();
});

test("childDiagram finds the decomposing diagram or null", () => {
  expect(childDiagram(shop(), "p1")).toBe("level1");
  expect(childDiagram(shop(), "p2")).toBeNull();
});

test("ancestors lists the processes above, nearest first", () => {
  expect(ancestors(shop(), "p12")).toEqual(["p1", "p0"]);
  expect(ancestors(shop(), "p0")).toEqual([]);
  expect(ancestors(shop(), "missing")).toEqual([]);
});

test("walks up a broken tree stop on a loop or a missing parent", () => {
  const doc = shop();
  doc.elements.x = { ...common, id: "x", kind: "process", name: "", parentProcessId: "y", ordinal: 1, processDescription: "" };
  doc.elements.y = { ...common, id: "y", kind: "process", name: "", parentProcessId: "x", ordinal: 2, processDescription: "" };
  doc.elements.z = { ...common, id: "z", kind: "process", name: "", parentProcessId: "gone", ordinal: 3, processDescription: "" };
  expect(ancestors(doc, "x")).toEqual(["y"]);
  expect(processNumber(doc, "x")).toBe("2.1");
  expect(ancestors(doc, "z")).toEqual([]);
  expect(processNumber(doc, "z")).toBe("3");
});

test("occurrencesOn and isShownOn read the views", () => {
  const doc = shop();
  expect(occurrencesOn(doc, "level0").map((o) => o.id).sort()).toEqual(["oP2", "oRider"]);
  expect(isShownOn(doc, "rider", "level0")).toBe(true);
  expect(isShownOn(doc, "rider", "ctx")).toBe(false);
});

test("flowsTouching finds data flows at either end and control flows by target", () => {
  const doc = shop();
  expect(flowsTouching(doc, "p2").map((f) => f.id).sort()).toEqual(["bell", "fixed", "used"]);
  expect(flowsTouching(doc, "parts").map((f) => f.id)).toEqual(["used"]);
  expect(flowsTouching(doc, "p1")).toEqual([]);
});

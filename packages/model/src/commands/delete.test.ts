import { describe, expect, test } from "vitest";
import { apply, copyDocument } from "../apply.ts";
import { emptyDocument, type ProjectDocument } from "../document.ts";
import { findViolations } from "../invariants.ts";
import { applyInSession, startSession } from "../session.ts";
import type { Id } from "../id.ts";

const text = { description: "", aliases: [], notes: "", origin: "student" as const };

function start(): ProjectDocument {
  const result = apply(
    emptyDocument(),
    { type: "createProject", args: { name: "Bike Repair Shop", contextDiagramId: "ctx", processId: "p0", occurrenceId: "o-p0" } },
    "student",
  );
  if (!result.ok) throw new Error(result.message);
  return result.doc;
}

type Builder = {
  process(id: Id, name: string, parent: Id, ordinal: number, diagram: Id): void;
  diagram(id: Id, decomposes: Id): void;
  entity(id: Id, name: string): void;
  store(id: Id, name: string, ordinal: number): void;
  data(id: Id, name: string): void;
  place(occurrence: Id, element: Id, diagram: Id): void;
  flow(id: Id, diagram: Id, source: Id | null, target: Id | null, dataId: Id, sourceOcc: Id | null, targetOcc: Id | null): void;
  control(id: Id, diagram: Id, target: Id, targetOcc: Id): void;
};

function build(doc: ProjectDocument): Builder {
  const route = (flowId: Id, diagramId: Id, sourceOccurrenceId: Id | null, targetOccurrenceId: Id | null): void => {
    doc.views.routes[`r-${flowId}`] = { id: `r-${flowId}`, flowId, diagramId, sourceOccurrenceId, targetOccurrenceId, points: [] };
  };
  return {
    process(id, name, parent, ordinal, diagram) {
      doc.elements[id] = { kind: "process", id, name, ...text, parentProcessId: parent, ordinal, processDescription: "" };
      doc.views.occurrences[`o-${id}`] = { id: `o-${id}`, diagramId: diagram, elementId: id, x: 0, y: 0, width: 100, height: 60 };
    },
    diagram(id, decomposes) {
      doc.elements[id] = { kind: "diagram", id, name: `Diagram ${id}`, ...text, diagramKind: "dfd", decomposesProcessId: decomposes };
    },
    entity(id, name) {
      doc.elements[id] = { kind: "externalEntity", id, name, ...text };
    },
    store(id, name, ordinal) {
      doc.elements[id] = { kind: "dataStore", id, name, ...text, ordinal };
    },
    data(id, name) {
      doc.elements[id] = { kind: "dataElement", id, name, ...text, dataType: "text", allowedValues: [] };
    },
    place(occurrence, element, diagram) {
      doc.views.occurrences[occurrence] = { id: occurrence, diagramId: diagram, elementId: element, x: 0, y: 0, width: 80, height: 40 };
    },
    flow(id, diagram, source, target, dataId, sourceOcc, targetOcc) {
      doc.elements[id] = { kind: "dataFlow", id, name: "", ...text, diagramId: diagram, sourceId: source, targetId: target, dataId };
      route(id, diagram, sourceOcc, targetOcc);
    },
    control(id, diagram, target, targetOcc) {
      doc.elements[id] = { kind: "controlFlow", id, name: "Closing time", ...text, diagramId: diagram, targetId: target };
      route(id, diagram, null, targetOcc);
    },
  };
}

// A small bike repair shop: levels 0, 1 and 2, flows across diagrams, and an off-diagram end each way.
function shop(): ProjectDocument {
  const doc = start();
  const b = build(doc);
  b.data("d-bike", "Bike");
  b.data("d-quote", "Quote");
  b.entity("customer", "Customer");
  b.place("o-cust-ctx", "customer", "ctx");
  b.flow("f-bike-ctx", "ctx", "customer", "p0", "d-bike", "o-cust-ctx", "o-p0");

  b.diagram("dg0", "p0");
  b.process("p1", "Take Order", "p0", 1, "dg0");
  b.process("p2", "Repair Bike", "p0", 2, "dg0");
  b.store("parts", "Parts", 1);
  b.place("o-cust-0", "customer", "dg0");
  b.place("o-parts-0", "parts", "dg0");
  b.flow("f-order", "dg0", "customer", "p1", "d-bike", "o-cust-0", "o-p1");
  b.flow("f-p1-p2", "dg0", "p1", "p2", "d-bike", "o-p1", "o-p2");
  b.flow("f-pick", "dg0", "parts", "p2", "d-bike", "o-parts-0", "o-p2");
  b.control("c-late", "dg0", "p2", "o-p2");

  b.diagram("dg1", "p1");
  b.process("p11", "Record Order", "p1", 1, "dg1");
  b.process("p12", "Quote Price", "p1", 2, "dg1");
  b.flow("f-quote", "dg1", "p11", "p12", "d-quote", "o-p11", "o-p12");
  b.flow("f-to-repair", "dg1", "p12", "p2", "d-quote", "o-p12", null);

  b.diagram("dg2", "p2");
  b.process("p21", "Fix Brakes", "p2", 1, "dg2");
  b.flow("f-from-order", "dg2", "p1", "p21", "d-bike", null, "o-p21");
  b.place("o-parts-2", "parts", "dg2");
  b.flow("f-parts-2", "dg2", "parts", "p21", "d-bike", "o-parts-2", "o-p21");
  return doc;
}

function run(doc: ProjectDocument, type: string, args: unknown): ProjectDocument {
  const result = apply(doc, { type, args }, "student");
  if (!result.ok) throw new Error(result.message);
  expect(findViolations(result.doc)).toEqual([]);
  return result.doc;
}

function refusal(doc: ProjectDocument, type: string, args: unknown): string {
  const result = apply(doc, { type, args }, "student");
  if (result.ok) throw new Error("expected a refusal");
  expect(result.code).toBe("refused");
  expect(result.message).toMatch(/^[A-Z][^.]*\.$/);
  return result.message;
}

const has = (doc: ProjectDocument, id: Id): boolean => id in doc.elements;
const placed = (doc: ProjectDocument, id: Id): boolean => id in doc.views.occurrences;

test("the fixture is a valid document", () => {
  expect(findViolations(shop())).toEqual([]);
});

describe("deleteElement of an external entity or data store (SPEC.md sections 3.5 and 4.1)", () => {
  test("an external entity goes with its occurrences and every flow touching it", () => {
    const doc = run(shop(), "deleteElement", { elementId: "customer" });
    expect(has(doc, "customer")).toBe(false);
    for (const id of ["f-bike-ctx", "f-order"]) {
      expect(has(doc, id)).toBe(false);
      expect(`r-${id}` in doc.views.routes).toBe(false);
    }
    expect(placed(doc, "o-cust-ctx") || placed(doc, "o-cust-0")).toBe(false);
    expect(has(doc, "f-p1-p2")).toBe(true);
  });

  test("a data store goes with its occurrences on every diagram and its flows", () => {
    const doc = run(shop(), "deleteElement", { elementId: "parts" });
    expect(has(doc, "parts")).toBe(false);
    expect(["f-pick", "f-parts-2"].some((id) => has(doc, id) || `r-${id}` in doc.views.routes)).toBe(false);
    expect(placed(doc, "o-parts-0") || placed(doc, "o-parts-2")).toBe(false);
  });
});

describe("deleteElement of a flow (SPEC.md section 4.1)", () => {
  test("a data flow goes with its route and nothing else", () => {
    const before = shop();
    const doc = run(before, "deleteElement", { elementId: "f-p1-p2" });
    expect(has(doc, "f-p1-p2")).toBe(false);
    expect("r-f-p1-p2" in doc.views.routes).toBe(false);
    expect(Object.keys(doc.elements)).toHaveLength(Object.keys(before.elements).length - 1);
    expect(Object.keys(doc.views.occurrences)).toEqual(Object.keys(before.views.occurrences));
  });

  test("a control flow goes with its route", () => {
    const doc = run(shop(), "deleteElement", { elementId: "c-late" });
    expect(has(doc, "c-late")).toBe(false);
    expect("r-c-late" in doc.views.routes).toBe(false);
  });
});

describe("deleteElement of a process (SPEC.md sections 3.4 and 4.1)", () => {
  test("removes the whole branch and the flows that had it as an off-diagram end", () => {
    const doc = run(shop(), "deleteElement", { elementId: "p1" });
    for (const id of ["p1", "dg1", "p11", "p12", "f-quote", "f-to-repair", "f-order", "f-p1-p2", "f-from-order"]) {
      expect(has(doc, id)).toBe(false);
    }
    for (const id of ["o-p1", "o-p11", "o-p12"]) expect(placed(doc, id)).toBe(false);
    for (const flow of ["f-quote", "f-to-repair", "f-order", "f-p1-p2", "f-from-order"]) {
      expect(`r-${flow}` in doc.views.routes).toBe(false);
    }
    // The sibling branch, its diagram and the flows that do not touch p1 stay.
    for (const id of ["p2", "dg2", "p21", "f-parts-2", "f-pick", "c-late", "customer", "parts"]) {
      expect(has(doc, id)).toBe(true);
    }
  });

  test("a control flow that starts the deleted process goes too", () => {
    const doc = run(shop(), "deleteElement", { elementId: "p2" });
    expect(has(doc, "c-late")).toBe(false);
    expect(has(doc, "f-to-repair")).toBe(false);
    expect(has(doc, "p21")).toBe(false);
  });

  test("a leaf process with no child diagram is deleted", () => {
    const doc = run(shop(), "deleteElement", { elementId: "p21" });
    expect(has(doc, "p21")).toBe(false);
    expect(has(doc, "f-parts-2")).toBe(false);
    expect(has(doc, "dg2")).toBe(true);
  });

  test("process 0 is refused", () => {
    expect(refusal(shop(), "deleteElement", { elementId: "p0" })).toContain("Bike Repair Shop");
  });
});

describe("deleteElement of a diagram (SPEC.md section 4.1)", () => {
  test("the context diagram is refused", () => {
    expect(refusal(shop(), "deleteElement", { elementId: "ctx" })).toContain("context diagram");
  });

  test("a diagram that shows a process is refused, pointing to the process", () => {
    const message = refusal(shop(), "deleteElement", { elementId: "dg1" });
    expect(message).toContain("delete the process it decomposes");
  });

  test("a diagram that shows no process is deleted with everything on it", () => {
    const doc = shop();
    const b = build(doc);
    b.diagram("dg-empty", "p11");
    b.place("o-cust-e", "customer", "dg-empty");
    b.place("o-parts-e", "parts", "dg-empty");
    b.flow("f-e", "dg-empty", "customer", "parts", "d-bike", "o-cust-e", "o-parts-e");
    expect(findViolations(doc)).toEqual([]);
    const result = run(doc, "deleteElement", { elementId: "dg-empty" });
    expect(has(result, "dg-empty") || has(result, "f-e") || "r-f-e" in result.views.routes).toBe(false);
    expect(placed(result, "o-cust-e") || placed(result, "o-parts-e")).toBe(false);
    expect(has(result, "customer") && has(result, "parts")).toBe(true);
  });
});

describe("deleteElement of a data definition (SPEC.md section 4.1)", () => {
  test("is refused while a flow carries it", () => {
    expect(refusal(shop(), "deleteElement", { elementId: "d-quote" })).toContain("Quote");
  });

  test("is refused while a structure lists it as a component", () => {
    const doc = shop();
    doc.elements["s-order"] = { kind: "dataStructure", id: "s-order", name: "Order", ...text, components: [{ dataId: "d-note", occurs: "once", limit: null }] };
    build(doc).data("d-note", "Note");
    expect(findViolations(doc)).toEqual([]);
    expect(refusal(doc, "deleteElement", { elementId: "d-note" })).toContain("Note");
  });

  test("cascade deletes the flows that carry it and leaves every component list", () => {
    const doc = shop();
    doc.elements["s-order"] = {
      kind: "dataStructure", id: "s-order", name: "Order", ...text,
      components: [{ dataId: "d-bike", occurs: "once", limit: null }, { dataId: "d-quote", occurs: "optional", limit: null }],
    };
    const result = run(doc, "deleteElement", { elementId: "d-bike", cascade: true });
    expect(has(result, "d-bike")).toBe(false);
    for (const id of ["f-bike-ctx", "f-order", "f-p1-p2", "f-pick", "f-from-order", "f-parts-2"]) {
      expect(has(result, id) || `r-${id}` in result.views.routes).toBe(false);
    }
    const structure = result.elements["s-order"];
    expect(structure?.kind === "dataStructure" && structure.components.map((c) => c.dataId)).toEqual(["d-quote"]);
    expect(has(result, "f-quote")).toBe(true);
  });

  test("cascade deletes a structure that lists itself without trouble", () => {
    const doc = shop();
    doc.elements["s-self"] = { kind: "dataStructure", id: "s-self", name: "Tree", ...text, components: [{ dataId: "s-self", occurs: "many", limit: null }] };
    expect(has(run(doc, "deleteElement", { elementId: "s-self" }), "s-self")).toBe(false);
  });

  test("one that is used nowhere is deleted without cascade", () => {
    const doc = shop();
    build(doc).data("d-spare", "Spare");
    expect(has(run(doc, "deleteElement", { elementId: "d-spare" }), "d-spare")).toBe(false);
  });
});

describe("deleteElement with a bad id (SPEC.md section 4.1)", () => {
  test("an unknown id is refused", () => {
    expect(refusal(shop(), "deleteElement", { elementId: "nope" })).toContain("nope");
  });

  test("an occurrence id is not an element id", () => {
    refusal(shop(), "deleteElement", { elementId: "o-cust-0" });
  });

  test("an unnamed element is named by its kind", () => {
    const doc = shop();
    build(doc).data("d-blank", "");
    doc.elements["s-x"] = { kind: "dataStructure", id: "s-x", name: "X", ...text, components: [{ dataId: "d-blank", occurs: "once", limit: null }] };
    expect(refusal(doc, "deleteElement", { elementId: "d-blank" })).toContain("unnamed data element");
  });

  test("an argument that is not allowed is invalid", () => {
    const result = apply(shop(), { type: "deleteElement", args: { elementId: "customer", force: true } }, "student");
    expect(result.ok === false && result.code).toBe("invalid");
  });
});

describe("removeOccurrence (SPEC.md sections 3.5 and 4.1)", () => {
  test("removing the last occurrence of a data store leaves the store unplaced", () => {
    let doc = run(shop(), "removeOccurrence", { occurrenceId: "o-parts-0" });
    expect(has(doc, "f-pick") || "r-f-pick" in doc.views.routes).toBe(false);
    expect(has(doc, "f-parts-2")).toBe(true);
    doc = run(doc, "removeOccurrence", { occurrenceId: "o-parts-2" });
    expect(has(doc, "f-parts-2")).toBe(false);
    expect(has(doc, "parts")).toBe(true);
    expect(Object.values(doc.views.occurrences).some((o) => o.elementId === "parts")).toBe(false);
  });

  test("removes the control flows and data flows attached to it, and no others", () => {
    const doc = run(shop(), "removeOccurrence", { occurrenceId: "o-cust-0" });
    expect(has(doc, "f-order")).toBe(false);
    expect("r-f-order" in doc.views.routes).toBe(false);
    expect(has(doc, "f-bike-ctx")).toBe(true);
    expect(placed(doc, "o-cust-ctx")).toBe(true);
    expect(has(doc, "customer")).toBe(true);
  });

  test("with two occurrences on one diagram, only the flows on that occurrence go", () => {
    const doc = shop();
    const b = build(doc);
    b.place("o-cust-0b", "customer", "dg0");
    b.flow("f-second", "dg0", "customer", "p2", "d-bike", "o-cust-0b", "o-p2");
    expect(findViolations(doc)).toEqual([]);
    const result = run(doc, "removeOccurrence", { occurrenceId: "o-cust-0b" });
    expect(has(result, "f-second")).toBe(false);
    expect(has(result, "f-order")).toBe(true);
  });

  test("a process's occurrence is refused, pointing to deleteElement", () => {
    const message = refusal(shop(), "removeOccurrence", { occurrenceId: "o-p1" });
    expect(message).toContain("Take Order");
    expect(message).toContain("delete the process");
  });

  test("an unknown occurrence is refused", () => {
    expect(refusal(shop(), "removeOccurrence", { occurrenceId: "customer" })).toContain("customer");
  });
});

describe("undo (SPEC.md sections 3.6 and 3.9)", () => {
  test("restores a deleted branch exactly, and redo deletes it again", () => {
    const before = shop();
    const first = applyInSession(startSession(before), { type: "deleteElement", args: { elementId: "p1" } }, "student");
    if (!first.ok) throw new Error(first.message);
    expect(first.session.doc).not.toEqual(before);
    const undone = applyInSession(first.session, { type: "undo" }, "student");
    if (!undone.ok) throw new Error(undone.message);
    expect(undone.session.doc).toEqual(before);
    const redone = applyInSession(undone.session, { type: "redo" }, "student");
    if (!redone.ok) throw new Error(redone.message);
    expect(redone.session.doc).toEqual(first.session.doc);
  });

  test("a refused command leaves the document untouched", () => {
    const before = shop();
    const copy = copyDocument(before);
    apply(before, { type: "deleteElement", args: { elementId: "p0" } }, "student");
    expect(before).toEqual(copy);
  });
});

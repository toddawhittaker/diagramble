// A hand-built document for the query tests: a bike-repair shop with a context
// diagram, a level 0 diagram, a level 1 diagram under process 2, a data store shown on
// two diagrams, an off-diagram end, an unattached end, a control flow, a nested data
// structure and one external entity that is shown nowhere (docs/SPEC.md sections 3.3 to 3.5).
import { apply } from "../apply.ts";
import { emptyDocument, type Element, type ProjectDocument } from "../document.ts";
import { findViolations } from "../invariants.ts";
import type { Id } from "../id.ts";

const text = { description: "", aliases: [] as string[], notes: "", origin: "student" as const };

export function sampleDocument(): ProjectDocument {
  const created = apply(
    emptyDocument(),
    { type: "createProject", args: { name: "Bike Shop", contextDiagramId: "ctx", processId: "p0", occurrenceId: "o-p0-ctx" } },
    "student",
  );
  if (!created.ok) throw new Error(created.message);
  const doc = created.doc;
  const add = (element: Element): void => {
    doc.elements[element.id] = element;
  };
  const place = (id: Id, diagramId: Id, elementId: Id): void => {
    doc.views.occurrences[id] = { id, diagramId, elementId, x: 10, y: 20, width: 100, height: 60 };
  };
  const route = (id: Id, flowId: Id, diagramId: Id, sourceOccurrenceId: Id | null, targetOccurrenceId: Id | null): void => {
    doc.views.routes[id] = { id, flowId, diagramId, sourceOccurrenceId, targetOccurrenceId, points: [] };
  };

  // Diagrams and the process tree.
  add({ ...text, kind: "diagram", id: "d0", name: "Level 0", diagramKind: "dfd", decomposesProcessId: "p0" });
  add({ ...text, kind: "diagram", id: "d2", name: "Level 1 of Repair Bike", diagramKind: "dfd", decomposesProcessId: "p2" });
  add({ ...text, kind: "process", id: "p1", name: "Take Repair Order", parentProcessId: "p0", ordinal: 1, processDescription: "" });
  add({ ...text, kind: "process", id: "p2", name: "Repair Bike", parentProcessId: "p0", ordinal: 2, processDescription: "" });
  add({ ...text, kind: "process", id: "p21", name: "Diagnose Fault", parentProcessId: "p2", ordinal: 1, processDescription: "" });
  add({ ...text, kind: "process", id: "p22", name: "Replace Parts", parentProcessId: "p2", ordinal: 2, processDescription: "" });
  place("o-p1", "d0", "p1");
  place("o-p2", "d0", "p2");
  place("o-p21", "d2", "p21");
  place("o-p22", "d2", "p22");

  // External entities and data stores; the store's number has a gap and is shown twice.
  add({ ...text, kind: "externalEntity", id: "e-customer", name: "Customer" });
  add({ ...text, kind: "externalEntity", id: "e-supplier", name: "Parts Supplier" });
  add({ ...text, kind: "dataStore", id: "st-log", name: "Repair Log", ordinal: 2 });
  place("o-cust-ctx", "ctx", "e-customer");
  place("o-cust-d0", "d0", "e-customer");
  place("o-log-d0", "d0", "st-log");
  place("o-log-d2", "d2", "st-log");

  // The data dictionary, with a structure nested inside another.
  add({ ...text, kind: "dataElement", id: "de-owner", name: "Owner Name", dataType: "text", allowedValues: [] });
  add({ ...text, kind: "dataElement", id: "de-phone", name: "Phone", dataType: "text", allowedValues: [] });
  add({ ...text, kind: "dataElement", id: "de-part", name: "Part Name", dataType: "text", allowedValues: [] });
  add({ ...text, kind: "dataElement", id: "de-qty", name: "Quantity", dataType: "number", allowedValues: [] });
  add({
    ...text, kind: "dataElement", id: "de-status", name: "Status", dataType: "text",
    allowedValues: [{ value: "open", meaning: "Not started" }, { value: "done", meaning: "Bike returned" }],
  });
  add({ ...text, kind: "dataElement", id: "de-fault", name: "Fault Found", dataType: "text", allowedValues: [] });
  add({
    ...text, kind: "dataStructure", id: "ds-line", name: "Part Line",
    components: [
      { dataId: "de-part", occurs: "once", limit: null },
      { dataId: "de-qty", occurs: "once", limit: null },
    ],
  });
  add({
    ...text, kind: "dataStructure", id: "ds-request", name: "Repair Request",
    components: [
      { dataId: "de-owner", occurs: "once", limit: null },
      { dataId: "de-phone", occurs: "optional", limit: null },
      { dataId: "ds-line", occurs: "many", limit: 5 },
    ],
  });
  add({
    ...text, kind: "dataStructure", id: "ds-record", name: "Order Record",
    components: [
      { dataId: "de-status", occurs: "once", limit: null },
      { dataId: "ds-line", occurs: "many", limit: null },
    ],
  });

  // Flows, each with its one route.
  const flow = (id: Id, diagramId: Id, sourceId: Id | null, targetId: Id | null, dataId: Id): void => {
    add({ ...text, kind: "dataFlow", id, name: "", diagramId, sourceId, targetId, dataId });
  };
  flow("f-ctx", "ctx", "e-customer", "p0", "ds-request");
  route("r-ctx", "f-ctx", "ctx", "o-cust-ctx", "o-p0-ctx");
  flow("f-order", "d0", "e-customer", "p1", "ds-request");
  route("r-order", "f-order", "d0", "o-cust-d0", "o-p1");
  flow("f-record", "d0", "p1", "st-log", "ds-record");
  route("r-record", "f-record", "d0", "o-p1", "o-log-d0");
  flow("f-loose", "d0", null, "p2", "de-owner");
  route("r-loose", "f-loose", "d0", null, "o-p2");
  add({ ...text, kind: "controlFlow", id: "c-drop", name: "Bike Dropped Off", diagramId: "d0", targetId: "p1" });
  route("r-drop", "c-drop", "d0", null, "o-p1");
  flow("f-fault", "d2", "p21", "p1", "de-fault");
  route("r-fault", "f-fault", "d2", "o-p21", null);
  flow("f-pull", "d2", "p1", "p21", "ds-record");
  route("r-pull", "f-pull", "d2", null, "o-p21");
  flow("f-reread", "d2", "st-log", "p22", "ds-record");
  route("r-reread", "f-reread", "d2", "o-log-d2", "o-p22");

  const violations = findViolations(doc);
  if (violations.length > 0) throw new Error(violations.map((v) => v.message).join(" "));
  return doc;
}

/** The same document with every map rebuilt in the opposite key order. */
export function reversedKeyOrder(doc: ProjectDocument): ProjectDocument {
  const reverse = <T>(map: Record<string, T>): Record<string, T> => Object.fromEntries(Object.entries(map).reverse());
  return {
    ...doc,
    elements: reverse(doc.elements),
    views: { occurrences: reverse(doc.views.occurrences), routes: reverse(doc.views.routes) },
  };
}

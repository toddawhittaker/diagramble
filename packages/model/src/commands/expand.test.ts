import { describe, expect, test } from "vitest";
import { z } from "zod";
import { apply, asJson } from "../apply.ts";
import type { ProjectDocument } from "../document.ts";
import { findViolations } from "../invariants.ts";
import type { Origin } from "../kinds/common.ts";
import { applyPatch } from "../patch.ts";
import { expandCommands } from "./expand.ts";

// A bike-repair shop, built by hand: createProject, then direct edits. Every document is
// checked with findViolations, so the fixtures themselves obey docs/SPEC.md section 3.4.

const text = { description: "", aliases: [] as string[], notes: "", origin: "student" as Origin };
const sentence = /^[A-Z][^]*\.$/;

function addData(doc: ProjectDocument, id: string, name: string): void {
  doc.elements[id] = { kind: "dataElement", id, name, ...text, dataType: "text", allowedValues: [] };
}
function addNode(
  doc: ProjectDocument, kind: "externalEntity" | "dataStore", id: string, name: string,
  diagramId: string, occurrences: [string, number, number][],
): void {
  doc.elements[id] =
    kind === "externalEntity"
      ? { kind, id, name, ...text }
      : { kind, id, name, ...text, ordinal: 1 };
  for (const [occurrenceId, width, height] of occurrences) {
    doc.views.occurrences[occurrenceId] = { id: occurrenceId, diagramId, elementId: id, x: 10, y: 10, width, height };
  }
}
function addFlow(
  doc: ProjectDocument, id: string, diagramId: string, sourceId: string | null, targetId: string | null,
  dataId: string, sourceOccurrenceId: string | null, targetOccurrenceId: string | null,
): void {
  doc.elements[id] = { kind: "dataFlow", id, name: "", ...text, diagramId, sourceId, targetId, dataId };
  doc.views.routes[`r-${id}`] = { id: `r-${id}`, flowId: id, diagramId, sourceOccurrenceId, targetOccurrenceId, points: [] };
}
function addProcess(doc: ProjectDocument, id: string, name: string, parentProcessId: string, ordinal: number, diagramId: string | null): void {
  doc.elements[id] = { kind: "process", id, name, ...text, parentProcessId, ordinal, processDescription: "" };
  if (diagramId !== null) {
    doc.views.occurrences[`o-${id}`] = { id: `o-${id}`, diagramId, elementId: id, x: 0, y: 0, width: 160, height: 120 };
  }
}

function created(): ProjectDocument {
  const result = apply(
    { schemaVersion: 1, settings: { name: "", topDiagramId: null, showFindings: "always", caseText: "" }, elements: {}, views: { occurrences: {}, routes: {} } },
    { type: "createProject", args: { name: "Bike Repair Shop", contextDiagramId: "ctx", processId: "p0", occurrenceId: "o-p0" } },
    "student",
  );
  if (!result.ok) throw new Error(result.message);
  return result.doc;
}

/** The context diagram: two external entities and a data store around process 0. */
function contextDoc(): ProjectDocument {
  const doc = created();
  addData(doc, "request", "Repair Request");
  addData(doc, "bill", "Repair Bill");
  addData(doc, "partsOrder", "Parts Order");
  addData(doc, "workRecord", "Work Record");
  addNode(doc, "externalEntity", "customer", "Customer", "ctx", [["o-customer-1", 140, 60], ["o-customer-2", 100, 40]]);
  addNode(doc, "externalEntity", "supplier", "Supplier", "ctx", [["o-supplier", 150, 70]]);
  addNode(doc, "dataStore", "repairLog", "Repair Log", "ctx", [["o-log", 180, 50]]);
  addFlow(doc, "f-request", "ctx", "customer", "p0", "request", "o-customer-2", "o-p0");
  addFlow(doc, "f-bill", "ctx", "p0", "customer", "bill", "o-p0", "o-customer-1");
  addFlow(doc, "f-order", "ctx", "p0", "supplier", "partsOrder", "o-p0", "o-supplier");
  addFlow(doc, "f-record", "ctx", "p0", "repairLog", "workRecord", "o-p0", "o-log");
  expect(findViolations(doc)).toEqual([]);
  return doc;
}

const level0Args = {
  processId: "p0",
  diagramId: "d0",
  flowIds: {
    "f-request": { flowId: "c-request", routeId: "cr-request" },
    "f-bill": { flowId: "c-bill", routeId: "cr-bill" },
    "f-order": { flowId: "c-order", routeId: "cr-order" },
    "f-record": { flowId: "c-record", routeId: "cr-record" },
  },
  occurrenceIds: { customer: "oc-customer", supplier: "oc-supplier", repairLog: "oc-log" },
};

function expand(doc: ProjectDocument, args: unknown, origin: Origin = "student"): ProjectDocument {
  const result = apply(doc, { type: "expandProcess", args }, origin);
  if (!result.ok) throw new Error(result.message);
  expect(findViolations(result.doc)).toEqual([]);
  return result.doc;
}
function refusal(doc: ProjectDocument, args: unknown): string {
  const result = apply(doc, { type: "expandProcess", args }, "student");
  if (result.ok || result.code !== "refused") throw new Error("expected a refusal");
  expect(result.message).toMatch(sentence);
  return result.message;
}

/** Level 0 with processes 1 and 2, a flow between them, a customer flow into 1 and a control flow into 1. */
function level0Doc(): ProjectDocument {
  const doc = expand(contextDoc(), level0Args);
  addData(doc, "partNeed", "Part Need");
  addData(doc, "rush", "Rush Job");
  addProcess(doc, "p1", "Take In Repairs", "p0", 1, "d0");
  addProcess(doc, "p2", "Order Parts", "p0", 2, "d0");
  // Attach the inherited customer flow to process 1.
  const request = doc.elements["c-request"];
  if (request?.kind !== "dataFlow") throw new Error("fixture");
  request.targetId = "p1";
  const route = doc.views.routes["cr-request"];
  if (route === undefined) throw new Error("fixture");
  route.targetOccurrenceId = "o-p1";
  addFlow(doc, "f-part", "d0", "p1", "p2", "partNeed", "o-p1", "o-p2");
  doc.elements["cf-rush"] = { kind: "controlFlow", id: "cf-rush", name: "Rush Job Arrives", ...text, diagramId: "d0", targetId: "p1" };
  doc.views.routes["r-cf-rush"] = { id: "r-cf-rush", flowId: "cf-rush", diagramId: "d0", sourceOccurrenceId: null, targetOccurrenceId: "o-p1", points: [] };
  expect(findViolations(doc)).toEqual([]);
  return doc;
}

describe("expandProcess on process 0 (SPEC.md sections 3.3 and 4.1)", () => {
  const doc = expand(contextDoc(), level0Args);

  test("creates the level 0 diagram named after the process", () => {
    expect(doc.elements["d0"]).toEqual({
      kind: "diagram", id: "d0", name: "Bike Repair Shop", ...text,
      diagramKind: "dfd", decomposesProcessId: "p0",
    });
  });

  test("carries each data flow down with the same data, direction and an unattached inner end", () => {
    const flow = (id: string) => doc.elements[id];
    expect(flow("c-request")).toMatchObject({ kind: "dataFlow", diagramId: "d0", name: "", dataId: "request", sourceId: "customer", targetId: null });
    expect(flow("c-bill")).toMatchObject({ dataId: "bill", sourceId: null, targetId: "customer" });
    expect(flow("c-order")).toMatchObject({ dataId: "partsOrder", sourceId: null, targetId: "supplier" });
    expect(flow("c-record")).toMatchObject({ dataId: "workRecord", sourceId: null, targetId: "repairLog" });
    // The parent flows stay where they were.
    expect(flow("f-request")).toMatchObject({ diagramId: "ctx", targetId: "p0" });
  });

  test("gives each new flow one route with the placed occurrence for the outer end", () => {
    expect(doc.views.routes["cr-request"]).toEqual({
      id: "cr-request", flowId: "c-request", diagramId: "d0",
      sourceOccurrenceId: "oc-customer", targetOccurrenceId: null, points: [],
    });
    expect(doc.views.routes["cr-bill"]).toMatchObject({ sourceOccurrenceId: null, targetOccurrenceId: "oc-customer" });
    expect(doc.views.routes["cr-record"]).toMatchObject({ sourceOccurrenceId: null, targetOccurrenceId: "oc-log" });
  });

  test("places each outer element once, however many flows share it, stacked in element id order", () => {
    const onChild = Object.values(doc.views.occurrences).filter((o) => o.diagramId === "d0");
    expect(onChild).toHaveLength(3);
    expect(doc.views.occurrences["oc-customer"]).toEqual({ id: "oc-customer", diagramId: "d0", elementId: "customer", x: 0, y: 0, width: 140, height: 60 });
    expect(doc.views.occurrences["oc-log"]).toEqual({ id: "oc-log", diagramId: "d0", elementId: "repairLog", x: 0, y: 140, width: 180, height: 50 });
    expect(doc.views.occurrences["oc-supplier"]).toEqual({ id: "oc-supplier", diagramId: "d0", elementId: "supplier", x: 0, y: 280, width: 150, height: 70 });
  });

  test("copies the size of the element's first occurrence by occurrence id order", () => {
    // o-customer-1 (140 by 60) sorts before o-customer-2 (100 by 40).
    expect(doc.views.occurrences["oc-customer"]).toMatchObject({ width: 140, height: 60 });
  });

  test("the result passes the invariant check", () => {
    expect(findViolations(doc)).toEqual([]);
  });

  test("new elements take the caller's origin", () => {
    const aiDoc = expand(contextDoc(), level0Args, "ai");
    expect(aiDoc.elements["d0"]?.origin).toBe("ai");
    expect(aiDoc.elements["c-request"]?.origin).toBe("ai");
    expect(aiDoc.elements["f-request"]?.origin).toBe("student");
  });

  test("a process with no data flows gets an empty diagram", () => {
    const bare = expand(created(), { processId: "p0", diagramId: "d0", flowIds: {}, occurrenceIds: {} });
    expect(bare.elements["d0"]).toMatchObject({ diagramKind: "dfd", decomposesProcessId: "p0" });
    expect(Object.keys(bare.views.routes)).toEqual([]);
  });
});

describe("expandProcess below level 0 (SPEC.md sections 3.3 and 3.4)", () => {
  test("a flow to a sibling process becomes an off-diagram end with no occurrence", () => {
    const doc = expand(level0Doc(), {
      processId: "p1", diagramId: "d1",
      flowIds: { "c-request": { flowId: "k-request", routeId: "kr-request" }, "f-part": { flowId: "k-part", routeId: "kr-part" } },
      occurrenceIds: { customer: "ok-customer" },
    });
    expect(doc.elements["d1"]).toMatchObject({ name: "Take In Repairs", decomposesProcessId: "p1" });
    expect(doc.elements["k-part"]).toMatchObject({ diagramId: "d1", sourceId: null, targetId: "p2", dataId: "partNeed" });
    expect(doc.views.routes["kr-part"]).toMatchObject({ sourceOccurrenceId: null, targetOccurrenceId: null, points: [] });
    expect(doc.elements["k-request"]).toMatchObject({ sourceId: "customer", targetId: null });
    expect(doc.views.routes["kr-request"]).toMatchObject({ sourceOccurrenceId: "ok-customer", targetOccurrenceId: null });
    // Customer is placed on the child at the size of its occurrence on level 0.
    expect(doc.views.occurrences["ok-customer"]).toMatchObject({ diagramId: "d1", x: 0, y: 0, width: 140, height: 60 });
  });

  test("a control flow into the process is not carried down", () => {
    const doc = level0Doc();
    const args = {
      processId: "p1", diagramId: "d1",
      flowIds: { "c-request": { flowId: "k-request", routeId: "kr-request" }, "f-part": { flowId: "k-part", routeId: "kr-part" } },
      occurrenceIds: { customer: "ok-customer" },
    };
    const result = expand(doc, args);
    expect(Object.values(result.elements).filter((e) => e.kind === "controlFlow" && e.diagramId === "d1")).toEqual([]);
    // Naming the control flow in flowIds is an extra key.
    const message = refusal(doc, { ...args, flowIds: { ...args.flowIds, "cf-rush": { flowId: "k-rush", routeId: "kr-rush" } } });
    expect(message).toContain('control flow "Rush Job Arrives"');
  });

  test("a flow whose parent end was off-diagram keeps that off-diagram end", () => {
    const doc = expand(level0Doc(), {
      processId: "p1", diagramId: "d1",
      flowIds: { "c-request": { flowId: "k-request", routeId: "kr-request" }, "f-part": { flowId: "k-part", routeId: "kr-part" } },
      occurrenceIds: { customer: "ok-customer" },
    });
    // Attach the inherited part flow to a new child of process 1, then expand that child.
    addProcess(doc, "p11", "Log The Bike", "p1", 1, "d1");
    const part = doc.elements["k-part"];
    if (part?.kind !== "dataFlow") throw new Error("fixture");
    part.sourceId = "p11";
    const route = doc.views.routes["kr-part"];
    if (route === undefined) throw new Error("fixture");
    route.sourceOccurrenceId = "o-p11";
    expect(findViolations(doc)).toEqual([]);

    const deeper = expand(doc, {
      processId: "p11", diagramId: "d11",
      flowIds: { "k-part": { flowId: "m-part", routeId: "mr-part" } },
      occurrenceIds: {},
    });
    expect(deeper.elements["m-part"]).toMatchObject({ diagramId: "d11", sourceId: null, targetId: "p2", dataId: "partNeed" });
    expect(deeper.views.routes["mr-part"]).toMatchObject({ sourceOccurrenceId: null, targetOccurrenceId: null });
  });

  test("a flow whose outer end is empty is not carried down", () => {
    const doc = level0Doc();
    // The customer flow into process 1 loses its outer end.
    const request = doc.elements["c-request"];
    if (request?.kind !== "dataFlow") throw new Error("fixture");
    request.sourceId = null;
    const route = doc.views.routes["cr-request"];
    if (route === undefined) throw new Error("fixture");
    route.sourceOccurrenceId = null;
    const result = expand(doc, {
      processId: "p1", diagramId: "d1",
      flowIds: { "f-part": { flowId: "k-part", routeId: "kr-part" } },
      occurrenceIds: {},
    });
    expect(result.elements["k-part"]).toBeDefined();
  });
});

describe("expandProcess refusals (SPEC.md section 4.1)", () => {
  test("a process that already has a child diagram is refused", () => {
    const doc = expand(contextDoc(), level0Args);
    const message = refusal(doc, { processId: "p0", diagramId: "d0b", flowIds: {}, occurrenceIds: {} });
    expect(message).toContain('"Bike Repair Shop"');
    expect(message).toContain("already has a child diagram");
  });

  test("an element that is not a process is refused, named by kind and name", () => {
    expect(refusal(contextDoc(), { processId: "customer", diagramId: "d0", flowIds: {}, occurrenceIds: {} })).toBe(
      'External entity "Customer" is not a process, so it cannot be expanded.',
    );
    const doc = contextDoc();
    doc.elements["customer"] = { kind: "externalEntity", id: "customer", name: "", ...text };
    expect(refusal(doc, { processId: "customer", diagramId: "d0", flowIds: {}, occurrenceIds: {} })).toBe(
      "An unnamed external entity is not a process, so it cannot be expanded.",
    );
  });

  test("an id that is not in the project is refused", () => {
    expect(refusal(contextDoc(), { processId: "ghost", diagramId: "d0", flowIds: {}, occurrenceIds: {} })).toContain('"ghost"');
  });

  test("a process shown on no diagram is refused", () => {
    const doc = contextDoc();
    addProcess(doc, "p9", "Stray Step", "p0", 9, null);
    expect(refusal(doc, { processId: "p9", diagramId: "d9", flowIds: {}, occurrenceIds: {} })).toContain('"Stray Step"');
  });

  test("a flow from the process to itself is skipped, like a flow with an unattached outer end", () => {
    const doc = contextDoc();
    addData(doc, "loop", "Rework Loop");
    addFlow(doc, "f-loop", "ctx", "p0", "p0", "loop", "o-p0", "o-p0");
    const expanded = expand(doc, level0Args);
    const onChild = Object.values(expanded.elements).filter((e) => e.kind === "dataFlow" && e.diagramId === "d0");
    expect(onChild.map((e) => e.id).sort()).toEqual(["c-bill", "c-order", "c-record", "c-request"]);
  });

  test("a flowIds key for a flow from the process to itself is an extra key", () => {
    const doc = contextDoc();
    addData(doc, "loop", "Rework Loop");
    addFlow(doc, "f-loop", "ctx", "p0", "p0", "loop", "o-p0", "o-p0");
    const flowIds = { ...level0Args.flowIds, "f-loop": { flowId: "c-loop", routeId: "cr-loop" } };
    expect(refusal(doc, { ...level0Args, flowIds })).toBe(
      'The process "Bike Repair Shop" cannot be expanded because flowIds has data flow "Rework Loop", which is not carried down.',
    );
  });

  test("a missing flowIds key is refused, naming the flow by its data", () => {
    const { "f-bill": _, ...flowIds } = level0Args.flowIds;
    expect(refusal(contextDoc(), { ...level0Args, flowIds })).toBe(
      'The process "Bike Repair Shop" cannot be expanded because flowIds has no entry for data flow "Repair Bill".',
    );
  });

  test("an extra flowIds key is refused, naming it", () => {
    const flowIds = { ...level0Args.flowIds, "f-ghost": { flowId: "c-ghost", routeId: "cr-ghost" } };
    expect(refusal(contextDoc(), { ...level0Args, flowIds })).toBe(
      'The process "Bike Repair Shop" cannot be expanded because flowIds has "f-ghost", which is not carried down.',
    );
    // A real element that is not a flow carried down is named by kind and name.
    const withEntity = { ...level0Args.flowIds, customer: { flowId: "c-x", routeId: "cr-x" } };
    expect(refusal(contextDoc(), { ...level0Args, flowIds: withEntity })).toContain('external entity "Customer", which is not carried down');
  });

  test("a missing occurrenceIds key is refused, naming the element", () => {
    const { supplier: _, ...occurrenceIds } = level0Args.occurrenceIds;
    expect(refusal(contextDoc(), { ...level0Args, occurrenceIds })).toBe(
      'The process "Bike Repair Shop" cannot be expanded because occurrenceIds has no entry for external entity "Supplier".',
    );
  });

  test("an extra occurrenceIds key is refused, naming the element", () => {
    const occurrenceIds = { ...level0Args.occurrenceIds, p0: "oc-p0" };
    expect(refusal(contextDoc(), { ...level0Args, occurrenceIds })).toBe(
      'The process "Bike Repair Shop" cannot be expanded because occurrenceIds has process "Bike Repair Shop", which is not placed on the child diagram.',
    );
  });

  test("every problem in both maps is named in the one sentence", () => {
    const message = refusal(contextDoc(), { processId: "p0", diagramId: "d0", flowIds: { zz: { flowId: "a", routeId: "b" }, yy: { flowId: "c", routeId: "e" } }, occurrenceIds: { qq: "g" } });
    expect(message).toContain('flowIds has no entry for data flow "Repair Bill", data flow "Parts Order", data flow "Work Record" and data flow "Repair Request"; flowIds has "yy" and "zz", which are not carried down; occurrenceIds has no entry for external entity "Customer", data store "Repair Log" and external entity "Supplier"; occurrenceIds has "qq", which is not placed on the child diagram.');
  });
});

describe("expandProcess arguments and ids (SPEC.md sections 3.2 and 7)", () => {
  const definition = expandCommands[0];
  if (definition === undefined) throw new Error("expandProcess is missing");

  test("the command is named, described in one sentence, and lists every new id", () => {
    expect(definition.name).toBe("expandProcess");
    expect(definition.sentence).toMatch(sentence);
    expect(definition.newIds(level0Args).sort()).toEqual(
      ["d0", "c-request", "cr-request", "c-bill", "cr-bill", "c-order", "cr-order", "c-record", "cr-record", "oc-customer", "oc-supplier", "oc-log"].sort(),
    );
  });

  test("the arguments are strict and every field has a description", () => {
    const schema = z.toJSONSchema(definition.args) as { properties: Record<string, { description?: string }>; additionalProperties: boolean };
    expect(Object.keys(schema.properties).sort()).toEqual(["diagramId", "flowIds", "occurrenceIds", "processId"]);
    for (const property of Object.values(schema.properties)) expect(property.description).toBeTruthy();
    expect(schema.additionalProperties).toBe(false);
    const result = apply(contextDoc(), { type: "expandProcess", args: { ...level0Args, origin: "ai" } }, "student");
    expect(result).toMatchObject({ ok: false, code: "invalid" });
  });

  test("a new id already in the document is reported as in use", () => {
    const result = apply(contextDoc(), { type: "expandProcess", args: { ...level0Args, diagramId: "ctx" } }, "student");
    expect(result).toMatchObject({ ok: false, code: "idInUse", ids: ["ctx"] });
  });

  test("the patch and its inverse take the document there and back", () => {
    const before = contextDoc();
    const result = apply(before, { type: "expandProcess", args: level0Args }, "student");
    if (!result.ok) throw new Error(result.message);
    const forward = applyPatch(asJson(before), result.patch);
    const back = applyPatch(asJson(result.doc), result.inverse);
    expect(forward).toEqual({ ok: true, doc: asJson(result.doc) });
    expect(back).toEqual({ ok: true, doc: asJson(before) });
  });
});

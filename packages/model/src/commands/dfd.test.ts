import { describe, expect, test } from "vitest";
import { apply, type ApplyResult } from "../apply.ts";
import { copyDocument } from "../apply.ts";
import { emptyDocument, type ProjectDocument } from "../document.ts";
import { findViolations } from "../invariants.ts";
import { findCommand } from "../registry.ts";
import { dfdCommands } from "./dfd.ts";

const box = { x: 10, y: 20, width: 100, height: 60 };

function ok(result: ApplyResult): ProjectDocument {
  if (!result.ok) throw new Error(result.message);
  expect(findViolations(result.doc)).toEqual([]);
  return result.doc;
}
function run(doc: ProjectDocument, type: string, args: unknown): ProjectDocument {
  return ok(apply(doc, { type, args }, "student"));
}
function refused(doc: ProjectDocument, type: string, args: unknown): string {
  const result = apply(doc, { type, args }, "student");
  if (result.ok || result.code !== "refused") throw new Error(`Expected a refusal, got ${JSON.stringify(result)}`);
  expect(result.message).toMatch(/^["A-Z][^]*\.$/);
  return result.message;
}

// A bike-repair shop: context diagram "ctx", process 0 "Repair Shop", the level 0
// diagram "d0" with process 1 "Take Job" and process 2 "Fix Bike", and the level 1
// diagram "d1" decomposing process 1 with process 1.1 "Log Job".
function shop(): ProjectDocument {
  let doc = run(emptyDocument(), "createProject", { name: "Repair Shop", contextDiagramId: "ctx", processId: "p0", occurrenceId: "o-p0" });
  const diagram = (id: string, of: string) => ({
    kind: "diagram" as const, id, name: `Level ${id}`, description: "", aliases: [], notes: "", origin: "student" as const,
    diagramKind: "dfd" as const, decomposesProcessId: of,
  });
  doc.elements.d0 = diagram("d0", "p0");
  doc = run(doc, "addProcess", { id: "p1", occurrenceId: "o-p1", diagramId: "d0", name: "Take Job", ...box });
  doc = run(doc, "addProcess", { id: "p2", occurrenceId: "o-p2", diagramId: "d0", name: "Fix Bike", ...box });
  doc.elements.d1 = diagram("d1", "p1");
  doc = run(doc, "addProcess", { id: "p11", occurrenceId: "o-p11", diagramId: "d1", name: "Log Job", ...box });
  return doc;
}

const entity = { id: "cust", occurrenceId: "o-cust", diagramId: "d0", name: "Customer", ...box };

describe("the DFD command family (SPEC.md section 4.1)", () => {
  test("every command is named, described by one sentence and has a described, strict schema", () => {
    expect(dfdCommands.map((c) => c.name)).toEqual([
      "addExternalEntity", "addDataStore", "addProcess", "placeExisting", "addControlFlow",
      "setProcessNumber", "addFlow", "setFlowData", "reconnectFlow",
    ]);
    for (const c of dfdCommands) {
      expect(findCommand(c.name)).toBe(c);
      expect(c.sentence).toMatch(/^[A-Z][^.]*\.$/);
      expect(JSON.stringify(c.args)).toBeDefined();
    }
  });
});

describe("addExternalEntity and addDataStore (SPEC.md sections 3.3 and 3.5)", () => {
  test("an external entity and one occurrence are added, with the caller's origin", () => {
    const result = apply(shop(), { type: "addExternalEntity", args: entity }, "ai");
    const doc = ok(result);
    expect(doc.elements.cust).toEqual({
      kind: "externalEntity", id: "cust", name: "Customer", description: "", aliases: [], notes: "", origin: "ai",
    });
    expect(doc.views.occurrences["o-cust"]).toEqual({ id: "o-cust", diagramId: "d0", elementId: "cust", ...box });
  });

  test("data stores are numbered one more than the highest, and a gap is never refilled", () => {
    let doc = shop();
    doc = run(doc, "addDataStore", { id: "s1", occurrenceId: "o-s1", diagramId: "d0", name: "Jobs", ...box });
    doc = run(doc, "addDataStore", { id: "s2", occurrenceId: "o-s2", diagramId: "d0", name: "Parts", ...box });
    doc = run(doc, "addDataStore", { id: "s3", occurrenceId: "o-s3", diagramId: "d0", name: "Bills", ...box });
    expect(["s1", "s2", "s3"].map((id) => (doc.elements[id] as { ordinal: number }).ordinal)).toEqual([1, 2, 3]);
    delete doc.elements.s2;
    delete doc.views.occurrences["o-s2"];
    doc = run(doc, "addDataStore", { id: "s4", occurrenceId: "o-s4", diagramId: "d0", name: "Tools", ...box });
    expect((doc.elements.s4 as { ordinal: number }).ordinal).toBe(4);
  });

  test("a diagram that is not a diagram is refused", () => {
    expect(refused(shop(), "addExternalEntity", { ...entity, diagramId: "p1" })).toContain("diagram");
    expect(refused(shop(), "addDataStore", { ...entity, diagramId: "nowhere" })).toContain("nowhere");
  });

  test("width and height must be positive", () => {
    for (const bad of [{ width: 0 }, { height: -5 }]) {
      const result = apply(shop(), { type: "addExternalEntity", args: { ...entity, ...bad } }, "student");
      expect(result).toMatchObject({ ok: false, code: "invalid" });
    }
  });

  test("an id already in use is reported before the command runs", () => {
    const result = apply(shop(), { type: "addExternalEntity", args: { ...entity, id: "p1" } }, "student");
    expect(result).toMatchObject({ ok: false, code: "idInUse", ids: ["p1"] });
  });
});

describe("addProcess (SPEC.md sections 3.3 and 3.4)", () => {
  test("the parent is the diagram's process and the ordinal is the next free whole number", () => {
    const doc = shop();
    expect(doc.elements.p1).toMatchObject({ parentProcessId: "p0", ordinal: 1 });
    expect(doc.elements.p2).toMatchObject({ parentProcessId: "p0", ordinal: 2, processDescription: "" });
    expect(doc.elements.p11).toMatchObject({ parentProcessId: "p1", ordinal: 1 });
  });

  test("the smallest unused ordinal is chosen, so a gap is filled", () => {
    let doc = run(shop(), "setProcessNumber", { processId: "p1", ordinal: 3 });
    doc = run(doc, "addProcess", { id: "p3", occurrenceId: "o-p3", diagramId: "d0", name: "Pay", ...box });
    expect(doc.elements.p3).toMatchObject({ ordinal: 1 });
  });

  test("a given ordinal is used, and one a sibling holds is refused", () => {
    const doc = run(shop(), "addProcess", { id: "p5", occurrenceId: "o-p5", diagramId: "d0", name: "Pay", ordinal: 5, ...box });
    expect(doc.elements.p5).toMatchObject({ ordinal: 5 });
    expect(refused(shop(), "addProcess", { id: "p6", occurrenceId: "o-p6", diagramId: "d0", name: "Pay", ordinal: 2, ...box })).toContain("2");
  });

  test("the context diagram shows only process 0, so it refuses a process", () => {
    expect(refused(shop(), "addProcess", { id: "px", occurrenceId: "o-px", diagramId: "ctx", name: "Extra", ...box })).toContain("context diagram");
  });

  test("anything that is not a diagram is refused", () => {
    expect(refused(shop(), "addProcess", { id: "px", occurrenceId: "o-px", diagramId: "p1", name: "Extra", ...box })).toContain("p1");
  });

  test("an ordinal under 1 is invalid", () => {
    const result = apply(shop(), { type: "addProcess", args: { id: "px", occurrenceId: "o-px", diagramId: "d0", name: "X", ordinal: 0, ...box } }, "student");
    expect(result).toMatchObject({ ok: false, code: "invalid" });
  });

  test("a data flow diagram that decomposes nothing is refused like the context diagram", () => {
    const doc = shop();
    const ctx = doc.elements.ctx;
    if (ctx?.kind === "diagram") ctx.diagramKind = "dfd";
    expect(refused(doc, "addProcess", { id: "px", occurrenceId: "o-px", diagramId: "ctx", name: "X", ...box })).toContain("context diagram");
  });
});

describe("placeExisting (SPEC.md section 3.5)", () => {
  test("a second occurrence of an external entity or data store is added", () => {
    let doc = run(shop(), "addExternalEntity", entity);
    doc = run(doc, "addDataStore", { id: "s1", occurrenceId: "o-s1", diagramId: "d0", name: "Jobs", ...box });
    doc = run(doc, "placeExisting", { occurrenceId: "o-cust2", elementId: "cust", diagramId: "d0", x: 1, y: 2, width: 30, height: 40 });
    doc = run(doc, "placeExisting", { occurrenceId: "o-s1b", elementId: "s1", diagramId: "d1", ...box });
    expect(doc.views.occurrences["o-cust2"]).toEqual({ id: "o-cust2", diagramId: "d0", elementId: "cust", x: 1, y: 2, width: 30, height: 40 });
    expect(doc.views.occurrences["o-s1b"]?.diagramId).toBe("d1");
  });

  test("a process, a flow or a missing element is refused", () => {
    const doc = run(run(shop(), "addExternalEntity", entity), "addFlow", {
      id: "f1", routeId: "r1", diagramId: "d0", sourceId: "cust", targetId: "p1", dataId: "dd1", newDataName: "Job Request",
    });
    const place = { occurrenceId: "o-x", diagramId: "d0", ...box };
    expect(refused(doc, "placeExisting", { ...place, elementId: "p1" })).toContain("Take Job");
    expect(refused(doc, "placeExisting", { ...place, elementId: "f1" })).toContain("data flow");
    expect(refused(doc, "placeExisting", { ...place, elementId: "ghost" })).toContain("ghost");
  });

  test("a diagram that is not a diagram is refused", () => {
    const doc = run(shop(), "addExternalEntity", entity);
    expect(refused(doc, "placeExisting", { occurrenceId: "o-x", elementId: "cust", diagramId: "cust", ...box })).toContain("diagram");
  });
});

describe("setProcessNumber (SPEC.md sections 3.3 and 4.1)", () => {
  test("changes the ordinal, including to its own current value", () => {
    let doc = run(shop(), "setProcessNumber", { processId: "p2", ordinal: 7 });
    expect(doc.elements.p2).toMatchObject({ ordinal: 7 });
    doc = run(doc, "setProcessNumber", { processId: "p2", ordinal: 7 });
    expect(doc.elements.p2).toMatchObject({ ordinal: 7 });
  });

  test("a number a sibling has is refused, naming the parent", () => {
    expect(refused(shop(), "setProcessNumber", { processId: "p2", ordinal: 1 })).toContain("Repair Shop");
  });

  test("the same number under a different parent is fine", () => {
    const doc = run(shop(), "setProcessNumber", { processId: "p11", ordinal: 2 });
    expect(doc.elements.p11).toMatchObject({ ordinal: 2 });
  });

  test("process 0 is refused", () => {
    expect(refused(shop(), "setProcessNumber", { processId: "p0", ordinal: 3 })).toContain("Process 0");
  });

  test("an ordinal under 1 is invalid", () => {
    expect(apply(shop(), { type: "setProcessNumber", args: { processId: "p2", ordinal: 0 } }, "student")).toMatchObject({ ok: false, code: "invalid" });
  });

  test("an element that is not a process is refused", () => {
    expect(refused(shop(), "setProcessNumber", { processId: "d0", ordinal: 3 })).toContain("d0");
  });
});

describe("addControlFlow (SPEC.md sections 3.3, 3.4 and 3.5)", () => {
  const cf = { id: "c1", routeId: "rc1", diagramId: "d0", targetId: "p2", name: "Bike Dropped Off" };

  test("makes the control flow and a route with no source occurrence", () => {
    const doc = run(shop(), "addControlFlow", cf);
    expect(doc.elements.c1).toEqual({
      kind: "controlFlow", id: "c1", name: "Bike Dropped Off", description: "", aliases: [], notes: "",
      origin: "student", diagramId: "d0", targetId: "p2",
    });
    expect(doc.views.routes.rc1).toEqual({ id: "rc1", flowId: "c1", diagramId: "d0", sourceOccurrenceId: null, targetOccurrenceId: "o-p2", points: [] });
  });

  test("works on the context diagram for process 0", () => {
    const doc = run(shop(), "addControlFlow", { ...cf, diagramId: "ctx", targetId: "p0" });
    expect(doc.views.routes.rc1?.targetOccurrenceId).toBe("o-p0");
  });

  test("a target not shown on the diagram, or not a process, is refused", () => {
    expect(refused(shop(), "addControlFlow", { ...cf, targetId: "p11" })).toContain("Log Job");
    expect(refused(run(shop(), "addExternalEntity", entity), "addControlFlow", { ...cf, targetId: "cust" })).toContain("Customer");
    expect(refused(shop(), "addControlFlow", { ...cf, targetId: "ghost" })).toContain("ghost");
  });

  test("a diagram that is not a diagram is refused", () => {
    expect(refused(shop(), "addControlFlow", { ...cf, diagramId: "p2" })).toContain("diagram");
  });

  test("a named occurrence that is not the process's is refused", () => {
    expect(refused(shop(), "addControlFlow", { ...cf, targetOccurrenceId: "o-p1" })).toContain("o-p1");
    expect(run(shop(), "addControlFlow", { ...cf, targetOccurrenceId: "o-p2" }).views.routes.rc1?.targetOccurrenceId).toBe("o-p2");
  });
});

describe("addFlow (SPEC.md sections 3.3, 3.4 and 3.5)", () => {
  function withEntity(): ProjectDocument {
    return run(shop(), "addExternalEntity", entity);
  }
  const existing = { id: "f1", routeId: "r1", diagramId: "d0", sourceId: "cust", targetId: "p1", dataId: "dd1" };
  const flow = { ...existing, newDataName: "Job Request" };

  test("with newDataName makes the data structure, and the flow's label is its name", () => {
    const result = apply(withEntity(), { type: "addFlow", args: flow }, "ai");
    const doc = ok(result);
    expect(doc.elements.dd1).toEqual({
      kind: "dataStructure", id: "dd1", name: "Job Request", description: "", aliases: [], notes: "", origin: "ai", components: [],
    });
    expect(doc.elements.f1).toMatchObject({ kind: "dataFlow", name: "", dataId: "dd1", sourceId: "cust", targetId: "p1", diagramId: "d0" });
    expect(doc.views.routes.r1).toEqual({ id: "r1", flowId: "f1", diagramId: "d0", sourceOccurrenceId: "o-cust", targetOccurrenceId: "o-p1", points: [] });
  });

  test("newIds lists the flow, its route and the new structure only when one is made", () => {
    const addFlowCommand = findCommand("addFlow");
    const parsed = addFlowCommand?.args.parse(flow);
    expect(addFlowCommand?.newIds(parsed)).toEqual(["f1", "r1", "dd1"]);
    expect(addFlowCommand?.newIds(addFlowCommand.args.parse(existing))).toEqual(["f1", "r1"]);
  });

  test("a new structure id that is already used is reported", () => {
    const result = apply(withEntity(), { type: "addFlow", args: { ...flow, dataId: "p1" } }, "student");
    expect(result).toMatchObject({ ok: false, code: "idInUse", ids: ["p1"] });
  });

  test("an existing structure or element can be carried; anything else is refused", () => {
    let doc = run(withEntity(), "addFlow", flow);
    doc = run(doc, "addFlow", { ...existing, id: "f2", routeId: "r2", sourceId: "p1", targetId: "cust" });
    expect(doc.elements.f2).toMatchObject({ dataId: "dd1" });
    expect(refused(doc, "addFlow", { ...existing, id: "f3", routeId: "r3", dataId: "p2" })).toContain("Fix Bike");
    expect(refused(doc, "addFlow", { ...existing, id: "f3", routeId: "r3", dataId: "ghost" })).toContain("ghost");
  });

  test("a data element can be carried", () => {
    const doc = withEntity();
    doc.elements.de1 = {
      kind: "dataElement", id: "de1", name: "Job Number", description: "", aliases: [], notes: "", origin: "student", dataType: "text", allowedValues: [],
    };
    expect(run(doc, "addFlow", { ...existing, dataId: "de1" }).elements.f1).toMatchObject({ dataId: "de1" });
  });

  test("both ends must be nodes shown on the diagram", () => {
    const doc = withEntity();
    expect(refused(doc, "addFlow", { ...flow, sourceId: "ghost" })).toContain("ghost");
    expect(refused(doc, "addFlow", { ...flow, sourceId: "d0" })).toContain("Level d0");
    expect(refused(doc, "addFlow", { ...flow, targetId: "p0" })).toContain("Repair Shop");
    const lonely = run(doc, "addExternalEntity", { ...entity, id: "sup", occurrenceId: "o-sup", diagramId: "d1", name: "" });
    expect(refused(lonely, "addFlow", { ...flow, sourceId: "sup" })).toContain("unnamed external entity");
  });

  test("a diagram that is not a diagram is refused", () => {
    expect(refused(withEntity(), "addFlow", { ...flow, diagramId: "p1" })).toContain("diagram");
  });

  test("an entity shown twice needs the occurrence named", () => {
    const doc = run(withEntity(), "placeExisting", { occurrenceId: "o-cust2", elementId: "cust", diagramId: "d0", ...box });
    expect(refused(doc, "addFlow", flow)).toContain("which occurrence");
    const named = run(doc, "addFlow", { ...flow, sourceOccurrenceId: "o-cust2" });
    expect(named.views.routes.r1?.sourceOccurrenceId).toBe("o-cust2");
    expect(refused(doc, "addFlow", { ...flow, sourceOccurrenceId: "o-p1" })).toContain("o-p1");
  });

  test("an off-diagram end on a level 1 diagram is accepted and has no occurrence", () => {
    const doc = run(shop(), "addFlow", { id: "f1", routeId: "r1", diagramId: "d1", sourceId: "p11", targetId: "p2", dataId: "dd1", newDataName: "Bike Details" });
    expect(doc.views.routes.r1).toMatchObject({ sourceOccurrenceId: "o-p11", targetOccurrenceId: null });
    const reversed = run(shop(), "addFlow", { id: "f1", routeId: "r1", diagramId: "d1", sourceId: "p2", targetId: "p11", dataId: "dd1", newDataName: "Bike Details" });
    expect(reversed.views.routes.r1).toMatchObject({ sourceOccurrenceId: null, targetOccurrenceId: "o-p11" });
  });

  test("an end that is the diagram's own process or one of its ancestors is refused", () => {
    const base = { id: "f1", routeId: "r1", diagramId: "d1", sourceId: "p11", dataId: "dd1", newDataName: "X" };
    expect(refused(shop(), "addFlow", { ...base, targetId: "p1" })).toContain("Take Job");
    expect(refused(shop(), "addFlow", { ...base, targetId: "p0" })).toContain("Repair Shop");
  });

  test("an off-diagram process on the context diagram is refused", () => {
    expect(refused(run(shop(), "addExternalEntity", { ...entity, diagramId: "ctx" }), "addFlow", { ...flow, diagramId: "ctx", targetId: "p1" })).toContain("Take Job");
  });

  test("two off-diagram ends are refused", () => {
    const doc = shop();
    doc.elements.d2 = { ...(doc.elements.d1 as object), id: "d2", decomposesProcessId: "p2" } as never;
    doc.elements.p3 = { ...(doc.elements.p2 as object), id: "p3", ordinal: 3, name: "Pay" } as never;
    doc.views.occurrences["o-p3"] = { id: "o-p3", diagramId: "d0", elementId: "p3", ...box };
    expect(refused(doc, "addFlow", { id: "f1", routeId: "r1", diagramId: "d1", sourceId: "p2", targetId: "p3", dataId: "dd1", newDataName: "X" })).toContain("Only one end");
  });

  test("an off-diagram end cannot name an occurrence", () => {
    expect(
      refused(shop(), "addFlow", { id: "f1", routeId: "r1", diagramId: "d1", sourceId: "p11", targetId: "p2", targetOccurrenceId: "o-p2", dataId: "dd1", newDataName: "X" }),
    ).toContain("no occurrence");
  });
});

describe("setFlowData (SPEC.md section 3.3)", () => {
  function flowDoc(): ProjectDocument {
    const doc = run(shop(), "addExternalEntity", entity);
    return run(doc, "addFlow", { id: "f1", routeId: "r1", diagramId: "d0", sourceId: "cust", targetId: "p1", dataId: "dd1", newDataName: "Job Request" });
  }

  test("changes the data a flow carries, to a structure or an element", () => {
    let doc = run(flowDoc(), "addFlow", { id: "f2", routeId: "r2", diagramId: "d0", sourceId: "p1", targetId: "p2", dataId: "dd2", newDataName: "Work Order" });
    doc = run(doc, "setFlowData", { flowId: "f1", dataId: "dd2" });
    expect(doc.elements.f1).toMatchObject({ dataId: "dd2" });
    doc.elements.de1 = {
      kind: "dataElement", id: "de1", name: "Job Number", description: "", aliases: [], notes: "", origin: "student", dataType: "text", allowedValues: [],
    };
    expect(run(doc, "setFlowData", { flowId: "f1", dataId: "de1" }).elements.f1).toMatchObject({ dataId: "de1" });
  });

  test("a control flow, a missing flow or anything that is not data is refused", () => {
    const doc = run(flowDoc(), "addControlFlow", { id: "c1", routeId: "rc1", diagramId: "d0", targetId: "p2", name: "Closing Time" });
    expect(refused(doc, "setFlowData", { flowId: "c1", dataId: "dd1" })).toContain("c1");
    expect(refused(doc, "setFlowData", { flowId: "ghost", dataId: "dd1" })).toContain("ghost");
    expect(refused(doc, "setFlowData", { flowId: "f1", dataId: "p1" })).toContain("Take Job");
    expect(refused(doc, "setFlowData", { flowId: "f1", dataId: "ghost" })).toContain("ghost");
  });
});

describe("reconnectFlow (SPEC.md sections 3.4 and 3.5)", () => {
  function flowDoc(): ProjectDocument {
    const doc = run(shop(), "addExternalEntity", entity);
    return run(doc, "addFlow", { id: "f1", routeId: "r1", diagramId: "d0", sourceId: "cust", targetId: "p1", dataId: "dd1", newDataName: "Job Request" });
  }

  test("changes an end and the route's matching occurrence", () => {
    const doc = run(flowDoc(), "reconnectFlow", { flowId: "f1", end: "target", elementId: "p2" });
    expect(doc.elements.f1).toMatchObject({ sourceId: "cust", targetId: "p2" });
    expect(doc.views.routes.r1).toMatchObject({ sourceOccurrenceId: "o-cust", targetOccurrenceId: "o-p2" });
    const source = run(flowDoc(), "reconnectFlow", { flowId: "f1", end: "source", elementId: "p2" });
    expect(source.elements.f1).toMatchObject({ sourceId: "p2" });
    expect(source.views.routes.r1?.sourceOccurrenceId).toBe("o-p2");
  });

  test("attaches an unattached end", () => {
    const doc = flowDoc();
    const flow = doc.elements.f1;
    if (flow?.kind === "dataFlow") flow.sourceId = null;
    const route = doc.views.routes.r1;
    if (route) route.sourceOccurrenceId = null;
    const attached = run(doc, "reconnectFlow", { flowId: "f1", end: "source", elementId: "cust" });
    expect(attached.views.routes.r1?.sourceOccurrenceId).toBe("o-cust");
  });

  test("an off-diagram end gets a null occurrence, and an on-diagram one gets the occurrence back", () => {
    let doc = run(shop(), "addFlow", { id: "f1", routeId: "r1", diagramId: "d1", sourceId: "p11", targetId: "p2", dataId: "dd1", newDataName: "X" });
    doc = run(doc, "addExternalEntity", { ...entity, diagramId: "d1" });
    doc = run(doc, "reconnectFlow", { flowId: "f1", end: "target", elementId: "cust" });
    expect(doc.views.routes.r1).toMatchObject({ sourceOccurrenceId: "o-p11", targetOccurrenceId: "o-cust" });
    doc = run(doc, "reconnectFlow", { flowId: "f1", end: "target", elementId: "p2" });
    expect(doc.views.routes.r1?.targetOccurrenceId).toBeNull();
  });

  test("a second off-diagram end is refused", () => {
    const doc = run(shop(), "addFlow", { id: "f1", routeId: "r1", diagramId: "d1", sourceId: "p11", targetId: "p2", dataId: "dd1", newDataName: "X" });
    doc.elements.p3 = { ...(doc.elements.p2 as object), id: "p3", ordinal: 3, name: "Pay" } as never;
    doc.views.occurrences["o-p3"] = { id: "o-p3", diagramId: "d0", elementId: "p3", ...box };
    expect(refused(doc, "reconnectFlow", { flowId: "f1", end: "source", elementId: "p3" })).toContain("Only one end");
  });

  test("occurrence rules match addFlow", () => {
    const doc = run(flowDoc(), "placeExisting", { occurrenceId: "o-cust2", elementId: "cust", diagramId: "d0", ...box });
    expect(refused(doc, "reconnectFlow", { flowId: "f1", end: "source", elementId: "cust" })).toContain("which occurrence");
    expect(run(doc, "reconnectFlow", { flowId: "f1", end: "source", elementId: "cust", occurrenceId: "o-cust2" }).views.routes.r1?.sourceOccurrenceId).toBe("o-cust2");
    expect(refused(doc, "reconnectFlow", { flowId: "f1", end: "source", elementId: "cust", occurrenceId: "o-p1" })).toContain("o-p1");
  });

  test("a control flow, a missing flow, or a bad end is refused", () => {
    const doc = run(flowDoc(), "addControlFlow", { id: "c1", routeId: "rc1", diagramId: "d0", targetId: "p2", name: "Closing Time" });
    expect(refused(doc, "reconnectFlow", { flowId: "c1", end: "target", elementId: "p1" })).toContain("c1");
    expect(refused(doc, "reconnectFlow", { flowId: "f1", end: "target", elementId: "ghost" })).toContain("ghost");
    expect(refused(doc, "reconnectFlow", { flowId: "f1", end: "target", elementId: "p11" })).toContain("Log Job");
  });

  test("a flow with no route cannot be reconnected", () => {
    const doc = flowDoc();
    delete doc.views.routes.r1;
    const result = findCommand("reconnectFlow")?.run(copyDocument(doc), { flowId: "f1", end: "target", elementId: "p2" }, { origin: "student" });
    expect(result).toMatchObject({ ok: false, message: expect.stringContaining("no line") });
  });

  test("a flow whose diagram has gone cannot be reconnected", () => {
    const doc = flowDoc();
    delete doc.elements.d0;
    const result = findCommand("reconnectFlow")?.run(copyDocument(doc), { flowId: "f1", end: "target", elementId: "p2" }, { origin: "student" });
    expect(result).toMatchObject({ ok: false });
  });
});

describe("calling a command directly", () => {
  test("an unnamed element is called by its kind in a refusal", () => {
    const doc = run(shop(), "addExternalEntity", { ...entity, name: "" });
    expect(refused(doc, "placeExisting", { occurrenceId: "o-x", elementId: "o-nothing", diagramId: "d0", ...box })).toContain("o-nothing");
    expect(refused(doc, "addControlFlow", { id: "c1", routeId: "rc1", diagramId: "d0", targetId: "cust", name: "E" })).toContain("unnamed external entity");
  });
});

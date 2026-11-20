import { describe, expect, test } from "vitest";
import { emptyDocument, type ProjectDocument } from "./document.ts";
import {
  checkDecomposition, checkFlowEndKinds, checkFlowEndsShown, checkMapKeys, checkOneContextDiagram,
  checkOrdinals, checkProcessOccurrences, checkProcessTree, checkReferences, checkTopDiagram,
  checkViews, findViolations,
} from "./invariants.ts";

const common = { description: "", aliases: [], notes: "", origin: "student" as const };
const box = { x: 0, y: 0, width: 100, height: 60 };

// A bakery: a context diagram, a level 0 diagram decomposing process 0, and a level 1
// diagram decomposing process 1 with an off-diagram end, an unattached end and a control flow.
function bakery(): ProjectDocument {
  const process = (id: string, parentProcessId: string | null, ordinal: number) =>
    ({ ...common, id, kind: "process" as const, name: id, parentProcessId, ordinal, processDescription: "" });
  const diagram = (id: string, diagramKind: "context" | "dfd", decomposesProcessId: string | null) =>
    ({ ...common, id, kind: "diagram" as const, name: id, diagramKind, decomposesProcessId });
  const flow = (id: string, diagramId: string, sourceId: string | null, targetId: string | null) =>
    ({ ...common, id, kind: "dataFlow" as const, name: "", diagramId, sourceId, targetId, dataId: "order" });
  const occ = (id: string, diagramId: string, elementId: string) => ({ id, diagramId, elementId, ...box });
  const route = (id: string, flowId: string, diagramId: string, s: string | null, t: string | null) =>
    ({ id, flowId, diagramId, sourceOccurrenceId: s, targetOccurrenceId: t, points: [] });
  const elements = [
    diagram("ctx", "context", null),
    diagram("level0", "dfd", "p0"),
    diagram("level1", "dfd", "p1"),
    process("p0", null, 0),
    process("p1", "p0", 1),
    process("p2", "p0", 2),
    process("p11", "p1", 1),
    process("p12", "p1", 2),
    { ...common, id: "customer", kind: "externalEntity" as const, name: "Customer" },
    { ...common, id: "orders", kind: "dataStore" as const, name: "Orders", ordinal: 1 },
    { ...common, id: "item", kind: "dataElement" as const, name: "Item", dataType: "text", allowedValues: [] },
    { ...common, id: "order", kind: "dataStructure" as const, name: "Order", components: [{ dataId: "item", occurs: "many" as const, limit: null }] },
    flow("fCtx", "ctx", "customer", "p0"),
    flow("fTake", "level0", "customer", "p1"),
    flow("fFile", "level0", "p1", "orders"),
    flow("fBake", "level0", "orders", "p2"),
    flow("fInherited", "level1", null, "p11"),
    flow("fToBake", "level1", "p12", "p2"),
    { ...common, id: "cOpen", kind: "controlFlow" as const, name: "Shop opens", diagramId: "level1", targetId: "p11" },
  ];
  const occurrences = [
    occ("oCustomerCtx", "ctx", "customer"), occ("oP0", "ctx", "p0"),
    occ("oCustomer0", "level0", "customer"), occ("oP1", "level0", "p1"), occ("oP2", "level0", "p2"),
    occ("oOrders0", "level0", "orders"),
    occ("oP11", "level1", "p11"), occ("oP12", "level1", "p12"),
  ];
  const routes = [
    route("rCtx", "fCtx", "ctx", "oCustomerCtx", "oP0"),
    route("rTake", "fTake", "level0", "oCustomer0", "oP1"),
    route("rFile", "fFile", "level0", "oP1", "oOrders0"),
    route("rBake", "fBake", "level0", "oOrders0", "oP2"),
    route("rInherited", "fInherited", "level1", null, "oP11"),
    route("rToBake", "fToBake", "level1", "oP12", null),
    route("rOpen", "cOpen", "level1", null, "oP11"),
  ];
  return {
    schemaVersion: 1,
    settings: { name: "Corner Bakery", topDiagramId: "ctx", showFindings: "always", caseText: "" },
    elements: Object.fromEntries(elements.map((e) => [e.id, e])),
    views: {
      occurrences: Object.fromEntries(occurrences.map((o) => [o.id, o])),
      routes: Object.fromEntries(routes.map((r) => [r.id, r])),
    },
  };
}

const checks = {
  checkMapKeys, checkTopDiagram, checkReferences, checkFlowEndsShown, checkFlowEndKinds,
  checkDecomposition, checkProcessTree, checkProcessOccurrences, checkOneContextDiagram,
  checkOrdinals, checkViews,
};
type CheckName = keyof typeof checks;

/** The document breaks the named check and passes every other one. */
function expectOnly(doc: ProjectDocument, name: CheckName): void {
  for (const [other, check] of Object.entries(checks)) {
    const found = check(doc);
    if (other === name) {
      expect(found.length, other).toBeGreaterThan(0);
      for (const v of found) {
        expect(v.message).toMatch(/^[A-Z].*\.$/);
      }
    } else {
      expect(found, other).toEqual([]);
    }
  }
}

function edit(change: (doc: ProjectDocument) => void): ProjectDocument {
  const doc = bakery();
  change(doc);
  return doc;
}

test("a context, level 0 and level 1 bakery passes every check (SPEC.md section 3.4)", () => {
  expect(findViolations(bakery())).toEqual([]);
});

test("the empty document before createProject is valid", () => {
  expect(findViolations(emptyDocument())).toEqual([]);
});

describe("map keys and the top diagram (SPEC.md section 3.6)", () => {
  test("a key that differs from its record's id is refused", () => {
    expectOnly(edit((d) => { d.views.routes.rCtx = { ...d.views.routes.rCtx!, id: "other" }; }), "checkMapKeys");
  });
  test("an id used in two maps is refused", () => {
    expectOnly(edit((d) => { d.views.occurrences.oP0 = { ...d.views.occurrences.oP0! }; d.views.routes.oP0 = { ...d.views.routes.rCtx!, id: "oP0" }; delete d.views.routes.rCtx; }), "checkMapKeys");
  });
  test("a top diagram that is not a diagram is refused", () => {
    expectOnly(edit((d) => { d.settings.topDiagramId = "p0"; }), "checkTopDiagram");
  });
  test("a non-empty document needs a top diagram", () => {
    expectOnly(edit((d) => { d.settings.topDiagramId = null; }), "checkTopDiagram");
    expect(checkTopDiagram(edit((d) => { d.settings.topDiagramId = null; }))[0]?.ids).toEqual([]);
  });
});

describe("invariant 1: references (SPEC.md section 3.4)", () => {
  test("a flow end that does not exist", () => {
    expectOnly(edit((d) => {
      d.elements.fTake = { ...d.elements.fTake!, targetId: "nobody" } as never;
      d.views.routes.rTake!.targetOccurrenceId = null;
    }), "checkReferences");
  });
  test("a data flow whose data is a process", () => {
    expectOnly(edit((d) => { d.elements.fCtx = { ...d.elements.fCtx!, dataId: "p2" } as never; }), "checkReferences");
  });
  test("a component that refers to a missing element", () => {
    expectOnly(edit((d) => { d.elements.order = { ...d.elements.order!, components: [{ dataId: "flour", occurs: "once", limit: null }] } as never; }), "checkReferences");
  });
  test("a control flow whose target is not a process", () => {
    expectOnly(edit((d) => {
      d.elements.cOpen = { ...d.elements.cOpen!, diagramId: "level0", targetId: "orders" } as never;
      d.views.routes.rOpen = { ...d.views.routes.rOpen!, diagramId: "level0", targetOccurrenceId: "oOrders0" };
    }), "checkReferences");
  });
  test("a diagram that decomposes an external entity", () => {
    expectOnly(edit((d) => { d.elements.spare = { ...common, id: "spare", kind: "diagram", name: "", diagramKind: "dfd", decomposesProcessId: "customer" }; }), "checkReferences");
  });
  test("a flow whose diagram is not a diagram", () => {
    expectOnly(edit((d) => {
      delete d.elements.fInherited;
      d.elements.fLost = { ...common, id: "fLost", kind: "dataFlow", name: "", diagramId: "nowhere", sourceId: null, targetId: "p11", dataId: "order" };
      d.views.routes.rInherited = { ...d.views.routes.rInherited!, flowId: "fLost", diagramId: "nowhere", targetOccurrenceId: null };
    }), "checkReferences");
  });
  test("a process whose parent is a data store", () => {
    const doc = edit((d) => { d.elements.p2 = { ...d.elements.p2!, parentProcessId: "orders" } as never; });
    expect(checkReferences(doc).length).toBe(1);
  });
  test("a data flow with both ends unattached", () => {
    expectOnly(edit((d) => {
      d.elements.fToBake = { ...d.elements.fToBake!, sourceId: null, targetId: null } as never;
      d.views.routes.rToBake!.sourceOccurrenceId = null;
    }), "checkReferences");
  });
});

describe("invariant 2: flow ends shown on the flow's diagram (SPEC.md section 3.4)", () => {
  test("an external entity not shown on the flow's diagram", () => {
    expectOnly(edit((d) => {
      d.elements.fInherited = { ...d.elements.fInherited!, sourceId: "customer" } as never;
    }), "checkFlowEndsShown");
  });
  test("the decomposed process itself cannot be an off-diagram end", () => {
    expectOnly(edit((d) => { d.elements.fToBake = { ...d.elements.fToBake!, targetId: "p1" } as never; }), "checkFlowEndsShown");
  });
  test("an ancestor of the decomposed process cannot be an off-diagram end", () => {
    expectOnly(edit((d) => { d.elements.fToBake = { ...d.elements.fToBake!, targetId: "p0" } as never; }), "checkFlowEndsShown");
  });
  test("a descendant of the decomposed process cannot be an off-diagram end", () => {
    // On level 0, which decomposes process 0, process 1.1 is below process 0.
    expectOnly(edit((d) => {
      d.elements.fBake = { ...d.elements.fBake!, targetId: "p11" } as never;
      d.views.routes.rBake!.targetOccurrenceId = null;
    }), "checkFlowEndsShown");
  });
  test("no off-diagram end on the context diagram", () => {
    expectOnly(edit((d) => {
      d.elements.fCtx = { ...d.elements.fCtx!, targetId: "p1" } as never;
      d.views.routes.rCtx!.targetOccurrenceId = null;
    }), "checkFlowEndsShown");
  });
  test("both ends off-diagram is refused", () => {
    expectOnly(edit((d) => {
      d.elements.fToBake = { ...d.elements.fToBake!, sourceId: "p2" } as never;
      d.views.routes.rToBake!.sourceOccurrenceId = null;
    }), "checkFlowEndsShown");
  });
});

describe("invariant 3: kinds of flow ends (SPEC.md section 3.4)", () => {
  test("a data flow that ends at a data element", () => {
    expectOnly(edit((d) => { d.elements.fToBake = { ...d.elements.fToBake!, targetId: "item" } as never; }), "checkFlowEndKinds");
  });
  test("a control flow whose process is not on its diagram", () => {
    expectOnly(edit((d) => {
      d.elements.cOpen = { ...d.elements.cOpen!, targetId: "p2" } as never;
      d.views.routes.rOpen!.targetOccurrenceId = null;
    }), "checkFlowEndKinds");
  });
});

describe("invariant 4: decomposition (SPEC.md section 3.4)", () => {
  test("two diagrams decompose one process", () => {
    expectOnly(edit((d) => {
      d.elements.a = { ...common, id: "a", kind: "diagram", name: "", diagramKind: "dfd", decomposesProcessId: "p2" };
      d.elements.b = { ...common, id: "b", kind: "diagram", name: "", diagramKind: "dfd", decomposesProcessId: "p2" };
    }), "checkDecomposition");
  });
  test("a data flow diagram that decomposes nothing", () => {
    expectOnly(edit((d) => { d.elements.a = { ...common, id: "a", kind: "diagram", name: "", diagramKind: "dfd", decomposesProcessId: null }; }), "checkDecomposition");
  });
  test("a context diagram that decomposes a process", () => {
    expectOnly(edit((d) => { d.elements.ctx = { ...d.elements.ctx!, decomposesProcessId: "p2" } as never; }), "checkDecomposition");
  });
});

describe("invariant 5: the process tree (SPEC.md section 3.4)", () => {
  test("a second process with no parent", () => {
    const doc = edit((d) => { d.elements.p12 = { ...d.elements.p12!, parentProcessId: null, ordinal: 0 } as never; });
    expect(checkProcessTree(doc).length).toBeGreaterThan(0);
  });
  test("process 0 with an ordinal other than 0", () => {
    expectOnly(edit((d) => { d.elements.p0 = { ...d.elements.p0!, ordinal: 3 } as never; }), "checkProcessTree");
  });
  test("a child process with ordinal 0", () => {
    expectOnly(edit((d) => { d.elements.p12 = { ...d.elements.p12!, ordinal: 0 } as never; }), "checkProcessTree");
  });
  test("a loop of parent processes", () => {
    expectOnly(edit((d) => {
      d.elements.x = { ...common, id: "x", kind: "process", name: "", parentProcessId: "y", ordinal: 1, processDescription: "" };
      d.elements.y = { ...common, id: "y", kind: "process", name: "", parentProcessId: "x", ordinal: 1, processDescription: "" };
      d.elements.dx = { ...common, id: "dx", kind: "diagram", name: "", diagramKind: "dfd", decomposesProcessId: "x" };
      d.elements.dy = { ...common, id: "dy", kind: "diagram", name: "", diagramKind: "dfd", decomposesProcessId: "y" };
      d.views.occurrences.ox = { id: "ox", diagramId: "dy", elementId: "x", ...box };
      d.views.occurrences.oy = { id: "oy", diagramId: "dx", elementId: "y", ...box };
    }), "checkProcessTree");
  });
});

describe("invariant 6: where a process is shown (SPEC.md section 3.4)", () => {
  test("a process shown on the wrong diagram", () => {
    expectOnly(edit((d) => {
      d.elements.p3 = { ...common, id: "p3", kind: "process", name: "", parentProcessId: "p0", ordinal: 3, processDescription: "" };
      d.views.occurrences.oP3 = { id: "oP3", diagramId: "level1", elementId: "p3", ...box };
    }), "checkProcessOccurrences");
  });
  test("a process shown twice", () => {
    expectOnly(edit((d) => { d.views.occurrences.oP2b = { id: "oP2b", diagramId: "level0", elementId: "p2", ...box }; }), "checkProcessOccurrences");
  });
  test("process 0 shown on the level 0 diagram as well", () => {
    expectOnly(edit((d) => { d.views.occurrences.oP0b = { id: "oP0b", diagramId: "level0", elementId: "p0", ...box }; }), "checkProcessOccurrences");
  });
  test("a process not shown at all", () => {
    expectOnly(edit((d) => { d.elements.p3 = { ...common, id: "p3", kind: "process", name: "", parentProcessId: "p0", ordinal: 3, processDescription: "" }; }), "checkProcessOccurrences");
  });
});

describe("invariant 7: one context diagram (SPEC.md section 3.4)", () => {
  test("two context diagrams", () => {
    expectOnly(edit((d) => { d.elements.ctx2 = { ...common, id: "ctx2", kind: "diagram", name: "", diagramKind: "context", decomposesProcessId: null }; }), "checkOneContextDiagram");
  });
  test("no context diagram", () => {
    const doc = edit((d) => { d.elements.ctx = { ...d.elements.ctx!, diagramKind: "dfd" } as never; });
    expect(checkOneContextDiagram(doc).length).toBe(1);
  });
});

describe("invariant 8: ordinals (SPEC.md section 3.4)", () => {
  test("two sibling processes with one ordinal", () => {
    expectOnly(edit((d) => { d.elements.p12 = { ...d.elements.p12!, ordinal: 1 } as never; }), "checkOrdinals");
  });
  test("the same ordinal under different parents is allowed", () => {
    expect(checkOrdinals(bakery())).toEqual([]);
  });
  test("two data stores with one ordinal", () => {
    expectOnly(edit((d) => { d.elements.pans = { ...common, id: "pans", kind: "dataStore", name: "Pans", ordinal: 1 }; }), "checkOrdinals");
  });
});

describe("views (SPEC.md section 3.5)", () => {
  test("an occurrence on something that is not a diagram", () => {
    expectOnly(edit((d) => { d.views.occurrences.oStray = { id: "oStray", diagramId: "p2", elementId: "customer", ...box }; }), "checkViews");
  });
  test("an occurrence of a data element", () => {
    expectOnly(edit((d) => { d.views.occurrences.oItem = { id: "oItem", diagramId: "level0", elementId: "item", ...box }; }), "checkViews");
  });
  test("a route that draws something that is not a flow", () => {
    expectOnly(edit((d) => { d.views.routes.rStray = { ...d.views.routes.rCtx!, id: "rStray", flowId: "order" }; }), "checkViews");
  });
  test("a route on another diagram than its flow", () => {
    expectOnly(edit((d) => { d.views.routes.rCtx!.diagramId = "level0"; d.views.routes.rCtx!.sourceOccurrenceId = "oCustomer0"; d.views.routes.rCtx!.targetOccurrenceId = null; }), "checkViews");
  });
  test("a flow with no route", () => {
    expectOnly(edit((d) => { delete d.views.routes.rFile; }), "checkViews");
  });
  test("a flow with two routes", () => {
    expectOnly(edit((d) => { d.views.routes.rFile2 = { ...d.views.routes.rFile!, id: "rFile2" }; }), "checkViews");
  });
  test("an off-diagram end with an occurrence", () => {
    expectOnly(edit((d) => { d.views.routes.rToBake!.targetOccurrenceId = "oP11"; }), "checkViews");
  });
  test("a control flow's route with a source occurrence", () => {
    expectOnly(edit((d) => { d.views.routes.rOpen!.sourceOccurrenceId = "oP12"; }), "checkViews");
  });
  test("an attached end with no occurrence", () => {
    expectOnly(edit((d) => { d.views.routes.rTake!.sourceOccurrenceId = null; }), "checkViews");
  });
  test("an end attached to an occurrence of another element", () => {
    expectOnly(edit((d) => { d.views.routes.rTake!.sourceOccurrenceId = "oP2"; }), "checkViews");
  });
  test("an end attached to an occurrence that does not exist", () => {
    expectOnly(edit((d) => { d.views.routes.rTake!.sourceOccurrenceId = "gone"; }), "checkViews");
  });
});

test("findViolations gathers every check's violations", () => {
  const doc = edit((d) => {
    d.settings.topDiagramId = "p0";
    delete d.views.routes.rFile;
  });
  expect(findViolations(doc).length).toBe(2);
});

import { describe, expect, test } from "vitest";
import { apply, type Command } from "../apply.ts";
import { emptyDocument, type ProjectDocument } from "../document.ts";
import { findViolations } from "../invariants.ts";
import { findCommand } from "../registry.ts";
import type { DataElement, DataStructure } from "../kinds/dictionary.ts";

function run(doc: ProjectDocument, command: Command): ProjectDocument {
  const result = apply(doc, command, "student");
  if (!result.ok) throw new Error(result.message);
  return result.doc;
}

function refusal(doc: ProjectDocument, command: Command): string {
  const result = apply(doc, command, "student");
  if (result.ok) throw new Error("expected a refusal");
  expect(result.message).toMatch(/^["A-Z].*\.$/);
  return result.message;
}

// A bike-repair shop with a project and a few definitions.
function shop(): ProjectDocument {
  let doc = run(emptyDocument(), {
    type: "createProject",
    args: { name: "Bike Repair", contextDiagramId: "ctx", processId: "p0", occurrenceId: "o-p0" },
  });
  doc = run(doc, { type: "defineData", args: { id: "repair-order", dataKind: "structure", name: "Repair Order" } });
  doc = run(doc, { type: "defineData", args: { id: "part", dataKind: "structure", name: "Part" } });
  doc = run(doc, { type: "defineData", args: { id: "order-date", dataKind: "element", name: "Order Date" } });
  return doc;
}

const once = (dataId: string) => ({ dataId, occurs: "once" as const, limit: null });

describe("defineData (SPEC.md sections 3.3 and 4.1)", () => {
  test("creates a data structure with no components", () => {
    const doc = shop();
    expect(doc.elements["repair-order"]).toEqual({
      kind: "dataStructure", id: "repair-order", name: "Repair Order", description: "", aliases: [],
      notes: "", origin: "student", components: [],
    });
    expect(findViolations(doc)).toEqual([]);
  });

  test("creates a data element with an empty type and no allowed values", () => {
    expect(shop().elements["order-date"]).toEqual({
      kind: "dataElement", id: "order-date", name: "Order Date", description: "", aliases: [],
      notes: "", origin: "student", dataType: "", allowedValues: [],
    });
  });

  test("takes origin from the caller (SPEC.md section 3.2)", () => {
    const result = apply(shop(), { type: "defineData", args: { id: "x", dataKind: "element", name: "X" } }, "ai");
    expect(result.ok && result.doc.elements.x?.origin).toBe("ai");
  });

  test("is refused when the id is already used", () => {
    const result = apply(shop(), { type: "defineData", args: { id: "part", dataKind: "element", name: "Part" } }, "student");
    expect(result).toMatchObject({ ok: false, code: "idInUse", ids: ["part"] });
  });

  test("is refused for an unknown data kind or an extra field", () => {
    const bad = { type: "defineData", args: { id: "x", dataKind: "table", name: "X" } };
    expect(apply(shop(), bad, "student")).toMatchObject({ ok: false, code: "invalid" });
    const extra = { type: "defineData", args: { id: "x", dataKind: "element", name: "X", origin: "ai" } };
    expect(apply(shop(), extra, "student")).toMatchObject({ ok: false, code: "invalid" });
  });
});

describe("setComposition (SPEC.md sections 3.3 and 4.1)", () => {
  test("replaces the component list, keeping order, occurs and limit", () => {
    let doc = shop();
    doc = run(doc, { type: "setComposition", args: { structureId: "repair-order", components: [once("order-date")] } });
    doc = run(doc, {
      type: "setComposition",
      args: {
        structureId: "repair-order",
        components: [
          { dataId: "part", occurs: "many", limit: 12 },
          { dataId: "order-date", occurs: "optional", limit: null },
        ],
      },
    });
    expect((doc.elements["repair-order"] as DataStructure).components).toEqual([
      { dataId: "part", occurs: "many", limit: 12 },
      { dataId: "order-date", occurs: "optional", limit: null },
    ]);
    expect(findViolations(doc)).toEqual([]);
  });

  test("an empty list clears the components", () => {
    let doc = run(shop(), { type: "setComposition", args: { structureId: "repair-order", components: [once("part")] } });
    doc = run(doc, { type: "setComposition", args: { structureId: "repair-order", components: [] } });
    expect((doc.elements["repair-order"] as DataStructure).components).toEqual([]);
  });

  test("a structure may contain itself, and a cycle between two is allowed", () => {
    let doc = run(shop(), { type: "setComposition", args: { structureId: "part", components: [once("part")] } });
    doc = run(doc, { type: "setComposition", args: { structureId: "repair-order", components: [once("part")] } });
    doc = run(doc, { type: "setComposition", args: { structureId: "part", components: [once("repair-order")] } });
    expect(findViolations(doc)).toEqual([]);
  });

  test("is refused when the structure is a data element, another kind, or unknown", () => {
    const doc = shop();
    expect(refusal(doc, { type: "setComposition", args: { structureId: "order-date", components: [] } }))
      .toContain("Order Date");
    expect(refusal(doc, { type: "setComposition", args: { structureId: "p0", components: [] } }))
      .toContain("not a data structure");
    expect(refusal(doc, { type: "setComposition", args: { structureId: "nothing", components: [] } }))
      .toContain("no data structure");
  });

  test("is refused when a component is not a data definition or does not exist", () => {
    const doc = shop();
    const msg = refusal(doc, { type: "setComposition", args: { structureId: "repair-order", components: [once("p0")] } });
    expect(msg).toContain("Bike Repair");
    refusal(doc, { type: "setComposition", args: { structureId: "repair-order", components: [once("nothing")] } });
  });

  test("is refused when a limit is given with an occurs other than many", () => {
    const doc = shop();
    for (const occurs of ["once", "optional"] as const) {
      const message = refusal(doc, {
        type: "setComposition",
        args: { structureId: "repair-order", components: [{ dataId: "part", occurs, limit: 3 }] },
      });
      expect(message).toContain("many");
    }
  });

  test("is refused when a limit is not a whole number of 1 or more", () => {
    const doc = shop();
    for (const limit of [0, -2, 1.5]) {
      const result = apply(doc, {
        type: "setComposition",
        args: { structureId: "repair-order", components: [{ dataId: "part", occurs: "many", limit }] },
      }, "student");
      expect(result.ok).toBe(false);
    }
  });

  test("the input document is not changed by a refusal or a success", () => {
    const doc = shop();
    const before = JSON.stringify(doc);
    apply(doc, { type: "setComposition", args: { structureId: "repair-order", components: [once("part")] } }, "student");
    refusal(doc, { type: "setComposition", args: { structureId: "order-date", components: [] } });
    expect(JSON.stringify(doc)).toBe(before);
  });
});

describe("setDataElement (SPEC.md section 3.3)", () => {
  test("sets the type and allowed values with their meanings", () => {
    const doc = run(shop(), {
      type: "setDataElement",
      args: {
        elementId: "order-date", dataType: "date",
        allowedValues: [{ value: "A", meaning: "Active" }, { value: "C", meaning: "Closed" }],
      },
    });
    expect(doc.elements["order-date"] as DataElement).toMatchObject({
      dataType: "date", allowedValues: [{ value: "A", meaning: "Active" }, { value: "C", meaning: "Closed" }],
    });
    expect(findViolations(doc)).toEqual([]);
  });

  test("is refused for a data structure, another kind, or an unknown id", () => {
    const doc = shop();
    const args = (elementId: string) => ({ elementId, dataType: "text", allowedValues: [] });
    expect(refusal(doc, { type: "setDataElement", args: args("repair-order") })).toContain("Repair Order");
    refusal(doc, { type: "setDataElement", args: args("p0") });
    refusal(doc, { type: "setDataElement", args: args("nothing") });
  });
});

describe("refusals name an unnamed data flow in plain words (SPEC.md sections 3.2 and 4.1)", () => {
  function withFlow(): ProjectDocument {
    const doc = shop();
    doc.elements.flow = {
      kind: "dataFlow", id: "flow", name: "", description: "", aliases: [], notes: "", origin: "student",
      diagramId: "ctx", sourceId: "p0", targetId: null, dataId: "repair-order",
    };
    return doc;
  }

  function expectPlain(message: string): void {
    expect(message).toMatch(/^[A-Z"]/);
    expect(message).toContain("data flow");
    expect(message).not.toContain("dataFlow");
  }

  test("setComposition with a data flow as the structure", () => {
    expectPlain(refusal(withFlow(), { type: "setComposition", args: { structureId: "flow", components: [] } }));
  });

  test("setComposition with a data flow as a component", () => {
    expectPlain(refusal(withFlow(), {
      type: "setComposition", args: { structureId: "repair-order", components: [once("flow")] },
    }));
  });
});

describe("the registry", () => {
  test("the three commands are registered with one-sentence descriptions", () => {
    for (const name of ["defineData", "setComposition", "setDataElement"]) {
      const definition = findCommand(name);
      expect(definition?.sentence).toMatch(/^[A-Z][^.]*\.$/);
    }
  });
});

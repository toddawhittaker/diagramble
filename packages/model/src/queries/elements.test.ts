import { describe, expect, test } from "vitest";
import { emptyDocument } from "../document.ts";
import { findQuery } from "../registry.ts";
import { elementQueries } from "./elements.ts";
import { sampleDocument } from "./sampleDocument.ts";

function query(name: string) {
  const definition = elementQueries.find((q) => q.name === name);
  if (!definition) throw new Error(`no query ${name}`);
  return definition;
}

describe("getModel (SPEC.md section 4.2)", () => {
  test("returns the whole document in its storage form, as a copy", () => {
    const doc = sampleDocument();
    const model = query("getModel").run(doc, query("getModel").args.parse({}));
    expect(model).toEqual(doc);
    (model as typeof doc).elements.p1 = (model as typeof doc).elements.p2!;
    expect(doc.elements.p1?.name).toBe("Take Repair Order");
  });

  test("takes no arguments", () => {
    expect(query("getModel").args.safeParse({ extra: 1 }).success).toBe(false);
  });
});

describe("getElement (SPEC.md section 4.2)", () => {
  const run = (id: string) => query("getElement").run(sampleDocument(), query("getElement").args.parse({ elementId: id }));

  test("returns an element with its occurrences on every diagram, sorted by id", () => {
    const doc = sampleDocument();
    expect(run("e-customer")).toEqual({
      element: doc.elements["e-customer"],
      occurrences: [doc.views.occurrences["o-cust-ctx"], doc.views.occurrences["o-cust-d0"]],
    });
  });

  test("returns an element that is shown nowhere with no occurrences", () => {
    expect(run("e-supplier")).toEqual({ element: sampleDocument().elements["e-supplier"], occurrences: [] });
  });

  test("returns a flow with no occurrences", () => {
    expect(run("f-order")).toMatchObject({ element: { kind: "dataFlow" }, occurrences: [] });
  });

  test("returns null for an unknown id, including one that names an object property", () => {
    expect(run("nobody")).toBeNull();
    expect(run("toString")).toBeNull();
  });

  test("requires an element id and refuses other arguments", () => {
    const { args } = query("getElement");
    expect(args.safeParse({}).success).toBe(false);
    expect(args.safeParse({ elementId: "p1", extra: 1 }).success).toBe(false);
  });
});

describe("whereUsed (SPEC.md section 4.2)", () => {
  const run = (id: string) => query("whereUsed").run(sampleDocument(), query("whereUsed").args.parse({ elementId: id }));

  test("lists a data store's diagrams, and the flows that end at it", () => {
    expect(run("st-log")).toEqual({ diagrams: ["d0", "d2"], flows: ["f-record", "f-reread"], structures: [] });
  });

  test("lists a process's diagram, its flows at either end and its control flows", () => {
    expect(run("p1")).toEqual({
      diagrams: ["d0"],
      flows: ["c-drop", "f-fault", "f-order", "f-pull", "f-record"],
      structures: [],
    });
  });

  test("lists an external entity on two diagrams", () => {
    expect(run("e-customer")).toEqual({ diagrams: ["ctx", "d0"], flows: ["f-ctx", "f-order"], structures: [] });
  });

  test("lists the flows that carry a data element and the structures that list it", () => {
    expect(run("de-owner")).toEqual({ diagrams: [], flows: ["f-loose"], structures: ["ds-request"] });
  });

  test("lists the structures that nest a structure, and the flows that carry it", () => {
    expect(run("ds-line")).toEqual({ diagrams: [], flows: [], structures: ["ds-record", "ds-request"] });
    expect(run("ds-record")).toEqual({ diagrams: [], flows: ["f-pull", "f-record", "f-reread"], structures: [] });
  });

  test("lists a decomposed process's child diagram with the diagram that shows it", () => {
    expect(run("p2")).toEqual({ diagrams: ["d0", "d2"], flows: ["f-loose"], structures: [] });
  });

  test("lists the data flows and control flows on a diagram", () => {
    expect(run("d0")).toEqual({ diagrams: [], flows: ["c-drop", "f-loose", "f-order", "f-record"], structures: [] });
    expect(run("d2")).toEqual({ diagrams: [], flows: ["f-fault", "f-pull", "f-reread"], structures: [] });
  });

  test("returns three empty lists for an element used nowhere", () => {
    expect(run("e-supplier")).toEqual({ diagrams: [], flows: [], structures: [] });
  });

  test("returns null for an unknown id", () => {
    expect(run("nobody")).toBeNull();
    expect(run("constructorX")).toBeNull();
  });

  test("names each id once when a structure lists a part twice", () => {
    const doc = sampleDocument();
    const record = doc.elements["ds-record"];
    if (record?.kind !== "dataStructure") throw new Error("fixture");
    record.components.push({ dataId: "de-status", occurs: "optional", limit: null });
    expect(query("whereUsed").run(doc, { elementId: "de-status" })).toEqual({
      diagrams: [], flows: [], structures: ["ds-record"],
    });
  });
});

describe("the registry (SPEC.md section 7 item 2)", () => {
  test("offers each query by name, with a one-sentence description", () => {
    for (const name of ["getModel", "getElement", "whereUsed"]) {
      const found = findQuery(name);
      expect(found?.kind).toBe("query");
      expect(found?.sentence).toMatch(/^[A-Z][^.]*\.$/);
    }
  });

  test("getModel returns an empty document unchanged", () => {
    expect(query("getModel").run(emptyDocument(), {})).toEqual(emptyDocument());
  });
});

import { describe, expect, test } from "vitest";
import { emptyDocument, type ProjectDocument } from "../document.ts";
import { findQuery } from "../registry.ts";
import { dataElementsOf, dictionaryQueries } from "./dictionary.ts";

const common = { description: "", aliases: [], notes: "", origin: "student" as const };

type Part = [id: string, occurs?: "once" | "optional" | "many", limit?: number | null];

// A bakery's dictionary: elements, and structures built from the parts given.
function bakery(structures: Record<string, Part[]>, elements: string[]): ProjectDocument {
  const doc = emptyDocument();
  for (const id of elements) {
    doc.elements[id] = { ...common, id, kind: "dataElement", name: id, dataType: "text", allowedValues: [] };
  }
  for (const [id, parts] of Object.entries(structures)) {
    doc.elements[id] = {
      ...common, id, kind: "dataStructure", name: id,
      components: parts.map(([dataId, occurs = "once", limit = null]) => ({ dataId, occurs, limit })),
    };
  }
  return doc;
}

describe("dataElementsOf (SPEC.md section 4.2)", () => {
  test("a data element expands to itself", () => {
    expect(dataElementsOf(bakery({}, ["flour"]), "flour")).toEqual(["flour"]);
  });

  test("nested optional and many parts expand to their elements, in first-seen order", () => {
    const doc = bakery(
      {
        order: [["customer-name"], ["line", "many", 20], ["note", "optional"]],
        line: [["loaf"], ["quantity"]],
        note: [["text"]],
      },
      ["customer-name", "loaf", "quantity", "text"],
    );
    expect(dataElementsOf(doc, "order")).toEqual(["customer-name", "loaf", "quantity", "text"]);
  });

  test("each element appears once, even when two parts share it", () => {
    const doc = bakery(
      { order: [["a"], ["inner"], ["a"]], inner: [["b"], ["a"]] },
      ["a", "b"],
    );
    expect(dataElementsOf(doc, "order")).toEqual(["a", "b"]);
  });

  test("a cycle between two structures expands without looping", () => {
    const doc = bakery(
      { a: [["x"], ["b"]], b: [["y"], ["a"]] },
      ["x", "y"],
    );
    expect(dataElementsOf(doc, "a")).toEqual(["x", "y"]);
    expect(dataElementsOf(doc, "b")).toEqual(["y", "x"]);
  });

  test("a structure that contains itself expands without looping", () => {
    const doc = bakery({ a: [["a"], ["x"]] }, ["x"]);
    expect(dataElementsOf(doc, "a")).toEqual(["x"]);
  });

  test("an empty structure, a missing component, and an unknown or other-kind id give nothing", () => {
    const doc = bakery({ empty: [], broken: [["gone"], ["x"]] }, ["x"]);
    expect(dataElementsOf(doc, "empty")).toEqual([]);
    expect(dataElementsOf(doc, "broken")).toEqual(["x"]);
    expect(dataElementsOf(doc, "nothing")).toEqual([]);
    doc.elements.shop = { ...common, id: "shop", kind: "externalEntity", name: "Shop" };
    expect(dataElementsOf(doc, "shop")).toEqual([]);
  });

  test("does not change the document", () => {
    const doc = bakery({ a: [["x"]] }, ["x"]);
    const before = JSON.stringify(doc);
    dataElementsOf(doc, "a");
    expect(JSON.stringify(doc)).toBe(before);
  });
});

describe("expandData (SPEC.md section 4.2)", () => {
  const doc = bakery({ a: [["x"], ["b", "many", null]], b: [["y"]] }, ["x", "y"]);
  const [expandData] = dictionaryQueries;

  test("returns the ids of the data elements the definition is composed of", () => {
    expect(expandData?.name).toBe("expandData");
    expect(expandData?.kind).toBe("query");
    expect(expandData?.run(doc, { dataId: "a" })).toEqual(["x", "y"]);
  });

  test("takes only a dataId and is registered", () => {
    expect(expandData?.args.safeParse({ dataId: "a" }).success).toBe(true);
    expect(expandData?.args.safeParse({ dataId: "a", extra: 1 }).success).toBe(false);
    expect(findQuery("expandData")).toBe(expandData);
  });
});

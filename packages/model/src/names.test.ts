import { describe, expect, test } from "vitest";
import type { Element } from "./document.ts";
import { Called, called, compareText, KIND_WORDS } from "./names.ts";

const common = { description: "", aliases: [], notes: "", origin: "student" as const };

describe("naming an element for a student (SPEC.md sections 3.2 and 4.1)", () => {
  test("every element kind has plain words with no capitals", () => {
    expect(KIND_WORDS).toEqual({
      process: "process",
      externalEntity: "external entity",
      dataStore: "data store",
      dataFlow: "data flow",
      controlFlow: "control flow",
      dataStructure: "data structure",
      dataElement: "data element",
      diagram: "diagram",
    });
  });

  test("a named element is its name in double quotes", () => {
    const entity: Element = { ...common, id: "c", kind: "externalEntity", name: "Customer" };
    expect(called(entity)).toBe('"Customer"');
    expect(Called(entity)).toBe('"Customer"');
  });

  test("an unnamed element is named by its kind, capitalised at the start of a sentence", () => {
    const flow: Element = {
      ...common, id: "f", kind: "dataFlow", name: "", diagramId: "d", sourceId: null, targetId: null, dataId: "x",
    };
    expect(called(flow)).toBe("the unnamed data flow");
    expect(Called(flow)).toBe("The unnamed data flow");
  });
});

describe("compareText (SPEC.md section 4.2)", () => {
  test("orders strings by code unit, not by locale, and treats equal strings as tied", () => {
    expect(compareText("a", "b")).toBe(-1);
    expect(compareText("b", "a")).toBe(1);
    expect(compareText("a", "a")).toBe(0);
    expect(compareText("Z", "a")).toBe(-1);
    expect(compareText("a", "ab")).toBe(-1);
  });
});

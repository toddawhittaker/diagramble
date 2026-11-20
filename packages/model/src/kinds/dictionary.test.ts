import { expect, test } from "vitest";
import { DataElement, DataStructure } from "./dictionary.ts";

const common = { description: "", aliases: [], notes: "", origin: "student" };

test("a structure's components are dataId, occurs and limit", () => {
  const s = { ...common, id: "loan", name: "Loan", kind: "dataStructure", components: [{ dataId: "due", occurs: "many", limit: 12 }, { dataId: "note", occurs: "optional", limit: null }] };
  expect(DataStructure.safeParse(s).success).toBe(true);
  expect(DataStructure.safeParse({ ...s, components: [{ dataId: "due", occurs: "many" }] }).success).toBe(false);
  expect(DataStructure.safeParse({ ...s, components: [{ dataId: "due", occurs: "twice", limit: null }] }).success).toBe(false);
});

test("a data element has a type and allowed values with meanings", () => {
  const e = { ...common, id: "status", name: "Status", kind: "dataElement", dataType: "text", allowedValues: [{ value: "L", meaning: "On loan" }] };
  expect(DataElement.safeParse(e).success).toBe(true);
  expect(DataElement.safeParse({ ...e, allowedValues: [{ value: "L" }] }).success).toBe(false);
});

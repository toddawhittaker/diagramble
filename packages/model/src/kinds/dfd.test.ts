import { expect, test } from "vitest";
import { ControlFlow, DataFlow, DataStore, ExternalEntity, Process } from "./dfd.ts";

const common = { name: "Member", description: "", aliases: [], notes: "", origin: "student" };

test("each DFD kind accepts a complete record", () => {
  expect(Process.parse({ ...common, id: "p0", kind: "process", parentProcessId: null, ordinal: 0, processDescription: "" })).toBeTruthy();
  expect(ExternalEntity.parse({ ...common, id: "ee1", kind: "externalEntity" })).toBeTruthy();
  expect(DataStore.parse({ ...common, id: "ds1", kind: "dataStore", ordinal: 1 })).toBeTruthy();
  expect(DataFlow.parse({ ...common, name: "", id: "f1", kind: "dataFlow", diagramId: "ctx", sourceId: null, targetId: "p0", dataId: null })).toBeTruthy();
  expect(ControlFlow.parse({ ...common, id: "cf1", kind: "controlFlow", diagramId: "ctx", targetId: "p0" })).toBeTruthy();
});

test("a data store's ordinal is a whole number of 1 or more", () => {
  for (const ordinal of [0, 1.5, -1]) {
    expect(DataStore.safeParse({ ...common, id: "ds1", kind: "dataStore", ordinal }).success).toBe(false);
  }
});

test("an unknown field, a missing field and a bad id are refused", () => {
  const ee = { ...common, id: "ee1", kind: "externalEntity" };
  expect(ExternalEntity.safeParse({ ...ee, colour: "red" }).success).toBe(false);
  const { notes: _, ...missing } = ee;
  expect(ExternalEntity.safeParse(missing).success).toBe(false);
  expect(ExternalEntity.safeParse({ ...ee, id: "bad id" }).success).toBe(false);
});

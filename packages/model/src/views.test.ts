import { expect, test } from "vitest";
import { Occurrence, Route } from "./views.ts";

test("an occurrence and a route accept complete records and refuse extras", () => {
  const o = { id: "o1", diagramId: "ctx", elementId: "ee1", x: 0, y: 0, width: 120, height: 60 };
  expect(Occurrence.safeParse(o).success).toBe(true);
  expect(Occurrence.safeParse({ ...o, z: 1 }).success).toBe(false);
  for (const size of [{ width: 0 }, { width: -1 }, { height: 0 }, { height: -1 }]) {
    expect(Occurrence.safeParse({ ...o, ...size }).success).toBe(false);
  }
  const r = { id: "r1", flowId: "f1", diagramId: "ctx", sourceOccurrenceId: null, targetOccurrenceId: "o1", points: [{ x: 1, y: 2 }] };
  expect(Route.safeParse(r).success).toBe(true);
  expect(Route.safeParse({ ...r, points: [{ x: 1 }] }).success).toBe(false);
});

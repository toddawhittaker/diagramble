import { expect, test } from "vitest";
import { Diagram } from "./diagram.ts";

test("a diagram is context or dfd", () => {
  const d = { id: "ctx", kind: "diagram", name: "Context", description: "", aliases: [], notes: "", origin: "student", diagramKind: "context", decomposesProcessId: null };
  expect(Diagram.safeParse(d).success).toBe(true);
  expect(Diagram.safeParse({ ...d, diagramKind: "erd" }).success).toBe(false);
});

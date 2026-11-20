import { expect, test } from "vitest";
import { Origin } from "./common.ts";

test("origin is student, starter or ai", () => {
  for (const o of ["student", "starter", "ai"]) expect(Origin.safeParse(o).success).toBe(true);
  expect(Origin.safeParse("teacher").success).toBe(false);
});

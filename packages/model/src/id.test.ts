import { expect, test } from "vitest";
import { Id } from "./id.ts";

test("accepts readable ids of letters, digits, underscores and hyphens", () => {
  for (const id of ["p0", "ee-member", "D_1", "a".repeat(64)]) expect(Id.safeParse(id).success).toBe(true);
});

test("refuses empty, too long, odd characters and reserved names", () => {
  for (const id of ["", "a".repeat(65), "a/b", "a~b", "a b", "é", "__proto__", "constructor", "prototype"]) {
    expect(Id.safeParse(id).success, id).toBe(false);
  }
});

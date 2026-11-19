import { expect, test } from "vitest";
import { packageName } from "./index.ts";

test("the package exports its own name", () => {
  expect(packageName).toBe("@diagramble/model");
});

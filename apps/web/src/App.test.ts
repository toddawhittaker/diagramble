import { expect, test } from "vitest";
import { App } from "./App.tsx";

test("App is a component function", () => {
  expect(typeof App).toBe("function");
});

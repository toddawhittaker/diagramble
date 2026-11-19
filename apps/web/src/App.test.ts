import { expect, test } from "vitest";
import { App } from "./App.tsx";

test("App renders a main landmark", () => {
  const element = App();
  expect(element.type).toBe("main");
});

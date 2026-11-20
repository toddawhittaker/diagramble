import { expect, test } from "vitest";
import { emptyDocument, ProjectDocument } from "./index.ts";

test("the package exports the document schema and the empty document", () => {
  expect(ProjectDocument.parse(emptyDocument()).schemaVersion).toBe(1);
});

test("the package exports apply, the session, the registry, the patch and the checks", async () => {
  const api = await import("./index.ts");
  for (const name of [
    "apply", "startSession", "applyInSession", "replay",
    "findCommand", "findQuery", "toolDefinitions", "diff", "applyPatch", "escapePointerToken",
    "findViolations", "processNumber", "storeLabel", "diagramShowing", "childDiagram", "ancestors",
    "occurrencesOn", "isShownOn", "flowsTouching", "diagrams", "isOffDiagramProcess", "isEmpty",
    "elementById", "occurrenceById", "routeById",
  ]) expect(typeof (api as Record<string, unknown>)[name], name).toBe("function");
  expect(Array.isArray(api.commandDefinitions) && Array.isArray(api.queryDefinitions)).toBe(true);
});

import { expect, test } from "vitest";
import { emptyDocument, ProjectDocument } from "./index.ts";

test("the package exports the document schema and the empty document", () => {
  expect(ProjectDocument.parse(emptyDocument()).schemaVersion).toBe(1);
});

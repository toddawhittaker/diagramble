import { expect, test } from "vitest";
import committed from "../schema/project-v1.schema.json" with { type: "json" };
import { emptyDocument, ProjectDocument, projectJsonSchema } from "./document.ts";

const common = { description: "", aliases: [], notes: "", origin: "student" };

function lendingLibrary() {
  return {
    schemaVersion: 1,
    settings: { name: "Lending Library", topDiagramId: "ctx", showFindings: "always", caseText: "" },
    elements: {
      ctx: { ...common, id: "ctx", kind: "diagram", name: "Context", diagramKind: "context", decomposesProcessId: null },
      p0: { ...common, id: "p0", kind: "process", name: "Library System", parentProcessId: null, ordinal: 0, processDescription: "" },
      member: { ...common, id: "member", kind: "externalEntity", name: "Member" },
      shelf: { ...common, id: "shelf", kind: "dataStore", name: "Shelf", ordinal: 1 },
      loanRequest: { ...common, id: "loanRequest", kind: "dataElement", name: "Loan Request", dataType: "text", allowedValues: [] },
      f1: { ...common, id: "f1", kind: "dataFlow", name: "", diagramId: "ctx", sourceId: "member", targetId: "p0", dataId: "loanRequest" },
    },
    views: {
      occurrences: {
        oMember: { id: "oMember", diagramId: "ctx", elementId: "member", x: 10, y: 10, width: 100, height: 50 },
        oP0: { id: "oP0", diagramId: "ctx", elementId: "p0", x: 200, y: 10, width: 120, height: 80 },
      },
      routes: { r1: { id: "r1", flowId: "f1", diagramId: "ctx", sourceOccurrenceId: "oMember", targetOccurrenceId: "oP0", points: [] } },
    },
  };
}

test("a hand-built valid document parses", () => {
  expect(ProjectDocument.safeParse(lendingLibrary()).success).toBe(true);
});

test("the empty document parses", () => {
  expect(ProjectDocument.safeParse(emptyDocument()).success).toBe(true);
});

test("an unknown field is refused at every level", () => {
  const top = { ...lendingLibrary(), extra: 1 };
  expect(ProjectDocument.safeParse(top).success).toBe(false);
  const deep = lendingLibrary();
  Object.assign(deep.elements.member, { colour: "red" });
  expect(ProjectDocument.safeParse(deep).success).toBe(false);
  const settings = lendingLibrary();
  Object.assign(settings.settings, { theme: "dark" });
  expect(ProjectDocument.safeParse(settings).success).toBe(false);
});

test("a missing field is refused", () => {
  const doc = lendingLibrary();
  const { dataId: _, ...flow } = doc.elements.f1;
  expect(ProjectDocument.safeParse({ ...doc, elements: { ...doc.elements, f1: flow } }).success).toBe(false);
});

test("a bad id is refused, as a field and as a map key", () => {
  const field = lendingLibrary();
  field.elements.f1.sourceId = "no spaces";
  expect(ProjectDocument.safeParse(field).success).toBe(false);
  const key = lendingLibrary();
  expect(ProjectDocument.safeParse({ ...key, elements: { ...key.elements, __proto__x: key.elements.member, "a/b": key.elements.member } }).success).toBe(false);
});

test("an unknown kind and a wrong schema version are refused", () => {
  const doc = lendingLibrary();
  expect(ProjectDocument.safeParse({ ...doc, schemaVersion: 2 }).success).toBe(false);
  expect(ProjectDocument.safeParse({ ...doc, elements: { x: { ...doc.elements.member, kind: "entity" } } }).success).toBe(false);
});

test("the committed JSON Schema matches the Zod schema", () => {
  expect(committed).toEqual(projectJsonSchema());
});

test("the JSON Schema says map keys must equal ids", () => {
  expect((projectJsonSchema() as { description: string }).description).toMatch(/map key must equal its record's id/);
});

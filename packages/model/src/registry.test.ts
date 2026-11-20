import { describe, expect, test } from "vitest";
import { commandDefinitions, findCommand, findQuery, queryDefinitions, toolDefinitions } from "./registry.ts";

const all = [...commandDefinitions, ...queryDefinitions];

describe("the registry (SPEC.md section 7 items 1 and 2)", () => {
  test("every name is unique across commands and queries", () => {
    const names = all.map((d) => d.name);
    expect(new Set(names).size).toBe(names.length);
  });

  test("every sentence is one non-empty sentence", () => {
    for (const d of all) expect(d.sentence, d.name).toMatch(/^[A-Z][^.!?]*\.$/);
  });

  test("each definition has the kind of its list", () => {
    expect(commandDefinitions.every((d) => d.kind === "command")).toBe(true);
    expect(queryDefinitions.every((d) => d.kind === "query")).toBe(true);
  });

  test("looks definitions up by name", () => {
    expect(findCommand("createProject")?.name).toBe("createProject");
    expect(findCommand("noSuchCommand")).toBeUndefined();
    expect(findQuery("noSuchQuery")).toBeUndefined();
  });

  test("gives one AI tool per definition with its sentence and a JSON Schema of its arguments", () => {
    const tools = toolDefinitions();
    expect(tools.map((t) => t.name)).toEqual(all.map((d) => d.name));
    const create = tools.find((t) => t.name === "createProject");
    expect(create?.description).toBe(findCommand("createProject")?.sentence);
    expect(create?.inputSchema).toMatchObject({
      type: "object",
      additionalProperties: false,
      required: ["name", "contextDiagramId", "processId", "occurrenceId"],
      properties: { name: { type: "string", description: expect.any(String) } },
    });
  });
});

import { describe, expect, test } from "vitest";
import { apply } from "../apply.ts";
import { emptyDocument } from "../document.ts";

// An id such as toString passes the Id schema (SPEC.md section 3.1), so a lookup must
// treat it as unknown rather than find a function on Object.prototype.

function project() {
  const result = apply(
    emptyDocument(),
    { type: "createProject", args: { name: "Bike", contextDiagramId: "ctx", processId: "p0", occurrenceId: "o0" } },
    "student",
  );
  if (!result.ok) throw new Error(result.message);
  return result.doc;
}

const ids = ["toString", "hasOwnProperty"];
const commands = (id: string) => [
  { type: "rename", args: { elementId: id, name: "x" } },
  { type: "describe", args: { elementId: id, description: "x" } },
  { type: "setComposition", args: { structureId: id, components: [] } },
  { type: "deleteElement", args: { elementId: id } },
  { type: "removeOccurrence", args: { occurrenceId: id } },
  { type: "moveOccurrence", args: { occurrenceId: id, x: 1, y: 1, width: 2, height: 2 } },
  { type: "setRoute", args: { routeId: id, points: [] } },
];

describe("a caller-given id that names an Object.prototype member is unknown (SPEC.md section 3.1)", () => {
  for (const id of ids) {
    for (const command of commands(id)) {
      test(`${command.type} with ${id} is refused`, () => {
        const before = Object.getOwnPropertyNames(Object.prototype).sort();
        const toString = Object.prototype.toString;
        const result = apply(project(), command, "student");
        expect(result).toMatchObject({ ok: false, code: "refused" });
        expect(Object.getOwnPropertyNames(Object.prototype).sort()).toEqual(before);
        expect(Object.prototype.toString).toBe(toString);
        expect(Object.keys(Object.prototype.toString)).toEqual([]);
        expect(Object.keys(Object.prototype.hasOwnProperty)).toEqual([]);
      });
    }
  }
});

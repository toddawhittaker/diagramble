import { describe, expect, test } from "vitest";
import { emptyDocument } from "./document.ts";
import { applyInSession, replay, startSession, type LogEntry, type Session } from "./session.ts";

const create = {
  type: "createProject",
  args: { name: "Bike Rental", contextDiagramId: "ctx", processId: "p0", occurrenceId: "o-p0" },
};

function ok(result: ReturnType<typeof applyInSession>): { session: Session; entry: LogEntry } {
  if (!result.ok) throw new Error(result.message);
  return result;
}

describe("undo and redo within a session (SPEC.md sections 3.6 and 3.9)", () => {
  test("an accepted command is logged with its patch and inverse", () => {
    const { session, entry } = ok(applyInSession(startSession(emptyDocument()), create, "ai"));
    expect(entry.command).toEqual(create);
    expect(entry.origin).toBe("ai");
    expect(session.undo).toEqual([entry]);
    expect(session.redo).toEqual([]);
  });

  test("a refused command leaves the session alone and is not logged", () => {
    const start = startSession(emptyDocument());
    const result = applyInSession(start, { type: "createProject", args: {} }, "student");
    expect(result).toMatchObject({ ok: false, code: "invalid" });
    expect(start.undo).toEqual([]);
  });

  test("undo returns the earlier document and is logged with the patch it applied", () => {
    const empty = emptyDocument();
    const made = ok(applyInSession(startSession(empty), create, "student"));
    const undone = ok(applyInSession(made.session, { type: "undo" }, "student"));
    expect(undone.session.doc).toEqual(empty);
    expect(undone.entry).toEqual({
      command: { type: "undo" }, origin: "student", patch: made.entry.inverse, inverse: made.entry.patch,
    });
    expect(undone.session.undo).toEqual([]);
    expect(undone.session.redo).toEqual([made.entry]);
  });

  test("undo then redo returns the same document", () => {
    const made = ok(applyInSession(startSession(emptyDocument()), create, "student"));
    const undone = ok(applyInSession(made.session, { type: "undo" }, "student"));
    const redone = ok(applyInSession(undone.session, { type: "redo" }, "student"));
    expect(redone.session.doc).toEqual(made.session.doc);
    expect(redone.entry).toEqual({
      command: { type: "redo" }, origin: "student", patch: made.entry.patch, inverse: made.entry.inverse,
    });
    expect(redone.session.undo).toEqual([made.entry]);
    expect(redone.session.redo).toEqual([]);
  });

  test("a new command clears redo", () => {
    const made = ok(applyInSession(startSession(emptyDocument()), create, "student"));
    const undone = ok(applyInSession(made.session, { type: "undo" }, "student"));
    const again = ok(applyInSession(undone.session, create, "student"));
    expect(again.session.redo).toEqual([]);
    expect(applyInSession(again.session, { type: "redo" }, "student")).toMatchObject({ ok: false, code: "refused" });
  });

  test("with nothing to undo or redo, each is refused with a plain sentence", () => {
    const start = startSession(emptyDocument());
    expect(applyInSession(start, { type: "undo" }, "student")).toEqual({
      ok: false, code: "refused", message: expect.stringMatching(/^[A-Z].*\.$/),
    });
    expect(applyInSession(start, { type: "redo" }, "student")).toEqual({
      ok: false, code: "refused", message: expect.stringMatching(/^[A-Z].*\.$/),
    });
  });

  test("an undo whose patch no longer applies is refused", () => {
    const made = ok(applyInSession(startSession(emptyDocument()), create, "student"));
    const broken = { ...made.session, doc: emptyDocument() };
    expect(applyInSession(broken, { type: "undo" }, "student")).toMatchObject({ ok: false, code: "refused" });
  });
});

describe("replay (SPEC.md section 3.6)", () => {
  test("rebuilds the document from the log's patches, undo entries included", () => {
    const empty = emptyDocument();
    const entries: LogEntry[] = [];
    let session = startSession(empty);
    for (const command of [create, { type: "undo" }, { type: "redo" }]) {
      const step = ok(applyInSession(session, command, "student"));
      entries.push(step.entry);
      session = step.session;
    }
    expect(replay(empty, entries)).toEqual({ ok: true, doc: session.doc });
  });

  test("fails cleanly, naming the entry, when a patch does not apply", () => {
    const made = ok(applyInSession(startSession(emptyDocument()), create, "student"));
    const result = replay(emptyDocument(), [{ ...made.entry, patch: made.entry.inverse }]);
    expect(result).toMatchObject({ ok: false, index: 0, message: expect.stringMatching(/^Entry 1 /) });
  });
});

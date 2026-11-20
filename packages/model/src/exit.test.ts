// The model's exit tests: one realistic project is built only through commands, then the
// guarantees of docs/SPEC.md sections 3.1, 3.4, 3.5, 3.6, 3.9 and 4.1 are checked on it.
import { describe, expect, test } from "vitest";
import { apply, type Command } from "./apply.ts";
import { storeLabel, processNumber } from "./derive.ts";
import { emptyDocument, type ProjectDocument } from "./document.ts";
import { findViolations } from "./invariants.ts";
import { toolDefinitions } from "./registry.ts";
import {
  applyInSession, replay, startSession,
  type LogEntry, type Session,
} from "./session.ts";

const box = (x: number, y: number) => ({ x, y, width: 120, height: 80 });

const projectCommands: Command[] = [
  // The context diagram, with two outside parties and the data that crosses its edge.
  { type: "createProject", args: { name: "Wheelhouse Bike Repair", contextDiagramId: "d-ctx", processId: "p0", occurrenceId: "o-p0" } },
  { type: "addExternalEntity", args: { id: "ee-customer", occurrenceId: "o-customer-ctx", diagramId: "d-ctx", name: "Customer", ...box(0, 0) } },
  { type: "addExternalEntity", args: { id: "ee-supplier", occurrenceId: "o-supplier-ctx", diagramId: "d-ctx", name: "Parts Supplier", ...box(400, 0) } },
  { type: "defineData", args: { id: "ds-invoice", dataKind: "structure", name: "Invoice" } },
  { type: "defineData", args: { id: "ds-part-order", dataKind: "structure", name: "Parts Order" } },
  { type: "addFlow", args: { id: "f-ctx-request", routeId: "r-ctx-request", diagramId: "d-ctx", sourceId: "ee-customer", targetId: "p0", dataId: "ds-request", newDataName: "Repair Request" } },
  { type: "addFlow", args: { id: "f-ctx-invoice", routeId: "r-ctx-invoice", diagramId: "d-ctx", sourceId: "p0", targetId: "ee-customer", dataId: "ds-invoice" } },
  { type: "addFlow", args: { id: "f-ctx-parts", routeId: "r-ctx-parts", diagramId: "d-ctx", sourceId: "p0", targetId: "ee-supplier", dataId: "ds-part-order" } },

  // Level 0: the three flows come down with their inner ends unattached.
  { type: "expandProcess", args: {
    processId: "p0", diagramId: "d-l0",
    flowIds: {
      "f-ctx-request": { flowId: "f-l0-request", routeId: "r-l0-request" },
      "f-ctx-invoice": { flowId: "f-l0-invoice", routeId: "r-l0-invoice" },
      "f-ctx-parts": { flowId: "f-l0-parts", routeId: "r-l0-parts" },
    },
    occurrenceIds: { "ee-customer": "o-customer-l0", "ee-supplier": "o-supplier-l0" },
  } },
  { type: "addProcess", args: { id: "p1", occurrenceId: "o-p1", diagramId: "d-l0", name: "Take In Bike", ...box(150, 0) } },
  { type: "addProcess", args: { id: "p2", occurrenceId: "o-p2", diagramId: "d-l0", name: "Repair Bike", ...box(150, 200) } },
  { type: "addProcess", args: { id: "p3", occurrenceId: "o-p3", diagramId: "d-l0", name: "Bill Customer", ...box(150, 400) } },
  { type: "addDataStore", args: { id: "st-jobs", occurrenceId: "o-jobs-l0", diagramId: "d-l0", name: "Job Tickets", ...box(350, 0) } },
  { type: "addDataStore", args: { id: "st-parts", occurrenceId: "o-parts-l0", diagramId: "d-l0", name: "Parts Stock", ...box(350, 200) } },
  { type: "placeExisting", args: { occurrenceId: "o-parts-l0-b", elementId: "st-parts", diagramId: "d-l0", ...box(350, 300) } },

  // The data dictionary.
  { type: "defineData", args: { id: "el-owner-name", dataKind: "element", name: "Owner Name" } },
  { type: "defineData", args: { id: "el-bike-model", dataKind: "element", name: "Bike Model" } },
  { type: "defineData", args: { id: "el-problem-text", dataKind: "element", name: "Problem Text" } },
  { type: "defineData", args: { id: "el-promised-date", dataKind: "element", name: "Promised Date" } },
  { type: "defineData", args: { id: "el-priority", dataKind: "element", name: "Priority" } },
  { type: "defineData", args: { id: "el-part-number", dataKind: "element", name: "Part Number" } },
  { type: "setDataElement", args: { elementId: "el-bike-model", dataType: "text", allowedValues: [] } },
  { type: "setDataElement", args: { elementId: "el-promised-date", dataType: "date", allowedValues: [] } },
  { type: "setDataElement", args: { elementId: "el-priority", dataType: "text", allowedValues: [{ value: "R", meaning: "Rush job" }, { value: "S", meaning: "Standard job" }] } },
  { type: "setComposition", args: { structureId: "ds-request", components: [
    { dataId: "el-owner-name", occurs: "once", limit: null },
    { dataId: "el-bike-model", occurs: "once", limit: null },
    { dataId: "el-problem-text", occurs: "many", limit: 5 },
  ] } },

  // Flows on level 0, one of them making a new structure, and a control flow.
  { type: "reconnectFlow", args: { flowId: "f-l0-request", end: "target", elementId: "p1" } },
  { type: "reconnectFlow", args: { flowId: "f-l0-invoice", end: "source", elementId: "p3" } },
  { type: "reconnectFlow", args: { flowId: "f-l0-parts", end: "source", elementId: "p2" } },
  { type: "addFlow", args: { id: "f-intake-job", routeId: "r-intake-job", diagramId: "d-l0", sourceId: "p1", targetId: "st-jobs", dataId: "ds-job", newDataName: "Job Ticket" } },
  { type: "setComposition", args: { structureId: "ds-job", components: [
    { dataId: "ds-request", occurs: "once", limit: null },
    { dataId: "el-promised-date", occurs: "optional", limit: null },
    { dataId: "el-priority", occurs: "once", limit: null },
  ] } },
  { type: "addFlow", args: { id: "f-job-repair", routeId: "r-job-repair", diagramId: "d-l0", sourceId: "st-jobs", targetId: "p2", dataId: "ds-job" } },
  { type: "addFlow", args: { id: "f-part-used", routeId: "r-part-used", diagramId: "d-l0", sourceId: "p2", targetId: "st-parts", targetOccurrenceId: "o-parts-l0-b", dataId: "ds-part-order" } },
  { type: "addFlow", args: { id: "f-part-pull", routeId: "r-part-pull", diagramId: "d-l0", sourceId: "st-parts", sourceOccurrenceId: "o-parts-l0", targetId: "p2", dataId: "ds-part-order" } },
  { type: "setFlowData", args: { flowId: "f-part-pull", dataId: "el-part-number" } },
  { type: "addFlow", args: { id: "f-repair-bill", routeId: "r-repair-bill", diagramId: "d-l0", sourceId: "p2", targetId: "p3", dataId: "ds-repair-record", newDataName: "Repair Record" } },
  { type: "addControlFlow", args: { id: "c-repair-done", routeId: "r-c-repair-done", diagramId: "d-l0", targetId: "p3", name: "Repair finished" } },

  // Level 1: process 1 is expanded; a store and an off-diagram process meet its diagram.
  { type: "expandProcess", args: {
    processId: "p1", diagramId: "d-l1",
    flowIds: {
      "f-l0-request": { flowId: "f-l1-request", routeId: "r-l1-request" },
      "f-intake-job": { flowId: "f-l1-job", routeId: "r-l1-job" },
    },
    occurrenceIds: { "ee-customer": "o-customer-l1", "st-jobs": "o-jobs-l1" },
  } },
  { type: "addProcess", args: { id: "p11", occurrenceId: "o-p11", diagramId: "d-l1", name: "Log Bike", ...box(150, 0) } },
  { type: "addProcess", args: { id: "p12", occurrenceId: "o-p12", diagramId: "d-l1", name: "Inspect Bike", ...box(150, 200) } },
  { type: "placeExisting", args: { occurrenceId: "o-parts-l1", elementId: "st-parts", diagramId: "d-l1", ...box(350, 200) } },
  { type: "reconnectFlow", args: { flowId: "f-l1-request", end: "target", elementId: "p11" } },
  { type: "reconnectFlow", args: { flowId: "f-l1-job", end: "source", elementId: "p12" } },
  { type: "addFlow", args: { id: "f-l1-log", routeId: "r-l1-log", diagramId: "d-l1", sourceId: "p11", targetId: "p12", dataId: "ds-request" } },
  { type: "addFlow", args: { id: "f-l1-pull", routeId: "r-l1-pull", diagramId: "d-l1", sourceId: "st-parts", targetId: "p12", dataId: "el-part-number" } },
  { type: "addFlow", args: { id: "f-l1-handoff", routeId: "r-l1-handoff", diagramId: "d-l1", sourceId: "p12", targetId: "p2", dataId: "ds-job" } },

  // Layout, text and a deletion.
  { type: "moveOccurrence", args: { occurrenceId: "o-p1", x: 160, y: 10, width: 140, height: 90 } },
  { type: "setRoute", args: { routeId: "r-l0-request", points: [{ x: 60, y: 40 }, { x: 60, y: 80 }] } },
  { type: "describe", args: { elementId: "ee-customer", description: "A person who brings a bike in for repair." } },
  { type: "setAliases", args: { elementId: "st-jobs", aliases: ["Work orders"] } },
  { type: "setNotes", args: { elementId: "p2", notes: "Ask the shop which repairs need a second mechanic." } },
  { type: "setProcessDescription", args: { processId: "p2", text: "Find the fault, fit parts, and test ride the bike." } },
  { type: "setProcessNumber", args: { processId: "p3", ordinal: 4 } },
  { type: "defineData", args: { id: "el-spare", dataKind: "element", name: "Spare" } },
  { type: "deleteElement", args: { elementId: "el-spare" } },
  { type: "rename", args: { elementId: "st-parts", name: "Parts Inventory" } },
];

const RENAME_INDEX = projectCommands.length - 1;

type Recorded = { session: Session; docs: ProjectDocument[]; entries: LogEntry[] };

/** Run every command from an empty document, checking after each one that it was accepted and the document is sound. */
function build(): Recorded {
  let session = startSession(emptyDocument());
  const docs: ProjectDocument[] = [];
  const entries: LogEntry[] = [];
  for (const [index, command] of projectCommands.entries()) {
    const result = applyInSession(session, command, "student");
    if (!result.ok) throw new Error(`Command ${index + 1} (${command.type}) was refused: ${result.message}`);
    expect(findViolations(result.session.doc), `after ${command.type} (command ${index + 1})`).toEqual([]);
    session = result.session;
    docs.push(session.doc);
    entries.push(result.entry);
  }
  return { session, docs, entries };
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

const json = (doc: ProjectDocument): string => JSON.stringify(doc);

function step(session: Session, type: "undo" | "redo"): { session: Session; entry: LogEntry } {
  const result = applyInSession(session, { type }, "student");
  if (!result.ok) throw new Error(`${type} was refused: ${result.message}`);
  expect(findViolations(result.session.doc)).toEqual([]);
  return { session: result.session, entry: result.entry };
}

const first = build();

describe("the bike-repair project built only through commands (SPEC.md sections 3.4 and 4.1)", () => {
  test("every command is accepted, the document is sound after each, and the result has the expected shape", () => {
    const doc = first.session.doc;
    expect(first.docs).toHaveLength(projectCommands.length);
    expect(findViolations(doc)).toEqual([]);
    expect(processNumber(doc, "p11")).toBe("1.1");
    expect(processNumber(doc, "p3")).toBe("4");
    expect(storeLabel(doc, "st-jobs")).toBe("D1");
    expect(doc.elements["el-spare"]).toBeUndefined();
    const flows = Object.values(doc.elements).filter((e) => e.kind === "dataFlow");
    expect(flows.length).toBeGreaterThan(10);
    // An inherited flow's inner end was attached by reconnectFlow; the off-diagram end stays a bare process id.
    expect(doc.elements["f-l1-request"]).toMatchObject({ sourceId: "ee-customer", targetId: "p11" });
    expect(doc.elements["f-l1-handoff"]).toMatchObject({ sourceId: "p12", targetId: "p2" });
    expect(doc.views.routes["r-l1-handoff"]?.targetOccurrenceId).toBeNull();
    expect(doc.views.occurrences["o-p1"]).toMatchObject({ x: 160, y: 10, width: 140, height: 90 });
    expect(doc.views.routes["r-l0-request"]?.points).toHaveLength(2);
  });
});

describe("one element on two diagrams (SPEC.md sections 3.5 and 4.1; EPICS.md Epic 2 exit)", () => {
  test("a data store shown on two diagrams, renamed once, shows the new name on both and keeps its label", () => {
    const before = first.docs[RENAME_INDEX - 1] as ProjectDocument;
    const after = first.session.doc;
    const shown = (doc: ProjectDocument) =>
      Object.values(doc.views.occurrences).filter((o) => o.elementId === "st-parts");

    expect(new Set(shown(after).map((o) => o.diagramId))).toEqual(new Set(["d-l0", "d-l1"]));
    expect(shown(after).length).toBeGreaterThanOrEqual(3);
    // The occurrences are the same records before and after: only the one element changed.
    expect(shown(after)).toEqual(shown(before));
    for (const occurrence of shown(after)) {
      expect(after.elements[occurrence.elementId]?.name).toBe("Parts Inventory");
      expect(before.elements[occurrence.elementId]?.name).toBe("Parts Stock");
    }
    expect(Object.values(after.elements).filter((e) => e.name === "Parts Inventory")).toHaveLength(1);
    expect(storeLabel(before, "st-parts")).toBe("D2");
    expect(storeLabel(after, "st-parts")).toBe("D2");
  });
});

describe("the log and replay (SPEC.md sections 3.6 and 3.9)", () => {
  test("replaying the log's patches from the empty document rebuilds exactly the final document", () => {
    const result = replay(emptyDocument(), first.entries);
    expect(result).toEqual({ ok: true, doc: first.session.doc });
  });

  test("every logged entry carries the command, the caller's origin, a patch and its inverse", () => {
    expect(first.entries.map((e) => e.command)).toEqual(projectCommands);
    for (const entry of first.entries) {
      expect(entry.origin).toBe("student");
      expect(entry.patch.length).toBeGreaterThan(0);
      expect(entry.inverse.length).toBeGreaterThan(0);
    }
  });

  test("running the same commands again from the empty document gives the same final document", () => {
    const again = build();
    expect(again.session.doc).toEqual(first.session.doc);
    expect(again.entries).toEqual(first.entries);
  });
});

describe("undo and redo within a session (SPEC.md sections 3.6 and 3.9)", () => {
  test("undoing every command in order returns to the empty document, and redoing them all returns to the final one", () => {
    let session = first.session;
    const log = [...first.entries];

    for (let i = projectCommands.length - 1; i >= 0; i--) {
      const undone = step(session, "undo");
      session = undone.session;
      log.push(undone.entry);
      expect(session.doc, `after undoing command ${i + 1}`).toEqual(i === 0 ? emptyDocument() : first.docs[i - 1]);
    }
    expect(session.doc).toEqual(emptyDocument());
    expect(session.undo).toHaveLength(0);
    expect(session.redo).toHaveLength(projectCommands.length);
    // An undo is itself logged, and replaying the log with the undos reaches the empty document again.
    expect(log.slice(projectCommands.length).every((e) => e.command.type === "undo")).toBe(true);
    expect(replay(emptyDocument(), log)).toEqual({ ok: true, doc: emptyDocument() });

    for (let i = 0; i < projectCommands.length; i++) {
      const redone = step(session, "redo");
      session = redone.session;
      log.push(redone.entry);
      expect(session.doc, `after redoing command ${i + 1}`).toEqual(first.docs[i]);
    }
    expect(session.doc).toEqual(first.session.doc);
    expect(session.redo).toHaveLength(0);
    expect(log.filter((e) => e.command.type === "redo")).toHaveLength(projectCommands.length);
    expect(replay(emptyDocument(), log)).toEqual({ ok: true, doc: session.doc });
  });

  test("a new command after an undo clears redo, and redo is then refused", () => {
    const undone = step(first.session, "undo");
    expect(undone.session.redo).toHaveLength(1);

    const next = applyInSession(
      undone.session,
      { type: "describe", args: { elementId: "st-parts", description: "Tyres, tubes and brake pads." } },
      "student",
    );
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    expect(next.session.redo).toHaveLength(0);

    const redo = applyInSession(next.session, { type: "redo" }, "student");
    expect(redo.ok).toBe(false);
    if (!redo.ok) expect(redo.code).toBe("refused");
    // The refusal changes nothing.
    expect(next.session.doc.elements["st-parts"]).toMatchObject({ name: "Parts Stock" });
  });
});

describe("apply never changes its input (SPEC.md section 3.6)", () => {
  test("a deep-frozen input document is accepted and left exactly as it was, for every command", () => {
    let doc = emptyDocument();
    for (const [index, command] of projectCommands.entries()) {
      deepFreeze(doc);
      const snapshot = json(doc);
      const result = apply(doc, command, "student");
      expect(result.ok, `command ${index + 1} (${command.type})`).toBe(true);
      expect(json(doc)).toBe(snapshot);
      if (!result.ok) return;
      expect(result.doc).not.toBe(doc);
      doc = result.doc;
    }
    expect(doc).toEqual(first.session.doc);
  });
});

describe("the registry as AI tools (SPEC.md sections 4.1 and 7)", () => {
  const RELEASE_0 = [
    "createProject", "addExternalEntity", "addDataStore", "addProcess", "placeExisting", "addControlFlow",
    "setProcessNumber", "addFlow", "defineData", "setComposition", "rename", "describe", "setAliases", "setNotes",
    "setProcessDescription", "setFlowData", "expandProcess", "removeOccurrence", "deleteElement",
  ];
  const ALSO = ["moveOccurrence", "setRoute", "reconnectFlow", "setDataElement"];
  const LATER = ["carryDown", "setTopDiagram", "setShowFindings", "setCaseText"];

  test("every Release 0 command is a tool with a sentence and an object input schema, and later commands are absent", () => {
    const tools = toolDefinitions();
    const byName = new Map(tools.map((tool) => [tool.name, tool]));
    for (const name of [...RELEASE_0, ...ALSO]) {
      const tool = byName.get(name);
      expect(tool, name).toBeDefined();
      expect(tool?.description.trim().length, name).toBeGreaterThan(0);
      expect(tool?.inputSchema, name).toMatchObject({ type: "object" });
    }
    for (const name of LATER) expect(byName.has(name), name).toBe(false);
    expect(new Set(tools.map((tool) => tool.name)).size).toBe(tools.length);
  });
});

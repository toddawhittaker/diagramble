import { describe, expect, test } from "vitest";
import { emptyDocument } from "../document.ts";
import { findViolations } from "../invariants.ts";
import { findQuery } from "../registry.ts";
import { outlineQueries } from "./outline.ts";
import { reversedKeyOrder, sampleDocument } from "./sampleDocument.ts";

const getOutline = outlineQueries[0]!;
const outline = (doc = sampleDocument()): string => getOutline.run(doc, {}) as string;

const EXPECTED = `Diagram: Context diagram [ctx]
  0 Bike Shop [p0]
  Customer [e-customer]
  Flow Repair Request [f-ctx]: Customer [e-customer] -> 0 Bike Shop [p0]

Diagram: Level 0 [d0] decomposes 0 Bike Shop [p0]
  1 Take Repair Order [p1]
  2 Repair Bike [p2]
  Customer [e-customer]
  D2 Repair Log [st-log]
  Flow Order Record [f-record]: 1 Take Repair Order [p1] -> D2 Repair Log [st-log]
  Flow Owner Name [f-loose]: (unattached) -> 2 Repair Bike [p2]
  Flow Repair Request [f-order]: Customer [e-customer] -> 1 Take Repair Order [p1]
  Event Bike Dropped Off [c-drop] -> 1 Take Repair Order [p1]

Diagram: Level 1 of Repair Bike [d2] decomposes 2 Repair Bike [p2]
  2.1 Diagnose Fault [p21]
  2.2 Replace Parts [p22]
  D2 Repair Log [st-log]
  Flow Fault Found [f-fault]: 2.1 Diagnose Fault [p21] -> To process 1
  Flow Order Record [f-pull]: From process 1 -> 2.1 Diagnose Fault [p21]
  Flow Order Record [f-reread]: D2 Repair Log [st-log] -> 2.2 Replace Parts [p22]

Dictionary
  Structure Order Record [ds-record]
    Status [de-status]: once
    Part Line [ds-line]: many
  Structure Part Line [ds-line]
    Part Name [de-part]: once
    Quantity [de-qty]: once
  Structure Repair Request [ds-request]
    Owner Name [de-owner]: once
    Phone [de-phone]: optional
    Part Line [ds-line]: many, limit 5
  Element Fault Found [de-fault]: text
  Element Owner Name [de-owner]: text
  Element Part Name [de-part]: text
  Element Phone [de-phone]: text
  Element Quantity [de-qty]: number
  Element Status [de-status]: text
    Allowed value open: Not started
    Allowed value done: Bike returned

Unplaced
  Parts Supplier [e-supplier]`;

describe("getOutline (SPEC.md section 7 item 1)", () => {
  test("the sample document is valid", () => {
    expect(findViolations(sampleDocument())).toEqual([]);
  });

  test("writes the context diagram, the others by process number, the dictionary and the unplaced elements", () => {
    expect(outline()).toBe(EXPECTED);
  });

  test("is the same when every map is built in a different key order", () => {
    expect(outline(reversedKeyOrder(sampleDocument()))).toBe(EXPECTED);
  });

  test("puts diagram 10 after diagram 2 by number, not by text", () => {
    const doc = sampleDocument();
    const text = { description: "", aliases: [], notes: "", origin: "student" as const };
    doc.elements.p10 = { ...text, kind: "process", id: "p10", name: "Close Shop", parentProcessId: "p0", ordinal: 10, processDescription: "" };
    doc.views.occurrences["o-p10"] = { id: "o-p10", diagramId: "d0", elementId: "p10", x: 0, y: 0, width: 1, height: 1 };
    doc.elements.d10 = { ...text, kind: "diagram", id: "d10", name: "Level 1 of Close Shop", diagramKind: "dfd", decomposesProcessId: "p10" };
    expect(findViolations(doc)).toEqual([]);
    const headings = outline(doc).split("\n").filter((line) => line.startsWith("Diagram:"));
    expect(headings.map((line) => line.split(" [")[0])).toEqual([
      "Diagram: Context diagram", "Diagram: Level 0", "Diagram: Level 1 of Repair Bike", "Diagram: Level 1 of Close Shop",
    ]);
    expect(outline(doc)).toContain("  10 Close Shop [p10]");
  });

  test("shows an empty name as (no name) and orders stores by number", () => {
    const doc = sampleDocument();
    const text = { description: "", aliases: [], notes: "", origin: "student" as const };
    doc.elements["st-first"] = { ...text, kind: "dataStore", id: "st-first", name: "", ordinal: 1 };
    doc.views.occurrences["o-first"] = { id: "o-first", diagramId: "d0", elementId: "st-first", x: 0, y: 0, width: 1, height: 1 };
    doc.elements["de-fault"] = { ...doc.elements["de-fault"]!, name: "" } as never;
    expect(findViolations(doc)).toEqual([]);
    const lines = outline(doc).split("\n");
    expect(lines.indexOf("  D1 (no name) [st-first]")).toBeGreaterThan(-1);
    expect(lines.indexOf("  D1 (no name) [st-first]")).toBeLessThan(lines.indexOf("  D2 Repair Log [st-log]"));
    expect(lines).toContain("  Flow (no name) [f-fault]: 2.1 Diagnose Fault [p21] -> To process 1");
    expect(lines).toContain("  Element (no name) [de-fault]: text");
  });

  test("shows an element with no type and a value with no meaning plainly", () => {
    const doc = sampleDocument();
    const status = doc.elements["de-status"];
    if (status?.kind !== "dataElement") throw new Error("fixture");
    status.dataType = "";
    status.allowedValues = [{ value: "open", meaning: "" }];
    const lines = outline(doc).split("\n");
    expect(lines).toContain("  Element Status [de-status]: (no type)");
    expect(lines).toContain("    Allowed value open");
  });

  test("names the empty blocks of a new project and of an empty document", () => {
    expect(outline(emptyDocument())).toBe("Dictionary\n  (none)\n\nUnplaced\n  (none)");
  });

  test("returns plain text with no trailing newline", () => {
    expect(typeof outline()).toBe("string");
    expect(outline().endsWith("\n")).toBe(false);
  });

  test("is offered by name with a one-sentence description and no arguments", () => {
    const found = findQuery("getOutline");
    expect(found?.kind).toBe("query");
    expect(found?.sentence).toMatch(/^[A-Z][^.]*\.$/);
    expect(getOutline.args.safeParse({ extra: 1 }).success).toBe(false);
  });
});

// getOutline (docs/SPEC.md section 7 item 1): the model as short, indented plain text.
// Every line carries the element's id in square brackets, so a caller can go on to
// getElement. Order never depends on the order of a map's keys: lines are sorted by
// number, then name, then id.
import { z } from "zod";
import { isShownOn, occurrencesOn, processNumber, storeLabel } from "../derive.ts";
import type { Element, ProjectDocument } from "../document.ts";
import type { Id } from "../id.ts";
import type { ControlFlow, DataFlow, DataStore, ExternalEntity, Process } from "../kinds/dfd.ts";
import type { DataElement, DataStructure } from "../kinds/dictionary.ts";
import type { Diagram } from "../kinds/diagram.ts";
import type { QueryDefinition } from "../registry.ts";

const NO_NAME = "(no name)";
const NO_TYPE = "(no type)";
const NONE = "(none)";
const INDENT = "  ";

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Compares dotted process numbers part by part as whole numbers; "" (no number) last. */
function compareNumbers(a: string, b: string): number {
  if (a === "" || b === "") return a === b ? 0 : a === "" ? 1 : -1;
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let i = 0; i < Math.min(left.length, right.length); i += 1) {
    if (left[i] !== right[i]) return (left[i] as number) - (right[i] as number);
  }
  return left.length - right.length;
}

function compareNamed(a: { name: string; id: Id }, b: { name: string; id: Id }): number {
  return compareText(a.name, b.name) || compareText(a.id, b.id);
}

// An id such as "toString" must not find a method of Object.
function find(doc: ProjectDocument, id: Id): Element | undefined {
  return Object.hasOwn(doc.elements, id) ? doc.elements[id] : undefined;
}

function tag(element: { id: Id; name: string }): string {
  return `${element.name === "" ? NO_NAME : element.name} [${element.id}]`;
}

function nodeLabel(doc: ProjectDocument, element: Element): string {
  if (element.kind === "process") return `${processNumber(doc, element.id)} ${tag(element)}`;
  if (element.kind === "dataStore") return `${storeLabel(doc, element.id)} ${tag(element)}`;
  return tag(element);
}

function endLabel(doc: ProjectDocument, id: Id | null, diagramId: Id, role: "source" | "target"): string {
  if (id === null) return "(unattached)";
  const element = find(doc, id);
  if (element === undefined) return `(missing) [${id}]`;
  if (element.kind === "process" && !isShownOn(doc, id, diagramId)) {
    return `${role === "target" ? "To" : "From"} process ${processNumber(doc, id)}`;
  }
  return nodeLabel(doc, element);
}

function dataName(doc: ProjectDocument, flow: DataFlow): string {
  const data = find(doc, flow.dataId);
  return data === undefined || data.name === "" ? NO_NAME : data.name;
}

function ofKind<K extends Element["kind"]>(doc: ProjectDocument, kind: K): Extract<Element, { kind: K }>[] {
  return Object.values(doc.elements).filter((e): e is Extract<Element, { kind: K }> => e.kind === kind);
}

function diagramBlock(doc: ProjectDocument, diagram: Diagram): string[] {
  const decomposed = diagram.decomposesProcessId === null ? undefined : find(doc, diagram.decomposesProcessId);
  const heading =
    decomposed === undefined
      ? `Diagram: ${tag(diagram)}`
      : `Diagram: ${tag(diagram)} decomposes ${nodeLabel(doc, decomposed)}`;

  const shown = new Set(occurrencesOn(doc, diagram.id).map((o) => o.elementId));
  const placed = [...shown].map((id) => find(doc, id)).filter((e): e is Element => e !== undefined);
  const processes = placed.filter((e): e is Process => e.kind === "process");
  const entities = placed.filter((e): e is ExternalEntity => e.kind === "externalEntity");
  const stores = placed.filter((e): e is DataStore => e.kind === "dataStore");
  const dataFlows = ofKind(doc, "dataFlow").filter((f) => f.diagramId === diagram.id);
  const controlFlows = ofKind(doc, "controlFlow").filter((f) => f.diagramId === diagram.id);

  const lines = [
    ...processes
      .sort((a, b) => compareNumbers(processNumber(doc, a.id), processNumber(doc, b.id)) || compareNamed(a, b))
      .map((p) => nodeLabel(doc, p)),
    ...entities.sort(compareNamed).map((e) => nodeLabel(doc, e)),
    ...stores.sort((a, b) => a.ordinal - b.ordinal || compareNamed(a, b)).map((s) => nodeLabel(doc, s)),
    ...dataFlows
      .map((f) => ({ flow: f, name: dataName(doc, f) }))
      .sort((a, b) => compareNamed({ name: a.name, id: a.flow.id }, { name: b.name, id: b.flow.id }))
      .map(({ flow, name }) => {
        const source = endLabel(doc, flow.sourceId, diagram.id, "source");
        const target = endLabel(doc, flow.targetId, diagram.id, "target");
        return `Flow ${name} [${flow.id}]: ${source} -> ${target}`;
      }),
    ...controlFlows.sort(compareNamed).map((f: ControlFlow) => {
      const target = find(doc, f.targetId);
      return `Event ${tag(f)} -> ${target === undefined ? `(missing) [${f.targetId}]` : nodeLabel(doc, target)}`;
    }),
  ];
  return [heading, ...lines.map((line) => INDENT + line)];
}

function diagramNumber(doc: ProjectDocument, diagram: Diagram): string {
  return diagram.decomposesProcessId === null ? "" : processNumber(doc, diagram.decomposesProcessId);
}

function diagramBlocks(doc: ProjectDocument): string[][] {
  const diagrams = ofKind(doc, "diagram");
  const context = diagrams.filter((d) => d.diagramKind === "context").sort(compareNamed);
  const others = diagrams
    .filter((d) => d.diagramKind !== "context")
    .sort((a, b) => compareNumbers(diagramNumber(doc, a), diagramNumber(doc, b)) || compareText(a.id, b.id));
  return [...context, ...others].map((d) => diagramBlock(doc, d));
}

function structureLines(doc: ProjectDocument, structure: DataStructure): string[] {
  const parts = structure.components.map((c) => {
    const data = find(doc, c.dataId);
    const name = data === undefined ? `(missing) [${c.dataId}]` : tag(data);
    return `${INDENT}${name}: ${c.occurs}${c.limit === null ? "" : `, limit ${c.limit}`}`;
  });
  return [`Structure ${tag(structure)}`, ...parts];
}

function elementLines(element: DataElement): string[] {
  const values = element.allowedValues.map(
    (v) => `${INDENT}Allowed value ${v.value}${v.meaning === "" ? "" : `: ${v.meaning}`}`,
  );
  return [`Element ${tag(element)}: ${element.dataType === "" ? NO_TYPE : element.dataType}`, ...values];
}

function dictionaryBlock(doc: ProjectDocument): string[] {
  const lines = [
    ...ofKind(doc, "dataStructure").sort(compareNamed).flatMap((s) => structureLines(doc, s)),
    ...ofKind(doc, "dataElement").sort(compareNamed).flatMap(elementLines),
  ];
  return ["Dictionary", ...(lines.length === 0 ? [NONE] : lines).map((line) => INDENT + line)];
}

function unplacedBlock(doc: ProjectDocument): string[] {
  const shown = new Set(Object.values(doc.views.occurrences).map((o) => o.elementId));
  const unplaced = [...ofKind(doc, "externalEntity"), ...ofKind(doc, "dataStore")].filter((e) => !shown.has(e.id));
  const lines = [
    ...unplaced.filter((e): e is ExternalEntity => e.kind === "externalEntity").sort(compareNamed),
    ...unplaced.filter((e): e is DataStore => e.kind === "dataStore").sort((a, b) => a.ordinal - b.ordinal || compareNamed(a, b)),
  ].map((e) => nodeLabel(doc, e));
  return ["Unplaced", ...(lines.length === 0 ? [NONE] : lines).map((line) => INDENT + line)];
}

const NoArgs = z.strictObject({});

const getOutline: QueryDefinition<z.infer<typeof NoArgs>, string> = {
  name: "getOutline",
  kind: "query",
  sentence:
    "Return the model as short indented plain text: each diagram, then the data dictionary, then the elements shown on no diagram.",
  args: NoArgs,
  run(doc) {
    const blocks = [...diagramBlocks(doc), dictionaryBlock(doc), unplacedBlock(doc)];
    return blocks.map((block) => block.join("\n")).join("\n\n");
  },
};

export const outlineQueries: QueryDefinition<any, unknown>[] = [getOutline];

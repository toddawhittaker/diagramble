import type { Element, ProjectDocument } from "./document.ts";
import type { Id } from "./id.ts";
import type { ControlFlow, DataFlow, Process } from "./kinds/dfd.ts";
import type { Diagram } from "./kinds/diagram.ts";
import type { Occurrence, Route } from "./views.ts";

// Pure helpers that read a document (SPEC.md sections 3.3 to 3.5). Every walk up the
// process tree keeps a set of visited ids, so a broken document cannot loop forever.

/**
 * Lookups by an id a caller gave. An id such as toString passes the Id schema (SPEC.md
 * section 3.1), so each returns a record only when the map holds that key itself.
 */
export function elementById(doc: ProjectDocument, id: Id): Element | undefined {
  return Object.hasOwn(doc.elements, id) ? doc.elements[id] : undefined;
}

export function occurrenceById(doc: ProjectDocument, id: Id): Occurrence | undefined {
  return Object.hasOwn(doc.views.occurrences, id) ? doc.views.occurrences[id] : undefined;
}

export function routeById(doc: ProjectDocument, id: Id): Route | undefined {
  return Object.hasOwn(doc.views.routes, id) ? doc.views.routes[id] : undefined;
}

function processAt(doc: ProjectDocument, id: Id | null): Process | null {
  if (id === null) return null;
  const element = elementById(doc, id);
  return element?.kind === "process" ? element : null;
}

/** Every diagram element of the document. */
export function diagrams(doc: ProjectDocument): Diagram[] {
  return Object.values(doc.elements).filter((e): e is Diagram => e.kind === "diagram");
}

/** The processes above this one, nearest first, stopping at a missing parent or a cycle. */
export function ancestors(doc: ProjectDocument, processId: Id): Id[] {
  const result: Id[] = [];
  const seen = new Set<Id>([processId]);
  let current = processAt(doc, processId);
  while (current !== null && current.parentProcessId !== null && !seen.has(current.parentProcessId)) {
    const parent = processAt(doc, current.parentProcessId);
    if (parent === null) break;
    result.push(parent.id);
    seen.add(parent.id);
    current = parent;
  }
  return result;
}

/**
 * The process number built from ordinals up the tree (SPEC.md section 3.3): "0" for
 * process 0, "2" for a child of process 0, "2.1" for the first child of process 2.
 * An id that is not a process gives "".
 */
export function processNumber(doc: ProjectDocument, processId: Id): string {
  const process = processAt(doc, processId);
  if (process === null) return "";
  if (process.parentProcessId === null) return "0";
  const chain = [process, ...ancestors(doc, processId).map((id) => processAt(doc, id) as Process)];
  return chain
    .filter((p) => p.parentProcessId !== null)
    .map((p) => String(p.ordinal))
    .reverse()
    .join(".");
}

/** A data store's label, D and its ordinal (SPEC.md section 3.3); "" for any other id. */
export function storeLabel(doc: ProjectDocument, storeId: Id): string {
  const store = elementById(doc, storeId);
  return store?.kind === "dataStore" ? `D${store.ordinal}` : "";
}

/** The diagram that decomposes this process, or null. */
export function childDiagram(doc: ProjectDocument, processId: Id): Id | null {
  return diagrams(doc).find((d) => d.decomposesProcessId === processId)?.id ?? null;
}

/**
 * The diagram a process is shown on (SPEC.md section 3.4, invariant 6): the one that
 * decomposes its parent, or the context diagram for process 0. Null when there is none.
 */
export function diagramShowing(doc: ProjectDocument, processId: Id): Id | null {
  const process = processAt(doc, processId);
  if (process === null) return null;
  if (process.parentProcessId === null) {
    return diagrams(doc).find((d) => d.diagramKind === "context")?.id ?? null;
  }
  return childDiagram(doc, process.parentProcessId);
}

export function occurrencesOn(doc: ProjectDocument, diagramId: Id): Occurrence[] {
  return Object.values(doc.views.occurrences).filter((o) => o.diagramId === diagramId);
}

export function isShownOn(doc: ProjectDocument, elementId: Id, diagramId: Id): boolean {
  return occurrencesOn(doc, diagramId).some((o) => o.elementId === elementId);
}

/** Every data flow with this element at either end, and every control flow that targets it. */
export function flowsTouching(doc: ProjectDocument, elementId: Id): (DataFlow | ControlFlow)[] {
  return Object.values(doc.elements).filter(
    (e): e is DataFlow | ControlFlow =>
      (e.kind === "dataFlow" && (e.sourceId === elementId || e.targetId === elementId)) ||
      (e.kind === "controlFlow" && e.targetId === elementId),
  );
}

/**
 * Whether an end of a flow on this diagram may be off the diagram (SPEC.md section 3.4,
 * invariant 2): the diagram decomposes a process P, and the end is a process that is
 * not P, not above P and not below P.
 */
export function isOffDiagramProcess(doc: ProjectDocument, diagramId: Id, endId: Id): boolean {
  const diagram = elementById(doc, diagramId);
  if (diagram?.kind !== "diagram" || diagram.decomposesProcessId === null) return false;
  if (elementById(doc, endId)?.kind !== "process") return false;
  const p = diagram.decomposesProcessId;
  return endId !== p && !ancestors(doc, p).includes(endId) && !ancestors(doc, endId).includes(p);
}

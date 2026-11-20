import type { Element } from "./document.ts";

// How a refusal names an element for a student (SPEC.md sections 3.2 and 4.1): by its
// name in double quotes, or by its kind in plain words while it has no name. A message
// never shows a raw kind such as dataFlow.

export const KIND_WORDS: Record<Element["kind"], string> = {
  process: "process",
  externalEntity: "external entity",
  dataStore: "data store",
  dataFlow: "data flow",
  controlFlow: "control flow",
  dataStructure: "data structure",
  dataElement: "data element",
  diagram: "diagram",
};

/** The element's name in double quotes, or "the unnamed <kind>" when it has none. */
export function called(element: Element): string {
  return element.name === "" ? `the unnamed ${KIND_WORDS[element.kind]}` : `"${element.name}"`;
}

/** The same, with the first letter capitalised for the start of a sentence. */
export function Called(element: Element): string {
  const text = called(element);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

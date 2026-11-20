// The one list of commands and queries (docs/SPEC.md section 7 items 1 and 2). It
// names no command itself: each family file supplies an array, and a later family
// adds one import line here.
import { z, type ZodType } from "zod";
import type { Id } from "./id.ts";
import type { Origin } from "./kinds/common.ts";
import type { ProjectDocument } from "./document.ts";
import { projectCommands } from "./commands/project.ts";
import { dfdCommands } from "./commands/dfd.ts";
import { viewCommands } from "./commands/views.ts";
import { expandCommands } from "./commands/expand.ts";
import { dictionaryCommands } from "./commands/dictionary.ts";
import { textCommands } from "./commands/text.ts";
import { deleteCommands } from "./commands/delete.ts";
import { elementQueries } from "./queries/elements.ts";
import { dictionaryQueries } from "./queries/dictionary.ts";
import { outlineQueries } from "./queries/outline.ts";

export type CommandResult = { ok: true; doc: ProjectDocument } | { ok: false; message: string };

export type CommandDefinition<A> = {
  name: string;
  kind: "command";
  sentence: string;
  args: ZodType<A>;
  /** The ids of the items the command creates, checked for clashes before it runs. */
  newIds(args: A): Id[];
  /** Receives a private copy of the document, which it may change and return. */
  run(doc: ProjectDocument, args: A, ctx: { origin: Origin }): CommandResult;
};

export type QueryDefinition<A, R> = {
  name: string;
  kind: "query";
  sentence: string;
  args: ZodType<A>;
  run(doc: ProjectDocument, args: A): R;
};

// Each definition keeps its own argument type; the lists hold them side by side.
export type AnyCommandDefinition = CommandDefinition<any>;
export type AnyQueryDefinition = QueryDefinition<any, unknown>;

export const commandDefinitions: readonly AnyCommandDefinition[] = [
  ...projectCommands,
  ...dfdCommands,
  ...viewCommands,
  ...expandCommands,
  ...dictionaryCommands,
  ...textCommands,
  ...deleteCommands,
];

export const queryDefinitions: readonly AnyQueryDefinition[] = [
  ...elementQueries,
  ...dictionaryQueries,
  ...outlineQueries,
];

export function findCommand(name: string): AnyCommandDefinition | undefined {
  return commandDefinitions.find((definition) => definition.name === name);
}

export function findQuery(name: string): AnyQueryDefinition | undefined {
  return queryDefinitions.find((definition) => definition.name === name);
}

export type ToolDefinition = { name: string; description: string; inputSchema: unknown };

/** One AI tool per command and query (docs/SPEC.md section 7 item 2). */
export function toolDefinitions(): ToolDefinition[] {
  return [...commandDefinitions, ...queryDefinitions].map((definition) => ({
    name: definition.name,
    description: definition.sentence,
    inputSchema: z.toJSONSchema(definition.args),
  }));
}

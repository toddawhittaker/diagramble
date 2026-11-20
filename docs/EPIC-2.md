# Epic 2 plan: Model

This is the detailed plan for Epic 2 of `docs/EPICS.md`. It lives only on the epic
branch `epic/2-model` and is deleted by the fold task. Epic 2 serves SPEC.md sections
3.1 to 3.7, section 4 for Release 0, and section 7 items 1, 2 and 5. It builds
`packages/model`: the element kinds and views, the saved document and its JSON Schema,
the pure `apply` with its invariants, undo and redo, and the Release 0 commands and
queries in one registry.

Base commit: `83b5274` (`main`). Milestone: "Epic 2: Model". It closes no issues. The
architect designed it first (the `epic-run` skill, step 2); the rulings below are its
recommendations as the user decided them.

## Rulings

1. **One map of elements, typed by `kind`.** `elements` maps each id to one element of
   the union of the kinds `process`, `externalEntity`, `dataStore`, `dataFlow`, `controlFlow`,
   `dataStructure`, `dataElement` or `diagram`. A diagram has an inner `diagramKind`,
   `context` or `dfd`; later releases add members to that inner union. Each map key
   equals its record's `id`.
2. **Every field is always present.** An empty reference is `null`, empty text is `""`,
   no allowed values is `[]`, and a component with no limit has `limit: null`. Every
   object is strict, so an unknown field is refused (SPEC.md section 3.9). Release 1
   fields are not added now.
3. **Flow ends are plain ids.** `sourceId` and `targetId` are an id or `null`. `null`
   is an unattached end. An off-diagram end is the id of a process not shown on the
   flow's diagram; the model works that out from where the process is shown
   (SPEC.md section 3.4, invariant 2). A data flow keeps `name: ""`.
4. **Process 0 and the context diagram.** Process 0 has `parentProcessId: null` and
   `ordinal: 0`. Every process has exactly one occurrence, on the diagram that
   decomposes its parent; process 0's is on the context diagram. Every other ordinal
   is a whole number of 1 or more. `expandProcess` on process 0 makes the level 0
   diagram.
5. **Data store labels.** A data store has an `ordinal`, set when it is created to one
   more than the highest ordinal any data store in the project has, and never
   renumbered. Its label is `D` and the ordinal. A deleted store leaves a gap. Nothing
   depends on the order of a map's keys, because PostgreSQL's `jsonb` reorders them.
6. **Views.** `views` holds two maps, `occurrences` and `routes`, each keyed by its
   record's own id. An occurrence is `{ id, diagramId, elementId, x, y, width,
   height }`. A route is `{ id, flowId, diagramId, sourceOccurrenceId,
   targetOccurrenceId, points }`, with `null` occurrence ids for an unattached or
   off-diagram end and for a control flow's source. In Release 0 each data flow and
   control flow has exactly one route, on its own diagram, and every command that makes
   a flow carries the route's id. Release 1's ERD lines reuse the same collection.
7. **The saved document.** `{ schemaVersion: 1, settings: { name, topDiagramId,
   showFindings, caseText }, elements, views }`. `settings.name` is the project's name,
   which the export file of SPEC.md section 3.9 is named after. `createProject` sets all
   four settings.
8. **The published JSON Schema** is `packages/model/schema/project-v1.schema.json`,
   generated from the Zod schema by a script in the package, committed, and checked by a
   test that generates it again and compares. JSON Schema cannot say that a map key
   equals its record's id; the invariant check enforces it, and the schema's
   description says so.
9. **Identifiers.** An id is 1 to 64 characters of letters, digits, `_` and `-`, and is
   never `__proto__`, `constructor` or `prototype`. So a JSON Patch path needs no
   escaping. Tests use readable ids.
10. **Command shape.** A command is `{ type, args }`. `args` is a strict Zod schema,
    with a description on each field through `.meta({ description })`, so that
    `z.toJSONSchema(args)` is the AI tool's input schema (SPEC.md section 7 item 2).
    A new element's id is `id`; a reference is `<role>Id`. A command that makes several
    items carries one id for each: `addFlow` carries the flow's, the route's, and the
    new data structure's when it makes one; `expandProcess` carries maps from each
    parent flow to its new flow and route ids, and from each placed element to its new
    occurrence id, and is refused with a sentence naming what is missing unless the maps
    cover exactly what it needs.
11. **`origin` is the caller's.** `apply(doc, command, origin)`. The server sets
    `origin` from who sent the command, and no command's arguments carry it, so neither
    a student nor an AI model can claim `starter` or `ai`.
12. **The registry.** One list of `{ name, kind: "command" | "query", sentence, args,
    run }`. It imports one array per family file and names no command itself, so a
    later epic adds a family file and one import line (EPICS.md section 1, rule 4).
13. **What `apply` returns.** Either `{ ok: true, doc, patch, inverse }`, where `patch`
    turns the old document into the new one and `inverse` turns it back, both in JSON
    Patch form (RFC 6902); or `{ ok: false, code, message, ids? }`. The codes are
    `invalid` (the arguments fail their schema), `idInUse` (a creating command's id is
    already in the document, with the clashing ids in `ids`, so the browser can make new
    ones and resend, SPEC.md section 3.2), and `refused` (an invariant or the command's
    own condition). `message` is one plain sentence. The input document is never
    changed.
14. **Our own JSON Patch subset.** `patch.ts` works out the difference between two
    documents and applies a patch, using only `add`, `remove` and `replace`, with arrays
    replaced whole. The output is valid RFC 6902. No dependency is added, and the
    lockfile is untouched.
15. **The log and undo.** A log entry is `{ command, origin, patch, inverse }`; Epic 7
    owns the table. `undo` and `redo` take no arguments. Within one editing session
    (SPEC.md section 3.9), undo applies the last entry's `inverse` and moves it to the
    redo stack; redo applies its `patch` again; any other command clears the redo stack.
    An undo is itself logged as `{ type: "undo" }` with the patch it applied. Replay
    rebuilds a document by applying the stored patches, never by running commands again,
    so a later change to a command's behavior never changes an old project.
16. **Three more commands**, recorded in SPEC.md section 4.1 at the fold:
    `moveOccurrence` (an occurrence's position and size), `setRoute` (a route's points),
    and `reconnectFlow` (attach or change one end of a data flow, with its occurrence).
17. **`deleteElement`.**
    - An external entity or data store: its occurrences, and every flow touching it
      with those flows' routes.
    - A process: its whole subtree (its child diagram, the processes and flows on it,
      and further down), and every data flow or control flow touching it on any diagram,
      including off-diagram ends.
    - A DFD diagram: refused while it shows any process; deleting its process is the way
      to remove a branch.
    - A data definition: refused while a flow carries it or a structure uses it, unless
      `cascade` is set; then the flows that carry it are deleted and it is taken out of
      every component list.
    - The context diagram and process 0: always refused.
18. **Other refusals.** `rename` on a data flow is refused with a sentence saying to
    rename its data or use `setFlowData`. A control flow's name is its event, and
    `rename` changes it as usual. `removeOccurrence` of a process is refused with a
    sentence pointing to `deleteElement`, because it would break invariant 6.
    `addProcess` on the context diagram is refused, because it shows only process 0.
19. **View consistency** is checked with the invariants: every occurrence's diagram and
    element exist; a route's diagram is its flow's diagram; a route's occurrences are on
    that diagram and show the flow's ends; each flow has exactly one route.
20. **`getOutline`.** One block per diagram in process-number order, then the
    dictionary, then unplaced elements. Each line carries the element's id in square
    brackets, so an AI model can call `getElement`, for example
    `Flow Loan Request [f1]: Member [ee1] -> 0 Library System [p0]`, with
    `(unattached)` or `To process 3` for the special ends. It is easy to change later.
21. **No `structuredClone`.** It is not in the ES2024 library the model compiles
    against. Copy documents by hand or through a JSON round trip.
22. **The prototype is a reference only.** Builders may read
    `prototype/src/model/types.ts` and the edge cases of `prototype/src/model/apply.ts`
    for `expandProcess`, `removeOccurrence` and `deleteElement`. The package is written
    fresh, and the prototype's store label, which follows key order, is not copied.

## Layout of `packages/model/src`

| File | What it owns |
| --- | --- |
| `index.ts` | The public exports |
| `id.ts` | The identifier schema (ruling 9) |
| `kinds/common.ts` | The common fields of SPEC.md section 3.2 and `origin` |
| `kinds/dfd.ts` | Process, external entity, data store, data flow, control flow |
| `kinds/dictionary.ts` | Data structure, data element |
| `kinds/diagram.ts` | Diagram, by `diagramKind` |
| `views.ts` | Occurrence and route |
| `document.ts` | The document schema, `emptyDocument`, and the `Element` union, one line per family |
| `patch.ts` | Diff and apply (ruling 14) |
| `derive.ts` | Process number, store label, the diagram that shows a process, a process's child diagram, ancestors, occurrences on a diagram, flows touching an element |
| `invariants.ts` | One exported check per invariant of SPEC.md section 3.4, plus map keys and view consistency (rulings 1 and 19) |
| `apply.ts` | Argument check, handler, invariants, diff; a refusal on any failure |
| `session.ts` | Undo and redo stacks and `applyInSession` |
| `registry.ts` | The one list of commands and queries (ruling 12) |
| `commands/project.ts` | `createProject` |
| `commands/dfd.ts` | `addExternalEntity`, `addDataStore`, `addProcess`, `placeExisting`, `addControlFlow`, `setProcessNumber`, `addFlow`, `setFlowData`, `reconnectFlow` |
| `commands/views.ts` | `moveOccurrence`, `setRoute` |
| `commands/expand.ts` | `expandProcess` |
| `commands/dictionary.ts` | `defineData`, `setComposition` |
| `commands/text.ts` | `rename`, `describe`, `setAliases`, `setNotes`, `setProcessDescription` |
| `commands/delete.ts` | `deleteElement`, `removeOccurrence` |
| `queries/elements.ts` | `getModel`, `getElement`, `whereUsed` |
| `queries/dictionary.ts` | `expandData`, exported also as a helper for Epic 5's balancing |
| `queries/outline.ts` | `getOutline` |
| `../schema/project-v1.schema.json` | The published JSON Schema (ruling 8) |

Each source file has its own test file beside it. `packages/model` keeps at least 75%
line, branch and function coverage after every task.

## Tasks

| Task | Owner and model | Files it may touch (under `packages/model/`) | Starts after | What done looks like |
| --- | --- | --- | --- | --- |
| T1 Shapes | builder, Opus, low effort | `src/id.ts`, `src/kinds/**`, `src/views.ts`, `src/document.ts`, `schema/**`, a generate script under `scripts/`, `package.json` (its scripts only), `src/index.ts` | None | Rulings 1 to 9. Schemas accept a hand-built valid document and refuse an unknown field, a missing field and a bad id; the schema file test passes |
| T2 Patch | builder, Sonnet, high effort | `src/patch.ts` and its test | None | Ruling 14. Diff then apply gives the target; applying the inverse gives the source; a patch never changes its input |
| T3 Invariants | builder, Opus, low effort | `src/invariants.ts`, `src/derive.ts` and their tests | T1 | Rulings 4, 5 and 19. One test per invariant of SPEC.md section 3.4, each a hand-built document that breaks exactly that one |
| T4 Core | builder, Opus, low effort | `src/apply.ts`, `src/session.ts`, `src/registry.ts`, `src/commands/project.ts`, empty family files under `src/commands/` and `src/queries/`, `src/index.ts`, their tests | T2, T3 | Rulings 10 to 13 and 15. `createProject` works through `apply`; each refusal code is tested; undo and redo restore the document exactly |
| T5 DFD commands | builder, Sonnet, high effort | `src/commands/dfd.ts` and its test | T4 | The commands of its row, with every refusal of SPEC.md section 4.1 and ruling 18 tested |
| T6 View commands | builder, Sonnet, high effort | `src/commands/views.ts` and its test | T4 | `moveOccurrence` and `setRoute`, refusing unknown ids and bad sizes |
| T7 Dictionary and text | builder, Sonnet, high effort | `src/commands/dictionary.ts`, `src/commands/text.ts`, `src/queries/dictionary.ts` and their tests | T4 | `defineData`, `setComposition`, the text commands, `expandData`; a structure that contains itself, directly or not, is allowed in the model and `expandData` stops on it |
| T8 Expand | builder, Sonnet, high effort | `src/commands/expand.ts` and its test | T5 | SPEC.md section 4.1's `expandProcess`: inherited flows, placed elements, off-diagram ends, control flows left behind |
| T9 Delete | builder, Sonnet, high effort | `src/commands/delete.ts` and its test | T5 | Ruling 17 and `removeOccurrence` |
| T10 Queries | builder, Sonnet, high effort | `src/queries/elements.ts`, `src/queries/outline.ts` and their tests | T5, T7 | `getModel`, `getElement`, `whereUsed`, `getOutline` (ruling 20) |
| T11 Exit tests | tester, Sonnet, high effort | `src/exit.test.ts` | T6, T8, T9, T10 | EPICS.md Epic 2's exit: a data store on two diagrams renamed once shows the new name on both; replaying the log's patches rebuilds the document; running the commands again gives the same document; undo then redo returns the same document |
| T12 Fold | the main session | `docs/STATUS.md`, `docs/SPEC.md` sections 3.3, 3.5, 3.6, 3.7 and 4.1, this file (deleted) | T11 and the review fixes | Rulings 5, 6, 7, 13, 15, 16 and 17 in the spec in a sentence or two each; the Epic 2 entry in STATUS.md; this plan deleted |

The family files that T4 creates empty are filled by the task that owns them. Only T4
edits `src/registry.ts` and `src/index.ts` after T1; a family task that needs a new
export from `index.ts` names it in its report, and T11 or the fold adds it. No task
edits the root files or the lockfile.

Waves, for reading only: T1 and T2; then T3; then T4; then T5, T6 and T7; then T8, T9
and T10; then T11 and the fold.

## Review

The code reviewer runs over the epic head once T5, T6 and T7 have landed, and makes a
short pass over the rest when T11 lands. No security or accessibility review: the epic
touches no server, saving, import or screen.

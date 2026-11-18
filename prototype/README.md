# Diagramble prototype

A clickable prototype of Diagramble with sample data. It is throwaway code, made so the
author can click through the app and judge whether it is worth building. The model and
the rules behave as [the specification](../docs/SPEC.md) says. Everything else is as
simple as it could be made.

Everything runs in the browser. There is no backend. The project is saved in the
browser's `localStorage`.

The app is not a learning management system. Nothing in it deals with assignments,
handing work in, grades, due dates or class lists, and no screen should add them.

## Install and run

```
cd prototype
npm install
npm run dev      # serves the app, by default at http://localhost:5173
npm test         # runs the rule tests once (Vitest)
npm run build    # type-checks, then builds into dist/
```

The stack is Vite, React, TypeScript, React Router (hash router), `@xyflow/react`
(React Flow) and Vitest. The fonts come from `@fontsource` packages, so the app works
offline. There is no other UI library. Styling is plain CSS with CSS variables.

## What is here

| Path | What it holds |
| --- | --- |
| `src/model/` | The model's types, the commands, `apply`, and the queries |
| `src/rules/` | The rule catalogue, the rule engine, the explanation text, and the tests |
| `src/sample/` | The sample project, "Clinic appointments", and the starter cases |
| `src/store/` | The one store: model, findings, undo and redo, saving, selection, and the hooks |
| `src/theme/` | The CSS variables and class names, and the light and dark switch |
| `src/frame/` | The top bar, the navigator and the page layout pieces |
| `src/components/` | The marks, controls, problem card, problems panel and entry fields |
| `src/screens/` | One folder per screen agent |
| `src/App.tsx` | The routes |

## Rules for a screen agent

1. **Edit only your own folder** under `src/screens/`. Do not change any file outside
   it: not the model, the rules, the store, the frame, the shared components, the
   theme, `App.tsx` or `package.json`. Five other agents are working at the same time,
   each in its own folder, and nobody merges by hand.
2. **Keep the names your `index.tsx` exports.** `App.tsx` already imports them.
3. **Add no dependencies.** Everything you may use is installed.
4. **If something you need is missing** from the shared code, build it inside your own
   folder and say so in your report.
5. Put your own CSS in a `.css` file in your folder and import it from your component.
   Begin every class name with your folder's name, such as `workspace-tool`, so that
   two screens never clash.
6. Use the CSS variables for every colour. Never write a hex value.
7. Change the model only by calling `dispatch(command)`. Never change a model object.

| Folder | Exports | Routes | What it is |
| --- | --- | --- | --- |
| `src/screens/workspace/` | `WorkspaceScreen` | `/diagram/:diagramId` | The diagram canvas (screen 1 of the briefs) |
| `src/screens/outline/` | `OutlineScreen` | `/diagram/:diagramId/outline` | The outline view (screen 2) |
| `src/screens/dictionary/` | `DictionaryScreen` | `/dictionary`, `/dictionary/:dataId` | The data dictionary (screen 3) |
| `src/screens/usecases/` | `UseCasesScreen` | `/use-cases`, `/use-cases/:id` | The use case form (screen 4) |
| `src/screens/datamodel/` | `DataModelScreen`, `CrudScreen` | `/data-model`, `/crud` | The entity relationship diagram, and the CRUD matrix (create, read, update, delete) |
| `src/screens/project/` | `ProblemsScreen`, `HelpScreen`, `ExportScreen` | `/problems`, `/help`, `/export` | The whole-project problems list, the help page, and the export page |
| `src/screens/project/` | `SearchScreen`, `ProjectScreen` | `/search`, `/project` | Search across the whole model, and the project page: the settings, the starter cases, and opening and saving a project file. Both are placeholders in `index.tsx` |

The router is a hash router, so the address bar shows `/#/diagram/dg-1`. Inside the app,
write routes without the hash: `<Link to="/diagram/dg-1">`. `/` opens the sample's child
diagram, or the project's top diagram when the project is not the sample. Read route parameters with `useParams()` from `react-router`. A screen with an
optional parameter (`/dictionary`, `/use-cases`) should show the first item when the
parameter is missing, and a plain message when it names something that does not exist.

Import from the folder indexes:

```ts
import { apply, get, all, elementLabel, type Model, type Command } from '../../model';
import { runRules, RULES, RULE_LIST, explain, type Finding } from '../../rules';
import { dispatch, useModel, useFindings, useSelection, selectElements } from '../../store';
import { PageHeader, WorkArea, RightPanel, ListColumn, UndoRedo, DiagramHeader } from '../../frame';
import { Mark, Button, Switch, Tabs, TextField, ProblemList, ProblemsPanel, EntryFields } from '../../components';
import { useTheme } from '../../theme/theme';
import { CLINIC, dataIdOf } from '../../sample/clinic';
import { STARTERS } from '../../sample/starters';
```

## The page layout

`AppLayout` draws the top bar and the navigator, and puts the open screen inside
`<main className="main">`, which is a flex row. A screen returns one or more columns for
that row, in a fragment. Each placeholder already shows the right columns for its
screen, so start from it.

```tsx
<>
  <ListColumn width={300} label="Definitions">…</ListColumn>   {/* optional, left */}
  <WorkArea>
    <PageHeader breadcrumb={['Data dictionary']} title="Appointment Request">
      <UndoRedo />
    </PageHeader>
    <div className="work-body scroll pad">…</div>
  </WorkArea>
  <RightPanel label="Where used, and problems">…</RightPanel>     {/* optional, right */}
</>
```

`work-body` fills the space under the page header and is `position: relative`. Add
`scroll` to make it scroll and `pad` for 20 pixels of padding. A canvas goes in a
`work-body` with neither.

## The model (`src/model/`)

The types are in `src/model/types.ts`. Read that file: it is short. In brief:

```ts
interface Model {
  schemaVersion: 1;
  name: string;                         // the project name
  nextId: number;
  elements: Record<Id, Element>;        // every element, keyed by id, in creation order
  views: {
    occurrences: Record<Id, NodeOccurrence>;   // a symbol on a diagram
    routes: Record<Id, FlowRoute>;             // keyed by flow id
    erd: Record<Id, { x: number; y: number }>; // entity positions on the one ERD, keyed by entity id
  };
  settings: {
    topDiagramId: Id | null;                // the project's top diagram. null means the context diagram
    showFindings: 'always' | 'onRequest';   // 'onRequest' holds the problems back until the student asks
  };
}
```

Every element has `id`, `kind`, `name`, `description`, `aliases: string[]`,
`notes: string` and `origin` (`'student'`, `'starter'` or `'ai'`). An alias is another
name the business uses. It is never a second name: labels, messages and lists show the
`name`, and no rule reads an alias or the notes. The kinds and their extra fields:

| `kind` | Extra fields |
| --- | --- |
| `process` | `parentProcessId: Id \| null` (null for process 0), `ordinal: number`, `processDescription: string` (the longer text of the process entry: what it does, step by step. Separate from the short `description`. No rule reads it), `crud: { dataId, uses }[]` |
| `externalEntity` | None |
| `dataStore` | None. Its label (D1) comes from `storeLabel` |
| `dataFlow` | `diagramId`, `sourceId: Id \| null`, `targetId: Id \| null`, `dataId`. Its `name` is always empty: the label is the name of the data it carries. A `null` end is unattached |
| `controlFlow` | `diagramId`, `targetId`. Its `name` is the starting event |
| `dataStructure` | `components: { dataId, occurs, limit? }[]`, where `occurs` is `'once'`, `'optional'` or `'many'`. `limit` is a whole number, 1 or more: the most times the part can occur. It is kept only while `occurs` is `'many'` |
| `dataElement` | `dataType: string`, `allowedValues?: { value: string, meaning: string }[]`, `length: number \| null`, `nullable: boolean \| null`. `length` and `nullable` are for the entity's dictionary entry. `null` means not filled in. No rule reads them |
| `diagram` | `diagramKind: 'context' \| 'dfd'`, `decomposesProcessId: Id \| null` (null for the context diagram). Show its title with `diagramTitle`, not its `name` |
| `useCase` | `ordinal`, `priority: 'high' \| 'medium' \| 'low'`, `actorId: Id \| null`, `trigger`, `triggerType: 'external' \| 'temporal'`, `preconditions: string[]`, `postconditions: string[]`, `steps: { text, substeps: string[], information: { direction: 'in' \| 'out', dataId }[] }[]`, `exceptions: { stepNumber, text, steps: string[] }[]` (`steps` is the numbered list of what is done about the exception), `summaryInputs: { dataId, sourceId }[]`, `summaryOutputs: { dataId, destinationId }[]`, `processId: Id \| null` |
| `entity` | `code: string`, `attributes: { dataId, identifier: boolean, repeats: boolean }[]`, `storeId: Id \| null`. `repeats` marks an attribute that can hold several values for one instance. Draw it in braces |
| `relationship` | `ends: [RelationshipEnd, RelationshipEnd]`, `identifying: boolean`. A `RelationshipEnd` is `{ entityId, verbPhrase, min: 0 \| 1 \| null, max: 'one' \| 'many' \| null }`. The values at an entity's end say how many of that entity go with one of the other. `null` means not decided yet: draw a question mark in place of the symbol. Its `name` is always empty |

An attribute is a data element that an entity owns, not a kind of its own. A CRUD cell
is an entry in a process's `crud` list: `uses` holds any of the letters C, R, U and D,
always in that order, such as `'RU'`. Its `dataId` is an attribute, or the id of an
entity that has no attributes yet, so that a matrix of processes against entities alone
can be filled in. A cell kept under an entity stays when the entity later gets
attributes. It is removed when the entity is deleted.

**The top diagram.** `topDiagram(model)` gives the highest diagram the project is
expected to contain. A diagram above it is "above the project": it stays in the model,
but nothing is reported there. Test it with `isAboveProject(model, diagramId)`.

The views:

```ts
interface NodeOccurrence { id; diagramId; elementId; x; y; width; height }
interface FlowRoute {
  flowId;
  sourceOccurrenceId: Id | null;   // null for an off-diagram end, an unattached end, or a control flow's source
  targetOccurrenceId: Id | null;
  points: { x; y }[];              // empty in the sample data
  sourceSide?: 'top' | 'right' | 'bottom' | 'left';   // a hint: the side of the symbol the line leaves
  targetSide?: 'top' | 'right' | 'bottom' | 'left';   // a hint: the side of the symbol the line enters
}
```

`NODE_SIZE` gives the default size of each symbol: process 170 by 96, external entity
120 by 90, data store 200 by 56. `x` and `y` are the top left corner.

A process has exactly one occurrence. An external entity or data store may have several,
on one diagram or on many, or none ("unplaced"). **An off-diagram end** is a flow end
that is a process not drawn on the flow's diagram: test it with `isOffDiagramEnd`, and
draw it as a note such as "To process 2".

### Commands

`apply(model, command)` returns `{ ok: true, model, created }` or `{ ok: false, error }`.
It never changes the model passed in. `error` is a plain sentence fit to show the user.
`created` lists the ids the command made, in the order given below. A command is refused
when it would break an invariant of section 3.4 or 9.1 of the specification.

In a screen, call `dispatch(command)` from the store, not `apply`. It returns the same
result.

Fields marked `?` are optional. Every "create" command also takes `id?` (to choose the
new element's id), `description?` and `origin?` (default `'student'`). A new element
starts with no aliases and empty notes.

Commands from section 4.1 of the specification:

| `type` | Arguments | What it does | `created` |
| --- | --- | --- | --- |
| `createProject` | `name`, `systemName?`, `processId?` | Makes the context diagram and process 0. `id` names the diagram. Must be the first command on an empty model | diagram, process |
| `addExternalEntity` | `diagramId`, `name`, `x?`, `y?` | Makes the element and one occurrence | element, occurrence |
| `addDataStore` | `diagramId`, `name`, `x?`, `y?` | The same, for a data store | element, occurrence |
| `addProcess` | `diagramId`, `name`, `ordinal?`, `x?`, `y?` | The same, for a process. Refused on the context diagram. `ordinal` defaults to the next number | element, occurrence |
| `placeExisting` | `diagramId`, `elementId`, `x?`, `y?`, `occurrenceId?` | Adds an occurrence of an existing external entity or data store | occurrence |
| `addControlFlow` | `diagramId`, `targetId`, `name` | A control flow into a process shown on that diagram | control flow |
| `setProcessNumber` | `processId`, `ordinal` | Changes the last part of a process's number. Refused if a sibling has it | |
| `addFlow` | `diagramId`, `sourceId`, `targetId`, then `dataId` or `dataName`, and `sourceOccurrenceId?`, `targetOccurrenceId?`, `sourceSide?`, `targetSide?` | Makes a flow. With `dataName`, it carries the definition of that name, or a new empty structure if there is none. An end may be `null` (unattached), but not both | flow, then the new structure if one was made |
| `defineData` | `dataKind: 'dataStructure' \| 'dataElement'`, `name`, `dataType?` (default `'Text'`), `allowedValues?`, `length?`, `nullable?`, `components?` | Makes a definition. `allowedValues` is as for `setDataType` | definition |
| `setComposition` | `dataId`, `components` | Replaces a structure's list of parts. Each part is `{ dataId, occurs, limit? }`. A `limit` on a part that does not occur `'many'` times is dropped | |
| `rename` | `id`, `name` | Renames any element | |
| `describe` | `id`, `description` | Sets any element's description | |
| `setAliases` | `id`, `aliases: string[]` | Replaces any element's aliases. Each is trimmed. Empty ones and repeats (ignoring case) are dropped | |
| `setNotes` | `id`, `notes` | Replaces any element's notes | |
| `setProcessDescription` | `processId`, `processDescription` | Sets the longer description of a process | |
| `setFlowData` | `flowId`, then `dataId` or `dataName` | Changes what a flow carries | the new structure, if one was made |
| `expandProcess` | `processId`, `diagramId?` | Makes the child diagram. Refused if the process already has one. Each flow touching the process on its parent is copied down with its inner end unattached. Outside elements are placed on the child diagram | diagram, then the new flows |
| `carryDown` | `processId` | For a process that already has a child diagram, brings down the flows added to the parent afterwards, each made as `expandProcess` makes it. See below. Refused when the process has no child diagram, and when there is nothing to bring down. It never removes a flow | the new flows |
| `setTopDiagram` | `diagramId: Id \| null` | Sets the project's top diagram. `null`, or the context diagram's id, means the context diagram | |
| `setShowFindings` | `showFindings: 'always' \| 'onRequest'` | Sets whether the problems are always shown or held back until asked for | |
| `removeOccurrence` | `occurrenceId` | Removes one symbol and the flows attached to it on that diagram. Refused for a process | |
| `deleteElement` | `id`, `cascade?` | Deletes an element everywhere, with whatever cannot exist without it. For a data definition still carried, used as a part, or owned as an attribute, it is refused unless `cascade` is true. Refused for process 0 and the context diagram | |

`carryDown` looks at each flow that touches the process on its own diagram, inwards and
outwards separately. A flow is brought down unless one of these is true:

- a flow that crosses the edge of the child diagram in the same direction already
  carries the same data definition, or
- every data element the flow comes to in the end already crosses the edge in that
  direction, in other flows. Such a flow arrives in parts and balances through the
  dictionary.

So a flow of which only some parts arrive is brought down whole. In the sample,
`carryDown` on process 1 brings down "Appointment Request", which clears the BAL-01
finding and leaves a DFD-05 finding until the student attaches the new flow.

Deleting the diagram that is the top diagram puts the top back at the context diagram.

`undo` and `redo` are not commands. They are functions of the store.

Commands added for the prototype:

| `type` | Arguments | What it does | `created` |
| --- | --- | --- | --- |
| `setFlowEnds` | `flowId`, `sourceId?`, `targetId?`, `sourceOccurrenceId?`, `targetOccurrenceId?` | Attaches or moves the ends of a flow. Leave a field out to keep that end. `null` detaches it | |
| `setFlowRoute` | `flowId`, `sourceSide?`, `targetSide?`, `points?` | Changes how a flow is drawn | |
| `setDataType` | `dataId`, `dataType`, `allowedValues?` | Changes a data element's type. `allowedValues`, when given, replaces the list. Each item is `{ value, meaning }`, or a plain string, which keeps the meaning that value already has (or an empty one) | |
| `setDataDetails` | `dataId`, `length?: number \| null`, `nullable?: boolean \| null` | Sets a data element's length and whether it may be empty. Leave a field out to keep it. A length is a whole number, 1 or more | |
| `setOccurs` | `dataId`, `componentId`, `occurs`, `limit?: number \| null` | Changes how often one part of a structure occurs. `limit` sets or (with `null`) clears the limit in the same step. Any occurrence but `'many'` clears it | |
| `setLimit` | `dataId`, `componentId`, `limit: number \| null` | Sets or clears the limit of one part. Refused unless the part occurs `'many'` times | |
| `moveNode` | `occurrenceId`, `x`, `y` | Moves a symbol on a data flow diagram | |
| `resizeNode` | `occurrenceId`, `width`, `height` | Resizes a symbol | |
| `addUseCase` | `name`, and any field of `updateUseCase`'s `patch` | Makes a use case. `ordinal` defaults to the next number | use case |
| `updateUseCase` | `id`, `patch` | `patch` holds any of `ordinal`, `priority`, `actorId`, `trigger`, `triggerType`, `preconditions`, `postconditions`, `steps`, `exceptions`, `summaryInputs`, `summaryOutputs`, `processId`. Each field given replaces the whole field. An exception may leave `steps` out, which means an empty list. Use `rename` and `describe` for the name and description | |
| `addEntity` | `name`, `code?`, `storeId?`, `x?`, `y?` | Makes an entity and its position on the ERD | entity |
| `updateEntity` | `id`, `code?`, `storeId?` | Sets the code or the data store. `storeId: null` clears it | |
| `moveEntity` | `entityId`, `x`, `y` | Moves an entity on the ERD | |
| `addAttribute` | `entityId`, then `dataId` or `dataName`, and `identifier?`, `repeats?` (default false), `dataType?` | Adds an attribute. With `dataName`, it uses the data element of that name, or makes one. Refused if the element belongs to another entity or is a structure | the new data element, if one was made |
| `removeAttribute` | `entityId`, `dataId` | Removes an attribute and its CRUD cells. The data element stays in the dictionary | |
| `setAttributes` | `entityId`, `attributes` | Replaces the whole list, to reorder it or to change which attributes are identifiers or repeat. Each item is `{ dataId, identifier, repeats? }`. With `repeats` left out, the attribute keeps the value it has | |
| `addRelationship` | `ends`, `identifying?` | Makes a relationship. Each end is `{ entityId, verbPhrase?, min?, max? }`. `min` and `max` left out (or `null`) mean not decided yet, so `ends: [{ entityId }, { entityId }]` starts with all four undecided | relationship |
| `updateRelationship` | `id`, `ends?`, `identifying?` | Changes a relationship. `ends` replaces both ends, in the same form as for `addRelationship`. Refused when it would make an undecided or many-to-many relationship identifying | |
| `setCrud` | `processId`, `dataId`, `uses` | Sets one CRUD cell. `uses` is a string such as `'CR'`. An empty string clears the cell. `dataId` is an attribute, or an entity that has no attributes. Filling a cell of an entity that has attributes is refused | |

Delete a use case, an entity or a relationship with `deleteElement`.

### Queries

All are pure functions of the model, in `src/model/queries.ts`.

| Function | Returns |
| --- | --- |
| `all(model, kind)` | Every element of that kind, typed, in creation order |
| `get(model, id, kind)` | One element of that kind, typed, or `undefined` |
| `isNode(e)`, `isData(e)` | Type guards: a process, external entity or data store; a structure or element |
| `dataDefinitions(model)` | Every structure and element |
| `KIND_WORDS` | The words for each kind, such as `'external entity'` |
| `contextDiagram(model)`, `rootProcess(model)` | The context diagram; process 0 |
| `childDiagram(model, processId)` | The diagram that expands a process, or `undefined` |
| `diagramOfProcess(model, processId)` | The diagram a process is drawn on |
| `parentDiagram(model, diagramId)` | The diagram one level up, or `undefined` |
| `processesOn(model, diagramId)` | The processes drawn on a diagram, in number order |
| `processNumber(model, processId)` | `'0'`, `'1'`, `'1.2'` |
| `isAncestor(model, ancestorId, processId)` | Whether one process is above another |
| `storeLabel(model, storeId)` | `'D1'` |
| `nodeTag(model, id)` | `'1.2'` for a process, `'D1'` for a data store, `''` otherwise |
| `diagramTitle(model, diagramId)` | `'Context diagram'`, `'Level 0'`, `'1 Schedule Appointment'` |
| `elementLabel(model, id)` | A name for anything: `'1.2 Book Slot'`, `'D1 Appointments'`, `'UC-1 Schedule Appointment'`, a flow's data name, `'Not attached'` for `null` |
| `diagramsInOrder(model)` | `{ diagram, title, depth }[]`: the diagrams as a tree, in reading order |
| `diagramPath(model, diagramId)` | The diagrams from the context diagram down to this one |
| `topDiagram(model)` | The project's top diagram: the one the setting names, or the context diagram |
| `isAboveProject(model, diagramId)` | Whether a diagram lies above the top diagram |
| `leafProcesses(model)` | The processes with no child diagram: the columns of the CRUD matrix |
| `occurrencesOn(model, diagramId)`, `occurrencesOf(model, elementId)` | Symbols on a diagram; symbols of an element |
| `isShownOn(model, elementId, diagramId)` | Whether an element has a symbol on a diagram |
| `flowsOn(model, diagramId)`, `controlFlowsOn(model, diagramId)` | The flows of a diagram |
| `flowsOf(model, nodeId)` | `{ into, out }`: the data flows at a node, on every diagram |
| `isOffDiagramEnd(model, flow, endId)` | Whether that end is a process not drawn on the flow's diagram |
| `contents(model, dataId)` | The set of ids a definition comes to in the end, as balancing uses it |
| `expandData(model, dataId)` | `{ element, fromId }[]`: the data elements a definition is made of in the end, each with the structure that directly holds it |
| `edgeFlows(model, processId)` | `{ parent, child, parentIn, parentOut, childIn, childOut }`: the flows balancing compares for a process, those touching it on its own diagram and those crossing the edge of its child diagram. `undefined` when it has no child diagram |
| `getFragment(model, processId)` | The textbook's DFD fragment: `{ process, diagramId, flows, controlFlows, elements }`, or `undefined`. `flows` are the data flows that touch the process on its own diagram, each `{ flow, direction: 'in' \| 'out', dataName, other, otherLabel }`, where `other` is the element at the other end, or `null` when that end is unattached. `controlFlows` are those into the process. `elements` are the elements at the other ends, each once, external entities first, then processes, then data stores |
| `eventResponseList(model)` | `{ id, trigger, name }[]`: one row for each use case, in number order. The trigger is the event and the name is the response |
| `search(model, options)` | `SearchResult[]`. See below |
| `whereUsed(model, id)` | `{ flows, diagrams, structures, entities, useCases }`. Each flow comes as `{ flow, diagramId, diagramTitle, fromLabel, toLabel }`. For data, `flows` are the flows that carry it and `structures` are the structures it is part of |
| `diagramOutline(model, diagramId)` | `{ title, items, flows, controlFlows }`. Each item is `{ occurrenceId, element, label, flowsIn, flowsOut }`, external entities first, then processes, then data stores. Each flow is `{ flow, dataName, fromLabel, toLabel }` |
| `getOutline(model)` | The whole model as indented plain text |
| `entityOfAttribute(model, dataId)` | The entity that owns a data element, or `undefined` |
| `parentEnd(relationship)` | `0` or `1`: which end is the parent. `null` when both ends are "many", and while either `max` is not decided |
| `fullIdentifier(model, entityId)` | The ids of an entity's identifier attributes, its own and inherited |
| `isDependent(model, entityId)` | Whether the entity is the child in an identifying relationship (drawn with a double border) |

`search(model, { text, kind?, diagramId?, only? })` looks for `text`, ignoring case, in
each element's name, aliases, description and notes. A process's `processDescription`
counts as a description. An empty `text` matches everything, so the other options can
be used alone.

- `kind` keeps one kind of element.
- `diagramId` keeps what is on one diagram: its symbols, its flows and control flows,
  the data its flows carry, and the diagram itself.
- `only: 'noDescription'` keeps elements with an empty description. It looks only at
  the kinds that have a described entry: processes, external entities, data stores,
  data definitions, use cases, entities and relationships.
- `only: 'unused'` keeps a process, external entity, data store or data definition that
  no flow, structure, entity or use case refers to.

Each result is `{ element, label, matchedIn, route, where }`. `label` comes from
`elementLabel`. `matchedIn` lists where the text was found, any of `'name'`, `'alias'`,
`'description'` and `'notes'`, and is empty when there was no text. `route` opens the
element, such as `/dictionary/d-phone`, `/diagram/dg-1`, `/use-cases/uc-1` or
`/data-model`, and `where` says the same in words, such as "Data dictionary" or
"Level 0". A flow has no name of its own, so a search by text finds the data it carries
and not the flow. The results come in creation order.

Also exported: `apply`, `applyAll(model, commands)` (throws if one is refused),
`checkInvariants(model)`, `emptyModel()`, `NODE_SIZE`, `normalizeModel(value)` (turns
parsed JSON into a model, filling in fields an older file lacks, and throws an `Error`
with a plain message when it is not a project) and `asStarter(model)` (a copy with every
origin set to `'starter'`).

## The rules (`src/rules/`)

`runRules(model)` returns every finding. The store runs it after each change, so a
screen reads findings from the store and never calls it.

Two project settings change what a student sees, and neither changes a rule.

- **The top diagram.** No finding is reported on a diagram above the top diagram, or
  about a process, external entity, data store or flow that is shown only there. An
  external entity or data store that is shown both above and inside the project is
  counted on the first diagram inside it. The top diagram is balanced against its parent
  process only when that process has at least one flow.
- **Findings on request.** The findings are always worked out. The store decides
  whether to show them. See "The store".

```ts
interface Finding {
  id: string;                 // stable while the problem stays the same. Use it as a React key
  ruleId: string;             // 'BAL-01'
  severity: 'error' | 'warning';
  elementIds: Id[];           // the elements involved, most relevant first
  diagramId: Id | null;       // the diagram it belongs to
  area: 'diagram' | 'dictionary' | 'dataModel';   // where it is counted
  values: Record<string, unknown>;                // the named values that filled the message
  message: string;            // ready to show
  why: string;                // ready to show
  fix: string;                // ready to show
}
```

Each finding is counted in exactly one place. A finding with a `diagramId` belongs to
that diagram. A finding about a data definition has `area: 'dictionary'`. A data model
finding has `area: 'dataModel'`. Both of those have `diagramId: null`.

What `elementIds` holds, for the rules a screen is most likely to mark:

| Rule | `elementIds` |
| --- | --- |
| BAL-01, BAL-02 | The parent data definition, the process, then the flows on the parent diagram that carry the data |
| BAL-03 | The flows on the child diagram that carry the data, then the data definition, then the process |
| BAL-04 | The child flow, the data definition, the process, then the parent flows |
| DFD-05, DFD-06 | The flow first |
| DFD-15 | The process, the data definition, then the flows |
| Rules about one item | That item |

To put a mark beside an item, ask whether any finding names it:
`findingsForElement(findings, id)`, `worstFor(findings, id)` (gives `'error'`,
`'warning'` or `null`) or the hook `useElementFindings(id)`. In the sample data this
puts a warning mark on the "Booking Info" flow and on "Booking Info" in the dictionary,
and an error mark on "Appointment Request" in the dictionary, as the briefs show.

A BAL-01 or BAL-02 finding carries the small table of the problem card in its `values`.
Narrow it with `isBalanceFinding(finding)`:

```ts
interface BalanceValues {
  data: string; process: string; missing: string;   // names, as in the message
  direction: 'in' | 'out';
  dataId: Id; processId: Id; missingIds: Id[];
  parts: {                       // every part of the parent data
    dataId: Id; name: string;
    crosses: boolean;            // true when all of it crosses the edge of the child diagram
    at: { elementId: Id; label: string }[];   // the child items it attaches to, such as '1.1'
  }[];
}
```

Other exports: `RULES` (a record by rule id) and `RULE_LIST` (an array), each entry
`{ id, severity, when, message, why, fix, provisional? }`, for the help page;
`countFindings(findings)` gives `{ errors, warnings }`;
`findingsForDiagram(findings, diagramId)`.

The rules are all 22 of section 5 of the specification, with its wording. Nine more are
provisional: ERD-01 to ERD-05, ERD-10, ERD-11, DM-01 and DM-02. The specification lists
them but has not settled their wording, so their text was written here. They are all
warnings, they are marked `provisional: true` in the catalogue, and they run only when
the project has at least one entity.

| Rule | Reported when | `elementIds` | `values` |
| --- | --- | --- | --- |
| ERD-10 | An end of a relationship has no `min` or no `max`. One finding for each relationship | The relationship, then its two entities | `first`, `second` (the entity names), `undecided: { end: 0 \| 1, entityId, min: boolean, max: boolean }[]`, where `true` means that value is missing |
| ERD-11 | An entity has at least one repeating attribute. One finding for each entity | The entity, then its repeating attributes | `name`, `attributes` (their names, joined), `count` |

ERD-05 (many-to-many) is reported only when both ends are decided as "many", never for
an undecided end.

`explain(model, finding)` returns the text for the "AI explanation" box. **No AI model
is called anywhere in the prototype.** The text is put together from the finding's own
values. It shows where an AI explanation would sit and how it would be marked.

## The store (`src/store/`)

One store holds the model, the findings, the undo and redo history, and the selection.
Every change is saved to `localStorage` at once, under the key
`diagramble.prototype.project.v2`. A project saved under the older key is ignored.

**Findings on request.** The findings are always worked out. The store also holds
`findingsVisible`, which is session state and is not saved. It is true while the setting
`showFindings` is `'always'`. While the setting is `'onRequest'` it starts false,
`checkNow()` sets it true, and any change to the model (a `dispatch` that succeeds, an
undo, a redo or a load) sets it false again. While it is false, `useFindings`,
`useDiagramFindings` and `useElementFindings` return empty lists, `useCounts` returns
zeros, and no finding can be selected. So a screen that reads findings through the hooks
hides them without doing anything. A screen must still not show its own "no problems"
message or OK mark while `useFindingsVisible()` is false. `FindingMarks` and
`ProblemList` already take care of that.

Functions, which can be called from anywhere:

| Function | What it does |
| --- | --- |
| `dispatch(command)` | Applies a command. On success it recomputes the findings, saves, and adds one undo step. On refusal it changes nothing, and the frame shows the reason in a strip at the bottom of the window. Returns the same result as `apply` |
| `undo()`, `redo()` | Step through the history |
| `resetToSample()` | Throws the saved project away and loads the sample data. It cannot be undone |
| `loadStarter(id)` | Replaces the project with a fresh copy of the starter case of that id and clears the history. Returns `false` when there is no such starter. It cannot be undone |
| `loadProjectFile(text)` | Replaces the project with the one in the text of a downloaded project file and clears the history. Returns `{ ok: true }`, or `{ ok: false, error }` with a plain sentence when the text is not a project file, in which case nothing changes. A file from before the new fields existed is opened with them filled in |
| `projectAsStarterFile()` | The current project as the text of a project file, with every origin set to `'starter'`. The project itself is not changed |
| `checkNow()` | Shows the findings when they are held back |
| `selectElements(ids)` | Selects elements. It also selects the first finding that names the first of them, if there is one |
| `selectFinding(findingId \| null)` | Selects a finding and, with it, the elements the finding names |
| `clearSelection()` | Selects nothing |
| `clearError()` | Hides the strip that shows a refused command |
| `getModel()`, `getFindings()`, `getFindingsVisible()` | The current values, for code outside a component. `getFindings()` gives every finding even while they are hidden |

Hooks:

| Hook | Returns |
| --- | --- |
| `useModel()` | The model |
| `useFindings()` | Every finding, errors first. Empty while the findings are hidden, as are the next three |
| `useFindingsVisible()` | Whether the findings are being shown |
| `useDiagramFindings(diagramId)` | The findings that belong to one diagram |
| `useElementFindings(elementId)` | The findings that name one element |
| `useCounts()` | `{ errors, warnings }` for the whole project |
| `useHistory()` | `{ canUndo, canRedo, undo, redo }` |
| `useSavedAt()` | A `Date`, or `null` if the browser would not save |
| `useLastError()` | The reason the last command was refused, or `null` |
| `useSelection()` | `{ elementIds: Id[], findingId: string \| null }` |
| `useIsSelected(elementId)` | Whether one element is selected |

Points to know:

- **One `dispatch` is one undo step.** While the user drags a symbol, keep the position
  in your own state and dispatch `moveNode` once when the drag ends. For a text field,
  keep a draft and dispatch when the field loses focus (`TextField`'s `onCommit`).
- **The selection holds element ids,** not occurrence ids. A flow is selected by its
  flow id. The canvas, the outline and the problems panel all read and write this one
  selection, which is how they stay in step. Selecting the "Booking Info" flow selects
  the BAL-03 finding, as screen 2 of the briefs asks.
- A new model object is made on every change, so `useMemo` with `model` as a dependency
  works as expected.

## The theme (`src/theme/`)

The app follows the computer's light or dark setting until the user picks one with the
switch in the top bar. The choice is kept in `localStorage`. The mode is set as
`data-theme="light"` or `"dark"` on the `<html>` element. `useTheme()` returns
`'light'` or `'dark'`, for the few places CSS cannot reach, such as React Flow's
`forceColorMode` prop (version 13 has no `colorMode` prop).

### CSS variables

| Variable | Its one meaning |
| --- | --- |
| `--paper` | Background of the top bar, the work area and the canvas |
| `--side-paper` | Background of the navigator and the right panel |
| `--ink` | Text, diagram lines, the primary button |
| `--muted` | Secondary text |
| `--hairline` | Dividers, borders, the canvas grid |
| `--select`, `--select-tint` | The selected item, and nothing else |
| `--error` | An error |
| `--warning` | A warning |
| `--ok` | No problems |
| `--ai` | Text written by AI, and nothing else |
| `--disabled` | A control that cannot be used |
| `--on-error`, `--on-warning` | The exclamation mark inside the error and the warning mark |
| `--on-ink` | Text on the primary button |
| `--font-title` | Source Serif 4, for titles (use weight 600) |
| `--font-body` | Source Sans 3, for body text (weights 400, 600 and 700, and 400 italic) |
| `--font-mono` | IBM Plex Mono, for numbers and rule codes (weights 400 and 500) |
| `--topbar-h`, `--nav-w`, `--header-h`, `--panel-w` | 48px, 216px, 72px, 390px |

The look, from `docs/mockups/STYLES.md`: one sheet of paper, regions divided by 1-pixel
hairlines, no shadows, no filled blocks, and every corner square except the process
symbol. There are no pills: a count is a plain monospaced number.

### Class names

| Class | Use |
| --- | --- |
| `is-selected` | The selection look: a 2-pixel outline in the selection colour and a tint fill. Add it to any selected item. Use it for nothing else |
| `row` | A row in a list (a `<button>` or a link). With `is-selected` it also gets the thick bar down its left edge |
| `btn`, `btn-primary`, `btn-small`, `btn-link` | Button looks, for a `<Link>` that should look like a button. Otherwise use `Button` |
| `input` | A text box, select or text area |
| `field`, `field-label`, `field-hint` | A labelled field. `TextField` uses them |
| `table` | A table with horizontal hairlines only and small monospaced headings |
| `table-caption` | A bold line above a table |
| `count` | A plain monospaced number |
| `missing` | Muted italic words over a dashed underline, for something left empty |
| `muted`, `mono`, `title` | Secondary text; monospaced text; the title typeface |
| `hstack`, `vstack`, `grow` | A flex row with an 8-pixel gap; a flex column with the same gap; an item that takes the spare room |
| `work`, `work-body`, `scroll`, `pad` | The centre column and its body. See "The page layout" |
| `page-header`, `breadcrumb`, `page-title`, `page-header-controls` | Used by `PageHeader` |
| `list-column`, `right-panel` | Used by `ListColumn` and `RightPanel` |
| `panel-heading` | A large heading in the right panel, such as "Problems" |
| `panel-subheading` | A small bold heading in the right panel, such as "Carried by 2 flows" |
| `section-heading` | A medium heading with a count beside it |
| `problem-list`, `problem-card`, `ai-box` | Used by the problem components |
| `placeholder` | Muted italic text with padding |
| `entry-fields`, `entry-fields-compact`, `entry-aliases`, `entry-alias`, `entry-alias-name` | Used by `EntryFields` |
| `nav-above`, `nav-above-note` | Used by the navigator for a diagram above the project |

The stylesheet also sets React Flow's own variables (`--xy-…`) on `.react-flow`, so
that its background, lines, labels and controls follow the paper colours in both modes.
A screen that uses React Flow imports its stylesheet in its own folder:
`import '@xyflow/react/dist/style.css';`

## The frame (`src/frame/`)

| Component | Props | What it is |
| --- | --- | --- |
| `AppLayout` | None | The top bar, the navigator and the open screen. Used by `App.tsx` only |
| `TopBar`, `Navigator` | None | Used by `AppLayout` only |
| `WorkArea` | `children` | The centre column of a screen |
| `PageHeader` | `breadcrumb: (string \| { label: string; to?: string })[]`, `title: string`, `children?` | The strip with the breadcrumb, the title, and the page's controls (`children`) at the right end |
| `UndoRedo` | None | The "Undo" and "Redo" buttons, wired to the store. Every editing screen puts it in its page header |
| `DiagramHeader` | `diagramId: Id`, `view: 'canvas' \| 'outline'` | The whole page header of both diagram screens: breadcrumb, title, the "Canvas" and "Outline" switch (which changes the route), and Undo and Redo |
| `RightPanel` | `label: string`, `children` | The right sidebar, 390 wide. It scrolls |
| `ListColumn` | `width: number`, `label: string`, `children`, `style?` | A fixed-width column on the left, such as the list of definitions. It scrolls |

The top bar shows the project name, "Saved" with the real time of the last save, the
light and dark switch, the project's live error and warning counts (a link to
`/problems`), and "Export PDF" (a link to `/export`). While the findings are hidden, the
words "Problems hidden" and a "Check now" button take the place of the counts.

The navigator has these rows: "Use cases" with a count, the heading "Diagrams", one row
for each diagram as a tree with its error and warning counts or an OK mark, "Data
dictionary" with a count, "Data model" with its counts, "CRUD matrix", "Search",
"Project", "Problems" with the total, and "Help: symbols and rules" at the bottom. The
counts are live. A diagram above the top diagram is shown in muted text with the words
"above the project" and no marks. While the findings are hidden, no marks are shown and
the "Problems" row says "hidden".

## Shared components (`src/components/`)

| Component | Props | What it is |
| --- | --- | --- |
| `Mark` | `kind: 'error' \| 'warning' \| 'ok' \| 'ai'`, `word?: boolean`, `count?: number`, `size?: number` (default 16), `label?: string` | One mark. `word` adds "Error" or "Warning" after it, as a problem card does. `count` adds a number. The AI mark always shows the letters "AI" |
| `FindingMarks` | `findings: Finding[]`, `showOk?: boolean`, `counts?: boolean` (default true) | An error mark and a warning mark with counts for a set of findings. With `showOk`, an OK mark when there are none. Otherwise nothing. The OK mark is never shown while the findings are hidden |
| `Missing` | `children` | The "missing" mark: `<Missing>No description yet</Missing>` |
| `Count` | `n: number \| string` | A plain monospaced number |
| `Button` | `variant?: 'default' \| 'primary' \| 'link'`, `small?: boolean`, and any `<button>` prop such as `disabled` and `onClick` | A button. A disabled button fades to the disabled grey |
| `Switch` | `options: { value, label }[]`, `value`, `onChange(value)`, `label: string`, `small?: boolean` | A two-part switch. `label` is read by screen readers only |
| `Tabs` | `tabs: { id, label, count? }[]`, `value`, `onChange(id)`, `label: string` | A row of tabs. The screen shows the content itself |
| `TextField` | `label: string`, `value: string`, `onChange?(value)`, `onCommit?(value)`, `rows?: number`, `placeholder?: string`, `hint?`, `readOnly?`, `hideLabel?`, `autoFocus?` | A labelled text box, or a text area when `rows` is given. `onCommit` fires when the field loses focus, and on Enter in a one-line box. `placeholder` shows in muted italics, for the "missing" look |
| `ProblemCard` | `finding: Finding`, `open: boolean`, `onToggle()`, `selected?: boolean`, `currentDiagramId?: Id` | One finding. Closed, it shows the mark, the rule code and the message. Open, it adds "Why", "How to fix", the small table for a balancing finding, an "Explain" button that shows the AI box, and a link to the finding's diagram (or "Open parent diagram" when the card sits beside that diagram) |
| `ProblemList` | `findings: Finding[]`, `currentDiagramId?: Id`, `emptyText?: string`, `openFirst?: boolean` | A stack of cards. Clicking a card selects its finding in the store and opens it. A finding selected elsewhere opens here. When empty it shows an OK mark and `emptyText`. While the findings are hidden it shows a sentence saying so and a "Check now" button |
| `ProblemsPanel` | `diagramId: Id` | The contents of the right panel on a diagram screen: the heading "Problems", the tabs "This diagram" and "Whole project" with counts, and the cards. Put it inside `RightPanel` |
| `AiBox` | `title?: string` (default "AI explanation"), `children` | A box with a dashed border in the AI colour, headed by the AI mark. Put only AI-written text in it |
| `SectionHeading` | `children`, `count?: number` | A heading with a count, such as "Problems 1" |
| `EntryFields` | `elementId: Id`, `compact?: boolean` | Shows and edits the fields every entry shares: the aliases (a small list with "Remove" beside each and a box to add one), the notes, and for a process the process description. Each edit is saved when its field loses focus, as one undo step, through `setAliases`, `setNotes` and `setProcessDescription`. An empty field has the "missing" look. It needs nothing from the screen around it: drop it into a panel or a page. `compact` gives shorter text areas and tighter spacing, for a narrow panel. It shows nothing when the element does not exist |

The marks follow section 1.2 of the briefs. Each mark means one thing. Use the error and
warning marks only for findings, the OK mark only where the rules ran and found nothing,
and the AI mark only around text an AI wrote. The app has no other status labels.

## The sample data (`src/sample/clinic.ts`)

"Clinic appointments", exactly as section 1.4 of the briefs describes it, plus three use
cases and a small data model. It is the project the app starts with. It is built with
commands. Its ids are stable, so a screen may use them for its starting state:

| What | Id |
| --- | --- |
| Diagrams | `CLINIC.context` (`dg-context`), `CLINIC.level0` (`dg-level0`), `CLINIC.child1` (`dg-1`) |
| Processes | `CLINIC.p0`, `p1`, `p2`, `p3`, `p11`, `p12`, `p13` (`p0`, `p1`, `p2`, `p3`, `p1-1`, `p1-2`, `p1-3`) |
| External entities | `CLINIC.client` (`x-client`), `CLINIC.vet` (`x-vet`) |
| Data store | `CLINIC.d1` (`s-appointments`) |
| Data definitions | `dataIdOf('Appointment Request')` gives `d-appointment-request`, and so on |
| Use cases | `uc-1`, `uc-2`, `uc-3` |
| Entities | `en-client`, `en-pet`, `en-appointment` |
| Relationships | `r-client-pet`, `r-pet-appointment` |

Flows and occurrences have generated ids. Find them with `flowsOn` and `occurrencesOn`.
Never rely on a sample id for anything but a starting state, because the user can delete
anything and can add items of their own.

It holds 3 diagrams, 7 processes, 2 external entities, 1 data store, 19 flows, 27 data
definitions (11 structures and 16 elements), 3 use cases, 3 entities and 2
relationships. Every flow has `sourceSide` and `targetSide` hints, chosen so that no
arrows cross when each line leaves and enters at the middle of the named side.

The data model: Client (Client Number, Client Name, Phone), Pet (Pet Number, Pet Name)
and Appointment (Appointment Number, Preferred Date, Reason for Visit). The first
attribute of each is its identifier. A Client owns many Pets and a Pet has many
Appointments. Only Appointment is held in a data store, D1. The CRUD matrix is partly
filled in, for the five processes that have no child diagram.

It has a few of the newer fields filled in, so that the screens have something to show:

| What | Where |
| --- | --- |
| An alias | The external entity "Client" has the alias "Pet owner" |
| A note | The data structure "Appointment Request" has a note |
| A process description | Process 1.2 "Book Slot", in structured English |
| Allowed values with meanings | The data element "Reason for Visit": C Check-up, V Vaccination, I Illness or injury, F Follow-up visit |

Both relationships have all four values decided, and no attribute repeats.

Its findings are exactly these five:

| Rule | Severity | Counted on | Message |
| --- | --- | --- | --- |
| BAL-01 | Error | 1 Schedule Appointment | 'Appointment Request' enters 'Schedule Appointment' on the parent diagram but does not fully enter this diagram. Missing: Client Details. |
| BAL-03 | Warning | 1 Schedule Appointment | 'Booking Info' crosses the edge of this diagram but not 'Schedule Appointment' on the parent diagram. |
| DFD-13 | Warning | Level 0 | 'Produce Daily Schedule' has no description. |
| DM-01 | Warning | Data model | 'Client' is not held in any data store. |
| DM-01 | Warning | Data model | 'Pet' is not held in any data store. |

So the top bar shows 1 error and 4 warnings, where the briefs show 1 and 2. The briefs
were written before the data model was added.

To start again from the sample data, call `resetToSample()`, or remove the key
`diagramble.prototype.project.v2` from the browser's `localStorage`.

## The starter cases (`src/sample/starters.ts`)

A starter case is a project to begin from. `STARTERS` is the list, each
`{ id, title, summary, build(): Model }`. `build()` returns a fresh model in which every
element has `origin: 'starter'`. `starterById(id)` finds one. Open one with the store's
`loadStarter(id)`. Every starter is original, with an invented business.

| `id` | Title | What it holds | Its findings |
| --- | --- | --- | --- |
| `blank` | Blank project | The context diagram and process 0, named "System" | DFD-07 and DFD-13 on process 0 |
| `level-0-alone` | Level 0 alone | A bike repair shop. The top diagram is the level 0 diagram, which holds two external entities, "Customer" and "Parts Supplier", and nothing else. The context diagram is above the project | DFD-08 twice and DFD-11, all on level 0. Nothing about the context diagram or process 0 |
| `find-the-errors` | Find the errors | A tool library. The top diagram is the level 0 diagram, with 4 processes, 2 external entities, 2 data stores and 11 flows. `showFindings` is `'onRequest'` | The five seeded ones: DFD-03 ("List Overdue Loans"), DFD-04 ("Register Member"), DFD-05 (the "Tool Donation" flow), DFD-13 (the data store "Tools") and DFD-14 ("Return Tool and Charge Fee") |
| `normalize-a-file` | Normalize a file | A music school. One entity, "Lesson Sign-up File", with eight attributes, of which "Instrument", "Teacher Name" and "Lesson Day" repeat. No relationships and no diagrams below the context diagram | ERD-11 and DM-01 on the entity, and DFD-07 on process 0 |

`STARTER_IDS` gives the ids the starters share: `context` (`dg-context`), `level0`
(`dg-level0`), `p0` and `file` (`en-file`, the entity of "Normalize a file").

The sample is not in `STARTERS`. Load it with `resetToSample()`.

## Where the prototype differs from the specification

- **No command log.** The specification stores each command with its changes. The
  prototype keeps whole copies of the model for undo and redo, and saves only the model.
- **Undo and redo are store functions,** not commands.
- **One entity relationship diagram.** The specification allows several. Entity
  positions are in `views.erd`, and there is no diagram element for the ERD.
- **The rules of sections 8.3, 9.3, 9.4 and 9.5** are not built, apart from the nine
  provisional ones. ERD-06 to ERD-09 and CRUD-01 to CRUD-05 are among those not built,
  so nothing reports a cell kept under an entity that has since been given attributes. Nothing checks a use case against its diagram, or the CRUD matrix
  against the flows.
- **DFD-02's message** is filled with a plural word (`{kinds}`), so that it reads "Two
  external entities are both named…".
- **`addFlow` with `dataName`** reuses an existing definition of that name, where the
  specification always makes a new structure.
- **The queries `getModel`, `getElement`, `getFindings` and `preview`** of the
  specification are not built as such. Use the store's hooks.
- **A starter case is loaded by a store function,** `loadStarter`, where the
  specification gives it to `createProject`.
- **`carryDown` is refused when there is nothing to bring down,** so that the student is
  told and no empty undo step is made. The specification does not say.
- **`length` and `nullable`** sit on the data element from the start. The specification
  defines them in section 11.5 and lets them be filled in from the first release.

## What the screens now use

Every item that the shared code gained in the second round is used by a screen: the
entry fields, `carryDown`, the fragment view, values with meanings, part limits, length
and "null", exception steps, the event-response list, undecided relationship ends,
repeating attributes, entity rows in the matrix, search, the project settings and the
starter cases. The export leaves out diagrams above the top diagram unless they are
ticked.

Known leftovers: no command renames the project, and the refusal text of `carryDown`
says "carry down" where the buttons say "Bring down new flows".

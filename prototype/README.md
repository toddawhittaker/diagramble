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
| `src/model/` | The model's types, the commands, `apply`, the queries, the calculations and their tests |
| `src/rules/` | The rule catalogue, the rule engine, the explanation text, and the tests |
| `src/sample/` | The sample project, "Clinic appointments", and the starter cases |
| `src/store/` | The one store: model, findings, undo and redo, saving, selection, and the hooks |
| `src/theme/` | The CSS variables and class names, and the light and dark switch |
| `src/frame/` | The top bar, the navigator and the page layout pieces |
| `src/components/` | The marks, controls, problem card, problems panel, entry fields and form controls |
| `src/screens/` | One folder per screen agent |
| `src/App.tsx` | The routes |

## Rules for a screen agent

1. **Edit only your own folder** under `src/screens/`. Do not change any file outside
   it: not the model, the rules, the store, the frame, the shared components, the
   theme, `App.tsx` or `package.json`. Seven other agents are working at the same time,
   each in its own folder, and nobody merges by hand.
2. **Keep the names your `index.tsx` exports.** `App.tsx` already imports them. You may
   split your folder into as many files as you like.
3. **Add no dependencies.** Everything you may use is installed.
4. **If something you need is missing** from the shared code, build it inside your own
   folder and say so in your report.
5. Put your own CSS in a `.css` file in your folder and import it from your component.
   Begin every class name with your folder's name, such as `planning-table`, so that
   two screens never clash.
6. Use the CSS variables for every colour. Never write a hex value.
7. Change the model only by calling `dispatch(command)`. Never change a model object.
8. Read `docs/SPEC.md` for the sections your row names. The specification is the
   authority for fields, formulas and rules. This file is the authority for names.

### What each screen agent builds

The five new folders hold placeholders. The three others hold finished first-release
screens, to be extended. `/storage` is the one new route in an existing folder.

| Folder | Exports | Routes | Specification | Shared code waiting for it |
| --- | --- | --- | --- | --- |
| `planning/` | `SystemRequestScreen`, `FeasibilityScreen` | `/system-request`, `/feasibility` | 10.1, 10.2 | `systemRequest`, `feasibility`, `updateSystemRequest`, `updateFeasibility`; `expectedValue`, `probabilityTotal`, `cashFlow`, `lineAmounts`, `isQuantityLine`, `checkMeasures`; `FACTOR_WORDS`, `TECHNICAL_FACTORS`, `ORGANIZATIONAL_FACTORS`; rules SR and FA through `useAreaFindings('systemRequest')` and `useAreaFindings('feasibility')`; `NumberField`, `CheckedFigure`, `EditableRows`, `CellText` |
| `requirements/` | `RequirementsScreen`, `AlternativeMatrixScreen` | `/requirements`, `/alternatives`, `/alternatives/:matrixId` | 10.3, 10.4 | `requirementsOutline`, `requirementsInOrder`, `requirementsFor`, `addRequirement`, `updateRequirement`, `reorderRequirements`, `setNoneExpected`, `NONFUNCTIONAL_TYPES`, `NONFUNCTIONAL_SUBTYPES`; `addAlternativeMatrix`, `updateAlternativeMatrix`, `removeAlternative`, `removeCriterion`, `matrixScores`; rules RQ and AM through `useAreaFindings('requirements')`, `useAreaFindings('alternatives')` and `useHomeFindings(matrixId)` |
| `interface/` | `InterfaceDiagramScreen`, `TestPlanScreen` | `/interfaces`, `/interfaces/:diagramId`, `/test-plan`, `/test-plan/:testId` | 10.6, 10.5 | `interfacesOn`, `linksOn`, `interfaceReach`, `views.isd`, `INTERFACE_SIZE`, `addInterfaceDiagram`, `addInterface`, `updateInterface`, `moveInterface`, `addNavigationLink`; `testsInOrder`, `addTest`, `updateTest`, `TEST_STAGES`, `TEST_TYPES`; rules ISD and TP through `useAreaFindings('interface')`, `useAreaFindings('testPlan')` and `useHomeFindings` |
| `binder/` | `BinderScreen` | `/binder`, `/binder/:sectionId` | 10.7 | `binderSections`, `PHASES`, `BINDER_LAYOUTS`, `MIGRATION_PLAN`, `addBinderSection`, `updateBinderSection`, `reorderBinderSections`, `addAttachment`, `removeAttachment`, `MAX_ATTACHMENT_BYTES`, `setConversion`, `CONVERSION_OPTIONS`, `conversionEffects`. No rules: nothing in the binder is checked |
| `structure/` | `StructureChartScreen`, `ProgramSpecScreen` | `/structure`, `/structure/:chartId`, `/programs`, `/programs/:moduleId` | 11.3, 11.4 | `modulesOf`, `moduleChildren`, `moduleNumber`, `originalModule`, `chartOfModule`, `fanIn`, `fanOut`, `couplesOf`, `coupleLabel`, `programIo`, `addStructureChart`, `addModule`, `updateModule`, `addCouple`, `updateCouple`, `setProgramSpec`; rules SC and PS-01 through `useAreaFindings('structure')` and `useHomeFindings(chartId)` |
| `workspace/` | `WorkspaceScreen` (unchanged) | `/diagram/:diagramId` (unchanged) | 11.1, 11.2 | The physical mode of the data flow diagram. `useMode`, `useViewModel`, `ModeSwitch`; the fields `implementation`, `human`, `physicalName`, `systemRelated`; `setPhysical`; `systemRelated` on `addProcess`, `addDataStore` and `addFlow`; rules PD-01 to PD-03, which arrive as ordinary diagram findings in physical mode |
| `datamodel/` | `DataModelScreen`, `CrudScreen` (unchanged), `StorageScreen` (a placeholder in `Storage.tsx`) | `/data-model`, `/crud` (unchanged), `/storage` | 11.5, 11.6 | The physical mode of the ERD and of the CRUD matrix, and the storage size estimate. `useMode`, `useViewModel`, `tableFields`, `storageEstimate`, `tableVolume`, `setPhysical`, `setStorage`, `setStorageSettings`, `setDataDetails`, `systemRelated` on `addEntity` and `addAttribute`; rules PDM (area `dataModel`) and VOL-01 through `useAreaFindings('storage')` |
| `project/` | `ProblemsScreen`, `HelpScreen`, `ExportScreen`, `SearchScreen`, `ProjectScreen` (unchanged) | `/problems`, `/help`, `/export`, `/search`, `/project` (unchanged) | 10.8, and the help and search for 10 and 11 | The compiled documents of section 10.8; the new rule families in the help page (`RULE_LIST`, each new rule has `provisional: true`, and the physical ones `physicalOnly: true`); search over the new kinds (`search` already finds them, and `routeOf` gives each one's route); grouping the new areas in the problems list (`FINDING_AREAS`, `AREA_WORDS`, `findingPlace`: `shared.ts` in this folder still sends them to "Whole project" and to the dictionary); `renameProject` for the project's name |

Three screens need no route of their own and no folder: `outline/`, `dictionary/` and
`usecases/` are finished and are not being extended. They read `useModel()`, so they
show system-related items in both modes.

The router is a hash router, so the address bar shows `/#/diagram/dg-1`. Inside the app,
write routes without the hash: `<Link to="/diagram/dg-1">`. `/` opens the sample's child
diagram, or the project's top diagram when the project is not the sample. Read route parameters with `useParams()` from `react-router`. A screen with an
optional parameter (`/dictionary`, `/use-cases`) should show the first item when the
parameter is missing, and a plain message when it names something that does not exist.

Import from the folder indexes:

```ts
import { apply, get, all, elementLabel, cashFlow, requirementsOutline, type Model, type Command } from '../../model';
import { runRules, RULES, RULE_LIST, explain, findingPlace, type Finding } from '../../rules';
import { dispatch, useModel, useViewModel, useMode, useFindings, useAreaFindings, useSelection, selectElements } from '../../store';
import { PageHeader, WorkArea, RightPanel, ListColumn, UndoRedo, DiagramHeader } from '../../frame';
import { Mark, Button, Switch, Tabs, TextField, ProblemList, ProblemsPanel, EntryFields } from '../../components';
import { NumberField, SelectField, EditableRows, CellText, CheckedFigure, ModeSwitch } from '../../components';
import { useTheme } from '../../theme/theme';
import { CLINIC, CLINIC2, dataIdOf } from '../../sample/clinic';
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
    isd: Record<Id, { x: number; y: number }>; // interface positions on their interface structure diagrams, keyed by interface id
  };
  settings: {
    topDiagramId: Id | null;                // the project's top diagram. null means the context diagram
    showFindings: 'always' | 'onRequest';   // 'onRequest' holds the problems back until the student asks
  };
  project: {
    noneExpected: NonfunctionalType[];      // the nonfunctional types marked "none expected" (section 10.3)
    overheadRate: number | null;            // storage: a percentage (section 11.6)
    months: number | null;                  // storage: how many months ahead to estimate
  };
}
```

The mode, logical or physical, is not in the model. It is a session setting of the
store. See "Logical and physical" below.

Every element has `id`, `kind`, `name`, `description`, `aliases: string[]`,
`notes: string` and `origin` (`'student'`, `'starter'` or `'ai'`). An alias is another
name the business uses. It is never a second name: labels, messages and lists show the
`name`, and no rule reads an alias or the notes. The kinds and their extra fields:

| `kind` | Extra fields |
| --- | --- |
| `process` | `parentProcessId: Id \| null` (null for process 0), `ordinal: number`, `processDescription: string` (the longer text of the process entry: what it does, step by step. Separate from the short `description`. No rule reads it), `crud: { dataId, uses }[]`. Physical: `implementation: string`, `human: boolean`, `systemRelated: boolean` |
| `externalEntity` | Physical: `human: boolean` |
| `dataStore` | Its label (D1) comes from `storeLabel`. Physical: `physicalName: string`, `systemRelated: boolean` |
| `dataFlow` | `diagramId`, `sourceId: Id \| null`, `targetId: Id \| null`, `dataId`. Its `name` is always empty: the label is the name of the data it carries. A `null` end is unattached. Physical: `physicalName: string`, `systemRelated: boolean` |
| `controlFlow` | `diagramId`, `targetId`. Its `name` is the starting event |
| `dataStructure` | `components: { dataId, occurs, limit? }[]`, where `occurs` is `'once'`, `'optional'` or `'many'`. `limit` is a whole number, 1 or more: the most times the part can occur. It is kept only while `occurs` is `'many'` |
| `dataElement` | `dataType: string`, `allowedValues?: { value: string, meaning: string }[]`, `length: number \| null`, `nullable: boolean \| null`. `length` and `nullable` are for the entity's dictionary entry. `null` means not filled in. No rule reads them. Physical: `systemRelated: boolean`, `fieldName: string`, `defaultValue: string`. Storage: `averageWidth: number \| null` |
| `diagram` | `diagramKind: 'context' \| 'dfd'`, `decomposesProcessId: Id \| null` (null for the context diagram). Show its title with `diagramTitle`, not its `name` |
| `useCase` | `ordinal`, `priority: 'high' \| 'medium' \| 'low'`, `actorId: Id \| null`, `trigger`, `triggerType: 'external' \| 'temporal'`, `preconditions: string[]`, `postconditions: string[]`, `steps: { text, substeps: string[], information: { direction: 'in' \| 'out', dataId }[] }[]`, `exceptions: { stepNumber, text, steps: string[] }[]` (`steps` is the numbered list of what is done about the exception), `summaryInputs: { dataId, sourceId }[]`, `summaryOutputs: { dataId, destinationId }[]`, `processId: Id \| null` |
| `entity` | `code: string`, `attributes: { dataId, identifier: boolean, repeats: boolean }[]`, `storeId: Id \| null`. `repeats` marks an attribute that can hold several values for one instance. Draw it in braces. Physical: `systemRelated: boolean`, `tableName: string`, `copies: Id[]` (data elements of other entities that this table repeats). Storage: `initialRecords`, `growthPerMonth`, `growthPerYear` (a percentage, used in place of `growthPerMonth` when set), `recordSize` (used only while the entity has no fields), each `number \| null` |
| `relationship` | `ends: [RelationshipEnd, RelationshipEnd]`, `identifying: boolean`. A `RelationshipEnd` is `{ entityId, verbPhrase, min: 0 \| 1 \| null, max: 'one' \| 'many' \| null }`. The values at an entity's end say how many of that entity go with one of the other. `null` means not decided yet: draw a question mark in place of the symbol. Its `name` is always empty. Physical: `foreignKey: boolean`, true once the student has placed the key in the child table |

The kinds of the second release (sections 10 and 11 of the specification):

| `kind` | Extra fields |
| --- | --- |
| `systemRequest` | At most one. `sponsor`, `businessNeed`, `businessRequirements: string[]`, `businessValue: { text, tangible, amount: number \| null, estimates: { label, amount, probability }[] }[]`, `specialIssues`. A probability is a percentage. Its `name` is not used. Read it with `systemRequest(model)` |
| `feasibility` | At most one. `technical: Record<TechnicalFactor, { assessment, reasons }>`, `organizational: Record<OrganizationalFactor, string>`, `economic` (below). Read it with `feasibility(model)` |
| `requirement` | Its sentence is its `name`. `requirementKind: 'user' \| 'functional' \| 'nonfunctional'`, `order: number`, `functionalType: 'process-oriented' \| 'information-oriented' \| null`, `group`, `userGroup` (an optional heading above the group), `nonfunctionalType: NonfunctionalType \| null`, `subtype` (one of `NONFUNCTIONAL_SUBTYPES[type]`, or empty), `priority: 'high' \| 'medium' \| 'low' \| number \| null` (a number is a release), `traceIds: Id[]` (use cases and processes) |
| `alternativeMatrix` | Its `name` is its title. `alternatives: string[]`, `criteria: { name, group: 'technical' \| 'economic' \| 'organizational', weight: number \| null }[]`, `cells: { supportingInformation, score: number \| null }[][]` (`cells[c][a]` is criterion `c`, alternative `a`), `recommendation` |
| `test` | Its `name` is a short title. `ordinal` (shown as T-1), `stage: 'unit' \| 'integration' \| 'system' \| 'acceptance'`, `testType` (one of `TEST_TYPES[stage]`, or empty), `programId: Id \| null` (a module) and `programText`, `version`, `tester`, `dateDesigned`, `dateConducted` (text), `requirementId: Id \| null` and `requirementText`, `objective`, `testCases: { interfaceId: Id \| null, interfaceText, dataField, valueEntered }[]`, `script`, `expectedResults`, `actualResults`, `result: '' \| 'passed' \| 'open items'`. Each "id or text" pair uses the text while the id is `null` |
| `interfaceDiagram` | One interface structure diagram. Its `name` is its title |
| `interface` | `diagramId`, `number: string` (such as `'0'` or `'1.2'`), `processIds: Id[]` |
| `navigationLink` | `diagramId`, `aId`, `bId`. It has no direction. Its `name` is empty |
| `binderSection` | Its `name` is its title. `phase: 'planning' \| 'analysis' \| 'design' \| 'implementation'`, `order: number`, `body: string`, `attachments: { id, name, mimeType, size, dataUrl }[]`, `layout: string \| null` (the key of the `BINDER_LAYOUTS` entry it started from), `conversion: { style, location, modules, reasons } \| null` (present only on a migration plan) |
| `structureChart` | Its `name` is its title. `topModuleId` |
| `module` | `parentModuleId: Id \| null` (null for a top module), `ordinal`, `conditional`, `repeated`, `library`, `repeatsId: Id \| null`, `processId: Id \| null`, and the program specification: `purpose`, `programmer`, `dateDue`, `language`, `events`, `ioNotes: { coupleId, notes }[]`, `pseudocode`, `other` |
| `couple` | `moduleId` (the lower module of the line), `direction: 'down' \| 'up'`, `coupleKind: 'data' \| 'control'`, `dataId: Id \| null`. A data couple has an empty `name` and takes its label from its data. A control couple has a `name` and no data |

The cash flow table, `feasibility.economic`:

```ts
interface Economic {
  firstYear: number;            // the calendar year of year 0
  years: number;                // years forecast after year 0, from 1 to 10. The table has years + 1 columns
  rate: number | null;          // the required rate of return, a percentage
  benefits: CashLine[];
  developmentCosts: CashLine[];
  operationalCosts: CashLine[];
  intangibles: string[];
  roi: number | null;           // typed by the student, a percentage
  breakEven: number | null;     // typed by the student, in years
  npv: number | null;           // typed by the student, in money
}
interface CashLine {
  name: string;
  amounts: (number | null)[];   // one for each column, year 0 first. null counts as 0
  quantity: number | null;      // with unitAmount set as well, the tool fills the line in and ignores amounts
  unitAmount: number | null;
  growthRate: number | null;    // a yearly percentage
  valueIndex: number | null;    // on a benefit: the index of a value in the system request
}
```

**Body text of a binder section.** `body` is plain text. A line that starts with `#`
is a heading, `-` or `1.` a list item, and `|` a table row. The layouts use only these.
The binder agent decides how to show and edit it.

**Attachments.** A file is kept in the model as a data URL, because the project is
saved in `localStorage`. `addAttachment` refuses a file over `MAX_ATTACHMENT_BYTES`
(300 KB) with a plain sentence. Read the file in the screen with `FileReader`'s
`readAsDataURL` and pass the result as `dataUrl`.

**A module used in several places.** A box with `repeatsId` set is one more appearance
of that module. Read its name, library mark and specification from
`originalModule(model, id)`. It has nothing below it. A structure chart has no stored
positions: draw it as a tree from `modulesOf`.

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

The `create` commands `addProcess`, `addDataStore`, `addFlow`, `defineData` (for a data
element), `addEntity` and `addAttribute` (when it makes a new element) also take
`systemRelated?: boolean`.

Commands of the second release. The type `Release2Command` is the union of these, and
`Command` is `CoreCommand | Release2Command`. A patch replaces each field it gives and
leaves the others alone.

| `type` | Arguments | What it does | `created` |
| --- | --- | --- | --- |
| `renameProject` | `name` | Renames the project. Refused when the name is empty | |
| `setPhysical` | `id`, and any of `implementation`, `physicalName`, `human`, `systemRelated`, `fieldName`, `defaultValue`, `averageWidth`, `tableName`, `copies`, `foreignKey` | Sets the physical fields of one element. Give only fields its kind has (see the kinds table): any other is refused. Refused for `systemRelated` on process 0, and for `foreignKey` on a relationship that is many-to-many or not decided | |
| `setStorage` | `entityId`, and any of `initialRecords`, `growthPerMonth`, `growthPerYear`, `recordSize` | Sets a table's storage figures. `null` clears one. Each must be 0 or more, and `initialRecords` whole | |
| `setStorageSettings` | `overheadRate?`, `months?` | Sets the project's two storage figures. `null` clears one | |
| `updateSystemRequest` | `patch: { sponsor?, businessNeed?, businessRequirements?, businessValue?, specialIssues? }`, and `id?`, `origin?` for the first call | Makes the system request if the project has none, then applies the patch. A value may leave out `tangible`, `amount` and `estimates` | the system request, the first time |
| `updateFeasibility` | `technical?` (any factors, each `{ assessment?, reasons? }`), `organizational?` (any factors, each text), `economic?` (any field of `Economic`), and `id?`, `origin?` for the first call | Makes the feasibility analysis if the project has none, then applies what is given. A cash line may leave out everything but `name`. Every line is fitted to `years + 1` amounts, so changing `years` pads or cuts them. Refused when a benefit's `valueIndex` points at no value | the analysis, the first time |
| `addRequirement` | `name`, and any field of `updateRequirement`'s `patch` | Makes a requirement, last in the outline. `requirementKind` defaults to `'functional'` | requirement |
| `updateRequirement` | `id`, `patch: { requirementKind?, functionalType?, group?, userGroup?, nonfunctionalType?, subtype?, priority?, traceIds? }` | Changes a requirement. The fields that do not belong to its kind are cleared, and a nonfunctional one with no type becomes `'operational'`. Use `rename` for the sentence. Refused when a trace is not a use case or a process | |
| `reorderRequirements` | `ids: Id[]` | Puts the requirements in this order. Every requirement must be listed once | |
| `setNoneExpected` | `nonfunctionalType`, `noneExpected: boolean` | Marks a nonfunctional type as "none expected", or clears the mark | |
| `addAlternativeMatrix` | `name`, and `alternatives?`, `criteria?`, `cells?`, `recommendation?` | Makes a matrix. The cells are fitted to the criteria and alternatives, and missing ones start empty | matrix |
| `updateAlternativeMatrix` | `id`, and `alternatives?`, `criteria?`, `cells?`, `recommendation?` | Replaces what is given and fits the cells again. Add a criterion or an alternative by giving a longer list. To reorder, give the list and the `cells` together | |
| `removeAlternative`, `removeCriterion` | `id`, `index` | Removes one column or one row, with its cells | |
| `addTest` | `name`, and any field of `updateTest`'s `patch` | Makes a test. `ordinal` defaults to the next number and `stage` to `'unit'` | test |
| `updateTest` | `id`, `patch` (any field of a test but its name and description) | Changes a test. Refused when two tests would share an ID, or when it names a module, requirement or interface that does not exist | |
| `addInterfaceDiagram` | `name` | Makes an empty interface structure diagram | diagram |
| `addInterface` | `diagramId`, `name`, `number?`, `processIds?`, `x?`, `y?` | Makes an interface and its position. `number` defaults to the lowest whole number not in use, so the first is `'0'` | interface |
| `updateInterface` | `id`, `number?`, `processIds?` | Changes the number or the processes. Refused when the number is empty or another interface on the diagram has it | |
| `moveInterface` | `interfaceId`, `x`, `y` | Moves an interface on its diagram | |
| `addNavigationLink` | `diagramId`, `aId`, `bId` | Links two interfaces. Refused for one interface linked to itself, and for two that are already linked | link |
| `addBinderSection` | `name`, `phase?`, `layout?`, `body?` | Makes a section. With `layout` (a key of `BINDER_LAYOUTS`) it starts with that layout's text and phase, and takes its title when `name` is empty. The layout `'migration-plan'` also gives it an empty conversion strategy | section |
| `updateBinderSection` | `id`, `phase?`, `body?` | Changes the phase or the text. Use `rename` for the title | |
| `reorderBinderSections` | `ids: Id[]` | Puts the sections in this order. Every section must be listed once | |
| `addAttachment` | `sectionId`, `name`, `dataUrl`, `mimeType?`, `attachmentId?` | Attaches a file. Refused when it is over 300 KB, or when `dataUrl` is not a data URL | |
| `removeAttachment` | `sectionId`, `attachmentId` | Removes an attached file | |
| `setConversion` | `sectionId`, and any of `style`, `location`, `modules`, `reasons` | Sets the conversion strategy. `null` clears a choice. Refused on a section that is not a migration plan | |
| `addStructureChart` | `name`, `moduleName?` (default: the chart's name), `moduleId?`, `ordinal?` (default 1), `processId?` | Makes a chart and its top module. `id` names the chart | chart, top module |
| `addModule` | `parentModuleId`, `name`, and any of `ordinal`, `conditional`, `repeated`, `library`, `repeatsId`, `processId` | Makes a module below another. `ordinal` defaults to the next number. Refused below a box that repeats another module | module |
| `updateModule` | `id`, `patch: { parentModuleId?, ordinal?, conditional?, repeated?, library?, repeatsId?, processId? }` | Changes a module, or moves it under another. The top module's `ordinal` may be changed, so that a chart can carry its process's number. Refused when it would break an invariant of section 11.3 | |
| `setProgramSpec` | `moduleId`, `patch: { purpose?, programmer?, dateDue?, language?, events?, ioNotes?, pseudocode?, other? }` | Sets the program specification. `ioNotes` replaces the whole list, and a row with empty notes is dropped. Refused on a box that repeats another module | |
| `addCouple` | `moduleId`, `direction`, `coupleKind`, then for a data couple `dataId` or `dataName`, and for a control couple `name?` | Adds a couple to the line above a module. With `dataName` it carries the definition of that name, or a new data element. Refused on a top module | couple, then the new element if one was made |
| `updateCouple` | `id`, `direction?`, `coupleKind?`, `dataId?` or `dataName?` | Changes a couple. Making it a control couple drops its data. Use `rename` for a control couple's name | the new element, if one was made |

`deleteElement` deletes any of the new kinds. What goes with it:

- A structure chart takes its modules. A module takes the modules below it, the boxes
  that repeat it, and its couples. The top module is refused: delete the chart.
- An interface structure diagram takes its interfaces and links. An interface takes its
  links.
- A test that named a deleted requirement, module or interface keeps its name as text.
- A deleted process or use case is dropped from every `traceIds` and `processIds`, and
  from the `processId` of a module.
- A data definition that a couple carries is refused unless `cascade` is true, as for a
  flow.

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

Queries of the second release, in `src/model/queries2.ts`:

| Function | Returns |
| --- | --- |
| `systemRequest(model)`, `feasibility(model)` | The one form, or `undefined` while the project has none |
| `requirementsInOrder(model)` | Every requirement, in outline order |
| `requirementsOutline(model)` | `{ user, functional, nonfunctional }`. `user` is `{ requirement, number }[]`, numbered `U1`, `U2`. `functional` is the groups, each `{ number, name, userGroup, requirements }`, numbered `1`, `2` with requirements `1.1`, `1.2`. Groups under one `userGroup` are next to each other. `nonfunctional` is always the four types, each `{ type, number, noneExpected, requirements }`, numbered from `1` again |
| `requirementNumber(model, id)` | `'1.2'`, `'U1'` |
| `requirementsFor(model, useCaseId)` | The requirements traced to a use case, directly or through its process |
| `processesBelow(model, processId)` | The ids of a process and every process below it |
| `testsInOrder(model)` | Every test, in ID order |
| `interfacesOn(model, diagramId)`, `linksOn(model, diagramId)` | The interfaces and links of one interface structure diagram |
| `interfaceReach(model, diagramId)` | `{ menu, distance, below }`: interface 0, how many links each interface is from it (an unreachable one is not in the map), and `below(id)`, the linked interfaces one step further away |
| `PHASES` | The four phases, in order |
| `binderSections(model, phase?)` | The sections in order, all or those of one phase |
| `modulesOf(model, chartId)` | `{ module, depth, number }[]`: the chart as a tree in reading order, the top module first |
| `moduleChildren(model, moduleId)` | The modules directly below one, in number order |
| `chartOfModule(model, moduleId)` | The chart a module is on |
| `moduleNumber(model, moduleId)` | `'1'`, `'1.2'`, `'1.2.1'` |
| `originalModule(model, moduleId)` | The module a box stands for: the one it repeats, or itself |
| `fanOut(model, moduleId)`, `fanIn(model, moduleId)` | The modules directly below; one plus the boxes that repeat it |
| `couplesOf(model, moduleId)` | The couples on the line above a module |
| `coupleLabel(model, couple)` | The name of its data, or its own name for a control couple |
| `programIo(model, moduleId)` | `{ inputs, outputs }`, each a list of `{ couple, name, type, otherModuleId, otherLabel, notes }`, listed from the chart as section 11.4 says. `type` is the data type, `'Structure'`, or `'Flag'` |
| `tableFields(model, entityId)` | The fields of a table in physical mode: `{ dataId, element, name, pk, fk, copy, fromEntityId, relationshipId }[]`. Its own attributes, then the primary key fields of each parent whose foreign key has been placed (tagged `pk` too in an identifying relationship), then its copies. `name` is the field name, or the logical name while there is none |
| `storageEstimate(model)` | `{ overheadRate, months, tables, initialVolume, finalVolume }`. Each table is `{ entity, name, fields, typedSize, growthBy, recordSize, totalRecordSize, initialVolume, growth, finalRecords, finalVolume }` |
| `modelForMode(model, mode)` | The model as a mode shows it. See "Logical and physical" |
| `isSystemRelated(element)` | Whether an element is marked system-related |
| `routeOf(model, id)` | `{ route, where }` for any element: the answer `search` gives |

`elementLabel` and `KIND_WORDS` cover the new kinds: `'1.2 The system will…'` for a
requirement, `'T-1 Free times…'` for a test, `'1.1 Book Appointment'` for an interface,
`'1.1.2 Book Slot'` for a module, the data name or flag name for a couple.

Fixed lists, in `src/model/forms.ts` and `src/model/binder.ts`:

| Name | What it holds |
| --- | --- |
| `TECHNICAL_FACTORS`, `ORGANIZATIONAL_FACTORS`, `FACTOR_WORDS` | The four and the five feasibility factors, and their words |
| `NONFUNCTIONAL_TYPES`, `NONFUNCTIONAL_SUBTYPES` | The four types, and the fifteen sub-types by type |
| `TEST_STAGES`, `TEST_TYPES` | The four stages, and the types of test by stage |
| `BINDER_LAYOUTS` | The fourteen starting layouts of section 10.7, each `{ key, title, phase, chapter, body }`. `MIGRATION_PLAN` is the key `'migration-plan'` |
| `CONVERSION_OPTIONS` | For `style`, `location` and `modules`: every option, each `{ title, meaning, risk, cost, time, explanation }`, where the three levels are `'low'`, `'medium'` or `'high'` |
| `conversionEffects(strategy)` | The same entries for the choices made so far, each with `choice` and `option`. Show them beside the student's reasons. Nothing is marked wrong |
| `MAX_ATTACHMENT_BYTES`, `INTERFACE_SIZE` | 307,200; `{ width: 150, height: 90 }` |

### Calculations

Pure functions in `src/model/calc.ts`, tested against hand-worked figures in
`calc.test.ts`. None reads the model.

| Function | Returns |
| --- | --- |
| `expectedValue(estimates)`, `probabilityTotal(estimates)` | Each amount multiplied by its probability, added up; the probabilities added up |
| `isQuantityLine(line)` | Whether the tool fills the line in: `quantity` and `unitAmount` are both set |
| `lineAmounts(line, years, section)` | The amounts of one line, year 0 first. `section` is `'benefits'`, `'developmentCosts'` or `'operationalCosts'` |
| `presentValue(value, rate, year)` | The value divided by (1 + rate) to the power of the year |
| `cashFlow(economic)` | Every worked-out figure: `yearLabels`, `lines` (each line's amounts, by section), and for each column `benefits`, `developmentCosts`, `operationalCosts`, `costs`, `net`, `cumulative`, `pvBenefits`, `pvCosts`; `totals`; and `roi` (a percentage), `breakEvenYear`, `breakEven` and `npv`, each `null` when the formula gives nothing |
| `checkMeasures(economic)` | `{ roi, breakEven, npv }`, each `{ typed, expected, status, allowance, typedText, expectedText, working }`. `status` is `'empty'`, `'match'`, `'mismatch'`, `'none'` (a break-even point typed when there is none) or `'unknown'`. `working` is the formula step by step with the table's figures. Pass `status` to `CheckedFigure` |
| `matrixScores(matrix)` | `{ weighted, totals, weightTotal }`: each score multiplied by its weight, the total for each alternative, and the weights added up |
| `recordSizeOf(widths)` | The widths added up |
| `growthRecords(input, months)` | The records added over the months |
| `tableVolume(recordSize, overheadRate, input, months)` | `{ recordSize, totalRecordSize, initialVolume, growth, finalRecords, finalVolume }` |
| `formatNumber(n, digits?)`, `formatPercent(n, digits?)` | `'21,763'`, `'36.4%'` |

A typed measure passes within 0.1 of a percentage point for return on investment, 0.01
of a year for the break-even point, and one unit of money for each column of the table
for net present value.

### Logical and physical

A physical model is not a copy (section 11.1). The store holds the mode, `'logical'` or
`'physical'`, as session state. The top bar has the switch.

- `useMode()` gives the mode. `setMode(mode)` changes it. `ModeSwitch` is the switch.
- `useViewModel()` gives the model as the mode shows it. In physical mode that is the
  model. In logical mode it is `modelForMode(model, 'logical')`: everything marked
  `systemRelated` is left out, with the flows at a removed process or store, the flows
  that carry removed data, the processes and diagrams below a removed process, and a
  data structure whose parts are all left out. It is a model like any other, so every
  query works on it. **Draw and list from `useViewModel()`.** Keep `useModel()` for what
  must see everything.
- The findings are worked out for the current mode, on that mode's model.
- A screen for physical work (the physical names, the table and field names, the
  storage size estimate) should say so when the mode is logical and offer `ModeSwitch`,
  because its rules run in physical mode only.

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

A search by text also looks in the longer text of the new kinds: the fields of the
system request, a binder section's body and file names, a module's purpose and
pseudocode, a test's objective and results, and a matrix's recommendation.

Also exported: `apply`, `applyAll(model, commands)` (throws if one is refused),
`checkInvariants(model)`, `emptyModel()`, `NODE_SIZE`, `normalizeModel(value)` (turns
parsed JSON into a model, filling in fields an older file lacks, and throws an `Error`
with a plain message when it is not a project) and `asStarter(model)` (a copy with every
origin set to `'starter'`).

## The rules (`src/rules/`)

`runRules(model, mode = 'logical')` returns every finding for one mode. The store runs
it after each change and when the mode changes, so a screen reads findings from the
store and never calls it.

In logical mode the rules run on `modelForMode(model, 'logical')`, and the rules marked
`physicalOnly` (PD, PDM and VOL) do not run. In physical mode they run on the whole
model.

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
  diagramId: Id | null;       // the data flow diagram it belongs to
  homeId: Id | null;          // the matrix, interface structure diagram, structure chart or test it belongs to
  area: FindingArea;          // where it is counted
  values: Record<string, unknown>;                // the named values that filled the message
  message: string;            // ready to show
  why: string;                // ready to show
  fix: string;                // ready to show
}
```

Each finding is counted in exactly one place. A finding with a `diagramId` belongs to
that diagram and has `area: 'diagram'`. Every other finding has `diagramId: null` and
one of these areas, listed in `FINDING_AREAS` in the order the navigator shows them:

| `area` | Rules | `homeId` |
| --- | --- | --- |
| `systemRequest` | SR | `null` |
| `feasibility` | FA | `null` |
| `requirements` | RQ | `null` |
| `diagram` | DFD and BAL, and PD in physical mode | `null`: `diagramId` says which diagram |
| `dictionary` | DFD-01, DFD-02, DFD-13 and DD, about a data definition | `null` |
| `dataModel` | ERD and DM, and PDM in physical mode | `null` |
| `alternatives` | AM | The matrix |
| `interface` | ISD | The interface structure diagram. `null` for ISD-04 |
| `structure` | SC and PS-01 | The structure chart. `null` for SC-07 |
| `storage` | VOL, in physical mode | `null` |
| `testPlan` | TP | The test for TP-01. `null` for TP-02 |

`AREA_WORDS` gives the words for each area. `findingPlace(finding)` gives
`{ to, text }`: the route where a finding is counted and words for a link to it, such
as `{ to: '/feasibility', text: 'Open feasibility analysis' }`. A PS-01 finding leads
to `/programs/:moduleId`. `ProblemCard` shows that link whenever the card is not
already on that page.

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
`{ id, severity, when, message, why, fix, provisional?, physicalOnly? }`, for the help
page; `countFindings(findings)` gives `{ errors, warnings }`;
`findingsForDiagram(findings, diagramId)`, `findingsForArea(findings, area)` and
`findingsForHome(findings, homeId)`; `physicalDfdStarted(model)`,
`physicalDataModelStarted(model)` and `storageStarted(model)`, which say whether each
set of physical rules is running.

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

### The rules of the second release

All 36 are in the catalogue with `provisional: true`, because the specification lists
them and leaves their wording and severity open. `engine2.ts` holds them, and
`release2.test.ts` shows each one firing and not firing.

| Family | Rules | Runs when | Severity |
| --- | --- | --- | --- |
| SR | SR-01 to SR-03 | The project has a system request | SR-01 is a warning. SR-02 and SR-03 are errors |
| FA | FA-01 to FA-05 | The project has a feasibility analysis | FA-02, FA-03 and FA-04 are errors. FA-01 and FA-05 are warnings |
| RQ | RQ-01 to RQ-03 | RQ-01 always. RQ-02 and RQ-03 only when the project has a requirement | Warnings |
| AM | AM-01 to AM-03 | For each matrix | AM-01 and AM-02 are errors. AM-03 is a warning |
| TP | TP-01, TP-02 | TP-01 for each test. TP-02 only when the project has a test | Warnings |
| ISD | ISD-01 to ISD-04 | ISD-03 only when the level 0 diagram has processes. ISD-04 only when the project has an interface structure diagram | ISD-01 and ISD-02 are errors. The others are warnings |
| SC | SC-01 to SC-07 | SC-07 only when the project has a structure chart | SC-01 and SC-05 are errors. The others are warnings |
| PS | PS-01 | For each module that does not repeat another | Warning |
| PD | PD-01 to PD-03 | Physical mode, once any physical field of the data flow diagrams is filled in | Warnings |
| PDM | PDM-01 to PDM-04 | Physical mode, once any physical field of the data model is filled in | PDM-04 is an error. The others are warnings |
| VOL | VOL-01 | Physical mode, once any storage figure is typed | Warning |

What `elementIds` and `values` hold, where a screen is likely to use them:

| Rule | One finding for | `elementIds` | `values` |
| --- | --- | --- | --- |
| SR-01 | Each empty field | The system request | `field`: the field in words |
| SR-02, SR-03 | Each value with estimates | The system request | `index` (into `businessValue`), `text`. SR-02: `total`. SR-03: `typed`, `expected`, `working` |
| FA-01 | Each of the two parts | The analysis | `part` (`'technical'` or `'organizational'`), `factors` (words), `missing` (the factor keys) |
| FA-02, FA-03, FA-04 | The measure | The analysis | `typed` (text), `expected` (number or `null`), `steps: string[]`, `working` (the steps joined). The same working is in the finding's `fix` |
| FA-05 | Each linked benefit | The analysis, the system request | `index` (into `benefits`), `name`, `amount`, `value`, `text` |
| RQ-01, TP-02 | Each requirement | The requirement | `number`, `name` |
| RQ-02 | Each use case | The use case | `name` |
| RQ-03 | Each type | None | `type` |
| AM-02, AM-03 | Each matrix | The matrix | `count`, and the cells as `{ criterion, alternative }[]`: `cells` for AM-02, `where` for AM-03 |
| TP-01 | Each test | The test | `number`, `fields` (what is missing) |
| ISD-02, ISD-03 | Each interface | The interface | `name`, `number` |
| ISD-04, SC-07 | Each process | The process | `name` |
| SC-01, SC-02 | Each module or control couple | The module, or the couple then its module | |
| SC-05, SC-06 | Each name; each repeated module | The modules | `name`, and `count` for SC-06 |
| PS-01 | Each module | The module | `fields` (`'purpose'`, `'pseudocode'`) |
| PD-02 | Each data store or flow | The store, or the flow then its data | `name` |
| PDM-01, VOL-01 | Each table | The entity, then the fields that lack something | `missing` (words) |
| PDM-03 | Each relationship | The relationship, then its two entities | `first`, `second`, `child` |
| PDM-04 | Each repeated name | The tables, or the table then the fields | `name` |

Choices made here, where the specification leaves a point open:

- **What a missing measure means.** FA-02 to FA-04 say nothing while the measure has
  not been typed. `CheckedFigure` shows "Not typed yet".
- **SR-03** allows a difference of one unit of money, and is reported when the amount
  is empty.
- **FA-01** is one finding for each part, naming the factors that are missing.
- **FA-05** compares the benefit's amount in year 1 with the value's amount, and allows
  a difference of one unit of money.
- **RQ-02** counts a requirement traced to the use case's process as traced to the use
  case.
- **AM-02 and AM-03** are one finding for each matrix, with a count.
- **ISD-03.** "Below" means linked and one step further from interface 0, because a link
  has no direction. An interface that cannot be reached is left to ISD-02.
- **SC-05** looks across every chart of the project.
- **The physical rules wait until the work is started,** so that switching to physical
  mode on a logical model does not report every process, flow and table at once.
- **PDM-02 takes the place of ERD-04 in physical mode.** In both modes a system-related
  identifier counts as an identifier, as section 11.5 says.
- **PD-03** is one finding for the project, counted on the top diagram.
- **PDM-01 and VOL-01** are one finding for each table, naming what is missing.

`explain(model, finding)` returns the text for the "AI explanation" box. **No AI model
is called anywhere in the prototype.** The text is put together from the finding's own
values. It shows where an AI explanation would sit and how it would be marked.

## The store (`src/store/`)

One store holds the model, the mode, the findings, the undo and redo history, and the
selection. The mode starts as `'logical'` on every visit and is not saved.
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
| `setMode(mode)` | Shows the model as `'logical'` or `'physical'` and works the findings out again for that mode. It does not change the model, so it is not an undo step and does not hide findings that are being shown |
| `selectElements(ids)` | Selects elements. It also selects the first finding that names the first of them, if there is one |
| `selectFinding(findingId \| null)` | Selects a finding and, with it, the elements the finding names |
| `clearSelection()` | Selects nothing |
| `clearError()` | Hides the strip that shows a refused command |
| `getModel()`, `getMode()`, `getFindings()`, `getFindingsVisible()` | The current values, for code outside a component. `getFindings()` gives every finding of the current mode even while they are hidden |

Hooks:

| Hook | Returns |
| --- | --- |
| `useModel()` | The whole model |
| `useMode()` | `'logical'` or `'physical'` |
| `useViewModel()` | The model as the mode shows it. See "Logical and physical" |
| `useFindings()` | Every finding of the current mode, errors first. Empty while the findings are hidden, as are the next five |
| `useFindingsVisible()` | Whether the findings are being shown |
| `useDiagramFindings(diagramId)` | The findings that belong to one diagram |
| `useAreaFindings(area)` | The findings counted in one area, such as `'feasibility'` |
| `useHomeFindings(homeId)` | The findings that belong to one matrix, interface structure diagram, structure chart or test |
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
| `nav-section`, `nav-group-toggle`, `nav-group-arrow`, `nav-item`, `nav-subgroup` | Used by the navigator's groups |
| `visually-hidden` | Text for screen readers only |
| `is-numeric` | On a `th` or `td` of a `table`: right-aligned and monospaced, for numbers |
| `number-field`, `number-field-box`, `number-field-input`, `number-field-unit`, `number-field-bare` | Used by `NumberField` |
| `cell-text` | Used by `CellText` |
| `editable-rows`, `editable-rows-table`, `editable-rows-controls` | Used by `EditableRows` |
| `checked-figure`, `checked-figure-status` | Used by `CheckedFigure` |

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
"Logical" and "Physical" switch, the light and dark switch, the project's live error and
warning counts for the current mode (a link to `/problems`), and "Export PDF" (a link to
`/export`). While the findings are hidden, the words "Problems hidden" and a "Check now"
button take the place of the counts.

The navigator groups the parts of the project under the textbook's four phases, then
the binder, then the rows for the whole project. Every count is live.

| Group | Rows |
| --- | --- |
| Planning | "System request" and "Feasibility analysis", each with its marks |
| Analysis | "Requirements definition" with its marks and a count, "Use cases" with a count, the small heading "Diagrams" and one row for each diagram as a tree with its marks, "Data dictionary" with its marks and a count, "Data model" with its marks, "CRUD matrix" |
| Design | "Alternative matrix", "Interface structure", "Structure charts", "Program specifications" and "Storage size estimate", each with its marks. When the project has more than one interface structure diagram or structure chart, each gets a row of its own below |
| Implementation | "Test plan" with its marks and a count |
| Binder | "Contents" with the number of sections, then one row for each section, with the number of files attached to it |
| (no heading) | "Search", "Project", "Problems" with the total, and "Help: symbols and rules" at the bottom |

A group's heading is a button that closes and opens it. The choice is kept in
`localStorage` under `diagramble.prototype.nav.closed`. While a group is closed, its
heading shows the marks of everything inside it, so that no problem is hidden. The
diagrams, the dictionary count and the data model marks follow the mode: a
system-related diagram or definition is listed in physical mode only. A diagram above
the top diagram is shown in muted text with the words "above the project" and no marks.
While the findings are hidden, no marks are shown and the "Problems" row says "hidden".

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

The form controls, in `src/components/forms.tsx`. They were added because three or more
of the new screens need each one.

| Component | Props | What it is |
| --- | --- | --- |
| `NumberField` | `label`, `value: number \| null`, `onCommit(value)`, `unit?: 'money' \| 'percent' \| 'plain'`, `suffix?`, `hint?`, `placeholder?`, `readOnly?`, `hideLabel?`, `size?` (characters, default 10) | A box for one number, right-aligned and monospaced. It keeps its own draft and calls `onCommit` when it loses focus, or on Enter, with the number or `null` when cleared. It is not called when nothing changed. Commas, spaces, "$" and "%" are ignored. Text that is not a number is not reported: the box turns to the error colour and says what to type. `'money'` groups the digits and `'percent'` shows "%" after the box |
| `SelectField` | `label`, `value`, `options: { value, label }[]`, `onChange(value)`, `hint?`, `hideLabel?`, `disabled?` | A labelled list to choose one option from |
| `CellText` | `label`, `value`, `onCommit(value)`, `placeholder?`, `rows?` | A text box for a table cell, with no visible label. It reports the text when it loses focus, if it changed |
| `EditableRows` | `label`, `rows: T[]`, `columns: { key, heading, width?, numeric?, render(row, index, set) }[]`, `onChange(rows)`, `newRow?()`, `addLabel?`, `emptyText?`, `fixedOrder?`, `fixedRows?`, `footer?`, `hideHeadings?` | A table of rows with "Up", "Down" and "Remove" beside each and an add button below. It holds no state: any edit, add, removal or move calls `onChange` with the whole new list, so dispatch one command from it. In `render`, call `set(row)` with the changed row. `footer` takes `<tr>` rows for totals. A list of plain text is one column with `hideHeadings` |
| `CheckedFigure` | Every `NumberField` prop but `hint`, and `status: 'empty' \| 'match' \| 'mismatch' \| 'none' \| 'unknown'`, `note?` | A figure the student types, with a mark beside it: the OK mark for a match, the error mark for a mismatch, and the "missing" look when nothing is typed. It never shows the right answer: the finding's card shows the working. While the findings are held back it shows no verdict. `status` is `checkMeasures(...).roi.status`, or for an expected value work it out with `expectedValue` |
| `ModeSwitch` | `small?` | The "Logical" and "Physical" switch, wired to the store |

Also exported: `numberText(value, unit)` and `parseNumber(text)`, which `NumberField`
uses.

The marks follow section 1.2 of the briefs. Each mark means one thing. Use the error and
warning marks only for findings, the OK mark only where the rules ran and found nothing,
and the AI mark only around text an AI wrote. The app has no other status labels.

## The sample data (`src/sample/clinic.ts`)

"Clinic appointments", exactly as section 1.4 of the briefs describes it, plus three use
cases, a small data model, and content of every kind of the second release
(`src/sample/clinic2.ts`). It is the project the app starts with. It is built with
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
| System request, feasibility analysis | `CLINIC2.systemRequest` (`sr`), `CLINIC2.feasibility` (`fa`) |
| Requirements | User: `rq-u1`, `rq-u2`. Functional: `CLINIC2.fFreeTimes`, `fBook`, `fConfirm`, `fClientDetails`, `fVisitNotes`, `fDailyList` (`rq-f1` to `rq-f6`). Nonfunctional: `rq-n1` to `rq-n4` |
| Alternative matrix | `CLINIC2.matrix` (`am-1`) |
| Tests | `t-1` to `t-5` |
| Interface structure diagram | `CLINIC2.interfaceDiagram` (`isd-1`) |
| Interfaces | `CLINIC2.ifMenu`, `ifAppointments`, `ifBook`, `ifConfirm`, `ifFindClient`, `ifVisit`, `ifSchedule` (`if-menu`, `if-appointments`, `if-book`, `if-confirm`, `if-find-client`, `if-visit`, `if-schedule`) |
| Binder sections | `CLINIC2.binderCharter`, `binderRisk`, `binderInterviews`, `binderMigration` (`b-charter`, `b-risk`, `b-interviews`, `b-migration`). The attachment is `at-diary-sketch` |
| Structure chart | `CLINIC2.chart` (`sc-1`) |
| Modules | `CLINIC2.mTop`, `mSchedule`, `mCheck`, `mBook`, `mConfirm`, `mRead`, `mRecord`, `mDaily` (`m-top`, `m-schedule`, `m-check`, `m-book`, `m-confirm`, `m-read`, `m-record`, `m-daily`), and the two boxes that repeat `mRead`: `mReadAgain1`, `mReadAgain2` (`m-read-2`, `m-read-3`) |
| Couples | `cp-schedule-in`, `cp-schedule-out`, `cp-check-in`, `cp-check-out`, `cp-check-none`, `cp-book-slot`, `cp-book-client`, `cp-book-out`, `cp-confirm-in`, `cp-confirm-out`, `cp-read-in`, `cp-read-out`, `cp-read-end`, `cp-record-in`, `cp-record-out`, `cp-daily-out` |

Flows, occurrences and navigation links have generated ids. Find them with `flowsOn`,
`occurrencesOn` and `linksOn`.
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

The second-release content, all invented for this project:

| What | What it holds |
| --- | --- |
| System request | Every field filled. Three values: one tangible with three estimates whose expected value, 18,000, is typed correctly; one tangible with a plain amount, 9,000; one intangible |
| Feasibility analysis | All nine assessments. A cash flow table for 2027 with three more years at 6%: two benefits (one typed, one given as 450 hours at 20 with 5% growth, each linked to a value of the system request), three development costs (one given as 40 hours at 25) and two operational costs. Total benefits 82,372.50 and total costs 47,000. The break-even point, 1.42 years, and the net present value, 28,112, are typed correctly. The return on investment is typed as 42.9%, where the formula gives 75.3% |
| Requirements definition | Two user requirements. Six functional requirements in three groups under the headings "Front desk" and "Veterinarians", traced to the use cases and processes. Four nonfunctional requirements with sub-types. "Cultural and political" is marked as none expected |
| Alternative matrix | "How to get the appointment system": three alternatives, five criteria whose weights add up to 100, fifteen scored cells and a recommendation |
| Test plan | Five tests across the unit, integration and system stages, each pointing at a requirement, a module and interfaces. One has passed and one has open items |
| Interface structure diagram | "Clinic System interfaces": seven interfaces from "0 Main Menu" down, six links that form a tree and one shortcut across it |
| Binder | "Project charter" and "Risk assessment" (planning, from their layouts), "Interview notes: front desk" (analysis, no layout, with a small SVG image attached), and "Migration plan" (implementation) with the conversion strategy parallel, pilot and whole-system, and reasons |
| Physical data flow diagram | An implementation on six of the seven processes. Both external entities are marked as human. The data store and 18 of the 19 flows have physical names |
| Structure chart | "Clinic System": ten modules, one for each process, with the library module "Read Appointments" drawn in three places, 14 data couples and 2 flags. "Book Slot" has every field of its program specification filled in. The other modules have a purpose, a language and pseudocode |
| Physical data model | A table name on each entity and a field name, length and "null" on each attribute. The foreign key is placed for Client and Pet. The appointment table repeats "Pet Name" as a copy |
| Storage figures | An overhead rate of 30% and 24 months. Initial records and growth on each table: by month for Client and Pet, and 12% a year for Appointment. An average width on seven of the eight fields |

Nothing in the sample is system-related, because the first-release tests fix its
counts of processes, data stores, flows, definitions and entities. To see the logical
view hide something, add a system-related item by hand.

`buildClinic(options)` takes `mistakes`, `useCases`, `dataModel` and `secondRelease`
(each default true). The second-release content needs the use cases and the data model.
With `mistakes: false` the sample has none of its deliberate slips, and its only
findings are DM-01 twice.

### The sample's findings

In logical mode, the mode the app starts in, there are exactly these eleven: the five of
the first release and six new ones. The top bar shows 2 errors and 9 warnings.

| Rule | Severity | Counted on | Message |
| --- | --- | --- | --- |
| FA-02 | Error | Feasibility analysis | The return on investment you typed, 42.9%, does not match the table. |
| BAL-01 | Error | 1 Schedule Appointment | 'Appointment Request' enters 'Schedule Appointment' on the parent diagram but does not fully enter this diagram. Missing: Client Details. |
| RQ-01 | Warning | Requirements definition | Requirement 1.4 is not traced to a use case or a process. |
| DFD-13 | Warning | Level 0 | 'Produce Daily Schedule' has no description. |
| BAL-03 | Warning | 1 Schedule Appointment | 'Booking Info' crosses the edge of this diagram but not 'Schedule Appointment' on the parent diagram. |
| DM-01 | Warning | Data model | 'Client' is not held in any data store. |
| DM-01 | Warning | Data model | 'Pet' is not held in any data store. |
| AM-03 | Warning | Alternative matrix | 'How to get the appointment system' has 1 cell with no supporting information. |
| ISD-03 | Warning | Interface structure | 'Find Client' has nothing below it and names no process. |
| PS-01 | Warning | Structure charts | The program specification of 'Send Confirmation' has no pseudocode. |
| TP-02 | Warning | Test plan | No test addresses requirement 3.1. |

Physical mode adds exactly these four, for 2 errors and 13 warnings:

| Rule | Severity | Counted on | Message |
| --- | --- | --- | --- |
| PD-01 | Warning | Level 0 | 'Record Visit' has no implementation and is not marked as human work. |
| PD-02 | Warning | 1 Schedule Appointment | The flow 'Available Slot' has no physical name. |
| PDM-03 | Warning | Data model | The relationship between 'Pet' and 'Appointment' has no foreign key. |
| VOL-01 | Warning | Storage size estimate | 'Appointment' has no average width for Reason for Visit. |

Both lists are fixed by the tests under "The whole sample" in `release2.test.ts`. The
five findings of the first-release part alone are fixed by the older tests, which now
build it with `buildClinic({ secondRelease: false })`.

A browser that already holds a saved project keeps it, because the storage key has not
changed. The new content appears after "Start again from the sample data" on the
project page.

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

No starter holds second-release content yet, so none has a second-release finding, in
either mode.

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
- **The interface structure diagram and the structure chart are kinds of their own,**
  `interfaceDiagram` and `structureChart`, where the specification makes them kinds of
  diagram. Every first-release screen takes a `diagram` to be a data flow diagram.
- **One mode for the whole project.** The specification lets each diagram and the
  matrix be shown in either mode. The prototype has one switch, because the findings
  are worked out for one mode at a time.
- **A structure that holds only system-related data is left out of the logical view.**
  The specification gives a data structure no mark of its own.
- **A line given as a quantity and a unit amount starts in year 1** for a benefit or an
  operational cost, and falls in year 0 alone for a development cost. The specification
  says "the first year" and no more.
- **Growth as a yearly percentage is compounded at the end of each whole year,** so a
  part of a year at the end adds nothing. The specification says only that it compounds
  once a year.
- **The net present value allowance is one unit of money for each column,** counting
  year 0.
- **"A requirement, or text"** and the two like it on a test are two fields each, an id
  and a text.
- **User requirements are numbered U1, U2.** The specification gives them no numbers.
- **The fifteen sub-types, the types of test and the conversion table** were written
  from general knowledge of the subject, not copied from the textbook. Check them
  against Figures 7-5 to 7-8, 11-4 and 12-4.
- **A binder section's body is plain text** with marks for headings, lists and tables.
- **No rule reads `repeated` or `events`,** and nothing checks `copies`, as the
  specification says.

## What is waiting for a screen

Everything the first-release screens were given is in use. The shared code of the
second release is all waiting: see "What each screen agent builds". Until those screens
are built:

- The five new folders and `/storage` show placeholders with their problems beside them.
- The diagram canvas, the outline, the ERD and the CRUD matrix read `useModel()`, so
  they show system-related items in both modes and no physical names.
- The problems page groups the new areas under "Whole project" and offers them a link
  to the dictionary (`src/screens/project/shared.ts`). The link on each problem card is
  already right.
- The help page lists the new rules, because it reads `RULE_LIST`, with no page about
  the new symbols.
- The export has none of the compiled documents of section 10.8.
- No screen calls `renameProject`.

Known leftover from the first release: the refusal text of `carryDown` says "carry
down" where the buttons say "Bring down new flows".

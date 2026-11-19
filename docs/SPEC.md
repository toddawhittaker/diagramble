# Diagramble: Core Specification for Release 0

17 November 2026 · Draft for review

This document specifies the core of Diagramble narrowly: the semantic model, the first
rules for data flow diagrams, and three test cases. It is the basis for the Release 0
prototype described in the [product vision](VISION.md). Sections 8 to 11 go further.
They fix the shape of what the first and second releases add, so that the core does not
have to change later. They are not built in Release 0.

It follows the course textbook: Dennis, Wixom and Roth, *Systems Analysis and Design*,
8th edition. Page and figure numbers in this document are that book's printed ones.
Section 13 lists what was checked against it.

Revised on 17 November 2026 after two Visible Analyst tutorials were read. Section 13
ends with every check those tutorials show, set against the rules here. Section 14.4
lists what was taken from Visible Analyst and what was left out. Revised again after the
exercises of every chapter were read against it. Section 14.5 lists what that changed.

Terms used throughout: a data flow diagram (DFD) shows processes, data stores, external
entities and the data flowing between them. An entity relationship diagram (ERD) shows
the data model. The data dictionary holds the definition of every piece of data. The
top diagram is the context diagram. The one below it is the level 0 diagram, and below
that come level 1 and level 2 diagrams.

## 1. Decisions

These were decided on 17 November 2026. Where they differ from the product vision, this
document wins. Section 14 records the smaller points settled the same day.

| Decision | Choice | Effect |
| --- | --- | --- |
| License | Business Source License 1.1, decided on 18 November 2026. Free production use for non-profit organizations (including credit-bearing tuition), individuals' own study and teaching (including students at for-profit schools), and a one-time paid setup for a non-profit that hosts the tool itself, all only with a copy obtained free or from the author. A commercial license is needed for any other use by a for-profit organization; for a company paid to run a college's courses that use it; for selling or bundling; for any recurring charge for hosting, operating, maintaining or supporting it, even to a non-profit; and for paid training that earns no academic credit. A "charge" includes indirect income such as advertising, data, revenue shares and paid bundles. Each version becomes AGPL-3.0-or-later four years after it is published. The full terms are in `LICENSE`, and a plain-language summary is in `LICENSING.md` | It is not an open source license. No dependency may be under the GPL or the AGPL alone, because those would require the whole tool to use the same license. Libraries under the Eclipse Public License are allowed. elkjs is used under its "EPL-2.0" option, which section 14 confirms. Outside contributions need a contributor license agreement, so that commercial licenses can be sold |
| First deployment | Hosted by the project's author | The trial launch in Release 0 runs against that deployment. Who hosts for other institutions is not decided |
| Textbook | Dennis, Wixom and Roth, *Systems Analysis and Design*, 8th edition (Wiley, 2022) | The tool is built for this book. It sets the symbol style, the names of things, the limits and the wording of the rules. See section 13 |
| Course coverage | Chapters 1 to 12. Chapter 13, on agile methods, is not covered | The design diagrams of chapters 9 and 10 join the roadmap in the second release. None is in Release 0 |
| Balancing strictness | Parent data missing from the child diagram is an error. Data added on the child diagram is a warning | BAL-03 is a warning. See section 5.5 |
| Use cases | The textbook's use case form, linked to its process and flows, in the first release | See section 8. Not built in Release 0 |
| Data model | The entity relationship diagram, its dictionary entries and the CRUD matrix, checked against the process model, in the first release | See section 9. Not built in Release 0 |
| Design diagrams | The physical DFD, structure chart, program specification and physical data model of chapters 9 and 10, in the second release | See section 11. Not built in Release 0 |
| Other chapters | Checked forms for chapters 1, 3, 6 and 11. The interface structure diagram for chapter 8. A project binder for everything else. All of it exports to PDF, in the second release | See section 10. Not built in Release 0 |
| Saving | Every change is saved to the server as it is made, in the student's own account. A project can also be exported to a file and imported again, decided on 18 November 2026 | See section 3.9. Since 18 November 2026, Release 0 has a database and saves each accepted command (section 2). The project list, copying, renaming, deleting, export and import come in Release 1 |
| Instructors' AI agents | A Model Context Protocol (MCP) server lets an instructor's own AI agent build scenarios and starter cases, using a personal API key, decided on 18 November 2026 | See section 7.1. Built in Release 1, decided on 18 November 2026 |
| Grading | None, decided on 18 November 2026. Diagramble sends Canvas no score and keeps no rubrics or comments on submissions, The Canvas launch only signs a person in and opens their work. Assignment and Grade Services, Deep Linking and LTI Advantage certification are dropped from every plan. Whether the course dashboard reads the class list from Canvas's roster service is open (section 14.3) | Students hand in the exported PDF through Canvas (section 3.9), and may attach their project file too. The instructor grades in Canvas. A course dashboard of student behavior, without grades, is a Release 2 candidate; for now its student list is the people who launched from the course |
| Course settings | One small settings record per Canvas course, decided on 18 November 2026. The launch says which course and whether the person is an instructor. An instructor sets one AI assistance level (0 to 4) and one rule profile for the course, and every student launched from it gets them. Nothing about assignments is stored | See section 7 item 4. Not built in Release 0, except that an account may record the course it launched from |
| Element identifiers | Made by whoever creates the item and carried in the creating command, decided on 18 November 2026 | See sections 3.2, 4.1 and 14.6 |
| Stack | TypeScript everywhere | One shared package holds the model and rules and runs in both browser and server |
| Server framework | Fastify (MIT), with Zod for request checking, decided on 18 November 2026 | See section 12 |
| Canvas launch | Our own thin layer for the Learning Tools Interoperability (LTI) 1.3 launch, built on `jose` (MIT), not on ltijs, decided on 18 November 2026. The launch is critical, so it sits inside our own tests and security review. ltijs has one maintainer and brings its own Express app and database layer | See section 12 |
| Database access | Kysely (MIT) behind a small project-store interface of our own (load, save, append to the log), decided on 18 November 2026 | The same code can run on PostgreSQL on the server and on SQLite in a possible desktop app later (section 14.3). See section 12 |
| AI models and agents | The Vercel AI SDK, package `ai` (Apache-2.0), for student-facing AI including agents (its tool-loop agent), decided on 18 November 2026. Rule 1: use provider packages such as `@ai-sdk/anthropic` with the institution's own key, never bare model-name strings, which route through Vercel's hosted gateway. Rule 2: our server still builds the tool list for each request from the assistance level (section 7 item 4), and an agent changes the model only by proposing through `preview` (section 7 item 5). Rule 3: we log every step and remove student identity ourselves (section 7 item 7). The institution supplies and protects the provider key, and chooses a provider whose terms fit its data rules; Diagramble does not vet providers, decided on 18 November 2026 | See sections 7 and 12. No AI feature is built in Release 0 |
| Deployment | One Docker image for the app, and a Docker Compose file that adds PostgreSQL, decided on 18 November 2026 | See section 12 |
| Sign-in | The Canvas launch only, for now, decided on 18 November 2026. An account is kept separate from the ways of signing in to it, so that other ways can be added later without changing accounts | A session is a cookie that points to a record stored in the database. Later ways of signing in are listed in section 14.3 |
| Flow identity | Separate flow elements, each carrying a shared dictionary definition | See section 3.3 |
| AI | Agent integration must be possible from the start | See section 7. No AI feature is built in Release 0 |
| Accessibility | Essential, decided on 18 November 2026. Students with disabilities must be able to do all their work. The target is the Web Content Accessibility Guidelines (WCAG) 2.2 Level AA | The keyboard outline of section 2 item 5 is the first step. Every screen is held to the target |
| Data retention | A requirement before Release 1's live course, decided on 18 November 2026. An instructor can archive an old course, which makes it read-only for everyone while its students keep their projects. A retention policy decides how long logs, analytics, AI usage records and archived courses are kept before they are deleted. An account can be deleted | The numbers, and who sets them, are open (section 14.3) |
| Symbol styles | Release 1 draws only the textbook's style: Gane and Sarson for data flow diagrams and the textbook's entity relationship notation, decided on 18 November 2026 | Other styles may come later, chosen per Canvas course by the instructor in the course settings of section 7 item 4. The candidates are open (section 14.3) |

## 2. Scope of Release 0

Release 0 is a prototype that tests the riskiest parts. It is allowed to be rough.

In scope:

1. The semantic model and its commands, as a tested library with no user interface.
2. The DFD rules in section 5, including balancing through the dictionary.
3. The three test cases in section 6, passing as automated tests.
4. A minimal canvas that shows one model on a context diagram and its child diagrams.
5. A minimal outline view in which a keyboard-only user can build a context diagram.
6. A trial launch from a Canvas test course that signs the student in and opens their
   saved project.
7. Accounts and saving to the server, added on 18 November 2026. PostgreSQL, reached
   through Kysely, stores accounts, sign-in methods, sessions, launch nonces and
   projects. Each command the server accepts is saved before the next one is applied, as
   section 3.9 describes. A student has one project for each Canvas course, and the
   launch opens it.

Out of scope: use case forms (section 8), the ERD and the CRUD matrix (section 9), the
forms, diagram and binder of section 10, the design diagrams of the textbook's chapters 9
and 10 (section 11), the project list and copying, renaming and deleting projects,
project files and their export and import (section 3.9), course settings (section 7
item 4), export to PDF, AI features, real-time editing, and visual polish.
Grading is out of every release (section 1).

Exit criteria are those in section 11 of the product vision under "Release 0".

## 3. Semantic model

### 3.1 Principles

1. Every element has an identifier that never changes. Names are not identifiers.
2. The model holds meaning only. Positions, sizes and routes live in a separate view
   collection (section 3.5).
3. The model changes only through commands (section 4). No view writes to it directly.
4. The core is a set of pure functions: `apply(model, command)` returns a new model and
   a change record, or an error. Nothing in the core touches a network, a clock or a
   screen.

### 3.2 Common fields

Every element has these fields.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | Identifier | Assigned once, never reused. See the identifier rules below |
| `kind` | One of the kinds below | Never changes in Release 0 |
| `name` | Text | May be empty while the student is working. Rules report empty names |
| `description` | Text | May be empty while the student is working. The textbook asks for one on every item, so rule DFD-13 reports an empty description |
| `aliases` | List of text | Other names the business uses for the same thing. The textbook lists an alias among the fields of a flow, a data store, an external entity and an attribute (Figures 4-13 and 5-9). `search` looks in them. No rule in Release 0 reads them |
| `notes` | Text | Working notes and open questions. The textbook lists notes on every kind of entry (Figures 4-13, 4-16 and 5-6 to 5-8). Never checked |
| `origin` | `student`, `starter` or `ai` | Who created the element. Needed later for instructor review and AI disclosure |

**Identifier rules,** decided on 18 November 2026:

- Whoever creates an item puts its identifier in the creating command: the browser, a
  test, an AI agent or an instructor's MCP agent (section 7.1). The core never makes one.
- The browser makes an identifier of 10 characters drawn from lowercase letters and
  digits, using `crypto.getRandomValues`, never `Math.random`. Tests and agents may
  choose readable identifiers instead.
- An identifier is unique only within one project. The database keys an item by its
  project and its identifier together, and nothing may assume that identifiers are
  unique across projects. A copy of a starter case may keep the case's identifiers.
- The server refuses a creating command whose identifier is already used in the
  project. The browser then makes a new identifier and sends the command again.
- An identifier is an opaque string. Nothing parses it.

Why: the browser and the server both apply each command, and two copies of a project can
run at once, with two open tabs, a dropped connection, an instructor's MCP agent, or an
AI proposal accepted later. A counter kept in the project would let two copies give out
the same identifier.

An alias is not a second name. A flow's label, a rule's message and every list show the
`name`. Two elements may not be told apart by an alias, and an alias never takes part in
balancing.

### 3.3 Element kinds

| Kind | Extra fields | Notes |
| --- | --- | --- |
| Process | `parentProcessId` (empty for process 0), `ordinal`, `processDescription` | Its number is built from ordinals: 0, then 1, 2, 3 on the level 0 diagram, then 1.1, 1.2 below process 1. The ordinal is the last part of the number. It defaults to the next free whole number among the processes with the same parent. It can be changed, so that a process can carry the number of its use case, as the textbook's examples do (Figure 4-20) |
| External entity | None | May appear on many diagrams |
| Data store | None | Its label (D1, D2) is derived from creation order. May appear on many diagrams |
| Data flow | `diagramId`, `sourceId`, `targetId`, `dataId` | Belongs to exactly one diagram. Has one source and one target. Carries exactly one data definition. One end may be an off-diagram end (see below). A flow created by `expandProcess` may have one end empty ("unattached") until the student attaches it |
| Control flow | `diagramId`, `targetId` | Its `name` is the event that starts a process, such as "End of Term". It has no source and carries no data. It is drawn as a dotted line (pages 156 to 157) |
| Data structure | `components`: an ordered list of `{ dataId, occurs, limit }` where `occurs` is `once`, `optional` or `many` | A named group of data, such as "Order" |
| Data element | `dataType` (text), `allowedValues` (optional list of `{ value, meaning }`) | A single piece of data, such as "Order Date" |
| Diagram | `diagramKind` (`context` or `dfd`), `decomposesProcessId` (empty for the context diagram) | The level 0 diagram decomposes process 0 |

Three of these fields follow the textbook's dictionary entries.

- **`processDescription`** is the longer text of a process entry: what the process does,
  step by step, in structured English, a decision tree or a decision table written as
  text (page 144, Figure 4-16). It is separate from the short `description`. The
  textbook asks for it on the lowest-level processes, and says a process is small
  enough when this text fits on one page (page 149). No rule reads it in Release 0.
- **`meaning`** says what one allowed value stands for, such as "A" for "Active". The
  textbook's entry for a data element lists "Values and Meanings" (Figure 5-7).
- **`limit`** is optional and is used only when `occurs` is `many`. It is the largest
  number of times the part can occur, such as 12 for the months of a year. Balancing
  ignores it.

How flows work, following the flow identity decision:

- A flow has no name of its own. Its label is the name of the data definition it
  carries. Renaming that definition changes the label on every flow that carries it.
- A flow on a parent diagram and a flow on its child diagram are different elements,
  even when they carry the same data.
- A flow that needs a different label, such as "Approved Order", carries a different
  data definition. That definition can be composed of the original one.
- A flow that must carry several things carries a data structure composed of them.
- An off-diagram end is a process that is not shown on the flow's diagram. On the
  diagram that decomposes process P, a flow may run between something inside P and a
  process outside P. The textbook draws that end as a note such as "To Process 2"
  (Figure 4-15), and so does the tool.

### 3.4 Invariants

The model service guarantees these at all times. A command that would break one is
refused. They are not rules, and a student never sees them violated.

1. Every reference (`sourceId`, `targetId`, `dataId`, `parentProcessId`,
   `decomposesProcessId`, component `dataId`) points to an existing element of the
   right kind. The one exception is the unattached end of an inherited flow.
2. A flow's source and target are both shown on the flow's diagram. The one exception
   is an off-diagram end. On the diagram that decomposes process P, one end of a flow
   may be a process that is not P, not above P and not below P in the hierarchy.
3. A flow's source and target are processes, data stores or external entities. A
   control flow's target is a process shown on the control flow's diagram.
4. A process is decomposed by at most one diagram.
5. The process hierarchy is a tree with process 0 at the root.
6. A process is shown on exactly one diagram: the one that decomposes its parent.
   Process 0 is shown only on the context diagram.
7. There is exactly one context diagram.
8. No two processes with the same parent have the same ordinal.

Everything else a student can get wrong is a rule (section 5), is allowed to exist in
the model, and is reported with an explanation.

### 3.5 Views

A view records how elements appear on one diagram. It holds no meaning.

| Record | Fields | Notes |
| --- | --- | --- |
| Node occurrence | `id`, `diagramId`, `elementId`, `x`, `y`, `width`, `height` | An external entity or data store may have several occurrences on one diagram |
| Flow route | `flowId`, `sourceOccurrenceId`, `targetOccurrenceId`, `points` | Says which occurrence each end attaches to. An off-diagram end has no occurrence: its field is empty, and the note is drawn at the last point of the route. A control flow's route has no source occurrence |

Symbols follow the Gane and Sarson style that the textbook uses (Figure 4-13). A process
is a rounded rectangle with its number in a band across the top. A data store is an
open-ended rectangle with its label (D1) in a box at the left. An external entity is a
square-cornered rectangle. Release 0 draws only this style.

Removing the last occurrence of an external entity or data store leaves the element in
the model as "unplaced". Deleting the element is a separate command.

### 3.6 Storage form

A project is one JSON document with five parts: `schemaVersion`, `settings`
(section 3.7), `elements`, `views` and `log`. Elements are stored in a map keyed by `id`. The log is the ordered list of
commands applied, each with its resulting changes in JSON Patch form (RFC 6902).
Section 7 depends on this form being stable and documented.

### 3.7 Project settings

A project has two settings. Both exist so that a textbook exercise can be done as it is
set.

| Setting | Values | Notes |
| --- | --- | --- |
| `topDiagramId` | A diagram. The context diagram by default | The highest diagram that the project is expected to contain. Many of the textbook's exercises ask for a level 0 diagram alone (Chapter 4, exercises B, D, G, I, K, M, O, Q and S), and some start lower still: minicase 3 gives one process and asks for its level 1 diagram. Diagrams above the top diagram are "above the project". They stay in the model, because the hierarchy needs them (section 3.4) |
| `showFindings` | `always` or `onRequest`. `always` by default | With `onRequest`, the findings are worked out as usual but shown only when the student asks. It suits an exercise that asks the student to find the errors in a given diagram (Chapter 4, minicase 2). Visible Analyst works this way all the time |

What "above the project" changes:

- No rule reports a finding on a diagram above the top diagram, or on an element that
  is shown only there.
- The top diagram is balanced against its parent process only when that process has at
  least one flow. An empty parent means the level above was not asked for. A parent with
  flows is a given fragment, and the student's diagram must balance with it.
- Export leaves out the diagrams above the top diagram unless the student includes them.

### 3.8 Projects and starter cases

**A project holds one scenario.** It is one business case carried from the system
request to the design: one system request, one feasibility analysis, one requirements
definition, one set of models. A student opens a new project for each exercise that has
its own scenario. Exercises that build on each other, such as a data flow diagram in
Chapter 4, an interface structure diagram in Chapter 8 and a structure chart in Chapter
9 for the same business, stay in one project, because the later work links to the
earlier.

**A starter case is a project to begin from.** About sixteen of the textbook's exercises
start from something given: a diagram to correct or extend, a list of requirements, a
table of costs, a structure chart to criticize, a set of tables to size.

- A starter case is an ordinary project in the storage form of section 3.6. It can hold
  content of every kind in this specification: diagrams, dictionary entries, use cases,
  the data model, the CRUD matrix, any form of section 10, any design diagram of section
  11, and binder sections with text already in them.
- Opening one makes a new project that is a copy of it. Every element of the copy has
  the `origin` `starter`, so what was given can always be told from what the student
  added. The student may change or delete starter content.
- A starter case carries its own settings (section 3.7). One that asks the student to
  find the errors sets `showFindings` to `onRequest`. One that gives a fragment sets the
  top diagram.
- Any project can be saved as a starter case. That is how an instructor, or the
  project's maintainers, make one.
- The starter cases shipped with the tool are original. Each asks for the same kind of
  work as an exercise in the textbook, with a different business and different numbers.
  None copies the textbook's cases, figures or figures' numbers.

### 3.9 Saving and project files

**Work is saved as the student goes.** Each project belongs to one student's account and
is kept on the server. Every command the server accepts (section 4) is saved before the
next one is applied. There is no Save button. The top bar shows when the project was last
saved.

- If the connection drops, the browser keeps the commands in order and sends them when
  the connection returns. Until then the top bar says the latest changes are not saved
  yet. Closing the page while changes are waiting asks the student first.
- Undo and redo are commands like any other, so they are saved the same way. They reach
  only the current editing session. After a reload or a takeover, earlier edits cannot be
  undone.

**Only one tab edits a project at a time.** Every other tab showing the same project is
read-only and says so plainly. A read-only tab offers a way to take over editing, which
makes the tab that was editing read-only. Decided on 18 November 2026.

**A student has many projects.** A project list shows each project's name and when it was
last changed. From it the student can open a project, start a new one (empty, or from a
starter case as in section 3.8), copy one, rename one, or delete one. Deleting asks the
student to confirm.

**A project can be exported to a file and imported again.** This lets a student keep their
own copy, work on another computer or another deployment, or give the file to someone
else. It is not the way to hand work in. Students hand in the PDF of section 10.8.

- The file is the storage form of section 3.6, as UTF-8 JSON, with the ending
  `.diagramble.json`. It holds the whole project: every element, view and setting, the
  log, and the binder's attached files. It holds nothing about the student, such as a
  name or account.
- The format is documented and kept stable, so that no student's work is locked in and
  other tools can read it.
- Importing a file always makes a new project in the list. It never replaces an existing
  project.
- Before importing, the tool checks the file. A file made by an older version is brought
  up to date. A file made by a newer version, a file that is not a Diagramble project, or
  a file that breaks an invariant of section 3.4 is refused with a plain sentence that
  says what is wrong. Nothing is imported from a refused file.
- A starter case file is the same format, so importing one is the same as opening that
  starter case. Elements keep the `origin` they had in the file.
- This is how an instructor gives a class a scenario. They build it, save it as a starter
  case, export the file and post it in Canvas, and each student imports it as their own
  new project. An instructor's AI agent can build the scenario for them (section 7.1).
- A student may attach their project file to what they hand in through Canvas. The
  instructor imports it to look at it. That makes a new project in the instructor's
  account and never touches the student's own copy.

**Import fails safe.** A file may come from anyone, so import is a security boundary:

1. Every imported file is treated as hostile.
2. The server checks it, not only the browser.
3. The file's size is checked against a limit before it is parsed.
4. Nesting depth, string lengths and element counts have limits.
5. Keys such as `__proto__`, `constructor` and `prototype` are refused.
6. The file is checked against the strict schema. Unknown fields are refused, not
   dropped.
7. A version upgrade runs only on a file that passed the check for its own version. The
   result is checked again against the current schema and every invariant of section 3.4.
8. Anything that fails refuses the whole file. Nothing is partly imported. The refusal is
   a plain sentence with no internal detail.
9. Imported text is never rendered as HTML anywhere, including the PDF export.
10. Imported `origin` values and the log are kept but marked unverified, and the project
    is marked as imported.
11. Text from an imported file that reaches an AI model, whether student AI or an
    instructor's agent, is data, never instructions. It must not widen the tools offered.
12. Attachments, when they exist, are never served inline from the app's domain.

## 4. Commands and queries

Each command and query has a name, a schema for its arguments, and a one-sentence
description. The schemas are written once and used for validation, for documentation,
and later as tool definitions for an AI model (section 7).

### 4.1 Commands

| Command | Effect |
| --- | --- |
| `createProject` | Creates the context diagram and process 0. Given a starter case, it copies that case's content instead (section 3.8) |
| `addExternalEntity`, `addDataStore`, `addProcess` | Creates the element and one occurrence on a given diagram |
| `placeExisting` | Adds an occurrence of an existing external entity or data store to a diagram |
| `addControlFlow` | Creates a control flow into a process on a diagram, with the starting event as its name |
| `setProcessNumber` | Changes a process's ordinal. Refused if another process with the same parent already has it |
| `addFlow` | Creates a flow on a diagram between two elements shown there, or between one element shown there and an off-diagram process. It carries an existing data definition, or a new data structure created from a given name. The new structure has no components, so DD-01 reports it until the student defines it |
| `defineData` | Creates a data structure or data element |
| `setComposition` | Replaces the component list of a data structure |
| `rename`, `describe` | Changes the name or description of any element |
| `setAliases`, `setNotes` | Replaces the aliases or the notes of any element |
| `setProcessDescription` | Sets the longer description of a process |
| `setFlowData` | Changes which data definition a flow carries |
| `expandProcess` | Creates the child diagram for a process. Refused if the process already has one. For each data flow touching the process on the parent, it creates a new flow on the child diagram carrying the same data, left unattached to any child process. If the other end is an external entity or data store, that element is placed on the child diagram. If the other end is another process, it becomes an off-diagram end. Control flows are not carried down |
| `carryDown` | For a process that already has a child diagram, brings down the flows that were added to the parent afterwards. A flow touching the process on the parent is brought down when no flow that crosses the edge of the child diagram in the same direction carries the same data definition. Each new flow is made as `expandProcess` makes it, with its inner end unattached. Flows whose data already arrives in parts are left alone, because they balance through the dictionary |
| `setTopDiagram`, `setShowFindings` | Change the project settings of section 3.7 |
| `removeOccurrence` | Removes one occurrence, and the flows attached to it on that diagram |
| `deleteElement` | Deletes an element everywhere. Refused for a data definition that is still carried or used as a component, unless `cascade` is set |
| `undo`, `redo` | Steps through the log, within the current editing session only (section 3.9). Edits made before a reload or a takeover cannot be undone |

Every command that creates an item carries the new item's `id`, made as section 3.2's
identifier rules say. A command that creates more than one item, such as `addFlow` with a
new data structure or `expandProcess`, carries one identifier for each.

`expandProcess` leaves each inherited flow with one end attached to the outside element
or off-diagram note, and the other end attached to the child diagram's boundary. Until the student attaches
it to a child process, rule DFD-05 reports it.

`carryDown` is the one-step answer to a BAL-01 or BAL-02 finding in which the whole of a
parent flow is missing. It comes from Visible Analyst, where exploding a process a
second time drags new parent flows down. It never removes a flow from the child diagram.
`carryDown`, the two settings commands, and the queries `search` and `getFragment` are
added in the first release. They are not part of Release 0.

### 4.2 Queries

| Query | Returns |
| --- | --- |
| `getModel` | The whole model in its storage form |
| `getOutline` | The model as indented plain text, in diagram order |
| `getElement` | One element with its occurrences |
| `whereUsed` | Every diagram, flow and data structure that refers to an element |
| `expandData` | The data elements a definition is ultimately composed of |
| `search` | Every element whose name, aliases, description or notes contain the given text. It can be narrowed to one kind of element, to one diagram, and to elements with no description or elements used nowhere. This is the repository search of Visible Analyst, and it answers tidy-up questions before a project is handed in |
| `getFragment` | One process of a diagram with its flows and the elements at their other ends. This is the textbook's DFD fragment (page 146). See section 8.4 |
| `getFindings` | The results of running a rule profile (section 5.1) |
| `preview` | The model and findings that a list of commands would produce, without applying them |

## 5. Rules

### 5.1 Shape of a rule

A rule has an identifier, a default severity (`error` or `warning`), a check, and three
pieces of text: the message, the reason, and the fix. A finding is structured data.

| Finding field | Meaning |
| --- | --- |
| `ruleId` | For example `DFD-03` |
| `severity` | `error` or `warning`, after the profile is applied |
| `elementIds` | The elements involved, most relevant first |
| `diagramId` | Where to show it, if it belongs to one diagram |
| `values` | Named values used to fill the message text |

A profile is a list of rule identifiers, each `off`, `warning` or `error`. Release 0 has
one built-in profile with the defaults below. The defaults follow the textbook's quality
checklist (Figure 4-24) and its list of common errors (Figure 4-25). Rules run on the
whole model after every command. Student models are small, so nothing incremental is needed.

Two project settings change what a student sees, and neither changes a rule. A finding
on a diagram above the project's top diagram is dropped, and the findings can be held
back until the student asks for them (section 3.7).

### 5.2 Element and connection rules

| Rule | Severity | Reported when | Message | Why | Fix |
| --- | --- | --- | --- | --- | --- |
| DFD-01 | Error | A process, external entity, data store, data definition or control flow has an empty name | "This {kind} has no name." | Nobody can tell what an unnamed item stands for | Give it a name that says what it is |
| DFD-02 | Error | Two processes, two external entities, two data stores or two data definitions have the same name, ignoring case | "Two {kind}s are both named '{name}'." | The same name must always mean the same thing | Rename one, or delete the duplicate and reuse the first |
| DFD-03 | Error | A process has at least one data flow out, no data flow in and no control flow in | "'{name}' produces data from nothing." | Every output must be made from data the process receives. The textbook calls this a miracle | Add the flows this process needs as input. If only the passing of time starts it, add a control flow |
| DFD-04 | Error | A process has at least one data flow in and no data flow out | "'{name}' receives data and produces nothing." | A process exists to turn inputs into outputs. The textbook calls this a black hole | Add the output, or remove the process |
| DFD-05 | Error | Neither end of a flow is a process, or one end is unattached | "'{data}' does not start or end at a process." | A DFD shows only data that the system's processes handle | Route the flow through a process, or remove it |
| DFD-06 | Error | A flow's source and target are the same element | "'{data}' flows from '{name}' back to itself." | A flow moves data from one place to another | Attach one end elsewhere |
| DFD-07 | Error | A process has no flows at all | "'{name}' is not connected to anything." | Every process needs at least one input and one output | Connect it, or remove it |
| DFD-08 | Error | An external entity has no flows on any diagram | "'{name}' neither sends nor receives data." | An outside party belongs on the diagram only if it exchanges data with the system | Add a flow, or remove it |
| DFD-09 | Warning | Across the whole model, a data store has flows in but none out, or out but none in | "'{name}' is only written to." or "'{name}' is only read from." | Stored data must come from somewhere and be used somewhere | Add the missing flow on whichever diagram it belongs. If another system keeps this data, show that system as an external entity instead |
| DFD-13 | Warning | A process, external entity, data store or data definition has an empty description | "'{name}' has no description." | The name says what an item is called and the description says what it is. The textbook asks for one on every item | Write a sentence or two saying what it is or does |
| DFD-14 | Warning | A process name contains the word "and" | "'{name}' may be doing more than one job." | A process should do one activity, so its name should not need "and" | Split it into two processes, or name it for the one thing it does |
| DFD-15 | Warning | A process sends out a data definition that it also receives | "'{name}' sends out '{data}' unchanged." | A process changes data, so what leaves it usually has a different name from what entered | Name the output for what the process did to it, such as "Approved Order" |

DFD-07 and DFD-08 are errors because the textbook's checklist lists them as syntax
rules. DFD-09 stays a warning because the textbook says a data store with flows in only
one direction is "not necessarily an error" (page 155). The textbook also wants a
process name to start with a verb and every other name to be a noun. Software cannot
check that reliably, so it stays with the instructor.

### 5.3 Structure rules

| Rule | Severity | Reported when | Message | Why | Fix |
| --- | --- | --- | --- | --- | --- |
| DFD-10 | Error | The context diagram shows a data store | "The context diagram shows the data store '{name}'." | The context diagram shows the system as one process and only what lies outside it | Move the data store to the level 0 diagram. If another system keeps this data, show that system as an external entity |
| DFD-11 | Warning | A level 0 or lower diagram has fewer than three processes | "This diagram has {count} processes. It should have at least three." | With only one or two processes, the extra diagram adds little | Add the processes that make it up, or remove this diagram and show the detail on its parent |
| DFD-12 | Warning | A diagram has more than seven processes | "This diagram has {count} processes. It should have no more than seven." | A crowded diagram is hard to read | Combine related processes into one and expand it |

The limits of three and seven come from the textbook's checklist (Figure 4-24). Its
prose is looser at the top: it says "no more than seven to nine" (page 149).

Whether a second process can exist on the context diagram is settled by the model:
`addProcess` is refused there, so no rule is needed.

### 5.4 Dictionary rules

| Rule | Severity | Reported when | Message | Why | Fix |
| --- | --- | --- | --- | --- | --- |
| DD-01 | Warning | A data structure has no components | "'{name}' has no contents defined." | Without contents, the tool cannot tell whether two flows carry the same data | List what it is made of, or change it to a single data element |
| DD-02 | Error | A data structure contains itself, directly or through other structures | "'{name}' is defined in terms of itself." | A definition must end in single data elements | Remove the component that leads back |
| DD-03 | Warning | A data definition is not carried by any flow and is not a component of anything | "'{name}' is defined but never used." | Unused definitions are usually leftovers or mistakes | Use it or delete it |

### 5.5 Balancing rules

Balancing compares a process on its parent diagram with the diagram that decomposes it.
It applies to every process that has a child diagram, including process 0.

Definitions, for a process P with child diagram C:

- **Inside.** An element is inside P if it is a process whose ancestor is P, or a data
  store whose every occurrence is on C or on diagrams below C.
- **Boundary flow.** A flow on C with exactly one end inside P. The unattached end of
  an inherited flow counts as inside P, so a newly expanded process starts balanced.
  An off-diagram end is outside P.
- **Parent inputs.** The data definitions carried by flows into P on the parent diagram.
  Parent outputs are defined the same way for flows out of P.
- **Child inputs.** The data definitions carried by boundary flows whose target is
  inside P. Child outputs are those whose source is inside P.
- **Contents.** The contents of a data element are itself. The contents of a data
  structure are the union of the contents of its components, whatever their `occurs`
  value. A structure with no components counts as a single item and triggers DD-01.
  The calculation must stop safely when a structure contains itself (DD-02).

P and C balance when the contents of the parent inputs equal the contents of the child
inputs, and the same holds for outputs.

The textbook defines balancing more loosely. The parent's information must be "shown
appropriately" on the child diagram, not identically (page 141), and a child diagram
"will likely add more data flows" (page 167). It gives no rule for a flow that is split
into parts. Comparing contents through the dictionary is this tool's way of making
"appropriately" checkable. Following the textbook, data missing from the child diagram
is an error, and data added on the child diagram is only a warning.

| Rule | Severity | Reported when | Message | Why | Fix |
| --- | --- | --- | --- | --- | --- |
| BAL-01 | Error | Some contents of the parent inputs are missing from the child inputs | "'{data}' enters '{process}' on the parent diagram but does not fully enter this diagram. Missing: {missing}." | A child diagram is a closer look at one process, so the same data must cross its edge | Add a flow carrying the missing data, or remove it from the parent |
| BAL-02 | Error | Some contents of the parent outputs are missing from the child outputs | "'{data}' leaves '{process}' on the parent diagram but does not fully leave this diagram. Missing: {missing}." | Same as BAL-01 | Same as BAL-01, for outputs |
| BAL-03 | Warning | Some contents of the child inputs or outputs are not in the parent's | "'{data}' crosses the edge of this diagram but not '{process}' on the parent diagram." | A child diagram adds detail, so it may show flows its parent leaves out. But data that enters or leaves the process usually belongs on the parent too | If the parent should show this data, add the flow there or define it as part of a parent flow. If it is detail the parent leaves out, no change is needed |
| BAL-04 | Warning | At least one parent flow carries contents that overlap a boundary flow's, and none of those parent flows has the same outside element (external entity, data store or off-diagram process) as the boundary flow | "'{data}' comes from '{childEnd}' here but from '{parentEnd}' on the parent diagram." | The same data should come from, or go to, the same place at every level | Attach the flow to the same outside element |

Findings name the top-level data definition the student drew, and list the missing
parts under it. A missing part is named by the largest component that is wholly
missing, not by its individual data elements. Each rule produces one finding per data
definition per direction (in or out). Findings are attached to the child diagram and to
process P.

Known limits, accepted for Release 0:

- Contents are compared as sets. Whether a part is optional or repeating is ignored.
- If the same data enters P from two different sources, BAL-01 does not tell them apart.
  BAL-04 covers the common case.
- Control flows are not balanced. A control flow on a parent diagram need not appear on
  the child diagram.

## 6. Test cases

Each case becomes a model built by commands, plus the exact findings expected. The
cases are original and written in the style of a textbook exercise. They are not taken
from the Dennis textbook.

In every case, every element has a description. That includes elements a variant adds,
unless the variant says otherwise.

### 6.1 Case A: library loans (clean and balanced)

Purpose: a correct two-level model produces no findings.

Context diagram, with process 0 "Library System":

| From | To | Data |
| --- | --- | --- |
| Member | 0 | Loan Request |
| 0 | Member | Loan Receipt |
| Librarian | 0 | Book Details |
| 0 | Librarian | Overdue Report |

Level 0 diagram, with processes 1 "Lend Book", 2 "Maintain Catalog", 3 "Report Overdue
Loans" and data stores D1 "Books", D2 "Loans":

| From | To | Data |
| --- | --- | --- |
| Member | 1 | Loan Request |
| 1 | Member | Loan Receipt |
| D1 | 1 | Book Record |
| 1 | D2 | Loan Record |
| Librarian | 2 | Book Details |
| 2 | D1 | Book Record |
| D2 | 3 | Loan Record |
| 3 | Librarian | Overdue Report |

Every data definition is a structure with at least one data element.

Expected findings: none.

### 6.2 Case B: clinic appointments (balancing through the dictionary)

Purpose: a parent flow balances with two child flows that carry its parts.

Dictionary: "Appointment Request" is composed of "Client Details" and "Visit Details".
"Client Details" is composed of the elements "Client Name" and "Phone". "Visit Details"
is composed of the elements "Pet Name", "Preferred Date" and "Reason for Visit".

Every other data definition named below is a structure with one data element of its
own.

Context diagram, with process 0 "Clinic System":

| From | To | Data |
| --- | --- | --- |
| Client | 0 | Appointment Request |
| 0 | Client | Appointment Confirmation |
| Veterinarian | 0 | Visit Notes |
| 0 | Veterinarian | Visit Summary |
| 0 | Veterinarian | Daily Schedule |

Level 0 diagram, with processes 1 "Schedule Appointment", 2 "Record Visit" and 3
"Produce Daily Schedule", and data store D1 "Appointments":

| From | To | Data |
| --- | --- | --- |
| Client | 1 | Appointment Request |
| 1 | Client | Appointment Confirmation |
| 1 | D1 | Appointment Record |
| D1 | 2 | Appointment Record |
| Veterinarian | 2 | Visit Notes |
| 2 | Veterinarian | Visit Summary |
| D1 | 3 | Appointment Record |
| 3 | Veterinarian | Daily Schedule |

Child diagram of process 1, with processes 1.1 "Check Availability", 1.2 "Book Slot"
and 1.3 "Send Confirmation":

| From | To | Data |
| --- | --- | --- |
| Client | 1.1 | Visit Details |
| Client | 1.2 | Client Details |
| 1.1 | 1.2 | Available Slot |
| 1.2 | D1 | Appointment Record |
| 1.2 | 1.3 | Booking |
| 1.3 | Client | Appointment Confirmation |

| Variant | Change | Expected findings |
| --- | --- | --- |
| B1 | None | None |
| B2 | Delete the flow carrying "Visit Details" | BAL-01 on process 1, data "Appointment Request", missing "Visit Details". DFD-03 on process 1.1 |
| B3 | In B1, change the "Client Details" flow to carry a new structure "Booking Info" composed of the element "Booking Code" | BAL-01 (error), missing "Client Details". BAL-03 (warning) for "Booking Info" |
| B4 | In B1, rename "Appointment Request" to "Booking Request" | None. The label changes on the parent flow and the model still balances |
| B5 | In B1, remove all components from "Visit Details" | DD-01 on "Visit Details". DD-03 on each of its three former elements. No balancing finding |

### 6.3 Case C: course registration (seeded errors)

Purpose: each element and connection rule fires exactly where expected.

Start from the correct two-level model below, then apply one change per variant. Every
data definition is a structure with one data element of its own.

Context diagram, with process 0 "Registration System":

| From | To | Data |
| --- | --- | --- |
| Student | 0 | Enrollment Request |
| 0 | Student | Enrollment Confirmation |
| Registrar | 0 | Course Details |
| 0 | Registrar | Class List |

Level 0 diagram, with processes 1 "Enroll Student", 2 "Maintain Courses" and 3 "Produce
Class List", and data stores D1 "Courses" and D2 "Enrollments":

| From | To | Data |
| --- | --- | --- |
| Student | 1 | Enrollment Request |
| 1 | Student | Enrollment Confirmation |
| D1 | 1 | Course Record |
| 1 | D2 | Enrollment Record |
| Registrar | 2 | Course Details |
| 2 | D1 | Course Record |
| D2 | 3 | Enrollment Record |
| 3 | Registrar | Class List |

The unchanged model produces no findings.

| Variant | Change | Expected findings |
| --- | --- | --- |
| C1 | Add a flow from Student to Registrar on the context diagram, carrying "Course Details" | DFD-05 |
| C2 | Add a flow from D1 to D2 on level 0, carrying "Course Record" | DFD-05 |
| C3 | Remove every flow into process 3 | DFD-03 on process 3. DFD-09 on D2 ("only written to") |
| C4 | Remove every flow out of process 2 | DFD-04 on process 2. DFD-09 on D1 ("only read from") |
| C5 | Clear the name of process 1 | DFD-01 |
| C6 | Rename D2 to "courses" | DFD-02 |
| C7 | Add a process named "Archive Enrollments" with no flows | DFD-07 |
| C8 | Add an external entity "Bursar" to level 0 with no flows | DFD-08 |
| C9 | Place D1 on the context diagram | DFD-10. Two BAL-03 findings for "Course Record" on level 0, one in and one out, because D1 now counts as outside process 0 |
| C10 | Expand process 1 and add a single child process named "Check Prerequisites" with no flows | DFD-11. DFD-07 on the new process. Four DFD-05 findings, one for each inherited flow not yet attached. No balancing finding |
| C11 | Define "Course Record" as containing "Course Section", and "Course Section" as containing "Course Record" | DD-02 on both |
| C12 | Clear the description of process 2 | DFD-13 |
| C13 | Rename process 3 to "Produce and Send Class List" | DFD-14 |
| C14 | Change the flow from process 2 to D1 to carry "Course Details" | DFD-15 on process 2 |
| C15 | Remove every flow into process 3, then add a control flow "End of Term" into it | DFD-09 on D2 ("only written to"). No DFD-03, because the control flow starts the process |
| C16 | Add a flow from process 1 to process 3 carrying "Enrollment Record", then expand process 1 | The child diagram has five inherited flows. The one that leads to process 3 has an off-diagram end, and process 3 is not placed on the child diagram. Findings: DFD-11, and five DFD-05 findings. No balancing finding |
| C17 | Set the number of process 3 to 5 | None. The process is shown as 5 |

## 7. AI agent integration

No AI feature is built in Release 0. These requirements make sure the core does not
have to change when one is added. They follow the AI strategy in section 8 of the
product vision.

1. **The model has a documented text form.** `getModel` returns stable JSON under a
   published schema. `getOutline` returns the same content as short plain text, which
   costs less to send to a model.
2. **Commands and queries are the tool surface.** Because each has a name, an argument
   schema and a description, each can be offered to an AI model as a tool with no new
   code path. The same definitions can later be served to outside agents through a
   Model Context Protocol server.
3. **Findings are data.** An AI model explains a finding from its rule identifier,
   elements and values. It never decides whether a rule is broken.
4. **The assistance level decides which tools exist.** The server reads the level from
   the settings of the Canvas course the student launched from (section 1, "Course
   settings"), and builds the tool list for each request from it.

   | Level | Tools offered to the AI model |
   | --- | --- |
   | 0 Off | None. No request is made |
   | 1 Explain | `getOutline`, `getElement`, `getFindings` |
   | 2 Question and hint | Level 1, plus `whereUsed` and `expandData` |
   | 3 Critique | Level 2, plus the project's starter case text |
   | 4 Open practice | Level 3, plus `preview` with commands |

5. **An AI model never changes the model directly.** At level 4 it proposes commands
   through `preview`. The server runs the rules on the result. The student sees the
   proposal with its findings and accepts or rejects it. Accepted elements are stored
   with `origin` set to `ai`.
6. **`preview` must be cheap.** This is why the core is pure functions over an
   unchanging model value (section 3.1).
7. **The gateway is neutral and server-side.** It holds the institution's own key, works
   with more than one model provider, removes student identity, and logs every request
   and response against the project. It is built on the AI SDK under the rules in
   section 1.
   - The key and the choice of provider are the institution's responsibility. The
     institution supplies the key, protects it, and chooses a provider whose terms fit
     its data rules, including whether the provider trains on data sent through its
     API. Some providers do. Diagramble does not vet providers.
   - AI use is also counted: requests and tokens, per student and per course. The course
     dashboard may show those counts.
   - Prompt and response text is logged for safety and debugging only. It is kept under
     the retention policy of section 1, "Data retention", and is never shown to
     instructors.

### 7.1 Building scenarios with an instructor's own AI agent

An instructor can ask their own AI agent to build a scenario, such as "a small bakery's
ordering system, with a level 0 diagram that has two balancing errors for the students
to find." The agent works through a Model Context Protocol (MCP) server that Diagramble
provides. This is separate from the student assistance levels of item 4 above, and it
never touches a student's work.

- **An API key is needed.** An instructor creates a personal API key in their account,
  names it, and can revoke it at any time. The key is shown once, when it is made, and
  the server keeps only a hash of it. Each key acts as its owner and reaches only its
  owner's own projects. Every request is logged against the key.
- **The tools are the commands and queries of section 4,** offered as MCP tools as items
  1 and 2 above describe, plus making a project, saving a project as a starter case
  (section 3.8) and exporting a project file (section 3.9).
- **The agent's work is checked like anyone else's.** Each command must keep the
  invariants of section 3.4, and the agent can read the findings. That lets it check that
  a "find the errors" scenario has exactly the errors the instructor asked for.
- **What the agent makes is marked.** Elements it creates have the `origin` `ai` in the
  instructor's project, so the instructor can review them. Saving the project as a
  starter case marks every element as given, like any other starter case.
- **The agent and its AI provider are the instructor's own.** Diagramble makes no AI
  requests for this and pays for none.

## 8. Use case forms (first release)

The textbook builds its data flow diagrams from use cases (pages 144 to 149). It
teaches use cases as forms and has no use case diagram. Use case forms are therefore
part of the first release. They are not built in Release 0. This section fixes their
shape so that the core does not have to change when they are added.

### 8.1 The form

A use case is one more element kind, with the common fields of section 3.2. Its extra
fields follow the textbook's form (Figures 4-1, 4-9 and 4-11).

| Field | Type | Notes |
| --- | --- | --- |
| `ordinal` | Whole number | Shown as UC-1, UC-2 |
| `priority` | `high`, `medium` or `low` | |
| `actorId` | An external entity | The primary actor |
| `trigger` | Text | What starts the use case |
| `triggerType` | `external` or `temporal` | Temporal means that time starts it |
| `preconditions`, `postconditions` | Lists of text | |
| `steps` | Ordered list of `{ text, substeps, information }` | The normal course. Branches are lettered sub-steps inside a step, as in the textbook. `information` lists the data that enters and leaves at this step, each as `{ direction, dataId }` |
| `exceptions` | List of `{ stepNumber, text, steps }` | Shown as E1, E2. `stepNumber` is the step where the exception can happen. `steps` is the numbered list of what is done about it, as in Figure 4-11 |
| `summaryInputs` | List of `{ dataId, sourceId }` | The source is an external entity or data store |
| `summaryOutputs` | List of `{ dataId, destinationId }` | The destination is an external entity or data store |
| `processId` | A process | The process that carries out this use case. Empty until the student draws it |

Naming data, a source or a destination on the form creates it in the model if it does
not exist yet. A new external entity or data store stays unplaced (section 3.5) until
the student draws it.

### 8.2 Links to the diagrams

The textbook turns a use case into diagrams in a fixed way.

| Part of the form | What it becomes on the diagrams |
| --- | --- |
| The use case | One process on the level 0 diagram. The process takes the use case's number by default |
| The primary actor | Usually an external entity |
| A summary input and its source | A data flow into that process |
| A summary output and its destination | A data flow out of that process |
| A temporal trigger | A control flow into that process |
| A step | Usually one process on the level 1 diagram that decomposes the use case's process |
| The information for a step | The flows into and out of that level 1 process |

The student draws the diagrams. The tool keeps the links and checks the two against
each other.

### 8.3 Planned rules

Wording and severities will be settled when these are built.

| Rule | Reported when |
| --- | --- |
| UC-01 | A use case has no process |
| UC-02 | A summary input or output has no flow on the use case's process that carries the same contents to or from the same place. Contents are compared as in section 5.5 |
| UC-03 | A use case with a temporal trigger has a process with no control flow |

There is no rule against a flow that the form does not list. The textbook tells
students to add flows the use case left out, such as reads from data stores (page 147).

### 8.4 Views worked out from the forms

The textbook's way from use cases to diagrams has three more pieces of paper. Each is
worked out from the model, so none is a new kind of element.

| View | What it shows | Where the textbook has it |
| --- | --- | --- |
| Event-response list | One row for each use case: its trigger as the event, its name as the response, and the requirements traced to it (section 10.3) | Figures 4-5 and 4-10 |
| DFD fragment | One process of the level 0 diagram with its flows and the external entities and data stores at their other ends. It is the query `getFragment` (section 4.2). A student draws a fragment by adding the process and its flows to the level 0 diagram, and the level 0 diagram is the fragments put together, as on page 148 | Figures 4-18, 4-19 and 4-27 |
| Use case list | Every use case with its number, priority, actor and process | Pages 121 to 122 |

All three can be included in an export, so that an exercise that asks for fragments
(Chapter 4, minicase 4) can be handed in.

A use case package (page 122) needs nothing new. When a system has more than eight or
nine use cases, the package is a process on the level 0 diagram, and the use cases in it
are carried out by the processes on its child diagram. `processId` may name a process at
any level.

An exercise that asks only for the top of the form (Chapter 4, exercises A and C) is a
use case with its steps left empty. No rule asks for steps.

## 9. Entity relationship diagram and CRUD matrix (first release)

The textbook teaches the data model in Chapter 5. It has three parts: an entity
relationship diagram in crow's foot notation, the dictionary entries behind it, and a
create, read, update, delete (CRUD) matrix that ties the data model to the process
model. All three are part of the first release. They are not built in Release 0. This
section fixes their shape so that the core does not have to change when they are added.

### 9.1 Elements

An attribute is not a new kind of element. It is a data element (section 3.3) that an
entity owns. The data that a flow carries and the data that an entity holds are
therefore the same elements, each with one name and one definition. That is what lets
the tool compare the two models. The product vision listed the attribute as a kind of
its own, linked to a data element. This section replaces that.

| Kind | Extra fields | Notes |
| --- | --- | --- |
| Entity | `code`, `attributes`: an ordered list of `{ dataId, identifier, repeats }`, `storeId` | A person, place, event or thing that the system keeps data about (page 173). `code` is optional. It is the short prefix, such as MEM, that the textbook puts in front of each attribute name (page 174). `identifier` marks an attribute that is part of the entity's identifier. `repeats` marks an attribute that can hold several values for one instance of the entity. It is off by default, and it exists so that the unnormalized file that a normalization exercise starts from can be entered. `storeId` is the data store that holds this entity. It is empty until the student sets it |
| Relationship | `ends`: two of `{ entityId, verbPhrase, min, max }`, `identifying` | `min` is 0 or 1. `max` is `one` or `many`. Either may be empty, which means "not decided yet". A relationship has no name of its own |

How a relationship works:

- **What the values at an end mean.** The values at an entity's end say how many of that
  entity can go with one of the other entity. `max` is the textbook's cardinality and
  `min` is its modality (pages 175 to 176).
- **The verb phrase at an end** is read from that entity towards the other.
- **An example.** A member makes zero or many loans, and a loan is made by exactly one
  member. The Loan end has `min` 0, `max` `many` and the phrase "is made by". The Member
  end has `min` 1, `max` `one` and the phrase "makes".
- **Parent and child.** When one end is `one` and the other is `many`, the entity at
  the `one` end is the parent and the other is the child (page 175). When both ends are
  `one`, the first end is treated as the parent. When both ends are `many`, there is no
  parent, and rule ERD-05 reports the relationship.
- **Not decided yet.** A new relationship starts with `min` and `max` empty at both
  ends, so that drawing a line does not decide them for the student. While either `max`
  is empty, no parent is worked out, and rule ERD-10 reports the relationship. Visible
  Analyst offers the same "unknown" choice. An exact number, such as "at most three", is
  not a field. It goes in the description.
- **Identifying.** `identifying` is true when the child cannot be identified without
  its parent, so that the parent's identifier is part of the child's (page 184).
- **In the dictionary,** a relationship is listed under its parent's verb phrase, as the
  textbook does (Figure 5-8).

Three things are worked out from these fields and are never stored:

- **The full identifier** of an entity is its own identifier attributes, together with
  the full identifier of each parent it has through an identifying relationship. The
  inherited part is shown in the child's box, marked as an identifier, as in Figure 5-1.
- **A dependent entity** is the child in at least one identifying relationship. Every
  other entity is independent (page 184).
- **An intersection entity** needs no field. It is an entity placed between two others
  to replace a many-to-many relationship, and it is the child of both (pages 182 to
  183). Whether it is dependent follows from the line above.

These invariants are added to those of section 3.4.

9. A data element is an attribute of at most one entity.
10. Each end of a relationship is an entity, and `storeId` is a data store.
11. A relationship with no parent cannot be identifying. No entity depends on itself
    through a chain of identifying relationships.

Both ends of a relationship may be the same entity.

### 9.2 The diagram and the dictionary

`erd` is a new diagram kind. A project may have several, so that a large model can be
split into subject areas (page 189). An ERD is a view and holds no meaning. An entity
may be placed on any number of ERDs. A relationship is drawn on every ERD that shows
both of its entities.

Drawing follows the textbook's crow's foot style (Figures 5-1 and 5-2).

- **An entity** is a box with its name in capitals in a band across the top. The
  identifier attributes come first, each marked with an asterisk. A dashed line
  separates them from the other attributes.
- **A dependent entity** has a double border.
- **A relationship** is a plain line. At each end, the symbol next to the entity shows
  `max`: a bar for one, a crow's foot for many. The symbol beyond it shows `min`: a bar
  for at least one, a circle for zero. The two verb phrases sit beside the line, the
  parent's first. An identifying relationship is drawn the same as any other. An end whose
  `max` or `min` is not decided yet is drawn with a question mark in place of the symbol.
- **A repeating attribute** is shown in braces.

The dictionary shows an entry for each entity, attribute and relationship, in the
textbook's layouts (Figures 5-6 to 5-8). Every value comes from the model, so nothing is
typed twice. The entity's entry lists a type, a length and "null" for each attribute
(Figure 5-6). The type is the data element's `dataType`. The length and "null" are the
`length` and `nullable` fields of section 11.5. They can be filled in from the first
release, so that an exercise asking for dictionary entries (Chapter 5, exercise G) can
be done before the physical model exists. No first-release rule reads them.

### 9.3 Planned ERD rules

Wording and severities will be settled when these are built. The textbook calls its
data modeling advice guidelines and not rules (page 188), so most of these will be
warnings.

| Rule | Reported when |
| --- | --- |
| ERD-01 | An entity has no name, or an end of a relationship has no verb phrase |
| ERD-02 | Two entities have the same name, ignoring case. Two attributes with the same name are already reported by DFD-02 |
| ERD-03 | An entity has no attributes |
| ERD-04 | An entity has no identifier, either its own or an inherited one |
| ERD-05 | A relationship is many-to-many. The textbook resolves it with an intersection entity (page 183) |
| ERD-06 | A relationship is identifying, but its parent has no identifier |
| ERD-07 | An entity has a code, and the name of one of its attributes does not begin with it (Figure 5-15) |
| ERD-08 | A relationship is optional at both ends |
| ERD-09 | A one-to-one relationship is required at both ends |
| ERD-10 | An end of a relationship has no `min` or no `max` yet |
| ERD-11 | An entity has a repeating attribute, so it is not in first normal form (page 196) |

ERD-08 and ERD-09 come from Visible Analyst, whose checks the product vision says to
keep. The textbook does not state them. Its tutorials show the first check and not the
second, which rests on the 2002 manual alone (section 13).

Normalization (Appendix 5A) is checked only as far as a diagram can show it. ERD-05
reports a many-to-many relationship and ERD-11 reports a repeating attribute, which is
the test for first normal form. The second and third forms ask what an attribute depends
on, and that is a judgment about the business, not about the diagram. They are not
checked. Section 14.3 leaves open whether a student should be able to record those
dependencies.

The textbook's normalization exercises (Your Turn 5A-1, exercises J and K, and minicase
2 of Chapter 5) start from a file with repeating groups and ask for the model at each
normal form. The student enters the file as one entity with repeating attributes, and
ERD-11 reports it. They then split it, stage by stage. A student who must hand in each
stage exports the model at each stage.

Left to the instructor, because software cannot judge them: whether an entity has more
than one instance, whether terms match the business's own, whether each attribute is
used, whether an attribute is broken down far enough, and whether assumptions are stated
(Figure 5-15).

### 9.4 Balancing the data model with the process model

The textbook ties the two models together in two ways: a data store corresponds to
entities, and the data in flows corresponds to attributes (pages 191 to 192). The first
link is `storeId`. The second needs no link, because an attribute is a data element.

**Stored data.** The stored data of a data store is the attributes of the entities it
holds, together with the full identifier of each parent of those entities. A record has
to carry its parent's identifier to stay tied to it, although the logical diagram does
not list it as an attribute of the child.

| Rule | Reported when |
| --- | --- |
| DM-01 | An entity has no data store |
| DM-02 | A data store holds no entity |
| DM-03 | A flow into or out of a data store carries a data element that is not in the store's stored data. Contents are compared as in section 5.5. A structure with no components is skipped, because DD-01 already reports it |
| DM-04 | An attribute is carried by no flow into or out of its entity's data store |

These rules run only when the project has at least one entity, so that a project with
no data model yet is not buried in findings. DD-03 does not report a data element that
an entity owns, because DM-04 covers it.

The textbook also says that every data element in any flow should be an attribute of
some entity. That is left to the instructor. A value that is worked out for a report is
rightly not an attribute, and the tool cannot tell such a value from a missing one.

### 9.5 CRUD matrix

The matrix follows Figure 5-16. The columns are processes. The rows are the entities,
each followed by its own attributes. A cell holds any of the letters C, R, U and D, or
nothing. It says how that process uses that attribute.

- **Columns.** The processes that have no child diagram. Every higher process is the
  sum of those below it.
- **Cells.** Each process has one more field, `crud`: a list of `{ dataId, uses }`. A
  student can fill in one cell, or a whole entity at once.
- **An entity with no attributes yet** has one row, its own, and its cells are kept
  under the entity's identifier. This lets a matrix of processes against entities or
  data stores alone be filled in, as one design exercise asks (Chapter 10, exercise K).
  Rules CRUD-01 to CRUD-04 then read "the entity" where they say "an attribute". Once
  the entity has attributes, CRUD-05 reports its own cells until the student moves them
  to the attributes.
- **Who fills it in.** The student. A flow from a process into a data store does not say
  whether the process creates, updates or deletes, so the tool cannot fill in the
  matrix. It checks the matrix against the flows.
- **When a process is expanded,** it stops being a column. Its cells are kept, and
  CRUD-05 reports them until the student moves them to the child processes.

| Rule | Reported when |
| --- | --- |
| CRUD-01 | An attribute is neither created nor updated by any process (page 192) |
| CRUD-02 | An attribute is read by no process (page 192) |
| CRUD-03 | A cell has no flow to match. R needs a flow from the entity's data store to the process that carries the attribute. C and U need a flow from the process to the data store that carries it. D needs any flow from the process to the data store |
| CRUD-04 | A flow has no cell to match. A flow from a data store to a process needs an R in that column for an attribute it carries. A flow from a process to a data store needs a C, U or D |
| CRUD-05 | A process with a child diagram still has cells, or an entity with attributes still has cells of its own |

CRUD-01 and CRUD-02 run only when the matrix has at least one cell filled.

The textbook says that every attribute should be created, read, updated and deleted
somewhere (page 192). It treats only the two cases above as problems, and its own Figure
5-16 has attributes that are never updated or deleted. The tool therefore does not
report an attribute that is never deleted, or one that is created but never updated.

## 10. Forms, the interface structure diagram and the binder (second release)

The course covers chapters 1 to 12, and most of those chapters end in a deliverable that
is a document, not a model. The tool supports them in three ways, all in the second
release. This section fixes their shape so that the core does not have to change.

| Kind of support | What it is | Used for |
| --- | --- | --- |
| Form | An element kind with fixed fields. The tool checks that it is complete, checks its arithmetic, and links its entries to the model | System request, feasibility analysis, requirements definition, alternative matrix, test plan |
| Diagram | A new diagram kind with its own elements and rules | Interface structure diagram |
| Binder section | Free text with file attachments. Nothing is checked | Every other deliverable |

Forms and diagram elements have the common fields of section 3.2 and change only through
commands, like everything else in the model. Their rules are findings of the same shape
as in section 5.1. Wording and severities will be settled when they are built.

Where a form holds a table of numbers, the tool fills in the totals, as a spreadsheet
would. The student works out and types the measures that the textbook teaches as
formulas, such as return on investment, and the tool checks them.

### 10.1 System request (Chapter 1)

One per project. The fields follow Figure 1-5.

| Field | Type | Notes |
| --- | --- | --- |
| `sponsor` | Text | The project sponsor |
| `businessNeed` | Text | The business reason for the system |
| `businessRequirements` | List of text | The capabilities the system must give, at a high level |
| `businessValue` | List of `{ text, tangible, amount, estimates }` | `amount` applies to tangible value only. `estimates` is an optional list of `{ label, amount, probability }`, as in Figure 1-6 |
| `specialIssues` | Text | Special issues or constraints |

Where a value has estimates, its amount is the expected value: the sum of each amount
multiplied by its probability (page 18).

| Rule | Reported when |
| --- | --- |
| SR-01 | A field is empty |
| SR-02 | The probabilities of a set of estimates do not add up to 100% |
| SR-03 | The amount of a value with estimates is not their expected value |

### 10.2 Feasibility analysis (Chapter 1 and Appendix 1A)

One per project, in three parts (Figure 1-7).

| Part | Fields |
| --- | --- |
| Technical | An assessment and reasons for each of: familiarity with the application, familiarity with the technology, project size, compatibility |
| Organizational | An assessment for each of: strategic alignment, project champions, senior management, users, other stakeholders |
| Economic | The cash flow table below |

The cash flow table follows Figures 1-12 and 1-13.

| Field | Type | Notes |
| --- | --- | --- |
| `firstYear`, `years` | Whole numbers | The first column is year 0. The textbook forecasts three to five years after it |
| `rate` | Percentage | The required rate of return |
| `benefits` | List of `{ name, amounts, valueIndex }` | One amount for each year. `valueIndex` optionally points at a tangible value in the system request |
| `developmentCosts`, `operationalCosts` | Lists of `{ name, amounts }` | Development costs normally fall in year 0 |
| `quantity`, `unitAmount`, `growthRate` | Optional, on any benefit or cost line | A line may be given as a quantity and an amount for each unit, such as hours and an hourly rate, in place of typed amounts. `growthRate` is a yearly percentage |
| `intangibles` | List of text | Listed, not added up |
| `roi`, `breakEven`, `npv` | Numbers typed by the student | Checked against the formulas below |

The tool adds up total benefits, total development costs, total operational costs and
total costs for each year and overall. It also shows the net benefit for each year
(total benefits less total costs) and the running total, which the textbook calls the
cumulative net cash flow. It shows the present value of each year's total benefits and
total costs as well, because the net present value is built from them.

A line given as a quantity and a unit amount is filled in by the tool. The first year's
amount is the quantity multiplied by the unit amount. Each later year's amount is the
year before it, increased by the growth rate. This is the textbook's own third step
(Figure 1-10), and it leaves the student the formulas that the textbook teaches.

The cash flow table can be used alone. An exercise that asks only for a cost-benefit
analysis leaves the technical and organizational parts empty.

The formulas are the textbook's (pages 21 to 23).

- **Return on investment** is total benefits less total costs, divided by total costs.
- **Break-even point** is worked out in the year when the cumulative net cash flow turns
  positive. It is the number of earlier years, not counting year 0, plus a fraction:
  that year's net cash flow less that year's cumulative net cash flow, divided by that
  year's net cash flow. If the cumulative figure never turns positive, there is no
  break-even point.
- **Present value** of an amount in year n is the amount divided by (1 + rate) to the
  power n. Year 0 is not discounted.
- **Net present value** is the present value of total benefits less the present value of
  total costs.

A typed result passes when it is within 0.1 of a percentage point for return on
investment, within 0.01 of a year for the break-even point, and within one unit of money
for each year of the table for net present value. The last allowance is there because
the textbook rounds each year's present value before adding.

Worked example for the tests, original to this document. The rate is 8%.

| | Year 0 | Year 1 | Year 2 | Year 3 | Total |
| --- | --- | --- | --- | --- | --- |
| Total benefits | 0 | 40,000 | 50,000 | 60,000 | 150,000 |
| Total costs | 80,000 | 10,000 | 10,000 | 10,000 | 110,000 |
| Net benefit | -80,000 | 30,000 | 40,000 | 50,000 | 40,000 |
| Cumulative net cash flow | -80,000 | -50,000 | -10,000 | 40,000 | |
| Present value of benefits | 0 | 37,037 | 42,867 | 47,630 | 127,534 |
| Present value of costs | 80,000 | 9,259 | 8,573 | 7,938 | 105,771 |

Expected results: return on investment 36.4%, break-even point 2.20 years, net present
value 21,763.

| Rule | Reported when |
| --- | --- |
| FA-01 | A technical or organizational factor has no assessment. Not reported while both of those parts are wholly empty |
| FA-02 | The typed return on investment does not match the formula |
| FA-03 | The typed break-even point does not match the formula, or one is typed when the cumulative figure never turns positive |
| FA-04 | The typed net present value does not match the formula |
| FA-05 | A benefit that points at a value in the system request has a different first-year amount from that value |

Each of FA-02 to FA-04 shows its working in the finding, so the student can see which
step went wrong.

### 10.3 Requirements definition (Chapter 3)

A requirement is an element kind. The definition is the numbered outline of all of them,
laid out as in Figure 3-14.

| Field | Type | Notes |
| --- | --- | --- |
| `requirementKind` | `user`, `functional` or `nonfunctional` | The textbook has four levels (Figure 3-1). Business requirements are the business requirements of the system request (section 10.1). A user requirement says what a user needs to do, and is listed ahead of the functional ones |
| `functionalType` | `process-oriented` or `information-oriented` | Functional only, and optional. A process the system performs, or information it must hold (Figure 3-1) |
| `group` | Text | Functional only. The business area, such as "Place Orders". Groups may sit under a user group heading, such as "Clients" |
| `nonfunctionalType` | `operational`, `performance`, `security` or `cultural and political` | Nonfunctional only (Figure 3-2) |
| `subtype` | One of the textbook's fifteen sub-types | Optional. Added when Chapter 7 refines the nonfunctional requirements (Figures 7-5 to 7-8) |
| `priority` | `high`, `medium`, `low`, or a release number | Optional |
| `traceIds` | List of use cases and processes | What carries out this requirement |

The requirement's sentence is its `name`. Its number is derived from its place in the
outline: groups are 1, 2, 3 and requirements are 1.1, 1.2. Nonfunctional numbering
starts again at 1, with one group for each type.

A nonfunctional type with nothing in it is stated, not left blank, as the textbook does
("No special cultural and political requirements are expected"). The form has a
`noneExpected` mark for each type.

| Rule | Reported when |
| --- | --- |
| RQ-01 | A functional requirement is traced to no use case and no process |
| RQ-02 | A use case has no requirement traced to it |
| RQ-03 | A nonfunctional type has no requirement and is not marked as none expected |

The textbook records the same link in the Requirements column of its event-response
list (Figure 4-10).

### 10.4 Alternative matrix (Chapter 6)

One or more per project. The layout follows Figure 6-6.

| Field | Type | Notes |
| --- | --- | --- |
| `alternatives` | List of names | The columns. The textbook's examples compare three |
| `criteria` | List of `{ name, group, weight }` | The rows. `group` is `technical`, `economic` or `organizational` |
| `cells` | For each criterion and alternative: `{ supportingInformation, score }` | The score is a whole number from 1 (poor fit) to 5 (perfect fit) |
| `recommendation` | Text | The recommended acquisition strategy and the reasons for it |

The tool multiplies each score by its weight and adds up a total for each alternative.

| Rule | Reported when |
| --- | --- |
| AM-01 | The weights do not add up to 100 |
| AM-02 | A score is missing or is not between 1 and 5 |
| AM-03 | A cell has no supporting information |

### 10.5 Test plan (Chapter 11)

A test is an element kind, and the test plan is the list of them. The fields follow
Figure 11-1, with the stage and type from Figure 11-4.

| Field | Type | Notes |
| --- | --- | --- |
| `ordinal` | Whole number | The test ID |
| `stage` | `unit`, `integration`, `system` or `acceptance` | |
| `testType` | One of the textbook's types for that stage | For example black-box, use scenario, requirements |
| `programId`, `version` | Text | The program under test. `programId` points at a program specification when one exists |
| `tester`, `dateDesigned`, `dateConducted` | Text and dates | |
| `requirementId` | A requirement, or text | The requirement addressed. Text is allowed when the project has no requirements definition, as in an exercise that asks for a test plan alone |
| `objective` | Text | |
| `testCases` | List of `{ interfaceId, dataField, valueEntered }` | `interfaceId` points at an interface on an interface structure diagram, or is text when the project has no such diagram |
| `script` | Text | For key and mouse sequences |
| `expectedResults`, `actualResults` | Text | |
| `result` | Empty, `passed` or `open items` | |

| Rule | Reported when |
| --- | --- |
| TP-01 | A test has no objective, has neither test cases nor a script, or has no expected results |
| TP-02 | A functional requirement is addressed by no test |

### 10.6 Interface structure diagram (Chapter 8)

A new diagram kind, `isd`. A project may have several. The textbook suggests one for
each process on the level 0 diagram (page 264).

| Kind | Extra fields | Notes |
| --- | --- | --- |
| Interface | `diagramId`, `number`, `processIds` | A screen, form or report. `processIds` lists the DFD processes it carries out and may be empty |
| Navigation link | `diagramId`, `aId`, `bId` | The user can move between these two interfaces. It has no direction |

The textbook ties an interface to DFD processes, not to use cases (page 262). The link
to a use case runs through the process (section 8.2).

An interface is drawn as a box in three parts: its number at the top, its name in the
middle and its process numbers at the bottom (Figure 8-10). A navigation link is a line
with no arrowhead. Interface 0 is the main menu. The diagram is usually a tree, but a
link may cut across it as a shortcut (Figure 8-25).

Invariants: both ends of a navigation link are interfaces on the link's diagram, and no
two interfaces on one diagram have the same number.

| Rule | Reported when |
| --- | --- |
| ISD-01 | A diagram has no interface numbered 0 |
| ISD-02 | An interface cannot be reached from interface 0 |
| ISD-03 | An interface with nothing below it names no process. Reported only when the level 0 diagram has processes |
| ISD-04 | A process on the level 0 diagram is carried out by no interface, counting the processes below it. Reported only when the project has an interface structure diagram |

### 10.7 The binder

The textbook has project teams keep an "electronic project binder": every deliverable,
in folders by phase, with a table of contents (page 56). The tool's binder is the same
thing.

| Field | Type | Notes |
| --- | --- | --- |
| `phase` | `planning`, `analysis`, `design` or `implementation` | |
| `body` | Text with headings, lists and tables | |
| `attachments` | Files of any type | Work made in other tools: images, PDFs, spreadsheets, and a web page or a zipped folder for an interface prototype (Chapter 8, exercises L and M). An exported PDF shows images and PDFs in place and lists every other file by name |

Nothing in a binder section is checked. A new section can start from the textbook's
layout for that deliverable.

The migration plan has one small form inside it, for the conversion strategy. The
student makes the three choices the textbook describes: the conversion style, the
conversion locations and the conversion modules (Figure 12-3). The tool then shows what
the textbook says each choice means for risk, cost and time (Figure 12-4), in the tool's
own words, beside the student's written reasons. Nothing is marked wrong, because the
right strategy depends on the business.

| Section | Chapter | Starting layout |
| --- | --- | --- |
| Work plan | 2 | None. The textbook gives no format |
| Staffing plan | 2 | A table of role, description and person assigned, then the reporting structure and special incentives (Figure 2-19) |
| Project charter | 2 | The project objective and a numbered list of team rules (Figure 2-20) |
| Risk assessment | 2 | For each risk: description, likelihood, potential impact, ways to address it (Figure 2-18) |
| Standards list | 2 | A table of types of standards and examples (Figure 2-14) |
| Executive summary | 3 | None |
| Architecture design | 7 | None. The nonfunctional requirements, with their sub-types, are printed from section 10.3 |
| Hardware and software specification | 7 | A table with a column for each kind of computer and rows for operating system, special software, hardware and network (Figure 7-10) |
| Personas and use scenarios | 8 | A numbered list of user steps for each scenario (Figure 8-23) |
| Interface standards | 8 | Metaphor, objects, actions, icons, template (Figure 8-26) |
| Interface prototypes | 8 | Attachments: storyboards, wireframes, screen designs |
| Data storage design | 10 | A table of each kind of data, its type, its use and the storage format suggested for it (Figure 10-6). Then a table of targets, comments and suggestions for denormalizing, clustering and indexing (Figure 10-20). The physical data model and the size estimate are in section 11 |
| Documentation | 11 | None |
| Migration plan | 12 | Preparing the business, the technology and the people (Figure 12-2). The conversion strategy by style, locations and modules (Figure 12-3) |

A student can add sections that are not in this list, such as interview reports.

### 10.8 Export to PDF

Every form, diagram and binder section exports to PDF, alone or as part of a compiled
document. The compiled documents are the ones the textbook has a team hand in at the
end of each phase.

| Document | Contents, in order | Order taken from |
| --- | --- | --- |
| System request and feasibility study | System request, feasibility analysis | Figure 1-3 |
| Project plan | Work plan, staffing plan, project charter, standards list, risk assessment | The textbook gives no outline |
| System proposal | Table of contents, executive summary, system request, work plan, feasibility analysis, requirements definition, use cases, process model, data model, appendices | Figure 3-15 |
| System specification | Recommended acquisition strategy, alternative matrix, architecture design, hardware and software specification, interface design, physical process model, program design specifications, physical data model, data storage design, CRUD matrix, repository entries | Figure 6-2 |
| Program design document | Every structure chart, then the program specifications in module order | Page 308 |
| Implementation documents | Test plan, documentation, migration plan | The textbook gives no outline |

The table of contents is generated. The process model and data model are the diagrams
with their descriptions, and the repository entries are the data dictionary. A part that
does not exist yet is left out and listed as missing on the contents page. Each compiled
document ends with the current findings for what it contains.

## 11. Design diagrams (second release)

Chapters 9 and 10 of the textbook turn the analysis models into design models: the
physical DFD, the structure chart, the program specification, the physical data model,
a revised CRUD matrix and an estimate of storage size. Each is built from a model of the
first release. All are in the second release. This section fixes their shape so that
the core does not have to change.

Like everything else, these change only through commands and report findings of the
shape in section 5.1. Wording and severities will be settled when they are built.

### 11.1 One model, two modes

A physical model is not a copy of its logical model. Each element gains fields for
design, and each DFD, each ERD and the CRUD matrix can be shown in `logical` or
`physical` mode.

The textbook builds each physical model by adding detail to the logical one. It has the
same parts and follows the same rules (pages 301 and 347). A separate copy would let a
student rearrange the physical model freely, but it would leave two models to drift
apart.

One new field, `systemRelated`, marks a process, data store, data flow, data element or
entity that exists only for the way the system is built: an audit file, a control, the
handling of an exception (pages 303 to 304 and 350). Such an element is shown only in
physical mode.

Rules run twice. On the logical model they leave out everything marked `systemRelated`.
On the physical model they include it.

### 11.2 Physical DFD (Chapter 9)

The textbook makes a physical DFD in five steps (Figure 9-1).

| Step | In the tool |
| --- | --- |
| 1. Add implementation references | A process has `implementation`: text such as "Python", shown on the last line of its symbol. A data store and a data flow have `physicalName`: text shown in place of the logical name, such as "MySQL: Loans Table" or "Loan Request Input Form". External entities do not change (page 302) |
| 2. Draw a human-machine boundary | A process and an external entity have `human`: true when a person does the work. The tool draws a dashed line around the human parts of each diagram, as in Figures 9-2 and 9-4 |
| 3. Add system-related data stores, data flows and processes | These are created with `systemRelated` set |
| 4. Update the data elements in the data flows | Data elements with `systemRelated` set, such as the date of the last change, are added to the structures that the flows carry |
| 5. Update the metadata | Descriptions, and the table sizes of section 11.6 |

The boundary is a field and not a drawn line, so that a keyboard user can set it in the
outline view.

Process numbers, levels and balancing are those of the logical model. The textbook says
only that the same rules apply (page 301), so every rule of section 5 runs on the
physical model too.

| Rule | Reported when |
| --- | --- |
| PD-01 | A process has no implementation and is not marked as human work |
| PD-02 | A data store or a data flow has no physical name |
| PD-03 | Nothing is marked as human work, so no boundary is drawn |

### 11.3 Structure chart (Chapter 9)

`structureChart` is a new diagram kind. It has one more field, `topModuleId`, and shows
the tree of modules under that module. A project may have several charts.

| Kind | Extra fields | Notes |
| --- | --- | --- |
| Module | `parentModuleId` (empty for the top module), `ordinal`, `conditional`, `repeated`, `library`, `repeatsId`, `processId` | Its number is built from ordinals, as a process's is (page 308). `conditional`: its control module calls it only in some cases. `repeated`: its control module calls it more than once. `library`: it is a standard module used in many places. `repeatsId`: this box is one more appearance of that module. `processId`: the DFD process it comes from, if any |
| Couple | `moduleId`, `direction` (`down` or `up`), `coupleKind` (`data` or `control`), `dataId` | Information passed along the line between a module and its control module. A data couple carries a data definition and takes its label from it, as a flow does. A control couple, or flag, has a `name` and carries no data |

Notes on the model:

- **The top module.** Its ordinal can be changed, so that a chart can carry the number
  of its process. The textbook writes the top number as 1.0, 1 and 2.0 in different
  figures. The tool writes it without ".0".
- **A module used in several places.** The textbook draws a library module once in each
  place it is called (page 309). Each extra box is a module with `repeatsId` set. It
  takes its name, its library mark and its specification from the module it repeats, and
  it has nothing below it.
- **Fan-out** is the number of modules directly below a module. **Fan-in** is one, plus
  the number of boxes that repeat it (page 321).
- **Symbols** follow Figure 9-7. A module is a rectangle holding its number and name. A
  library module has a vertical bar inside each side. A conditional call has a diamond
  on its line. A repeated call has a curved arrow across its line, and repeated modules
  that sit side by side share one arrow (Figure 9-8). A data couple is a short arrow
  with an empty circle at its tail. A control couple has a filled circle.
- **Connectors are left out.** The textbook's two connector symbols split a chart across
  paper pages. A chart here is not limited to a page.

Invariants: the modules of a chart form a tree. No two modules with the same parent have
the same ordinal. `repeatsId` points at a module that is not itself a repeat. The top
module has no couples, because it has no line above it.

| Rule | Reported when |
| --- | --- |
| SC-01 | A module has no name, or a control couple has no name |
| SC-02 | A control couple is passed down (page 311) |
| SC-03 | A module has more than seven modules directly below it. Not reported when every one of them is conditional |
| SC-04 | A module's name contains the word "and" (page 319) |
| SC-05 | Two modules have the same name, and neither repeats the other |
| SC-06 | A module is repeated but is not marked as a library module |
| SC-07 | A process with no child diagram is carried out by no module (page 313). Runs only when the project has a structure chart |

The textbook excuses a control module in a transaction structure from the limit of seven
(page 324), but it gives no test for one. The tool reads it as a module whose calls are
all conditional, as Figure 9-10 draws it. That reading is the tool's own.

Left to the instructor, because software cannot judge them: the kind of cohesion and of
coupling, whether a module uses the couples it is passed, whether a module holds a
reasonable amount of code, and whether a structure is a transaction or a transform
structure (Figures 9-14 to 9-18).

### 11.4 Program specification (Chapter 9)

The textbook has a team write one specification for each module (page 324). It is a set
of fields on the module, laid out as the form in Figure 9-19. A test's `programId`
(section 10.5) points at the module.

| Field | Type | Notes |
| --- | --- | --- |
| `purpose` | Text | |
| `programmer`, `dateDue` | Text and a date | |
| `language` | Text | The textbook's form lists languages to tick, and the list differs between Figures 9-19 and 9-22 |
| `events` | Text | What starts the program. Left empty for a program that runs in a fixed order (page 326) |
| `ioNotes` | List of `{ coupleId, notes }` | The notes for one row of the inputs or outputs table |
| `pseudocode` | Text | Not checked |
| `other` | Text | Calculations, business rules, calls to library modules, and changes that the chart needs |

The inputs and outputs are not typed. The textbook says that they are the module's
couples (page 326), so the tool lists them from the chart. An input is a couple passed
down to the module, or passed up to it from a module below. An output is the reverse.
Each row shows the couple's name, its type and the module at the other end. The type
comes from the data definition, and a control couple is shown as a flag.

A student who finds an input missing adds the couple on the chart. The textbook makes
the same point: writing the specification shows up problems in the chart (page 324).

| Rule | Reported when |
| --- | --- |
| PS-01 | A module has no purpose or no pseudocode. A box that repeats another module is not checked |

### 11.5 Physical data model (Chapter 10)

The textbook makes a physical ERD in five steps (Figure 10-7).

| Step | In the tool |
| --- | --- |
| 1. Change entities to tables or files | An entity has `tableName` |
| 2. Change attributes to fields | A data element has `fieldName`, `length`, `nullable` and `defaultValue`. Its `dataType` and `allowedValues` exist already (section 3.3) |
| 3. Add primary keys | The full identifier (section 9.1) is the primary key. A table with no identifier is given a generated one: a data element with `systemRelated` set and marked as an identifier (page 350). ERD-04 counts it |
| 4. Add foreign keys | A relationship has `foreignKey`, which the student sets. The child table then shows the parent's primary key fields, tagged FK |
| 5. Add system-related components | Entities and data elements with `systemRelated` set |

Notes on the model:

- **Foreign keys are shown, not stored.** The child table shows the parent's primary key
  fields under the parent's field names, as in Figure 10-10. In an identifying
  relationship those fields are tagged PK as well.
- **The student places each foreign key.** The tool does not add them on its own,
  because placing them is the step the textbook teaches (page 350).
- **One-to-one relationships.** The foreign key goes in the child, which is the second
  end (section 9.1). The textbook gives no rule for this case.
- **Denormalization.** An entity has `copies`: a list of data elements owned by another
  entity that this table repeats (Figures 10-13 and 10-14). Nothing about it is checked.
  When to denormalize is a judgment.
- **Drawing.** In physical mode an ERD follows Figures 10-8 and 10-10. The band holds
  the table name. Each field has its data type and length beside it. The primary key
  fields sit above the dashed line. PK and FK are small tags in front of the field
  name. Relationship lines do not change.
- **Default and allowed values** are shown in the dictionary and not on the diagram
  (page 349).

| Rule | Reported when |
| --- | --- |
| PDM-01 | A table has no table name, or a field has no field name or no data type |
| PDM-02 | A table has no primary key (page 350) |
| PDM-03 | A relationship has no foreign key (page 350). A many-to-many relationship cannot have one, and ERD-05 reports it |
| PDM-04 | Two tables have the same table name, or two fields of one table have the same field name |

The DM rules of section 9.4 and the CRUD rules of section 9.5 run on the physical model
as well. That covers what the textbook asks for in step 5: the data stores and data
elements added to the physical DFD must appear as tables and fields (page 350).

In physical mode the CRUD matrix shows table and field names and includes the
system-related processes, tables and fields, as Figure 10-11 does. It has one set of
cells for both modes.

### 11.6 Storage size estimate (Chapter 10)

The textbook calls this volumetrics. It needs seven more fields.

| Field | On | Notes |
| --- | --- | --- |
| `averageWidth` | Data element | In characters. The average width of the values, not the longest allowed (page 361) |
| `initialRecords` | Entity | The number of records loaded at the start |
| `growthPerMonth` | Entity | A number of records, not a percentage |
| `growthPerYear` | Entity | A percentage, used in place of `growthPerMonth` when an exercise gives growth that way. The tool compounds it once a year and says so, because the textbook does not say how |
| `recordSize` | Entity | Typed only when the entity has no fields, for an exercise that gives the size of each record and nothing else (Chapter 10, minicase 1) |
| `overheadRate`, `months` | Project | The share added for the database's own needs, and how far ahead to estimate |

The tool works out the rest. The textbook gives the method in words (pages 360 to 362).
These formulas give the same numbers as its Figure 10-18.

- **Record size** is the sum of the average widths of the table's fields, counting
  foreign key fields and copies.
- **Total record size** is the record size multiplied by one plus the overhead rate.
- **Initial volume** is the total record size multiplied by the initial records.
- **Volume after the chosen months** is the total record size multiplied by the sum of
  the initial records and the growth for those months.
- **Database size** is the sum over all tables.

Worked example for the tests, original to this document. A table has four fields of
average width 6, 20, 10 and 4. The overhead rate is 25%. It starts with 2,000 records
and grows by 100 a month. The estimate is for 24 months.

| Item | Value |
| --- | --- |
| Record size | 40 |
| Total record size | 50 |
| Initial volume | 100,000 |
| Volume after 24 months | 220,000 |

| Rule | Reported when |
| --- | --- |
| VOL-01 | A field has no average width, or a table has no initial records |

The tool calculates here, where section 10.2 has the student calculate. The textbook
teaches the measures of section 10.2 as formulas. It presents this estimate as a report
run from the modeling tool (page 362), and it writes no formulas for it.

One of the textbook's exercises gives growth as a percentage for each year (page 366).
The textbook does not say whether that growth compounds. A student turns it into records
for each month.

## 12. Code layout and tools

| Part | Contents | Used by |
| --- | --- | --- |
| `packages/model` | Element types, argument schemas, invariants, commands, queries | Everything |
| `packages/rules` | Rule definitions, profiles, message text | Browser and server |
| `packages/cases` | The test cases in section 6 as command lists and expected findings | Tests |
| `apps/web` | Canvas and outline view | Browser |
| `apps/server` | Storage, Canvas launch, and later the AI gateway | Server |

| Need | Choice | License |
| --- | --- | --- |
| Language | TypeScript | Apache-2.0 |
| Interface | React | MIT |
| Canvas | React Flow | MIT |
| Layout | elkjs. Dagre (MIT) was the alternative. Section 14.1 records the choice | EPL-2.0 or GPL-3.0-or-later |
| Argument schemas | Zod | MIT |
| Tests | Vitest | MIT |
| Database, when the server needs one | PostgreSQL | PostgreSQL License |
| Server framework | Fastify | MIT |
| Canvas launch | Our own layer on `jose` | MIT |
| Database access | Kysely, behind our own project-store interface | MIT |
| AI models and agents | Vercel AI SDK (`ai`) plus provider packages | Apache-2.0 |
| Deployment | Docker image, and Docker Compose with PostgreSQL | Not applicable |
| Linking the packages and apps | npm workspaces | Part of npm |
| Web app build and routing | Vite and React Router | MIT |
| Browser tests | Playwright, with its default Chromium headless shell. Other engines were measured on 18 November 2026: Firefox and WebKit were no lighter, and Lightpanda and Obscura failed keyboard focus, SVG sizes or rendering | Apache-2.0 |
| Database migrations | Kysely's migration runner | MIT |

The code in `apps/server` reaches the database only through the project-store interface.

Browser tests cost the most processor time and memory, so they are kept few. A check on
one component runs in Vitest's browser mode, and a check on the model or the rules runs
as a plain unit test. A full Playwright test is kept for a path a student follows through
the app. Playwright runs no more workers than the machine has processor cores, and the
suite is split across CI jobs once it grows.

The `model` and `rules` packages must have no dependency on React, the browser or the
server.

## 13. Checked against the textbook

Chapter 4 of the textbook was read against sections 3 and 5. An entry that cites a
figure was read from the figure itself.

| Question | What the textbook says | Where | Effect here |
| --- | --- | --- | --- |
| Symbol style | Gane and Sarson | Page 137, Figure 4-13 | Section 3.5 |
| Context diagram | One process, always numbered 0. No data stores. A data store kept by another system is drawn as an external entity | Pages 141, 145 | Invariant 7, DFD-10 |
| Level names and numbers | The level is the number of periods in the process numbers. The examples number level 0 processes after their use cases | Page 142, Figure 4-20 | Process `ordinal` |
| Processes on a diagram | Three to seven in the checklist. "No more than seven to nine" in the prose | Pages 149, 153 | DFD-11, DFD-12 |
| Inputs and outputs | Every process has at least one of each. A process with no input is a "miracle" and one with no output is a "black hole" | Pages 138, 154 | DFD-03, DFD-04, DFD-07 |
| Flows | One end of every flow is a process. No flow has two heads | Pages 138, 153 to 155 | DFD-05. A flow has one source and one target |
| Data stores | At least one flow in and one out, somewhere in the model. A store with only one is "not necessarily an error" | Pages 138, 152, 155 | DFD-09 |
| Names and descriptions | Every item has a unique name and a description. A process name is a verb phrase without "and". Outputs usually have different names from inputs | Pages 138, 146, 153 | DFD-01, DFD-02, DFD-13, DFD-14, DFD-15 |
| Balancing | The parent's information is "shown appropriately" below. A child diagram will likely add flows. No rule for a flow split into parts | Pages 141, 167 | Section 5.5. BAL-03 is a warning |
| Flows to other diagrams | The line ends in a note such as "To Process 2". External entities are shown on every level | Pages 140, 142 | Off-diagram ends, `expandProcess` |
| Time triggers | A dotted control flow into the process | Pages 156 to 157 | Control flow kind, DFD-03 |
| Data stores that appear only on a lower level | No rule. The figures show them | Figure 4-12 | The "inside" definition in section 5.5 stands |
| One data definition for each flow | A flow is one fact or a logical collection of facts | Page 138 | Section 3.3 stands |
| Flow labels | A flow has one name. The figures rename a flow between levels | Figures 4-20, 4-21 | A renamed flow carries a different definition, composed of the same elements |
| Composition notation | None. A flow's description lists its data elements | Page 138, Figure 4-13 | Component lists stay as they are |
| Repeated symbols | An external entity may be drawn twice on one diagram, with no marker | Figure 4-28 | Section 3.5 allows several occurrences |

Left to the instructor, because software cannot judge them: whether names are verbs or
nouns, whether a process has enough inputs to make its outputs, a consistent point of
view, a consistent level of detail, and consistent terms (pages 153 to 156).

The alias and notes fields that the textbook lists for a CASE tool (Figure 4-13) are
common fields of every element (section 3.2). The process description of Figure 4-16 is
the `processDescription` field (section 3.3). Still left out are four kinds of metadata
that the textbook lists in Figure 5-9: a user contact and an analyst contact for an
entity, and sample values and a format for an attribute. The notes field can hold them.

The textbook's own figures do not all pass these rules. Figure 4-21 adds flows that its
parent, Figure 4-20, does not show, which BAL-03 reports as warnings. It also renames
"Part Needed" to "Part ID and Quantity Needed", which balances only if the dictionary
defines one in terms of the other.

Chapters 1, 3, 6, 8 and 11 were read for section 10. Four points matter when testing
against the book.

| Where | What the textbook prints | What the formulas or the text give |
| --- | --- | --- |
| Figure 1-8, page 22 | A break-even point of 2.68 years, from 28,000 divided by 41,000 | 2.66 years. The subtraction above it gives 27,000 |
| Figure 1A-1, page 36 | A return on investment of 143%, which is benefits divided by costs | 43%, as page 35 and Figure 1-15 say |
| Figure 1A-1, page 36 | A break-even point of 1.62 years | 1.27 years, which agrees with "about 0.27 of the second year" on page 35 |
| Figure 8-25, page 290 | Interface numbers used twice on one diagram | The text says each number is unique (page 262). The tool keeps them unique |

Chapter 5 was read against section 9, and chapters 9 and 10 against section 11. The
notes are kept in `sources/notes/` on the author's computer, outside the repository.

| Question | What the textbook says | Where | Effect here |
| --- | --- | --- | --- |
| ERD notation | Crow's foot. An asterisk marks an identifier. A dependent entity has a double border | Pages 172 to 184, Figure 5-1 | Section 9.2 |
| Ends of a relationship | A verb phrase at each end. Cardinality and modality at each end. The parent is at the "one" end | Pages 175 to 176 | The `ends` of a relationship |
| Kinds of entity | Independent, dependent and intersection. The test for a dependent entity is that its identifier includes a parent's | Pages 182 to 184 | Worked out, not stored |
| Keys in the logical model | Identifiers only. Primary and foreign keys appear in Chapter 10 | Pages 174, 350 | Section 11.5 |
| Data model guidelines | Six, and "not rules that must be followed". Only the attribute prefix can be checked | Page 188, Figure 5-15 | ERD-07 |
| Balancing the two models | Every entity is a data store. Data in flows matches attributes | Pages 191 to 192 | Section 9.4 |
| CRUD matrix | Processes across, entities and attributes down. An attribute that is never read, or never created or updated, is a problem | Page 192, Figure 5-16 | Section 9.5 |
| Normalization | Three forms, each a yes or no test on what an attribute depends on | Pages 196 to 200 | Not checked |
| Physical DFD | The same parts and rules as the logical DFD. Five steps | Pages 301 to 305, Figure 9-1 | Sections 11.1 and 11.2 |
| Structure chart symbols | Module, library module, loop, conditional line, data couple, control couple, two connectors | Figure 9-7 | Section 11.3 |
| Control couples | Passed up, not down | Page 311, Figure 9-18 | SC-02 |
| Limit on modules below one | About seven. A transaction structure is excused | Page 324 | SC-03 |
| Modules and processes | A process tends to become a module, and a DFD level a chart level | Page 313 | `processId`, SC-07 |
| Program specification | One for each module. Its inputs and outputs are the module's couples | Pages 324 to 326, Figure 9-19 | Section 11.4 |
| Physical ERD | Five steps. Every table needs a primary key. The child table gets the foreign key | Pages 347 to 351, Figure 10-7 | Section 11.5 |
| Storage size | Field widths, overhead, initial records and growth for each month | Pages 360 to 362, Figure 10-18 | Section 11.6 |
| Program design document | Every structure chart and program specification | Page 308 | Section 10.8 |

These points matter when testing against the book's design chapters.

| Where | What the textbook prints | What the tool does |
| --- | --- | --- |
| Page 176 | One sentence puts the "zero" of an optional relationship next to the parent | It follows Figure 5-1 and the examples on pages 176 and 182, which put it by the crow's foot |
| Figure 5-15, page 190 | Relationships with one verb phrase | ERD-01 asks for one at each end, as the text does (page 175) |
| Figure 5-16, page 192 | Attributes that are never updated or deleted, though the text says each should be | It reports only what the text calls a problem. See section 9.5 |
| Figure 9-7, page 310 | The off-page connector is called a hexagon and drawn with five sides | Connectors are left out |
| Figure 9-13, page 318 | A control couple passed down | SC-02 reports it |
| Figures 9-19 and 9-22 | The same form with different column headings and languages | It follows Figure 9-19 |
| Figure 9-22, page 329 | Inputs and outputs that name modules beside the module, not the one above it | It names the module at the other end of the couple |
| Figure 10-10, page 352 | Two field names that look misspelled, and a key field tagged PK that should also be FK | Starter cases do not copy it |
| Figure 10-18, page 362 | Growth labeled as a rate, though the number is a count of records | `growthPerMonth` is a count |

### Checked against Visible Analyst's tutorials

Two vendor tutorials were read on 17 November 2026: the Zachman Framework edition of
2009, and a shorter one that reprints its framework chapter. The notes are in
`sources/notes/visible-analyst-gap-report.md`, outside the repository, and page numbers below are PDF pages of
the 2009 tutorial. The table has every message and check that the tutorials show from
Visible Analyst's Analyze function for the diagrams this specification covers.

| Visible Analyst reports | Page | Rule here | Difference |
| --- | --- | --- | --- |
| A data flow that "is dangling", meaning it is not attached to a process | 136 | DFD-05 | None |
| An unnamed data flow, and labels missing on any object | 136 | DFD-01 | Here a flow's label is the name of its data, so the rule reports the unnamed definition |
| Unattached objects | 136 | DFD-05, DFD-07, DFD-08 | None |
| A process without at least one input flow and one output flow | 136 | DFD-03, DFD-04, DFD-07 | The tutorials do not use the textbook's words "miracle" and "black hole" |
| An input flow on the parent that "is not shown" on the child | 137 | BAL-01, with BAL-02 for outputs | Visible Analyst matches flows by name. Here the contents are compared through the dictionary |
| A net input flow on the child that is "not shown attached to parent Process" | 136 | BAL-03 | An error there, a warning here (section 1) |
| A flow that is an input on one level and an output on another | 136 | BAL-01 and BAL-03 together | No single message names the direction |
| An unnamed entity, and relationship lines without labels | 115 | ERD-01 | None |
| A relationship that is "not normalized": many-to-many, or optional at both ends | 115 | ERD-05, ERD-08 | None |
| A foreign key that "does not exist" for a relationship | 260 | PDM-03 | Second release |
| An entity with no data store of the same composition | 73 | DM-01, DM-02 | No message is shown in the tutorial |
| A data element of an entity that no process uses on any data flow diagram | 73 | DM-03, DM-04 | No message is shown in the tutorial |
| A process on a functional decomposition diagram that is on no data flow diagram | 102 | None | There is no such diagram here. The process tree is worked out from the data flow diagrams, so the case cannot arise |

The tutorials show no check for a structure chart, and call that diagram's messages
"guidelines rather than rules" (page 74). Rules SC-01 to SC-07 come from the textbook.

These rules have no counterpart in the tutorials: DFD-02, DFD-06, DFD-09 to DFD-15,
DD-01 to DD-03, BAL-04, UC-01 to UC-03, CRUD-01 to CRUD-05, ERD-02 to ERD-04, ERD-06,
ERD-07 and ERD-09 to ERD-11. Most come from the textbook's checklists. ERD-09 comes
from Visible Analyst's older manual, and ERD-10 and ERD-11 are explained in section 14.4.

Visible Analyst is more permissive in one place. A net input flow may come "from
nowhere", with no external entity (page 124). Here DFD-05 reports a flow with a free
end, as the textbook's rule that every flow has two ends requires.

## 14. Settled points and open points

### 14.1 Settled on 17 November 2026

The project's author left the first seven to the specification's judgment. The eighth
was settled by reading the library's own records. The author chose the ninth, and also
confirmed the eight calls listed in section 14.2.

| Point | Settled as | Why |
| --- | --- | --- |
| Upper limit on processes | Seven. DFD-12 stays as written | Students check their work against the textbook's checklist (Figure 4-24), which says seven. The finding is only a warning, so a diagram of eight or nine is not marked wrong |
| Severities | DFD-07 and DFD-08 are errors. DFD-13 is a warning | The checklist lists the first two as syntax rules. A missing description is unfinished work, not a mistake |
| The textbook's figures | Students are told. The tool's help has a page on where it is stricter than the book, and BAL-03's explanation says that the book's own figures add flows this way. Starter cases stay original and balanced | A student who compares their work with Figure 4-21 should not be surprised by a warning |
| Drawing from a use case form | Not offered. The tool checks the form against the diagrams and draws nothing | Turning a use case into a diagram is the exercise the textbook sets (pages 144 to 149) |
| Calculate or check | As section 10 has it. The tool adds up the totals. The student types the expected value, return on investment, break-even point and net present value, and the tool checks them | The textbook teaches those four as formulas |
| Binder sections that could be forms | They stay binder sections | Nothing in them can be checked, and a binder section still exports to PDF |
| Tests and requirements | TP-02 stays: every functional requirement needs a test | The textbook ties a test to a requirement, not to a use case |
| elkjs license | Usable. From version 0.12.0 the package is released under "EPL-2.0 OR GPL-3.0-or-later". Since 18 November 2026 it is used under EPL-2.0 | See below |
| Layout library | elkjs | Chosen by the project's author. Dagre stays the fallback if elkjs proves unworkable |

The elkjs license was checked on 17 November 2026. The project behind the library, ELK,
names GPL-3.0 as a secondary license in its notice file. The elkjs contributors agreed
to the same change, and the issue that tracked their agreement was closed as complete in
July 2026. The license file in the elkjs repository still holds only the text of
the Eclipse Public License, so the package's own license field is the statement to rely
on.

The project's license changed from AGPL-3.0-or-later to the Business Source License on
18 November 2026 (section 1). The GPL option no longer helps, because GPL code would force
the whole tool under the GPL. elkjs is used under EPL-2.0 instead. EPL-2.0 lets its files
be combined with code under another license, as long as changes to elkjs's own files are
shared under EPL-2.0.

### 14.2 Calls made in sections 9 and 11, confirmed

These were made when the data model and the design diagrams were specified. The
project's author confirmed all eight on 17 November 2026. None affects Release 0.

1. **An attribute is a data element.** Section 9.1 has one element where the product
   vision had two linked ones.
2. **The student fills in the CRUD matrix.** The tool checks it against the flows and
   does not fill it in (section 9.5).
3. **Normalization is not checked,** beyond reporting a many-to-many relationship
   (section 9.3). Section 14.4 adds one more check, for a repeating attribute, which the
   author has not yet confirmed.
4. **A physical model is a mode, not a copy** (section 11.1). A student cannot give the
   physical DFD a different set of processes from the logical one, apart from the
   system-related ones.
5. **Structure chart connectors are left out** (section 11.3).
6. **The limit of seven modules** is not applied to a module whose calls are all
   conditional (section 11.3).
7. **The tool calculates the storage size estimate** (section 11.6).
8. **Indexes and clustering are not modeled.** They are a table in the binder
   (section 10.7).

### 14.3 Still open

1. **Who hosts for other institutions.** The project's author hosts the first
   deployment.
2. **Recorded dependencies for normalization.** A student could record which attributes
   each attribute depends on. The tool could then check the second and third normal
   forms, where it now checks only the first (section 9.3). It would make five of the
   textbook's exercises checkable, and it adds a field that most models never fill in.
3. **The additions of section 14.4.** The author asked for the documents to be made more
   complete. The individual calls in section 14.4 are the specification's, and the
   author has not confirmed them one by one.
4. **A desktop app.** An Electron app may come later. It could run the same server and
   project store in-process with SQLite in place of PostgreSQL. The Canvas launch and
   the institution's AI gateway would stay server-only. Nothing is built for it now.
5. **More ways to sign in.** Besides the Canvas launch, the author wants these later:
   OpenID Connect (OIDC), LDAP directories, and email "magic links" that are limited
   to an allow list of addresses or to allowed domains. None is scheduled yet.
6. **How PDFs are made.** Rendering pages in a headless browser gives the most faithful
   documents but adds a few hundred megabytes to the Docker image. A PDF library keeps
   the image small but lays out every document a second time. This must be settled
   before the export of section 10.8 is built.

7. **Which Canvas the trial uses.** The institution's Canvas test instance needs an LTI
   1.3 developer key from its administrator. Diagramble sends no score, so the key needs
   only the launch. The planning note is `docs/EPICS.md` section 6.
8. **The numbers of the retention policy.** Retention, course archiving and account
   deletion are required before Release 1's live course (section 1, "Data retention").
   Still open: how long command logs, the dashboard's analytics, AI usage records and
   their prompt text, and archived courses are kept, and who sets those periods. The
   deployment's administrator is the likely answer. Who may see what also needs writing
   down.
9. **Other symbol styles.** Candidates, for the user to choose among: DeMarco and Yourdon
   for data flow diagrams, which is display only; and Chen notation and the Unified
   Modeling Language (UML) class-diagram notation for entity relationship diagrams. Chen
   needs model changes, because it draws attributes as separate shapes and lets
   relationships carry attributes. A chosen style would be set per Canvas course.
10. **An instructor's agent editing an open project.** An instructor's MCP agent (section
    7.1) is a second writer. What happens when it edits a project that is open for
    editing in a tab is not decided.
11. **The roster service for the dashboard.** The course dashboard could read the class
    list from Canvas's roster service (LTI Names and Role Provisioning Services). It would
    then show students who have never launched, but the administrator must allow that
    Canvas service and Diagramble would hold more student data. Otherwise it keeps
    listing only the people who have launched.
12. **Binder attachments: storage, display and export.** Release 2. Notes so far:
    attachments can be shown safely if they are served from a separate origin (a domain
    other than the app's, as many sites do for user content) with a sandboxing content
    security policy and `nosniff`. Images can be decoded and encoded again on the server;
    SVG is either refused or turned into a bitmap. PDFs are shown in a sandboxed frame or
    drawn with a library. A zipped web page is served only from the separate origin.
    Files are stored outside the project document and referenced by content hash. An
    export file that holds attachments can no longer be plain JSON; it is probably a zip
    with the JSON inside. That adds zip limits to "Import fails safe" (section 3.9):
    entry counts, sizes, compression ratio and paths.

### 14.4 Taken from Visible Analyst, and left out

This follows the reading of the two tutorials (section 13). The test for each point was
whether the textbook or one of its exercises needs it.

Taken into this specification:

| Point | Where | Why |
| --- | --- | --- |
| Aliases and notes on every element | Section 3.2 | The textbook lists both among the fields of an entry (Figures 4-13, 5-6 to 5-9). The product vision said to keep them, and this document had left them out |
| A meaning beside each allowed value | Section 3.3 | The textbook's data element entry is headed "Values and Meanings" (Figure 5-7) |
| A longer description of a process | Section 3.3 | The textbook's process entry has one (Figure 4-16), and its stopping rule for decomposition is the length of that text |
| A limit on a repeated part | Section 3.3 | Small, and a normal thing to say about data. Visible Analyst has it on every component |
| Relationship ends that are not decided yet | Section 9.1, ERD-10 | A line drawn between two entities should not decide cardinality for the student |
| Bringing later parent flows down to an existing child diagram | `carryDown`, section 4.1 | It is the direct fix for the most common balancing error |
| Search across the whole model | `search`, section 4.2 | "Everything with no description" and "everything used nowhere" are the questions a student asks before handing a project in |
| A top diagram below the context diagram, and findings on request | Section 3.7 | Nine exercises of Chapter 4 ask for a level 0 diagram alone, and one asks the student to find the errors |
| Steps inside an exception | Section 8.1 | The textbook's full form has them (Figure 4-11) |
| The event-response list and the DFD fragment as worked-out views | Section 8.4 | Both are steps of the textbook's method, and minicase 4 of Chapter 4 asks for fragments |
| A repeating attribute, with a rule | Section 9.1, ERD-11 | The normalization exercises start from a file that has them |
| Length and "null" in an entity's dictionary entry | Section 9.2 | Figure 5-6 shows them, and exercise G of Chapter 5 asks for the entries |

Left out, with the reason:

| Visible Analyst has | Reason |
| --- | --- |
| An exact number on a relationship end, such as "3" or "5+" | The textbook teaches zero, one and many only. The description can say it |
| Views of the data model built by the tool: a global view, a view for one process, entity clusters | A project may already have several entity relationship diagrams (section 9.2), and the CRUD matrix shows which entities a process uses |
| A functional decomposition diagram from which data flow diagrams are spawned | The textbook builds its diagrams from use cases, not from a function tree. The process tree is shown as a view of the data flow diagrams |
| Free diagrams that no rule checks | The binder holds work made elsewhere (section 10.7). A whiteboard is what free tools already do well |
| Links from any text field to outside documents | A web address can be typed into the notes. The binder holds attachments |
| Structure chart symbols beyond the textbook's: macro, data-only module, information cluster, generic couple, interface table row, and separate control and data connection lines | The textbook's own set (Figure 9-7) is enough for its exercises |
| Triggers, check constraints, stored procedures, tablespaces and SQL views in the physical model | Chapter 10 teaches none of them |
| Planning statements, and the Zachman Framework screen that files diagrams under 30 cells | Neither does modeling work of its own. Requirements with trace links (section 10.3) cover the part a course uses |
| Yourdon, SSADM and Métrica rule sets, and the IDEF1X, Bachman and arrow notations | The textbook uses Gane and Sarson symbols and crow's foot notation |
| Key synchronization that adds foreign keys by itself | The student places each foreign key, because that is the lesson (section 11.5) |
| Class, state, activity, use case, sequence, collaboration and component diagrams, and business process diagrams | The textbook uses none of them. The tutorials show almost no checks on them |

### 14.5 Settled after the exercises of every chapter were read

Every exercise, minicase and "Your Turn" box of chapters 1 to 3 and 6 to 12 was read on
17 November 2026, 179 items in all. The notes are in
`sources/notes/textbook-exercises-report.md`, outside the repository. None was out of the tool's reach. The
project's author chose what to change.

| Point | Settled as | Where |
| --- | --- | --- |
| What a project is | One scenario. A student opens a new project for each exercise that has its own | Section 3.8 |
| Starting from given material | A starter case can hold content of every kind, and any project can be saved as one | Section 3.8 |
| Interface prototypes | An attachment may be a file of any type | Section 10.7 |
| An interface diagram with no data flow diagram | ISD-03 and ISD-04 are silent | Section 10.6 |
| A test plan with nothing to point at | The requirement and the interface may be text | Section 10.5 |
| A cost-benefit analysis alone | The cash flow table stands alone, and a line can be a quantity, a unit amount and a growth rate | Section 10.2 |
| Choosing a conversion strategy | A small form in the migration plan | Section 10.7 |
| Levels of requirement | User requirements, and two types of functional requirement | Section 10.3 |
| A storage estimate from given record sizes | A typed record size, and growth as a yearly percentage | Section 11.6 |
| A matrix by entity alone | An entity with no attributes has cells of its own | Section 9.5 |

Left for now, by the author's choice:

| Point | What it would take |
| --- | --- |
| An architecture or network diagram (Chapter 7) | A new diagram kind for places, servers and links. Until then it is an attachment |
| Second and third normal form (chapters 5 and 10) | Recorded dependencies. See section 14.3 |
| Screens and storyboards drawn in the tool (Chapter 8) | A screen record tied to the dictionary, or a drawing editor. Until then they are attachments |
| Structure chart connectors (Chapter 9, exercise D) | Two more symbols. The student writes them in words. See section 14.2, point 5 |

Three exercises cannot be done as printed, because of errors in the textbook: exercises
K and L of Chapter 9 and exercise J of Chapter 10.

### 14.6 Settled on 18 November 2026

The user settled these while the epics were planned (`docs/EPICS.md`).

| Point | Settled as | Where |
| --- | --- | --- |
| A database in Release 0 | Yes. It holds accounts, sign-in methods, sessions, launch nonces and saved projects | Sections 2 and 3.9 |
| Element identifiers | Made by the creator and carried in the creating command: 10 random lowercase letters and digits, unique within a project only | Sections 3.2 and 4.1 |
| Grading | None. No score is sent to Canvas, and there are no rubrics or submission comments. A course dashboard of behavior, without grades, may come in Release 2. Whether it reads the roster service is open | Sections 1 and 14.3 |
| The AI assistance level | Set per Canvas course, with the rule profile | Section 1 and section 7 item 4 |
| When AI comes | The instructors' MCP server in Release 1; student-facing AI in Release 2 | Sections 1 and 7 |
| Data retention | Required before Release 1's live course: course archiving, a retention policy and account deletion. The periods are open | Sections 1 and 14.3 |
| Accessibility | Essential. The target is WCAG 2.2 Level AA | Section 1 |
| Instructors and AI prompts | Instructors never see students' prompts or responses. AI use is counted in requests and tokens, per student and per course, and the dashboard may show the counts | Section 7 item 7 |
| AI keys and providers | The institution supplies and protects the key and chooses the provider. Diagramble does not vet providers | Sections 1 and 7 item 7 |
| Symbol styles | Release 1 draws only the textbook's styles. Others may come later, per Canvas course | Sections 1 and 14.3 |
| Group work | Deferred, with no release | VISION.md section 10 |
| Several tabs on one project | One tab edits and the others are read-only, with a way to take over. Undo reaches only the current editing session | Sections 3.9 and 4.1 |
| Release 2's measure of teaching value | The instructor's feedback as the tool is used | VISION.md section 11 |

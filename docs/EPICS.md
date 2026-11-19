# Epic plan

This file plans the epics that build Diagramble, release by release: what each delivers,
the sections of `docs/SPEC.md` and `docs/VISION.md` it serves, the directories it owns,
what it waits for, and which epics can run beside it. Its purpose is to let several
epics run at once without two of them editing the same files. It is the map, and it
changes only when the plan changes, in a pull request of its own. A running epic's
detailed plan is `docs/EPIC-<n>.md` on that epic's branch, deleted when the epic folds
(`docs/WORKFLOW.md`, "Epic plans"). `docs/STATUS.md` says what each merged epic
delivered. Fold tasks edit STATUS.md, never this file.

Each numbered epic becomes a GitHub milestone named `Epic <n>: <name>` and a branch
`epic/<n>-<slug>`. Release 0 is planned in detail. Releases 1 and 2 are candidate epics
with codes such as R1-a, numbered when they are planned. Sizes use the scale of VISION.md
section 10: S is days to two weeks, M two to six weeks, L one to three months. No dates
are given.

## 1. How parallel epics stay out of each other's way

An epic branch is cut from `main`, so an epic can use only what is already on `main`. Two
epics can run at once only when neither needs the other's unmerged code and they edit no
file in common. These rules make that hold.

1. **One owner per directory.** Each epic owns the directories in its entry below. No
   other epic edits them while it runs.
2. **Shared files are laid once.** Epic 1 creates the workspace root, the shared
   TypeScript settings and the continuous integration (CI) workflow, so that adding a
   package, a test or a browser test needs no edit to any of them.
3. **Dependencies come early.** Epic 1 installs every library that SPEC.md section 12
   names for Release 0, in the workspace that uses it, at exact versions. An epic that
   needs another adds it in one task that lands first. When two epics' lockfiles
   conflict, the one merging later takes `main`'s `package-lock.json` and runs
   `npm install` again. Nobody merges a lockfile by hand.
4. **Shared lists take one-line additions.** The element kinds and the command and query
   registry in `packages/model`, the rule list in `packages/rules`, and the routes in
   `apps/web` and `apps/server` list things across features. The epic that creates such
   a file owns it; a later epic may add its own lines and nothing more. A feature's code
   goes in a file or folder of its own: one per family of element kinds, one per family
   of rules, one per screen, as the prototype's screens were split
   (`prototype/README.md`, "Rules for a screen agent").
5. **Database migrations are added, never edited.** Before its epic pull request, an epic
   renames any migration not yet on `main` so that it sorts after the newest one there.
6. **Documents change at the fold, by adding.** `docs/STATUS.md` and `docs/SPEC.md`
   change only in fold tasks. When two epics add to the same section, the one merging
   second keeps both when it merges `main` in, which it must do before its epic pull
   request anyway (WORKFLOW.md, "Pull requests").
7. **The prototype is frozen.** No epic edits `prototype/`.

| Shared file | Owner | Who else may edit it |
| --- | --- | --- |
| Root `package.json`, `tsconfig.base.json` | Epic 1 | A fold task, for a new root script |
| `package-lock.json` | Epic 1 | An epic's dependency task, under rule 3 |
| `.github/workflows/ci.yml`, `.github/dependabot.yml` | Epic 1 | No Release 0 epic |
| A workspace's `package.json` and `tsconfig.json` | The epic that owns the workspace | Dependency tasks |
| `Dockerfile`, `compose.yaml`, `.dockerignore` | Epic 3 | Epic 6, to serve the web app's build |
| CLAUDE.md's commands table, WORKFLOW.md's "Local development" and "CI", the `epic-run` skill | Epic 1 | Fold tasks |
| `docs/STATUS.md`, `docs/SPEC.md` | Fold tasks, by adding | Nobody else |

Two other ways were weighed. Letting each epic add its own dependencies and CI steps saves
the foundation epic, but the first two parallel epics then conflict on the lockfile and
`ci.yml` at once. Writing the model's types in the foundation epic would start the rules
and the web app sooner, but those types are the hardest thing to undo, belong with
`apply` and its invariant tests, and give the other epics little to build on alone.

## 2. Release 0

Release 0 proves the risky parts (VISION.md section 11, "Release 0"; SPEC.md section 2).

| Exit criterion (VISION.md section 11) | SPEC.md section 2 item | Met by |
| --- | --- | --- |
| Balancing through the dictionary is right on three cases, one with a flow split into parts | 2, 3 | Epic 4 |
| One element on two diagrams is renamed once, and both update | 1, 4 | Epic 2 in the model, Epic 5 on screen |
| A launch from a Canvas test course opens a project and returns a score | 6 | Epic 3, then Epic 6 |
| A keyboard-only user builds a context diagram in the outline view | 5 | Epic 5 |

### Epic 1: Foundation

Serves SPEC.md section 12 and WORKFLOW.md "CI". Owns the root files above and an empty
skeleton of the five workspaces of section 12. Depends on nothing and runs alone, so it
stays small. Size S.

- An npm workspaces root over `packages/*` and `apps/*`, with `packages/model`,
  `packages/rules`, `packages/cases`, `apps/web` and `apps/server`, each holding a
  `package.json`, a `tsconfig.json` and one placeholder test.
- Root scripts `typecheck`, `lint`, `test`, `build` and `test:browser` that run in every
  workspace with `--workspaces --if-present`. `lint` stays the comment check; no other
  linter is added.
- `packages/model` and `packages/rules` compile with no browser library and no Node
  types, so importing React, the browser or the server fails the typecheck. This
  enforces SPEC.md section 12's boundary instead of only stating it.
- Internal packages export their TypeScript source, and the server runs it with the
  `.nvmrc` Node's type stripping, so no package has a build step.
- A CI job named "App": `npm ci` at the root, the four checks, a PostgreSQL service for
  the server's tests, Playwright's browser when `apps/web` has a Playwright
  configuration, and a Docker build when a `Dockerfile` exists. The "Prototype" job
  stays. The user adds "App" to both rulesets' required checks.
- The section 12 libraries for Release 0, plus four the server needs: `pg` (Kysely's
  PostgreSQL driver), `@fastify/formbody` (an LTI launch arrives as a form post),
  `@fastify/cookie` (the session cookie) and `@fastify/static` (serving the web build),
  all MIT.
- Dependabot for the root's npm packages, and the root commands in WORKFLOW.md, the
  `epic-run` skill and CLAUDE.md.

Exit: a pull request that adds a file to any workspace runs every check with no CI edit,
and `main` is green.

### Epic 2: Model

Serves SPEC.md sections 3.1 to 3.6, section 4 for Release 0, and section 7 items 1, 2, 5
and 6. Owns `packages/model`. Depends on Epic 1. Runs beside Epic 3. Size L.

- The element kinds of section 3.3 and their Zod schemas, the views of section 3.5, and
  the storage form of section 3.6 with `schemaVersion` 1 and a published JSON Schema.
- `apply(model, command)` returning a new model and a change record in JSON Patch form,
  or a refusal in a plain sentence; the invariants of section 3.4; undo and redo as
  logged commands.
- The Release 0 commands of section 4.1 (all but `carryDown`, `setTopDiagram` and
  `setShowFindings`) and the queries `getModel`, `getOutline`, `getElement`, `whereUsed`
  and `expandData`, each with a name, a schema and a sentence, in one registry.
  `getFindings` and `preview` need the rules, so Epic 4 builds them.
- One file per family of kinds, so that Release 1's use case and ERD epics add files.

Exit: a test for every invariant, a test that a data store on two diagrams renamed once
shows the new name on both, and a test that replaying the log rebuilds the model.
Element identity, the log entry and the storage form are hard to undo, so the epic's
architect run brings them to the user (Q2) and its fold records them in SPEC.md
section 3.6.

### Epic 3: Server and Canvas launch

Serves SPEC.md section 1 (the rows "Server framework" to "Sign-in") and section 12, and
VISION.md section 5, "Canvas through LTI 1.3". Owns `apps/server` and the Docker files.
Depends on Epic 1. Runs beside Epics 2, 4 and 5. Size M.

- A Fastify server with Zod-checked settings and requests.
- The Learning Tools Interoperability (LTI) 1.3 login and launch on `jose`: state, nonce,
  signature, issuer, audience and deployment checks, and the tool's public key set. One
  platform registration, read from settings.
- Score return through Assignment and Grade Services (AGS), with a signed client
  assertion for the access token.
- An account kept apart from its sign-in methods (SPEC.md section 1, "Sign-in"); an LTI
  sign-in method keyed by the token's issuer and subject; a session cookie that points to
  a stored record (Q1 says where).
- The Docker image, and the Compose file that adds PostgreSQL.
- Tests against a fake platform whose good and tampered tokens are signed in the test.

Exit: a launch from the Canvas test course (Q4) reaches the deployed server, signs the
user in, and posts a fixed score that shows in the gradebook. What SpeedGrader shows is
written down for Epic 6. The security reviewer has run.

### Epic 4: Rules and test cases

Serves SPEC.md sections 5 and 6. Owns `packages/rules` and `packages/cases`. Depends on
Epic 2. Runs beside Epics 3 and 5. Size L.

- The rule shape and finding of section 5.1, and the one built-in profile.
- One task per rule family, each owning its file and codes: element and connection
  (DFD-01 to 09, DFD-13 to 15), structure (DFD-10 to 12), dictionary (DD-01 to 03) and
  balancing (BAL-01 to 04).
- The queries `getFindings` and `preview` (section 4.2).
- Cases A, B1 to B5 and C1 to C17 as command lists with their exact expected findings.

Exit: all three cases pass as automated tests, which meets the first exit criterion.

### Epic 5: Canvas and outline view

Serves SPEC.md section 2 items 4 and 5 and section 3.5, VISION.md section 5
("Accessibility and keyboard modeling"), and `docs/mockups/STYLES.md`. Owns `apps/web`.
Depends on Epic 2. Runs beside Epics 3 and 4. Size M.

- A Vite, React and React Router app with one store over the model's `apply`, held in
  memory. A first task builds it; the canvas and the outline are then separate folders
  built in parallel.
- A React Flow canvas that draws Gane and Sarson symbols on the context diagram and its
  child diagrams, moves between levels, and expands a process.
- An outline view in which every element and flow can be created, named and connected
  from the keyboard. The epic decides whether elkjs or a simple rule places what the
  outline creates.

Exit: Playwright tests that build a context diagram with the keyboard alone (the fourth
exit criterion) and rename an element shown on two diagrams. The accessibility reviewer
has run over the outline.

### Epic 6: Trial launch

Serves SPEC.md section 2 item 6 and the third exit criterion. Owns the path from launch
to app: the score route and the serving of the web build in `apps/server`, and the
launch entry in `apps/web`. Depends on Epics 3, 4 and 5. Size S.

- The launch opens the web app on a project, and the app lists its findings (Q3).
- The browser sends the project in its storage form; the server checks it against the
  model's schema, runs the rules, and posts a score and a comment (Q3) in the form that
  Epic 3 found SpeedGrader shows best.
- The trial in the Canvas test course, then the release gate's whole-system review by the
  architect (WORKFLOW.md, "Epic plans"), its findings filed as issues.

Exit: all four Release 0 exit criteria shown on the deployed server.

### What Release 0 leaves thin on purpose

Everything on SPEC.md section 2's out-of-scope list. No project is saved, so work is lost
when the page closes. Accounts exist only as far as the launch needs them (Q1). The score
trusts the project the browser sends; Release 1 scores the server's saved copy. There is
one Canvas platform registration. The Release 1 commands and queries of SPEC.md section
4 are left out. Only Gane and Sarson symbols are drawn, and findings are a plain list.

### What may be taken from the prototype

The prototype is throwaway (`prototype/README.md`). Builders may read, and check against
SPEC.md, the shape of `src/model/types.ts`, the logic of `src/model/apply.ts`,
`src/model/queries.ts`, `src/rules/engine.ts` and `src/rules/catalogue.ts`, the rules'
message, reason and fix text, and the theme's CSS variables as an example of
`docs/mockups/STYLES.md`.

These must not be copied, because they differ from SPEC.md (`prototype/README.md`, "Where
the prototype differs from the specification"): undo by whole copies of the model with no
command log; undo and redo as store functions; saving to `localStorage` and the hash
router; `addFlow` reusing a definition with the same name; readable identifiers such as
`dg-context`, and the `nextId` and `project` parts that section 3.6 lacks, until Q2 is
settled; every kind and field of Releases 1 and 2; and the tests, which are written anew
from SPEC.md sections 3.4 and 6.

## 3. Release 1 candidates

Release 1 is the course-ready first release (VISION.md section 11, "Release 1", and
section 10, Level 1). SPEC.md sections 8 and 9 fix its new parts.

| Code | Epic | What it does | Depends on |
| --- | --- | --- | --- |
| R1-a | Saving and the project list | SPEC.md section 3.9: each accepted command saved before the next, the project-store interface of section 12, the queue kept while offline, and the project list. Its database schema and save request are hard to undo, so its architect run brings both to the user | Release 0 |
| R1-b | Project files and starter cases | Export and import with version upgrades and plain refusals (section 3.9), saving a project as a starter case (section 3.8), two shipped starter cases and symbol help (VISION.md section 10, item 17) | R1-a |
| R1-c | Data flow diagrams and dictionary, complete | The Release 1 commands and queries of section 4, the settings of section 3.7, the full editor, the dictionary screen, the problems panel, where-used, safe rename and delete, and the DeMarco and Yourdon display (VISION.md section 10, items 3 to 5, 11, 12) | Release 0 |
| R1-d | Use case forms | SPEC.md section 8: kinds, rules, worked-out views and the form screen | Release 0 |
| R1-e | Entity relationship diagram and CRUD matrix | SPEC.md section 9, including the checks against the process model | Release 0 |
| R1-f | Canvas launch for live sections | Several platform registrations and key rotation; the launch opens the student's own saved project for that Canvas link and scores the saved copy (VISION.md section 10, item 16) | R1-a |
| R1-g | Project document as PDF | The Release 1 exit criterion on a PDF. Needs SPEC.md section 14.3 item 6 settled, and SPEC.md to say which part of section 10.8 comes in Release 1 | R1-c, R1-d, R1-e |
| R1-h | Keyboard and screen reader | The outline as a full keyboard editor for every Release 1 kind, and a screen-reader pass (VISION.md section 10, item 13) | R1-c, R1-d, R1-e |
| R1-i | Instructor MCP server | SPEC.md section 7.1: personal API keys kept as hashes, revocable and logged, and Model Context Protocol (MCP) tools made from the command and query registry. Here only if Q5 says so | R1-a, R1-b |
| R1-j | Checked against the book | The exit criteria on chapters 4 and 5, on Visible Analyst's checks, and on a student finishing the starter case alone. It needs `sources/`, so it runs from the main checkout | All of the above |

## 4. Release 2 candidates

Release 2 is the complete educational environment (VISION.md section 11, "Release 2", and
section 10, Level 2). SPEC.md sections 7, 10 and 11 fix most of it.

| Code | Epic | What it does | Depends on |
| --- | --- | --- | --- |
| R2-a | AI gateway and assistance levels 1 and 2 | SPEC.md section 7 and section 1, "AI models and agents": the server builds each request's tools from the level, an AI SDK tool-loop agent uses only read-only queries, every step is logged and student identity removed. Meets the criterion that levels 0 to 2 are enforced and logged | R1-a, and a source for the level (Q6) |
| R2-b | Canvas settings per link, and certification | Deep Linking 2.0, the assistance level and rule profile set per Canvas link, and LTI Advantage certification. Scope depends on Q6 | R1-f |
| R2-c | Planning forms | System request, feasibility analysis and alternative matrix (SPEC.md sections 10.1, 10.2, 10.4) | Release 1 |
| R2-d | Requirements and test plan | SPEC.md sections 10.3 and 10.5, with their trace links | Release 1 |
| R2-e | Interface structure diagram | SPEC.md section 10.6 | Release 1 |
| R2-f | Binder and attachments | SPEC.md section 10.7. Where attachment files are kept, and how the project file carries them, is hard to undo | R1-a, R1-b |
| R2-g | Compiled PDFs | SPEC.md section 10.8 | R1-g, R2-c to R2-f |
| R2-h | Logical and physical mode | SPEC.md section 11.1, which the three design epics need | Release 1 |
| R2-i | Physical data flow diagram | SPEC.md section 11.2 | R2-h |
| R2-j | Structure chart and program specification | SPEC.md sections 11.3 and 11.4 | R2-h |
| R2-k | Physical data model and storage estimate | SPEC.md sections 11.5 and 11.6 | R2-h |
| R2-l | Accessibility audit | An independent audit and a published conformance report | The screens of R2-c to R2-k |

The experimental track follows R2-a: assistance levels 3 and 4, where an agent critiques
a draft or proposes commands through `preview` for the student to accept (SPEC.md section
7 items 4 and 5; VISION.md section 10, Level 4). Each ships alone, behind its own exit
criteria. Group projects, Chen notation, SQL schema export and guided workflows have no
SPEC.md section yet, so they cannot be planned.

## 5. Lanes

```
Epic 1 Foundation
 ├─ Epic 2 Model ─┬─ Epic 4 Rules and test cases ─┐
 │                └─ Epic 5 Canvas and outline ───┤
 └─ Epic 3 Server and Canvas launch ──────────────┴─ Epic 6 Trial launch
```

| Stage | Epics that can run at once |
| --- | --- |
| Release 0 | Epic 1 alone; then Epics 2 and 3; then Epics 4 and 5, with Epic 3 if it is still running; then Epic 6 |
| Release 1 | R1-a, R1-c, R1-d and R1-e; then R1-b, R1-f and R1-i; then R1-g and R1-h; then R1-j |
| Release 2 | R2-a, R2-c, R2-d, R2-e and R2-h; then R2-b, R2-f, R2-i, R2-j and R2-k; then R2-g and R2-l |

## 6. Questions to settle before an epic starts

**Q1. Does Release 0 have a database? Before Epic 3.** (a) Yes: PostgreSQL through
Kysely holds accounts, sign-in methods, sessions and launch nonces, but no projects.
(b) No: the launch keeps its state in memory and signed cookies, which saves a few days,
but R1-a then redesigns accounts and the launch is rewritten around them. Recommended:
(a). SPEC.md section 1 already makes a session a stored record, and the split between an
account and its sign-in methods is hard to undo. It takes accounts off SPEC.md section
2's out-of-scope list.

**Q2. How are element identifiers made? Before Epic 2.** (a) A counter kept in the
project, a sixth part of the storage form of SPEC.md section 3.6, as in the prototype.
Identifiers stay short in `getOutline`, and replaying commands gives the same ones, but a
save must name the version it builds on, because two writers would collide. (b) The
caller puts each new identifier in the command, from a random source outside the core.
Replay is exact under any interleaving and real-time editing needs no change, but every
creating command grows a field. Either way an identifier is an opaque string, never
parsed, so a later switch changes no saved file. Recommended: (a), because real-time
editing waits behind Release 3's entry gate.

**Q3. What does the trial launch open, and what score does it send? Before Epic 6.** (a) A
blank project held in the browser, scored 1 with no errors and 0 otherwise, with a
comment counting errors and warnings. (b) A fixed score, which proves only the plumbing.
Recommended: (a), because it also proves that the rules run on the server, the point of
one shared package (SPEC.md section 1, "Stack").

**Q4. Which Canvas does the trial use? Start now; Epic 3 needs it.** (a) The
institution's Canvas test or beta instance, with an LTI 1.3 developer key from its
administrator. (b) Canvas's open-source code run locally: no approval needed, but heavy,
and SpeedGrader may differ. Recommended: (a). The key needs the trial server's public
HTTPS address, so hosting must be ready by the end of Epic 3.

**Q5. When do student AI and the instructor MCP server come? Before Release 1 is
planned.** (a) Assistance levels 1 and 2 in Release 2 as VISION.md has them (R2-a), and
the MCP server, which no release names yet, late in Release 1 (R1-i). (b) Both in Release
1, as two more lanes after R1-a, with the level set per Canvas link. (c) Both in Release
2. Recommended: (a). The MCP server touches no student's work and helps the first live
section's instructor build scenarios. Student AI needs a source for its level (Q6) and
VISION.md's classroom comparison, and Release 1 already runs four lanes.

**Q6. Which of VISION.md's Release 2 teaching tools stay? Before Release 2 is planned.**
VISION.md section 10 lists assignment profiles, rubrics, comments on submissions, an
instructor dashboard and the roster service, and section 11 wants an instructor to grade
"without leaving Canvas". CLAUDE.md and `prototype/README.md` say the tool deals with no
assignments, grades or class lists unless the user asks. (a) Keep VISION.md as written.
(b) Keep only settings per Canvas link (assistance level, rule profile, starter case),
and leave grading and rosters to Canvas. (c) Drop them all. Recommended: (b). It gives
the AI levels and rule profiles a home without making the tool a learning management
system.

**Q7. When is the prototype retired?** (a) At the Release 1 gate, once `apps/web` covers
its first-release screens. (b) After Release 0. Recommended: (a). It stays the reference
for Release 1's screens, and its CI job costs little.

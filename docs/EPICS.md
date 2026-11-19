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
6. **Documents change at the fold, by adding.** Inside an epic, `docs/STATUS.md` and
   `docs/SPEC.md` change only in fold tasks. Outside any epic, `docs/SPEC.md` may also
   change in a documentation-only pull request into `main`, which is how an open point is
   settled before its epic starts. When two epics add to the same section, the one merging
   second keeps both when it merges `main` in, which it must do before its epic pull
   request anyway (WORKFLOW.md, "Pull requests").
7. **The prototype is frozen.** No epic edits `prototype/`. It is a reference for screen
   layout only. It and its CI job are deleted once `apps/web` has the Release 2 screens
   (section 2, "What may be taken from the prototype").

| Shared file | Owner | Who else may edit it |
| --- | --- | --- |
| Root `package.json`, `tsconfig.base.json` | Epic 1 | A fold task, for a new root script |
| `package-lock.json` | Epic 1 | An epic's dependency task, under rule 3 |
| `.github/workflows/ci.yml`, `.github/dependabot.yml` | Epic 1 | No Release 0 epic |
| A workspace's `package.json` and `tsconfig.json` | The epic that owns the workspace | Dependency tasks |
| `Dockerfile`, `compose.yaml`, `.dockerignore` | Epic 3 | Epic 8, to serve the web app's build in place of the prototype's |
| `packages/mock-lti` | Epic 4 | Epic 8, for the trial's people and courses |
| CLAUDE.md's commands table, WORKFLOW.md's "Local development" and "CI", the `epic-run` skill | Epic 1 | Fold tasks |
| `docs/STATUS.md`, `docs/SPEC.md` | Fold tasks, by adding | For `docs/SPEC.md`, a documentation-only pull request into `main` outside any epic (rule 6) |

The foundation epic owns the dependencies and CI steps because two parallel epics that
each add their own conflict on the lockfile and `ci.yml` at once. The model's types stay
out of the foundation epic because they are the hardest thing to undo, belong with
`apply` and its invariant tests, and give the other epics little to build on alone.

## 2. Release 0

Release 0 proves the risky parts (VISION.md section 11, "Release 0"; SPEC.md section 2).

| Exit criterion (VISION.md section 11) | SPEC.md section 2 item | Met by |
| --- | --- | --- |
| Balancing through the dictionary is right on three cases, one with a flow split into parts | 2, 3 | Epic 5 |
| One element on two diagrams is renamed once, and both update | 1, 4 | Epic 2 in the model, Epic 6 on screen |
| A launch from a mock LTI 1.3 platform, including one inside a frame, signs the user in and opens their saved project | 6, 7 | Epic 4, then Epic 7, then Epic 8 |
| A keyboard-only user builds a context diagram in the outline view | 5 | Epic 6 |

### Epic 1: Foundation

Serves SPEC.md section 12 and WORKFLOW.md "CI". Owns the root files above and an empty
skeleton of the five application workspaces of section 12. The sixth part,
`packages/mock-lti`, belongs to Epic 4. Depends on nothing and runs alone, so it
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
  all MIT. React Aria (Apache-2.0) is installed in `apps/web`.
- Dependabot for the root's npm packages, and the root commands in WORKFLOW.md, the
  `epic-run` skill and CLAUDE.md.

Exit: a pull request that adds a file to any workspace runs every check with no CI edit,
and `main` is green.

### Epic 2: Model

Serves SPEC.md sections 3.1 to 3.6, section 4 for Release 0, and section 7 items 1, 2
and 5. It serves item 6 only through the pure `apply`; Epic 5 builds `preview`. Owns `packages/model`. Depends on Epic 1. Runs beside Epics 3 and 4. Size L.

- The element kinds of section 3.3 and their Zod schemas, the views of section 3.5, and
  the storage form of section 3.6 with `schemaVersion` 1 and a published JSON Schema.
- `apply(model, command)` returning a new model and a change record in JSON Patch form,
  or a refusal in a plain sentence; the invariants of section 3.4; undo and redo as
  logged commands.
- The Release 0 commands of section 4.1 (all but `carryDown`, `setTopDiagram`,
  `setShowFindings` and `setCaseText`) and the queries `getModel`, `getOutline`, `getElement`, `whereUsed`
  and `expandData`, each with a name, a schema and a sentence, in one registry.
  `getFindings` and `preview` need the rules, so Epic 5 builds them.
- One file per family of kinds, so that Release 1's use case and ERD epics add files.

- Every creating command carries the new item's identifier, and `apply` refuses one whose
  identifier is already used in the project (SPEC.md sections 3.2 and 4.1). Tests use
  readable identifiers.

Exit: a test for every invariant, a test that a data store on two diagrams renamed once
shows the new name on both, and a test that replaying the log rebuilds the model. The log
entry and the storage form are hard to undo, so the epic's architect run brings them to
the user and its fold records them in SPEC.md section 3.6.

### Epic 3: Server and sign-in

Serves SPEC.md section 1 (the rows "Server framework", "Database access", "Deployment",
"Sign-in" and "Host names"), section 2 item 8 and section 12. Owns `apps/server` and the
Docker files; Epics 4 and 7 add their own folders to `apps/server` under section 1's
rule 4. Depends on Epic 1. Runs beside Epic 2. Size S.

The epic exists so that a deployed preview, behind a real sign-in, can collect feedback
from faculty while the rest of Release 0 is built.

- The epic's architect run starts by reading the `packages/auth` package of Portikus, the
  author's own project (MIT license, on the same Kysely stack), for its accounts, sign-in
  methods, sessions and password handling, and ports what fits, adapted to Fastify and to
  SPEC.md.
- A Fastify server with Zod-checked settings and requests, including the app's host
  name. It runs behind the deployment's own reverse proxy, which ends the TLS connection.
- PostgreSQL through Kysely, with the migration runner, for accounts, sign-in methods and
  sessions. The project tables are Epic 7's; the launch nonces are Epic 4's.
- An account kept apart from its sign-in methods (SPEC.md section 1, "Sign-in"), and a
  password sign-in method keyed by username. Passwords are stored as scrypt hashes from
  Node's own `crypto`, so no library is added. Repeated failed sign-ins for one username
  or from one address are slowed and then refused for a while.
- A command run on the server that makes a password account, sets its password, or
  disables it. Nobody can sign up from the web. A new account's login is its username
  (SPEC.md section 3.9).
- A sign-in page, a sign-out, and a host-only session cookie (no `Domain` attribute,
  `Secure`, `HttpOnly`) that points to a stored session.
- Every request signed in by the session cookie that changes anything is refused
  unless its `Origin` header matches the app host; `Origin: null` and a missing
  `Origin` are refused too (SPEC.md section 1, "Host names"). Tests cover each case.
- Every path except the sign-in page and a health check needs a session. Until Epic 8
  serves the web app's build, the server serves the prototype's build behind the
  sign-in. The Docker build runs the prototype's own `npm ci` and `npm run build`; no
  file in `prototype/` changes (section 1's rule 7).
- The Docker image, and the Compose file that adds PostgreSQL.

Exit: the Docker image deployed behind a reverse proxy, where a person with a password
account signs in and sees the prototype, and a person without one sees only the sign-in
page. The security reviewer has run.

### Epic 4: Canvas launch

Serves SPEC.md section 1 (the rows "Canvas launch" and "Sign-in"), section 2 item 6 and
VISION.md section 5, "Canvas through LTI 1.3". Owns the launch folder in `apps/server`,
its migrations and its routes, and `packages/mock-lti`. Depends on Epic 3. Runs beside
Epics 2, 5 and 6. Size M.

- The epic's architect run starts by reading the `packages/auth` and `packages/mock-lms`
  packages of Portikus, on the same `jose` stack. Portikus already has a tested LTI 1.3
  layer (login, token checks, state and nonce, roles, the tool's key, platform
  registrations, the roster service), a mock platform, and sign-in methods keyed by
  issuer and subject. The epic ports what fits, adapted to Fastify and to SPEC.md. Deep
  linking is not needed.
- The Learning Tools Interoperability (LTI) 1.3 login and launch on `jose`: state, nonce,
  signature, issuer, audience and deployment checks, and the tool's public key set. One
  platform registration, read from settings. Launch nonces are stored in PostgreSQL.
- An LTI sign-in method, keyed by the token's issuer and subject, on Epic 3's accounts.
  A launch signs the person in with Epic 3's session cookie.
- The launch requests the Canvas login ID as the custom variable `$Canvas.user.loginId`,
  and a new account stores it as its login (SPEC.md section 3.9).
- The LTI launch proves itself with the platform's signed token, so Epic 3's `Origin`
  check does not apply to it (SPEC.md section 1, "Host names"). Tests cover that a
  launch is accepted from the platform's site and that nothing else is let past the check.
- The launch's course and whether the person is an instructor are kept, because Epic 7
  finds the student's project by course: one project per student per course.
- The launch only signs a person in (SPEC.md section 1, "Grading"). The roster service
  comes with the course dashboard, R2-l.
- A mock LTI 1.3 platform in `packages/mock-lti` for development, CI and the Release 0
  trial (SPEC.md sections 2 item 6 and 12): people and courses to launch as, a launch
  that sends each person's login ID as the `$Canvas.user.loginId` custom variable, launching
  inside a frame, a roster service, and a signed-launch generator with deliberate
  defects for negative tests. It is never in the Docker image.
- Tests against the mock platform, with good launches and launches carrying each defect.

Exit: a launch from the mock platform, including one inside a frame, reaches the deployed
server and signs the user in. The security reviewer has run.

### Epic 5: Rules and test cases

Serves SPEC.md sections 5 and 6. Owns `packages/rules` and `packages/cases`. Depends on
Epic 2. Runs beside Epics 3, 4, 6 and 7. Size L.

- The rule shape and finding of section 5.1, and the one built-in profile.
- One task per rule family, each owning its file and codes: element and connection
  (DFD-01 to 09, DFD-13 to 15), structure (DFD-10 to 12), dictionary (DD-01 to 03) and
  balancing (BAL-01 to 04).
- The queries `getFindings` and `preview` (section 4.2).
- Cases A, B1 to B5 and C1 to C17 as command lists with their exact expected findings.

Exit: all three cases pass as automated tests, which meets the first exit criterion.

### Epic 6: Canvas and outline view

Serves SPEC.md section 2 items 4 and 5 and section 3.5, VISION.md section 5
("Accessibility and keyboard modeling"), and `docs/mockups/STYLES.md`. Owns `apps/web`,
except the save-queue folder that Epic 7 owns. Depends on Epic 2. Runs beside Epics 3, 4,
5 and 7. Size M.

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

### Epic 7: Saving

Serves SPEC.md section 2 item 7 and section 3.9's "Work is saved as the student goes".
Owns the project store in `apps/server` (one folder, its migrations and its routes) and
the save queue in `apps/web` (one folder), under section 1's rules 4 and 5. Depends on
Epics 2 and 4. Runs beside Epics 5 and 6. Size M.

- The project-store interface of SPEC.md section 12 (load, save, append to the log) on
  Kysely: each project one JSON document in a projects table, and every accepted
  command a row of a command-log table keyed by project, in order (SPEC.md section 3.6).
  Loading and saving a project is one read and one write. Every few hundred commands
  the server also stores a snapshot of the document, so any earlier state is rebuilt by
  replaying from the nearest snapshot (SPEC.md section 3.6).
- A save request that takes one command, checks it with the model's schema, applies it to
  the saved project, and stores it before the next. A creating command whose identifier
  is already used is refused (SPEC.md section 3.2).
- The browser's save queue: commands sent in order, kept while offline, a new identifier
  made and the command sent again after that refusal, and a warning before the page
  closes with changes waiting. It knows nothing of the web store; Epic 8 connects it.
- One project per student per Canvas course, made empty on first open.
- One editing tab per project (SPEC.md section 3.9): every other tab showing it is
  read-only and says so, and offers a takeover that makes the editing tab read-only. Undo
  and redo reach only the current editing session.

Exit: tests that a command is saved before the next is applied, that a queue held offline
arrives in order, that a reused identifier is refused and sent again, and that a second tab is read-only
until it takes over, after which the first tab is read-only. The save request
and the database schema are hard to undo, so the epic's architect run brings them to the
user. The security reviewer has run.

### Epic 8: Trial launch

Serves SPEC.md section 2 item 6 and the third exit criterion. Owns the path from launch
to app: the serving of the web build in `apps/server`, and the launch entry in `apps/web`.
Depends on Epics 5, 6 and 7. Size S.

- The launch opens the web app on the student's saved project for that course, and the
  app lists its findings. A read-only tab shows Epic 7's read-only notice and takeover.
- The web store sends each accepted command through Epic 7's save queue, and the top bar
  says when the project was last saved.
- The trial from the mock platform, then the release gate's whole-system review by the
  architect (WORKFLOW.md, "Epic plans"), its findings filed as issues.

Exit: all four Release 0 exit criteria shown on the deployed server, including a second
launch that opens the work saved by the first.

### What Release 0 leaves thin on purpose

Everything on SPEC.md section 2's out-of-scope list. A student has one project per Canvas
course and no project list. Nothing is sent to Canvas. There is one Canvas platform
registration. The Release 1 commands and queries of SPEC.md section 4 are left out. Only
Gane and Sarson symbols are drawn, and findings are a plain list.

### What may be taken from the prototype

The prototype is throwaway (`prototype/README.md`). Builders may read, and check against
SPEC.md, the shape of `src/model/types.ts`, the logic of `src/model/apply.ts`,
`src/model/queries.ts`, `src/rules/engine.ts` and `src/rules/catalogue.ts`, the rules'
message, reason and fix text, and the theme's CSS variables as an example of
`docs/mockups/STYLES.md`.

These must not be copied, because they differ from SPEC.md:

- undo by whole copies of the model, and undo and redo as store functions, where SPEC.md
  sections 3.6 and 4.1 make them logged commands;
- saving to `localStorage` and the hash router, where section 3.9 saves to the server;
- `addFlow` reusing a definition with the same name, where section 4.1 carries an
  existing definition or makes a new one;
- the identifier counter `nextId`, where section 3.2 has whoever creates an item supply
  its identifier;
- the `project` part, where section 3.6 has `settings` (section 3.7);
- every kind and field of Releases 1 and 2;
- and the tests, which are written anew from SPEC.md sections 3.4 and 6.

The prototype stays, frozen, as a reference for screen layout only, because its model and
rules differ from SPEC.md. It and its CI job are deleted once `apps/web` has the Release 2
screens.

## 3. Release 1 candidates

Release 1 is the course-ready first release (VISION.md section 11, "Release 1", and
section 10, Level 1). SPEC.md sections 8 and 9 fix its new parts.

| Code | Epic | What it does | Depends on |
| --- | --- | --- | --- |
| R1-a | Project list and checkpoints | SPEC.md section 3.9: the project list, starting a new project, copying, renaming and deleting one, named checkpoints that a student saves at any time and opens later as a new copy of the project, and opening a project as of a past date and time, also as a new copy, by the checkpoint path, over Release 0's saving | Release 0 |
| R1-b | Project files and starter cases | Export and import with version upgrades and plain refusals (section 3.9); the file holds the project and never the command log, and import starts a fresh log; saving a project as a starter case (section 3.8), two shipped starter cases and symbol help (VISION.md section 10, item 17), and the case text shown beside the canvas (section 3.7, `caseText`). Starter cases and version upgrades cover every Release 1 kind. Import is a security boundary: the security reviewer runs, and the exit includes tests built from section 3.9's "Import fails safe" list, with fuzzed and hand-crafted hostile files | R1-a, R1-c, R1-d, R1-e |
| R1-c | Data flow diagrams and dictionary, complete | The Release 1 commands and queries of section 4, the settings of section 3.7, the full editor, the dictionary screen, the problems panel, where-used, and safe rename and delete (VISION.md section 10, items 3, 5, 11, 12). Only Gane and Sarson symbols are drawn; other styles come later (SPEC.md section 14.1 item 5) | Release 0 |
| R1-d | Use case forms | SPEC.md section 8: kinds, rules, worked-out views and the form screen | Release 0 |
| R1-e | Entity relationship diagram and CRUD matrix | SPEC.md section 9, including the checks against the process model | Release 0 |
| R1-f | Canvas launch for live sections | Several platform registrations and key rotation (VISION.md section 10, item 16). The launch is checked against a real Canvas before the live course, with an LTI 1.3 developer key requested from a Canvas administrator for the launch and the roster service (SPEC.md section 14.1 item 4). Platform registrations are managed in R1-l's administrator interface, so this epic waits for it. The launch only signs a person in | R1-l |
| R1-g | Project document as PDF, and diagram images | Any diagram exported as a PNG or SVG image, downloaded or copied to the clipboard, with its text escaped (SPEC.md section 3.9). The Release 1 exit criterion on a PDF, made with the browser's own print to PDF (SPEC.md section 10.8): a print stylesheet that lays each document out as pages and scales or splits large diagrams, and a short hint to choose "Save as PDF" and turn off the browser's headers and footers. The compiled documents wait for R2-f | R1-c, R1-d, R1-e |
| R1-h | Keyboard and screen reader | The outline as a full keyboard editor for every Release 1 kind, and a screen-reader pass (VISION.md section 10, item 13) | R1-c, R1-d, R1-e |
| R1-i | Instructor MCP server | SPEC.md section 7.1: personal API keys kept as hashes, revocable and logged, and Model Context Protocol (MCP) tools made from the command and query registry. Keys are for instructors only. While the agent edits, the instructor's open tabs on that project are read-only and say so. The architect run reads how Portikus's `packages/auth` stores API keys as hashes and ports what fits | R1-a, R1-b |
| R1-k | Retention, archiving and account deletion | SPEC.md section 1, "Data retention": an instructor archives a course, which makes it read-only while students keep their projects; a retention policy deletes command logs and snapshots, analytics, AI usage records and logged AI exchanges, the request log of API keys, checkpoints, and archived courses after the periods the administrator sets in R1-l, two years by default; an account can be deleted. Needed before the live course. The security reviewer runs | R1-a, R1-f, R1-l |
| R1-l | Administrator interface and operations | SPEC.md section 1, "Administration": one system administrator per deployment; the first one made by the first sign-in with the break-glass password set at install; a second factor for administrators, either a passkey or an authenticator app's time-based one-time codes, and never text messages; retention period settings; an operations document for backup, restore and monitoring, with the data inventory of SPEC.md section 1, "Student records" (what is stored, where, and for how long); and their state shown in the interface (server status, last backup). The system administrator also manages Canvas platform registrations here, which R1-f needs, and makes, resets and disables password accounts, in place of Epic 3's server command. The other ways of signing in are R2-m. The architect run reads Portikus's `packages/auth` for its local administrator, passkey and breached-password code. The security reviewer runs | Release 0 |
| R1-j | Checked against the book | The exit criteria on chapters 4 and 5 and on Visible Analyst's checks. It needs `sources/`, so it runs from the main checkout | All of the above |

## 4. Release 2 candidates

Release 2 is the complete educational environment (VISION.md section 11, "Release 2", and
section 10, Level 2). SPEC.md sections 7, 10 and 11 fix most of it.

| Code | Epic | What it does | Depends on |
| --- | --- | --- | --- |
| R2-a | Course settings, AI gateway and assistance levels 1 and 2 | SPEC.md section 7 and section 1, "AI models and agents" and "Course settings": the screen where an instructor sets a course's level and rule profile, the server reading the level from it to build each request's tools, an AI SDK tool-loop agent using only read-only queries, every step logged, and AI use counted in requests and tokens per student and per course. The counts and logged exchanges fall under R1-k's retention policy. The institution supplies the key and chooses the provider (SPEC.md section 7 item 7). Meets the criterion that levels 0 to 2 are enforced and logged, and the AI behaviors of SPEC.md section 7 item 8 are tested: level 2 never names a missing element, help covers only work already done, the student sees what was used, and the server checks each reply's structure | Release 1 |
| R2-b | Planning forms | System request, feasibility analysis and alternative matrix (SPEC.md sections 10.1, 10.2, 10.4) | Release 1 |
| R2-c | Requirements and test plan | SPEC.md sections 10.3 and 10.5, with their trace links | Release 1 |
| R2-d | Interface structure diagram | SPEC.md section 10.6 | Release 1 |
| R2-e | Binder and attachments | SPEC.md section 10.7: attached files kept outside the project document by content hash, the files host of SPEC.md section 1 ("Host names"), images encoded again on the server, PDFs drawn with pdf.js, web pages and zipped prototypes only in a sandboxed frame from the files host, and everything else as a download. Import is extended for the zip export file and its limits (SPEC.md section 3.9, "Import fails safe"), with tests for each limit. The security reviewer runs | R1-a, R1-b |
| R2-f | Compiled PDFs and dictionary export | SPEC.md section 10.8, and the data dictionary's CSV export (section 3.9). Needs the choice of SPEC.md section 14.1 item 3 | R1-g, R2-b to R2-e, R2-g, R2-h, R2-i, R2-j |
| R2-g | Logical and physical mode | SPEC.md section 11.1, which the three design epics need | Release 1 |
| R2-h | Physical data flow diagram | SPEC.md section 11.2 | R2-g |
| R2-i | Structure chart and program specification | SPEC.md sections 11.3 and 11.4 | R2-g |
| R2-j | Physical data model, SQL schema export and storage estimate | SPEC.md sections 11.5 and 11.6, including the SQL schema export of section 11.5 in one dialect | R2-g |
| R2-k | Accessibility audit | An independent audit and a published conformance report, so that students with disabilities can rely on doing all their work in the tool | The screens of R2-a to R2-j, R2-l and R2-m |
| R2-l | Course dashboard | Behavior analytics per Canvas course, such as time spent, worked out from the saved command log. It may show R2-a's counts of AI requests and tokens, and offers no view of prompt or response text. Its class list comes from Canvas's roster service (Names and Role Provisioning Services, NRPS), fetched when the instructor opens it and not kept (SPEC.md section 1, "Grading"). The architect run reads Portikus's roster client in `packages/auth`. No grades. Students are told what it shows | Release 0's saving, R2-a, R1-k |
| R2-m | More ways to sign in | SPEC.md section 1, "Sign-in" and "Administration": OpenID Connect (OIDC) for school Google or Microsoft accounts, LDAP directories, and email magic links limited to an allow list of addresses or to allowed domains, each set up in R1-l's administrator interface and each a sign-in method of an existing kind of account. A new account takes its login from its first sign-in method (SPEC.md section 3.9). The administrator sets, for each method, whether it needs a second factor; by default LDAP and magic links do and OIDC does not. The architect run reads Portikus's `packages/auth` for its OpenID Connect sign-in and ports what fits. The security reviewer runs | R1-l |

Things wanted but in no release, such as AI assistance level 3, guided workflows, other
symbol styles and group work, are VISION.md section 11's "Later goals". They are not
planned here.

## 5. Lanes

```
Epic 1 Foundation
 ├─ Epic 2 Model ─────────────────────────────────────┬─ Epic 5 Rules and test cases ──┐
 │                                                    ├─ Epic 6 Canvas and outline ────┤
 │                                                    │                                │
 └─ Epic 3 Server and sign-in ─ Epic 4 Canvas launch ─┴─ Epic 7 Saving ────────────────┴─ Epic 8 Trial launch
```

| Stage | Epics that can run at once |
| --- | --- |
| Release 0 | Epic 1 alone; then Epics 2 and 3; then Epic 4 once Epic 3 has merged, and Epics 5 and 6 once Epic 2 has merged, with Epic 2 or 3 if still running; then Epic 7 once Epics 2 and 4 have merged; then Epic 8 |
| Release 1 | R1-a, R1-c, R1-d, R1-e and R1-l; then R1-b, R1-f, R1-g and R1-h; then R1-i and R1-k; then R1-j |
| Release 2 | R2-a, R2-b, R2-c, R2-d, R2-e, R2-g and R2-m; then R2-h, R2-i, R2-j and R2-l; then R2-f; then R2-k |

## 6. Questions to settle before an epic starts

One open point of SPEC.md section 14.1 holds back an epic: how the compiled documents'
PDFs are made (item 3) must be settled before R2-f starts.

# Status

This file says, in a sentence or two per epic, what each epic delivered,
and then lists the open items: gaps that are still true today. The release
roadmap and its exit criteria are in `docs/VISION.md` section 11, Release 0's
scope is in `docs/SPEC.md` section 2, and the reasons for decisions are in
`docs/SPEC.md` sections 1 and 14.

An epic's fold task adds one entry of one or two sentences below, adds any
new open items, and removes the open items the epic fixed. Wanted work
that is not a gap in something built goes in a GitHub issue instead.

## Epics

- **Before the epic workflow, the specification and the prototype.** The
  research and product vision, the core specification, notes from the
  textbook, the Drafting Paper style with its chips, marks and logo, and a
  clickable prototype of the first-release and second-release screens with
  sample data and the rules running in the browser. The prototype is frozen as
  a reference for screen layout and is deleted once `apps/web` has the Release 2
  screens.
- **Epic 1: Foundation.** An npm workspaces root over the five parts of SPEC.md
  section 12, each with a placeholder and one test; the Release 0 libraries, pinned
  exactly; a boundary check that keeps the model, rules and cases free of React, the
  browser and the server; and two required CI checks over all of them, App checks
  and App tests, the second failing below 75% test coverage.
- **Epic 2: Model.** `packages/model` holds the element kinds, views and saved document
  of SPEC.md section 3 with a published JSON Schema, the pure `apply` that enforces every
  invariant and returns a change and its inverse as JSON Patch, undo, redo and replay, and
  the Release 0 commands and queries of section 4 in one registry that doubles as AI tool
  definitions.
- **Epic 3: Server and sign-in.** `apps/server` is a Fastify server on PostgreSQL through
  Kysely that serves the prototype's build behind a password sign-in, with accounts kept
  apart from their sign-in methods, hashed 24-hour sessions, an exact `Origin` check on
  every request that can change anything, limits on failed sign-ins, and a server command
  for accounts; the Docker image and Compose file run it behind the deployment's own
  reverse proxy (SPEC.md section 1, "Sign-in", "Host names" and "Deployment").
- **Epic 4: Canvas launch.** `apps/server` signs a person in from one LTI 1.3 platform set
  by seven `LTI_*` settings, with a checked, single-use login state, a partitioned session
  cookie that works inside Canvas's frame, and the course and the person's role recorded
  each launch; `packages/mock-lti` is a mock platform with deliberate defects and a roster
  service for tests, development and the trial (SPEC.md section 1, "Canvas launch").

## Open items

- `apply` assumes its input document passes the invariant check; a command given a broken
  document can throw instead of refusing. Import must check a file with `findViolations`
  before it reaches `apply` (SPEC.md section 3.9).
- A sign-in that checks the old password just as `account set-password` commits can keep
  a session made with the old password, because the session is written after the
  command ends the account's sessions. `disable` then `enable` ends it.
- The prototype has no sign-out button, because no file in `prototype/` may change.
  `POST /sign-out` works; the web app adds the button.
- `/lti/login` has no per-address limit; an index keeps its table cheap to clean, but a
  flood can still grow it.
- Safari's handling of a partitioned launch cookie inside Canvas's frame is unchecked; the
  proof ran Chromium.
- The launch Origin rule is proved only against the mock; the first real Canvas
  registration confirms which host posts the launch.

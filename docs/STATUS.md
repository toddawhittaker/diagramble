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

## Open items

- `apply` assumes its input document passes the invariant check; a command given a broken
  document can throw instead of refusing. Import must check a file with `findViolations`
  before it reaches `apply` (SPEC.md section 3.9).


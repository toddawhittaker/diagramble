# Diagramble

Diagramble is a source-available web tool for teaching systems analysis and design. It
keeps one model behind every diagram, checks that model against explicit rules, and
explains each problem in plain words. It covers data flow diagrams, entity
relationship diagrams and a data dictionary, and it is built to support the course
textbook: Dennis, Wixom and Roth, *Systems Analysis and Design*, 8th edition.

Keep this file under 150 lines and to process: how work is delegated, tested, reviewed
and merged, with pointers to where the detail lives. Product decisions, design, rules,
status and history go in `docs/`, cited by file and section, never here.

## Where things are documented

| Path | What it holds |
| --- | --- |
| `docs/VISION.md` | Research and product vision. Wins on questions of intent. Section 11 is the release roadmap and its exit criteria |
| `docs/SPEC.md` | The core specification. Wins on implementation detail. Section 1 holds the decisions, 2 Release 0's scope, 3 the model, 5 the rules, 6 the test cases, 12 the code layout and tools, 14 the open points and the scope left out |
| `docs/STATUS.md` | A one- or two-sentence summary of each epic, and the open items |
| `docs/EPICS.md` | The epic plan: each epic's scope, owned directories, dependencies, and the epics that can run beside it. Its section 1 says who may edit the files that epics share |
| `docs/WORKFLOW.md` | Local development, branches, epic plans, pull requests, CI, secret scanning |
| `docs/mockups/` | The screen briefs (`BRIEFS.md`) and the Drafting Paper style (`STYLES.md`) |
| `docs/images/` | Figures for the documents, and the logo in `brand/` |
| GitHub milestones and issues | An epic is a milestone named `Epic <n>: <name>`. Wanted work that is not yet an epic is an issue labelled `enhancement` or `bug`; file one when the user defers something |
| `sources/` | Local only: `.gitignore` excludes the whole folder, because the textbook and the notes taken from it may infringe copyright. Start with `sources/README.md`. A worktree has no copy |

Before implementing any part, read the SPEC.md sections that cover it. Cite sections by
number in prompts, commits, and reports.

Documents state what is true now, in the present tense, with the reason where it matters.
They record no dates of decisions and nothing dropped or changed; git holds history. If
the project starts keeping architecture decision records, one would hold the reasoning
behind a hard-to-undo choice.

## Layout and commands

The real application is an npm workspaces project at the root, over `packages/model`,
`packages/rules`, `packages/cases`, `apps/web` and `apps/server`; its layout is SPEC.md
section 12. A throwaway clickable prototype in `prototype/` is its own npm project, not a
workspace. It runs in the browser with sample data and has no backend. It covers the
first-release and second-release screens of the specification. It is frozen, a reference
for screen layout only, and is deleted once `apps/web` has the Release 2 screens.
`prototype/README.md` describes its parts.

Prerequisites: the `.nvmrc` Node (a SessionStart hook puts it on PATH; humans run `nvm use`),
gitleaks for the pre-commit hook (`git config core.hooksPath .githooks` once per clone).

| Command | What it does |
|---|---|
| `npm ci` | Install the workspaces from the root lockfile |
| `npm run typecheck` / `npm run lint` / `npm test` | The three fast checks, over every workspace. `lint` also runs the boundary check |
| `npm run build` | Build `apps/web` with Vite |
| `npm run test:browser` | The browser tests, in the workspaces that have them |
| `npm run dev --workspace @diagramble/web` | Serve the web app with Vite |
| `docker compose up -d --build` | Run the app and PostgreSQL as deployed; WORKFLOW.md, "Local development", covers the `.env`, the test database and the `account` command |
| `npm ci`, `npm run typecheck` / `lint` / `test` / `build` / `dev` | The same checks for the prototype, run in `prototype/`; `dev` serves http://localhost:5173 |
| `node scripts/check-comment-history.mjs` | Fails on project history in comments, repo-wide |
| `node scripts/check-docs-links.mjs` | Fails on a broken relative link or image in Markdown |

## How work gets done here

The main session is an orchestrator: understand the request, write good
prompts, spawn agents, verify their claims, and report in plain English.
It does the work itself only for a one-line lookup or edit. Agents live in
`.claude/agents/`:

| Agent | Use for |
|---|---|
| explorer | Finding where things are. Cheap. Feed its report to other agents. |
| architect | Read-only design before a feature epic's plan, and the whole-system review at each release gate (WORKFLOW.md, "Epic plans"). |
| builder | Implementing a scoped change against a named SPEC.md section. |
| tester | Designing tests that pin SPEC.md invariants, then running them. |
| security-reviewer | Read-only review of students' data, accounts, the LMS launch, API keys, import and export. |
| code-reviewer | Read-only review for correctness, then YAGNI/KISS/DRY/SOLID quality. |
| a11y-reviewer | Read-only accessibility review of screens to WCAG 2.2 AA. |
| ui-designer | Building or polishing screens to the Drafting Paper style: semantic markup, container-driven layout, performance first. Review-only on request. |
| merger | Diagnosing a red task PR run (flake, conflict, real failure) and updating a branch that fell behind with conflicts. Cheap. |

Orchestration rules:

- Delegate to the cheapest agent that can do the job. Run explorer first
  when a location is unknown and pass its paths on. When a builder or
  tester prompt settles every choice, spawn it on Sonnet at high effort
  and tell it to stop and report any choice the prompt leaves open.
- Run independent agents in parallel. Never let two agents edit the same
  files; split by package or directory and merge in the main session.
- Several epics may run at once. An epic edits only the directories
  `docs/EPICS.md` gives it, and touches the shared files (root
  `package.json`, the lockfile, CI, the Docker files, `docs/STATUS.md`,
  `docs/SPEC.md`, this file) only as that file's section 1 allows.
- A good prompt names the SPEC.md sections, the files in scope, the base
  commit, what done looks like, and what to leave alone.
- Agent worktrees start at `main`. Tell a worktree agent the exact commit
  to reset to, and land its work with `git diff <base> <head> | git apply
  --3way`, not a rebase.
- Verify before relaying: run `npm run typecheck` and `npm run lint` on an
  agent's work; a Stop hook runs both for builder, tester and ui-designer.
- When agents disagree, read the spec section in dispute and rule. If the
  spec does not settle it, bring both positions and a recommendation to
  the user. Say what was ruled in the report.
- Default effort is low. Raise it for one task when it needs sustained
  reasoning, high for intensive debugging. Time-box debugging agents.
- Anything that runs several commands or waits on a long job goes to a
  background agent, so the reply to the user comes at once.
- Never `git add -A`; stage paths explicitly.
- Delete local branches and agent worktrees after a merge.

## Testing rules

- Tests are part of done. A change ships with unit tests for its logic.
  Once the repository has browser tests, any change a student can see ships
  with them too. Design tests from the SPEC.md invariant, not from what the
  code happens to do.
- Write the test first when the behavior is clear enough to state; at
  minimum, a bug fix starts with a failing test that reproduces it.
- Code in the workspaces and in `scripts/` keeps at least 75% line, branch and
  function coverage, enforced by `npm test` and CI. The prototype is exempt.
- Test cases and sample data are original. SPEC.md section 6 has the
  project's own cases.
- Before a pull request: typecheck, lint, the whole test suite and the
  build green locally, and the two repo-wide checks.

## Review and merge rules

- `main` changes only by pull request, and merging it is the user's
  decision. Prepare the pull request, citing the SPEC.md sections it serves
  and how it was verified (WORKFLOW.md, "Pull requests"), then report and
  stop.
- Running an epic (task PRs and how they land, which reviewers run, the
  fold, the epic PR) follows the `epic-run` skill.

## Design defaults

- Build only what was asked. No options, abstractions, or files for needs
  nobody has today.
- Prefer boring, mature technology with explicit interfaces over framework
  magic. Use what is already in the repo before adding a dependency, and
  say why if you add one.
- No dependency under the GPL or the AGPL alone (SPEC.md section 1, "License").
- Commit the lockfile. The real application pins exact dependency versions.
- `packages/model` and `packages/rules` stay free of React, the browser and the
  server (SPEC.md section 12).
- Never copy the textbook's text, figures, cases or worked numbers into the
  project. Cite it by chapter, figure and printed page.
- Diagramble supports the book; it is not a learning management system. Nothing
  deals with assignments, handing work in, grades or due dates unless the user asks.
  The spec makes two exceptions: course settings, and the Release 2 course dashboard
  of behavior analytics with a roster-service class list and no grades (SPEC.md
  section 1, "Grading").

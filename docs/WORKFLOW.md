# Branching, review, and CI

## Local development

The repository pins its Node version in `.nvmrc`. In a Claude Code session a
SessionStart hook puts that version first on the path; otherwise run
`nvm use`. The real application is an npm workspaces project at the repository
root, over `packages/model`, `packages/rules`, `packages/cases`, `apps/web` and
`apps/server`:

```
npm ci                # install exactly what package-lock.json lists
npm run typecheck     # every workspace
npm run lint          # the comment history check, then the boundary check
npm test              # the scripts' tests, then every workspace's Vitest tests, each with a 75% coverage floor
npm run build         # builds apps/web with Vite
npm run test:browser  # the browser tests, in the workspaces that have them
npm run dev --workspace @diagramble/web   # serves the web app with Vite
```

`apps/server`'s tests need PostgreSQL, as CI provides it. Start one with
`docker run -d --rm -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=diagramble_test postgres:18`
and set `DATABASE_URL=postgres://postgres:postgres@localhost:5432/diagramble_test`.
Each test file makes and drops its own database. Without `DATABASE_URL` those tests
stop and print this command.

To run the app as it is deployed, put `POSTGRES_PASSWORD` (letters and digits only,
for example from `openssl rand -hex 32`, because it goes into a URL) and `APP_ORIGIN`
in a `.env` file at the root, which Git ignores, and run `docker compose up -d --build`.
The app listens on `127.0.0.1:3000` for a reverse proxy on the same host; the Compose
network is named `diagramble`, so a proxy in another container can join it. Make an
account with
`docker compose exec app npm run account --workspace @diagramble/server -- make <username>`;
the command prints the new password once. `set-password`, `disable` and `enable` work
the same way, and `--stdin` reads a password instead of generating one.

To try the Canvas launch, run the mock LTI 1.3 platform:

```
npm start --workspace @diagramble/mock-lti -- --tool-url <app origin> [--public-url <mock's address>] [--keys-url <key set address>] [--port 4000] [--host 127.0.0.1]
```

It serves a launch page and a course page that frames the app, and prints the
`LTI_*` lines the app needs. `--public-url` defaults to `http://localhost:<port>`
and `--keys-url` to the public address plus `/jwks`; set `--keys-url` when the app
reaches the mock by another name, such as a Docker service name. Make the tool's
key with `openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048` and put it
in `.env` as one double-quoted line, keeping the `BEGIN PRIVATE KEY` and
`END PRIVATE KEY` lines and writing `\n` for each line break, which Compose expands:

```
LTI_TOOL_KEY="<BEGIN line>\n<key lines, each followed by \n>\n<END line>\n"
```

`compose.yaml` does not pass the `LTI_*` variables to the app yet, so list them
under the app's `environment` in an uncommitted `compose.override.yaml`, which Compose
reads on its own.

`npm test` measures coverage and fails when it is under 75% for lines, branches
and functions. Node's built-in test coverage checks the scripts' own tests, over
the scripts together. Vitest with the V8 provider checks the five workspaces, one
root `vitest.config.ts` running them as projects: the floor applies to the whole
and to each workspace separately, so one well-tested workspace cannot hide
another. `apps/web/src/main.tsx` is left out because it only mounts the app; the
browser tests cover it. `npm test` inside one workspace runs only that workspace's
tests, without the coverage check. The prototype is exempt. Reports are written to
`coverage/`, which Git ignores.

The boundary check, `scripts/check-boundaries.mjs`, fails when `packages/model`,
`packages/rules` or `packages/cases` import anything but their own files, their
listed dependencies, or, in test files, Vitest and their own development
dependencies. It also fails on any `/// <reference>` directive, which would bring
back Node or browser types (SPEC.md section 12).

The prototype is its own npm project in `prototype/`, with its own lockfile. It is
not a workspace, and the root commands do not touch it:

```
cd prototype
npm ci           # install exactly what package-lock.json lists
npm run dev      # serves the app at http://localhost:5173
npm test         # the rule and model tests
npm run typecheck
npm run lint     # the comment history check over the prototype
npm run build    # type-checks, then builds into dist/
```

Two more checks run from the repository root:

```
node scripts/check-comment-history.mjs   # comments and test titles carry no project history
node scripts/check-docs-links.mjs     # every relative link and image in Markdown resolves
```

Screenshots go in `screenshots/` at the repository root, named with the date
and subject. Git ignores that folder.

The course textbook and the notes taken from it are in `sources/`, which Git
ignores as a whole (`sources/README.md`, on the author's computer, covers
copyright and reading the book). An agent's worktree has no `sources/`.

## Branches

- `main` is always releasable. It changes only through a pull request, and
  only the user merges into it.
- Each epic gets a GitHub milestone named `Epic <n>: <name>`, whose issues
  are its work, and a long-lived branch named `epic/<n>-<slug>`. A
  fractional epic uses a dash for the point, as in `epic/3-5-<slug>`. It
  also changes only through a pull request.
- Work happens on short-lived task branches cut from the epic branch, named
  `task/<n>-<short-name>`. A task branch is merged into its epic by pull
  request, squash merge. The orchestrator turns on GitHub auto-merge for
  it once checked, so it lands and its branch is deleted when its CI is
  green; no person reviews a task pull request.
- When an epic's work and its epic-level review are done (see "Pull
  requests" below), the epic branch is merged into `main` by pull request,
  merge commit, so the epic's history is kept.
- To sync changes from `main` into an epic branch, create a short-lived
  branch from the epic, merge `main` into it, and open a pull request back
  into the epic branch. The branch ruleset requires a PR for every push to
  `epic/**`, so a direct merge is not allowed.
- Branches are deleted on merge.

Two rulesets enforce this. `main` and `epic/**` take changes only by pull
request, with the five CI checks green (Secret scan, Docs and comments,
Prototype, App checks and App tests). A pull request into `main` must also be up to date with it; one
into an epic branch need not be.

## Epic plans

An epic's detailed plan, `docs/EPIC-<n>.md` (its rulings, task table and
estimates), lives only on the epic branch, so every agent working from a
checkout can read it.

- Code comments, tests and other docs cite SPEC.md sections, never the
  plan, because the plan goes away.
- The epic's last task folds the plan's lasting rules into SPEC.md in a
  sentence or two each (a decision in section 1, a settled question in
  the section it concerns, taken off section 14's open points), and deletes the plan.
- Parallel task pull requests do not edit `docs/STATUS.md`, because
  they all conflict on it. Each one puts its proposed STATUS line (one
  sentence on what it delivered, and any new open items) in its pull
  request body instead.
- The fold task edits STATUS.md once, from those pull request bodies: it
  adds the epic's entry of one or two sentences, adds the epic's new open
  items at one line each, and removes the open items the epic fixed. No
  task lists, test counts or logs; the pull requests hold those.
- So `main` never holds a plan at a merge. Git history keeps it, and the
  epic pull request's commits show it to the reviewer.

Before a feature epic's plan is written, the architect agent designs it
(not for small fix batches). It reads wide: VISION.md, the releases still
to come in VISION.md section 11, SPEC.md, docs/EPICS.md and the open GitHub issues for
the area. It reports where the code goes, what existing helpers and
schemas the builders must reuse, and which task owns each shared file and
schema change. For each significant choice it gives the smallest change
and the shape the area should have; it recommends the smallest change
unless the choice is hard to undo (the model's element types, the saved
file format, the database schema, a contract between the browser and the
server), and brings large gaps to the user to decide. The plan cites its
report.

At each release gate in VISION.md section 11, the architect also reviews
the whole system, one app or area per run, for layers and boundaries that
local decisions have bent. The user picks which findings become an epic.

## Code style

- Comments say why, never history. Do not write issue or PR numbers,
  epic or task names, review codes, "ruling N", or pointers into epic
  plans; the history lives in version control, and plans are deleted.
  Cite a SPEC.md section instead.
- Do not copy a helper. Search for one that does the job and import it;
  if two places need the same code, move it into a shared module.
- A value that must match in two files or processes is one exported
  constant, not two values and a comment.

`scripts/check-comment-history.mjs` fails on history references in code
comments and test titles, and warns (without failing) about any non-test
source file over 800 lines. The prototype runs it as `npm run lint`.

## Pull requests

Every pull request cites the SPEC.md sections it serves and says how it was
verified. The template asks for both. CI must be green.
An epic pull request must be up to date with `main` before it is merged;
`gh pr update-branch <number>` does that. Task pull requests into an
epic branch need not be up to date, because each update costs a full CI
run. They are updated only when GitHub refuses a merge because the
branch is behind.

There are two kinds of pull request, merged by different people at
different times:

- A task pull request, from a task branch into its epic branch, is merged
  by GitHub auto-merge (squash) as soon as its CI is green, after the
  orchestrator has checked it. No one reviews it by hand; review happens
  once, later, over the whole epic.
- An epic pull request, from an epic branch into `main`, is opened only
  after every task pull request for that epic has landed, code-reviewer,
  security-reviewer (when the epic touches the server, accounts, saving,
  sign-in, the LMS launch, the MCP server or API keys, import or export,
  AI features, attachments and the files host, the administrator
  interface, second factors, or retention deletion) and a11y-reviewer (when the epic touches a screen) have run
  over the epic branch's head, every finding they required has been fixed
  or explicitly deferred, and the checks are green locally. Only the user
  merges an epic pull request into `main`.

The merger agent is called only when a task pull request's run is red, or
when its branch has fallen behind with conflicts. It reruns the CI up to
twice when a failure looks like a flake: a test unrelated to the change
failing on a timing-shaped error that also passed on an earlier run. A failure that touches the changed files, or
repeats after a rerun, is escalated to the orchestrator rather than retried
again; the merger agent never edits code to make a check pass.
`.claude/settings.json` grants agents permission to run `gh pr merge` and
read-only `gh` calls, which is what lets the orchestrator turn on auto-merge
without asking each time.

## CI

`.github/workflows/ci.yml` runs on every pull request into `main` or an epic
branch, and on pushes to them. A new push to a pull request cancels that pull
request's run on the older commit. Its jobs:

- **Secret scan**: gitleaks over the full history.
- **Docs and comments**: the Markdown link check and the comment history
  check, from the repository root.
- **Prototype**: `npm ci`, then typecheck, lint, the test suite and the
  build, in `prototype/`.
- **App checks**: `npm ci` at the root, then typecheck, lint and the build. It
  runs `docker build .` only once a `Dockerfile` exists at the root.
- **App tests**: `npm ci` at the root, then the test suite, with a PostgreSQL
  service whose address the tests read from `DATABASE_URL`. The test suite
  enforces the 75% coverage floor for each workspace and for the scripts. The
  job installs Playwright's Chromium headless shell and runs
  `npm run test:browser` only once `apps/web/playwright.config.ts` exists.

Every job has a time limit, so a hung runner cannot hold a pull request for
hours.

## Secret scanning

Remote: the CI secret-scan job. Local: a pre-commit hook runs gitleaks on
staged changes, and a commit that stages a secret is refused before it is
made. Enable the hook once per clone:

```sh
git config core.hooksPath .githooks
```

Install gitleaks from https://github.com/gitleaks/gitleaks/releases or your
package manager. Files that legitimately contain secret-shaped strings are
allowlisted in `.gitleaks.toml`.

## Dependencies

Dependabot checks the GitHub Actions and the root's npm packages monthly, and
groups each one's updates into one pull request. The prototype's npm packages
are left out, because the prototype is throwaway code. The lockfile is committed. No dependency may be under the
GPL or the AGPL alone (SPEC.md section 1, "License").

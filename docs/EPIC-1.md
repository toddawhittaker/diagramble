# Epic 1 plan: Foundation

This is the detailed plan for Epic 1 of `docs/EPICS.md`. It lives only on the epic
branch `epic/1-foundation` and is deleted by the fold task. Epic 1 serves SPEC.md
section 12 and WORKFLOW.md, "CI". It lays the workspace root, five empty application
workspaces, their libraries, the App CI job and Dependabot, so that later epics add
files without editing any shared file.

Base commit: `06ffb0c` (`main`). Milestone: "Epic 1: Foundation". It closes no issues.
It is an infrastructure epic, so no architect run comes first (the `epic-run` skill,
step 2).

## Rulings

1. **Package names.** The workspaces are `@diagramble/model`, `@diagramble/rules`,
   `@diagramble/cases`, `@diagramble/web` and `@diagramble/server`. Each is
   `"private": true` and `"license": "BUSL-1.1"`.
2. **No build step for packages.** Each internal package's `exports` points at
   `./src/index.ts`. The server runs TypeScript directly with the `.nvmrc` Node's type
   stripping, so the shared settings turn on `erasableSyntaxOnly`,
   `verbatimModuleSyntax` and `allowImportingTsExtensions`, and imports carry the `.ts`
   extension.
3. **Shared TypeScript settings** in `tsconfig.base.json`: `strict`,
   `noUncheckedIndexedAccess`, `isolatedModules`, `noEmit`, `skipLibCheck`, target and
   `lib` ES2024, module and module resolution `nodenext`, and `types: []`. Each
   workspace extends it and adds only what it needs.
4. **The boundary of SPEC.md section 12.** `packages/model`, `packages/rules` and
   `packages/cases` keep `lib: ["ES2024"]` and `types: []`, and do not list React, a
   DOM library or `@types/node` as dependencies. So `document`, `process`, or an import
   of `react` or `node:fs` fails their typecheck. `apps/server` adds `types: ["node"]`.
   `apps/web` adds the DOM libraries, `jsx: "react-jsx"`, and module resolution
   `bundler`.
5. **Root scripts** run in every workspace with `--workspaces --if-present`:
   `typecheck`, `test`, `build` and `test:browser`. `lint` stays the repository-wide
   comment check, `node scripts/check-comment-history.mjs`, run once at the root; no
   other linter is added.
6. **Where libraries go.** Exact versions, the newest stable major line of each, with
   every license checked against SPEC.md section 1, "License".
   - Root, as development tools: `typescript` and `vitest`.
   - `packages/model`: `zod`.
   - `packages/rules`: `@diagramble/model`.
   - `packages/cases`: `@diagramble/model` and `@diagramble/rules`.
   - `apps/web`: `react`, `react-dom`, `react-router`, `@xyflow/react`, `elkjs`,
     `react-aria-components`, `zod` and the three internal packages; as development
     tools `vite`, `@vitejs/plugin-react`, `@playwright/test`, `@types/react` and
     `@types/react-dom`.
   - `apps/server`: `fastify`, `@fastify/formbody`, `@fastify/cookie`,
     `@fastify/static`, `jose`, `kysely`, `pg`, `zod` and the three internal packages;
     as development tools `@types/node` and `@types/pg`.
   The AI SDK of section 12 is left out, because nothing in Release 0 uses it.
7. **Placeholder tests.** Each workspace has one Vitest test that imports its own
   `src/index.ts`, so the test runner, the exports and the imports are all exercised.
   `apps/web` has a `vite build` that builds an empty page. Nothing else is built.
8. **The App CI job.** One job named "App": `npm ci` at the root, then `typecheck`,
   `lint`, `test` and `build`, with a PostgreSQL service whose address is given to the
   tests in `DATABASE_URL`. It installs Playwright's Chromium headless shell and runs
   `test:browser` only when `apps/web/playwright.config.ts` exists, and it runs
   `docker build .` only when a `Dockerfile` exists at the root. The "Prototype" job
   stays as it is.
9. **Dependabot** checks the root's npm packages monthly and groups them into one pull
   request, as it does for the GitHub Actions. The prototype stays left out.
10. **The prototype is untouched.** It keeps its own lockfile and is not a workspace.
11. **PR #3 is not needed.** Epic 1 does not depend on the documentation change in pull
    request #3. If #3 merges before the epic pull request, `main` is merged into the
    epic first (WORKFLOW.md, "Branches").

## Tasks

| Task | Owner and model | Files it may touch | Starts after | What done looks like |
| --- | --- | --- | --- | --- |
| T1 Workspaces and libraries | builder, Sonnet, high effort | Root `package.json`, `package-lock.json`, `tsconfig.base.json`, `.gitignore`, `packages/model/**`, `packages/rules/**`, `packages/cases/**`, `apps/web/**`, `apps/server/**` | None | Rulings 1 to 7. At the root, `npm ci`, `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` pass. The report shows the typecheck failing when a model file uses `document`, `process`, or an import of `react`, and passing again with it removed |
| T2 CI and Dependabot | builder, Sonnet, high effort | `.github/workflows/ci.yml`, `.github/dependabot.yml` | T1 | Rulings 8 and 9. The App job is green on its own pull request |
| T3 Commands in the documents | builder, Sonnet, low effort | `docs/WORKFLOW.md` ("Local development", "CI", "Dependencies", and the required checks under "Branches"), `CLAUDE.md` (the commands table and its lead-in), `README.md` (its running section), `.claude/skills/epic-run/SKILL.md` (the checks named in step 7 and in the rules template) | T1 | The root commands are documented where the prototype's are now, and the prototype's stay documented as its own |
| T4 Fold | the main session | `docs/STATUS.md`, `docs/SPEC.md` section 12, this file (deleted) | T1, T2, T3 and the review fixes | Rulings 1, 2 and 4 in SPEC.md section 12 in a sentence each; the Epic 1 entry in STATUS.md; this plan deleted |

Waves, for reading only: T1 alone; then T2 and T3 side by side; then the review and T4.

## Review

The code reviewer runs over the epic head once T1 and T2 have landed. The security and
accessibility reviewers do not run: nothing here handles students' data, sign-in or a
screen.

## After the epic

The user adds "App" to the required checks of both rulesets once it is green on the
epic pull request.

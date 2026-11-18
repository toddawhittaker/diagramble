---
name: epic-run
description: Use when the orchestrator starts or continues a Diagramble epic (a feature epic or a fix batch) and must take it from branch to a green epic pull request ready for the user's merge.
---

# Running an epic end to end

The main session orchestrates; agents do the work (CLAUDE.md, "How work
gets done here"). Plans and folding follow docs/WORKFLOW.md, "Epic plans".
Keep a memory file for the epic with every ruling and a dated progress
line per step, so the run survives a context reset.

An epic is a GitHub milestone named `Epic <n>: <name>`; its issues are the
work it closes.

## Steps

1. **Branch.** `git fetch origin`, then cut `epic/<n>-<name>` from the
   current `origin/main` commit. Write that commit down; it is the base for
   every wave-one agent.
2. **Design (feature epics only).** Run architect before writing the plan.
   Fix batches skip this.
3. **Plan.** Write `docs/EPIC-<n>.md` (tasks, owner agent, files each task
   may touch, issues it closes) and land it on the epic branch through a
   plan PR. Give each task a "starts after" column naming the task PRs
   whose files or code it needs (often none). Ask the user plan questions
   one at a time, each with a recommendation.
   **Then stop for the user's approval.** Show the plan itself, not just
   a link: each task with its owner agent, model, files and the issues it
   closes, the waves, and the rulings made. Ask for approval and wait.
   Change the plan if the user asks, and show it again. Spawn no task agent
   until the user approves, unless the request already said to run the epic
   through without stopping (an AFK run). Record the approval in the
   epic's memory file so a continued run does not ask again.
4. **Split tasks** so no two agents edit the same files. When files must
   overlap, the later task waits for the earlier one. Start each task as
   soon as the PRs in its "starts after" column have merged, cut from the
   epic head at that moment; never hold a task for a whole wave to land.
   Waves are only a way to read the plan.
5. **Pick models** per CLAUDE.md "Delegation" and "Orchestration rules":
   Haiku for mechanical work, Sonnet at high effort when the prompt settles
   every choice, Opus for design or diagnosis.
6. **Write the shared rules file** in the scratchpad (template below) and
   point every task prompt at it. Each prompt adds the task row, the base
   commit, the files in scope, and what done looks like.
7. **Verify each report** before merging: in the agent's worktree run
   `npm run typecheck` and `npm run lint` in `prototype/` (builder, tester
   and ui-designer also run these in a Stop hook), read the diff, check with
   `gh pr view <n> --json files` that the files it claims are in the PR,
   and rule on anything it did outside its file list. Before pushing any
   edit of your own, run `node scripts/check-comment-history.mjs` and
   `python3 scripts/check-docs-links.py`.
8. **Land by auto-merge.** The repository allows auto-merge. Once a task
   PR passes step 7, run `gh pr merge <n> --auto --squash --delete-branch`.
   GitHub merges it when its CI is green. The epic rulesets do not require
   a branch to be up to date, so green PRs land in parallel. A task PR
   into the epic has no human review; the user reviews once, at the epic
   level. Never use auto-merge on a PR into main; the user merges main.
   Main-into-epic and epic-into-main use merge commits.

   Hand a PR to merger only to diagnose a red run (flake, conflict or
   real failure; it reruns flakes and escalates the rest) or to update a
   branch that has fallen behind with conflicts. Do not use a shell loop
   in the main session.

   Keep one background watcher running for the whole epic (Monitor, a
   60-second poll, re-armed when it expires). It reports every failing
   check and every merge conflict on any open PR into the epic (a
   conflicting PR runs no CI, so a red-check-only watcher misses it), every
   merge, every epic push run result, and failing checks on the epic PR.
   Chase a red result the moment it arrives: a red PR blocks every task
   that starts after it, and nothing else wakes the orchestrator. PRs are
   not tested together, so a red epic push run comes first, before any new
   task starts. At the end of each turn, say which step is pending and what
   it waits on.
9. **Reviews** start as soon as the first large share of the epic has
   landed (for example waves one and two), on a read-only worktree at that
   epic head, while the last tasks still run. When those land, the same
   reviewers do a short pass over the remaining diff. Run in parallel:
   - code-reviewer always, over the epic head and the whole repo's dead
     code;
   - security-reviewer when the epic touches the server, accounts,
     saving, sign-in, the LMS launch, the MCP server or API keys, import
     or export, or AI features;
   - a11y-reviewer when it touches a screen or a shared component.
10. **Fix round.** Rule on each finding: fix now through task PRs, or
    record as a STATUS open item. Land fixes the same way (step 8), also
    without human review, then have each reviewer confirm its findings are
    closed.
11. **Fold task** (last task PR): draft it while the fix round runs,
    since the task PR bodies already hold the STATUS lines, and finish it
    when the last fix lands. In STATUS.md add the epic's entry of one or
    two sentences, add its new open items at one line each, and remove
    the open items it fixed; no task lists, test counts or logs. Move
    lasting rules into SPEC.md (a decision into section 1, a settled
    question into section 14), delete the plan, and carry a `Fixes #N`
    line for each issue. Check `git diff main...epic -- docs/STATUS.md`
    shows the entry.
12. **Epic PR into main.** Cite the SPEC.md sections and how it was
    verified (WORKFLOW.md, "Pull requests"). One `Fixes #N` per line. When
    the epic changes what a student sees, put a before-and-after table of
    the key screens in the body, dark mode first. Keep the body in the
    scratchpad and update it with `gh pr edit --body-file`.
13. **Check CI yourself.** `gh pr checks <epic PR>` must be all green, not
    just the merger's word; push runs and pull request runs can differ.
14. **Stop.** Report the PR and wait. The user merges main. After the
    merge, close the milestone and delete the epic and task branches and
    the agents' worktrees without asking.

## Gotchas

- Worktree agents start at `main`. Always give the exact base commit and
  tell them to `git reset --hard` to it.
- `gh pr update-branch` on an epic sometimes fails with a GraphQL error
  ("Something went wrong"). Merge main into the epic through a task branch
  and PR instead, landed with a merge commit.
- Keep an agent's worktree until its PR merges; removing it early makes the
  agent impossible to resume for a CI fix. After the merge, delete the
  branch and worktree without asking.
- Tell reviewers never to switch branches in the main checkout.
- A fresh worktree needs `npm ci` in `prototype/` before any check runs.
- A worktree has no `sources/` folder, because Git ignores it. When a task
  needs the textbook notes, give the agent the main checkout's absolute
  path to them.
- Agents share the scratchpad; give each its own subfolder.
- An agent waiting on a merge can deadlock; tell running agents not to wait
  for their PR to land.
- Never echo "merged" without checking `gh pr view N --json state`.

## Shared rules file template

```markdown
# Epic <n> shared rules for task agents

Epic <n>, branch `epic/<n>-<name>`, cut from main <commit>. The plan is
docs/EPIC-<n>.md on the epic branch; read your task's row.

- In your worktree: `git fetch origin && git reset --hard <base from your
  prompt>`, then `git switch -c task/<n>-<short-name>`.
- Node: the .nvmrc version must be first on PATH (the SessionStart hook
  does this; otherwise use its full path). Run `npm ci` in `prototype/`.
- Scratchpad <path> is shared; use a subfolder named after your task.
- Tests first: a bug fix starts with a failing test. Design tests from the
  SPEC.md invariant.
- Verify the way CI does, so the PR goes green on its first run. Before
  opening the PR, merge the current epic head into your branch. Then run,
  in `prototype/`, the whole test suite (`npm test`), not just the changed
  files, and `npm run typecheck`, `npm run lint` and `npm run build`. For a
  change to any Markdown file, run `python3 scripts/check-docs-links.py`
  from the repository root.
- A failure near your code is yours until it is shown to fail the same way
  on the base without your change. "Passes when run alone" does not prove
  a flake.
- Never copy the textbook's text, figures, cases or worked numbers into
  code, tests, data or help text. The book and its notes are not in your
  worktree; read them only at the path your prompt gives, if it gives one.
- Do not edit docs/STATUS.md or the plan. Put a proposed STATUS line (one
  sentence delivered, any new open items) in the PR body.
- Never `git add -A`. No attribution lines. Never force-push; merge the
  epic branch in to catch up.
- PR into `epic/<n>-<name>`, not main. Body: `Refs #N`, the SPEC.md
  section served, how it was verified, the STATUS line. Do not merge,
  and do not wait for the PR to land; report as soon as it is open.
- Stay inside your listed files; name any exception in the report.
- If a choice is left open, stop and report it rather than guessing.
- Report: PR number, head commit, what was built and left out, test
  commands with results.
```

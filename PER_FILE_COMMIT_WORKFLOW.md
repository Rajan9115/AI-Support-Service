# ResolveAI — Per-File Git Commit Workflow

## Purpose

This document defines the mandatory Git workflow for Antigravity during every development phase of ResolveAI.

**Every file created or modified by Antigravity must be included in its own meaningful Git commit.** Do not combine multiple changed files into one commit. This rule applies to application code, tests, configuration, scripts, migrations, documentation, and other project files.

Use **npm** as the package manager. Do not use pnpm, yarn, or bun unless the project owner explicitly changes this requirement.

## 1. Before Starting Work

Before editing any file, inspect the repository and current Git state:

```bash
git status --short
git branch --show-current
git log -5 --oneline
```

Then:

1. Read `AGENTS.md`, this workflow, and the active phase requirements.
2. Identify existing user changes and preserve them.
3. Confirm the current branch.
4. Do not overwrite, stage, commit, or otherwise modify pre-existing user changes.
5. Create or modify only files needed for the current task.

If the working tree already contains changes, inspect and identify their ownership before proceeding. If ownership is unclear, stop and ask the project owner.

## 2. Mandatory Per-File Commit Rule

For **each individual file** Antigravity creates or modifies:

1. Finish the changes to that file.
2. Review the file diff.
3. Run relevant validation for the change where practical.
4. Stage only that exact file.
5. Review the staged diff.
6. Create one meaningful commit containing that single file.
7. Verify the commit and working-tree state before moving to the next file.

Example:

```bash
git add apps/api/src/modules/projects/project.controller.ts
git diff --cached --check
git diff --cached
git commit -m "feat(api): add project controller"

git add apps/api/src/modules/projects/project.service.ts
git diff --cached --check
git diff --cached
git commit -m "feat(api): add project service"
```

The examples are illustrative. Use the actual paths and accurate commit messages for the repository.

### Strict requirements

- One changed file per commit.
- Every newly created file must receive its own commit.
- Every modified existing file must receive its own commit.
- If the same file needs further edits later, create another commit for that later change after reviewing it.
- Do not create empty commits.
- Do not make meaningless commits just to satisfy the rule; each commit must represent a real, reviewable change to that one file.
- Do not stage the entire repository with `git add .` or `git add -A`.
- Do not include unrelated files in a commit.
- Do not commit files that belong to the user or another contributor unless explicitly authorized.
- Do not commit secrets, credentials, tokens, private keys, local environment files, build output, or generated artifacts that should be ignored.
- If a file should not be committed (for example, a local `.env` file), do not commit it. Explain the exception in the report and ensure the appropriate safe example/configuration file is committed if required.
- If a single logical feature spans multiple files, create separate commits for each file. Keep the commits in a sensible dependency order.
- Do not amend, rebase, squash, reset, force-push, or rewrite existing history unless the project owner explicitly authorizes it.
- Do not push commits unless the project owner explicitly asks.

## 3. Commit Message Convention

Use Conventional Commits. Each commit message must describe the change in its one committed file.

Format:

```text
<type>(<scope>): <specific change>
```

Allowed types include:

- `feat` — new functionality
- `fix` — bug fix
- `refactor` — code restructuring without behavior change
- `perf` — performance improvement
- `test` — tests or test-related changes
- `docs` — documentation
- `chore` — maintenance or configuration
- `build` — build system or dependencies
- `ci` — CI pipeline changes
- `security` — security-related improvement

Examples:

```text
feat(auth): add login request validation
test(auth): add login service unit tests
docs(api): document project endpoints
chore(config): add api environment example
fix(widget): handle empty assistant response
```

Avoid vague messages such as `update`, `changes`, `fixes`, or `initial commit`.

## 4. Validation — Use npm

Inspect the relevant `package.json` files and run only scripts that are actually defined. Do not assume every package has every script.

Common commands, when the scripts exist:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

For a monorepo, run the relevant checks in the affected workspace/package using the repository's actual npm workspace configuration and scripts.

Rules:

- Run focused tests and checks for the file or feature being changed.
- Run broader phase-level checks before declaring the phase complete.
- Never report a check as passed unless it was executed successfully.
- If a script is missing, report `not run — script not defined`.
- If a check fails, report the failure accurately and do not hide it.
- Do not use pnpm, yarn, or bun.

## 5. File Handling and Special Cases

### New files

Create, review, validate as applicable, stage, and commit each new file individually.

### Modified files

Inspect the diff to ensure it contains only the intended change. Stage and commit that file individually.

### Deleted files

A deletion is also a file change. Review the deletion, stage only that path, and create a dedicated commit for it. Report the deletion clearly.

### Renamed or moved files

Treat a rename/move as one file operation. Review the detected rename and its content diff, stage only the relevant path or paths, and create a dedicated commit for that rename/move. Do not accidentally include unrelated changes.

### Generated files and lockfiles

Do not commit transient build output, caches, logs, or generated files that are not intended to be version-controlled. When a dependency change legitimately updates `package-lock.json`, commit `package.json` and `package-lock.json` separately under this per-file policy, with clear messages.

### Formatting and automated edits

If formatting or code-generation tools modify multiple files, inspect every changed path. Commit each eligible file separately. Never blindly stage all formatter or generator output.

### Blocked commit

If a file cannot be committed because of a hook failure, validation failure, merge conflict, permission issue, or another blocker:

1. Do not bypass hooks or force the commit.
2. Record the exact file and reason.
3. Fix the issue if it is safe and within scope; otherwise stop and report it.
4. Leave the file's state visible and explain it in the final report.

## 6. Phase Completion Procedure

At the end of each development phase:

1. Compare the final working tree against the initial Git status.
2. Inspect every changed path using `git status --short`.
3. Confirm every Antigravity-created or Antigravity-modified eligible file has its own commit.
4. Confirm no unrelated user changes were included.
5. Review the phase's commit history with `git log`.
6. Run all applicable phase-level npm validation scripts.
7. Check the final working-tree state.
8. Report any uncommitted changes, failed checks, or intentionally uncommitted files.

A phase is **not complete** merely because code was written. It is complete only when its acceptance criteria and required validation are satisfied, and all eligible Antigravity file changes have been individually committed.

## 7. Required Implementation Report

At the end of every task and phase, provide this report:

```text
Implementation:
- Concise description of completed work.

Files changed:
- path/to/file — created / modified / deleted / renamed
- path/to/another-file — created / modified / deleted / renamed

Validation:
- npm run lint — passed / failed / not run
- npm run typecheck — passed / failed / not run
- npm test — passed / failed / not run
- npm run build — passed / failed / not run

Git commits:
- <hash> — <exact commit message> — <file path>
- <hash> — <exact commit message> — <file path>

Git:
- Working tree: clean / remaining changes explained
- Uncommitted Antigravity changes: none / list with reasons
- User changes preserved: yes / explanation

Notes:
- Known limitations, failed checks, blocked commits, or follow-up work.
```

Reporting requirements:

- List every file changed by Antigravity.
- List every per-file commit with its actual hash, exact message, and file path.
- Do not invent hashes, commit messages, validation results, or clean working-tree status.
- If no files were changed, state that no commit was necessary.
- If a file was intentionally not committed, identify it and explain why.
- If any Antigravity change remains uncommitted, do not describe the phase as fully committed.

## 8. Safety and Authorization

Antigravity must never:

- Commit secrets or private credentials.
- Stage or commit unrelated user changes.
- Use broad staging commands.
- Rewrite existing Git history.
- Force-push or push without explicit permission.
- Disable Git hooks or bypass required checks to make a commit pass.
- Claim a commit exists before verifying it.

When in doubt about ownership, scope, or whether a file is safe to commit, stop and ask the project owner.

---

**Mandatory instruction:** During every ResolveAI development phase, create a separate, meaningful Git commit for every individual file Antigravity creates, modifies, deletes, or renames, subject to the safety exceptions above. Use npm for all package scripts and validation.

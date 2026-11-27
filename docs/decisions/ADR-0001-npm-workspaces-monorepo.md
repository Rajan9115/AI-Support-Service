# ADR-0001: Use npm Workspaces for the Monorepo

- **Status**: Accepted
- **Date**: 2026-11-27

## Context

`AGENTS.md` and `IMPLEMENTATION_ROADMAP.md` originally suggested `pnpm workspaces`, whereas `AGENTS.md` (Mandatory Git Workflow) and `PER_FILE_COMMIT_WORKFLOW.md` explicitly mandate **npm** as the sole package manager for all installs, scripts, and validation.

## Decision

Use **npm workspaces** (`"workspaces": ["apps/*", "packages/*"]` in root `package.json`) with `package-lock.json` as the single lockfile.

## Consequences

- No additional package manager (`pnpm`, `yarn`, `bun`) is required in local or CI environments.
- All workspace scripts run via `npm run <script> --workspaces --if-present` or `npm --workspace=<name>`.

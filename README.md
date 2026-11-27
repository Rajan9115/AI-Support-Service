# ResolveAI

Multi-tenant AI customer-support infrastructure built as a modular monolith with npm workspaces, TypeScript, Next.js App Router, Express, MongoDB Atlas, Redis/BullMQ, and Gemini.

## Prerequisites

- **Node.js** `>= 20.11.0`
- **npm** `>= 10.0.0` (do not use pnpm, yarn, or bun)

## Workspace Structure

- `apps/dashboard` — Next.js App Router dashboard (`@resolveai/dashboard`)
- `apps/api` — Node.js + Express API & background workers (`@resolveai/api`)
- `packages/shared` — Shared Zod schemas, error codes, and types (`@resolveai/shared`)
- `packages/config` — Shared strict TypeScript configurations (`@resolveai/config`)
- `docs/` — Canonical architecture, schema, API, security, operations, and ADR documentation

## Local Setup

```bash
npm install
cp .env.example .env
```

## Available Scripts

- `npm run dev` — Start workspace dev servers
- `npm run lint` — Run ESLint across all workspaces
- `npm run typecheck` — Run TypeScript typechecking across all workspaces
- `npm test` — Run Vitest unit/integration tests across all workspaces
- `npm run build` — Build shared packages, API, and dashboard
- `npm run format:check` — Verify formatting with Prettier

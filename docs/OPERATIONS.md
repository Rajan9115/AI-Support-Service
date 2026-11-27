# ResolveAI — Operations & Local Development

## 1. Prerequisites

- **Node.js**: `>= 20.11.0` (LTS)
- **npm**: `>= 10.0.0` (mandatory package manager per `PER_FILE_COMMIT_WORKFLOW.md`)
- **MongoDB Atlas** (or local MongoDB with Atlas Vector Search support for Phase 6+)
- **Redis** (for BullMQ queues and rate limiting in Phase 2+)

## 2. Local Setup

```bash
npm install
cp .env.example .env
```

Fill in `.env` values as required by the active phase. Never commit `.env`.

## 3. Workspace Commands

- `npm run lint` — Run ESLint across all workspaces.
- `npm run typecheck` — Run TypeScript typechecking across all workspaces.
- `npm test` — Run unit and integration tests across all workspaces.
- `npm run build` — Build all apps and packages.

## 4. Observability & Reliability

- **Structured Logging**: JSON logs with `requestId`, `organizationId` (when safe), `projectId`, route/job name, duration, and error code.
- **Health Checks**:
  - `GET /health`: Process liveness.
  - `GET /ready`: Dependency readiness (MongoDB, Redis).
- **Graceful Shutdown**: On `SIGTERM`/`SIGINT`, stop accepting HTTP traffic, drain active requests/BullMQ workers, close MongoDB and Redis connections, then exit.

## 5. Incident Runbooks (Summary)

- **MongoDB Unavailable**: `/ready` returns `503`; API logs connection errors without crashing process; check Atlas network allowlist and connection string.
- **Redis Unavailable**: `/ready` returns `503`; ingestion queueing fails fast with `DEPENDENCY_UNAVAILABLE`; check Redis connectivity and memory limits.
- **AI Provider Outage/Quota**: Circuit-break or return `AI_PROVIDER_ERROR` safely; trigger configured human handover fallback if enabled.

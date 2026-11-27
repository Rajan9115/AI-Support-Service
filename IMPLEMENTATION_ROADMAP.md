# ResolveAI — Phase-wise Implementation Roadmap

## 1. Delivery strategy

Build ResolveAI as a **modular monolith** with a pnpm TypeScript monorepo. Deliver a narrow, working vertical slice at each stage. Do not build the widget, AI orchestration, billing, and every dashboard screen simultaneously.

**Suggested first-release target:** a business can create an organization and project, add a knowledge base, ingest documents, configure a Gemini-powered support agent, embed the widget, answer grounded questions, and hand a conversation to a human support agent.

The estimates below are planning ranges for one developer with AI assistance, not guarantees. The schedule depends on familiarity, integration friction, testing depth, and deployment choices.

## 2. Phase overview

| Phase | Focus | Exit result |
|---|---|---|
| 0 | Requirements and architecture baseline | Approved product contracts and decisions |
| 1 | Monorepo and engineering foundation | Reproducible local development and CI |
| 2 | API/database foundation | Healthy, observable API with validated config |
| 3 | Auth and multi-tenancy | Secure organizations, projects, roles, keys |
| 4 | Knowledge-base management | KBs, project mapping, source records |
| 5 | Ingestion pipeline | Secure file/website/FAQ processing jobs |
| 6 | Gemini, embeddings, vector RAG | Grounded answers with source references |
| 7 | Agent configuration and tools | Configurable behavior and governed tool calls |
| 8 | Runtime chat and conversations | Persisted API chat and streaming |
| 9 | Dashboard and human support | Operators can manage conversations and handovers |
| 10 | Widget, SDK, webhooks | External applications can integrate |
| 11 | Usage, security, performance, release | Launch-ready operational baseline |

---

## Phase 0 — Requirements and architecture baseline

**Objective:** Remove critical ambiguity before implementation.

### Tasks
- Confirm initial customer persona and first target use case.
- Confirm organization, project, member, and end-customer roles.
- Define first-release boundaries versus later features.
- Document organization/project/knowledge-base relationships.
- Define the project credential and browser runtime-session model.
- Define conversation lifecycle and human handover states.
- Define ingestion source lifecycle and document versioning.
- Define data deletion/retention expectations.
- Record decisions in Architecture Decision Records (ADRs).

### Deliverables
- `AGENTS.md`
- `docs/SYSTEM_ARCHITECTURE.md`
- `docs/DATABASE_SCHEMA.md`
- `docs/API_DOCUMENTATION.md`
- `docs/SECURITY.md`
- `docs/IMPLEMENTATION_ROADMAP.md`
- Initial ADRs

### Acceptance gate
- No unresolved critical ambiguity in tenant isolation, public widget credentials, knowledge-base sharing, or runtime session authorization.
- Every major domain has a clear owner and boundary.
- First-release scope is explicit.

---

## Phase 1 — Repository foundation and engineering tooling

**Objective:** Establish a reliable, repeatable development environment.

### Tasks
1. Create pnpm workspace and root scripts.
2. Add `apps/dashboard`, `apps/api`, and required `packages/*` workspaces.
3. Configure TypeScript strict mode and shared compiler settings.
4. Configure ESLint and formatting consistently.
5. Add environment variable schemas and `.env.example`.
6. Add test runner setup and a minimal passing test in each app/package that needs tests.
7. Add CI workflow for install, lint, typecheck, test, and build.
8. Write setup instructions and repository conventions.
9. Add `.gitignore` and ensure secrets/build artifacts are excluded.

### Deliverables
- Reproducible workspace install.
- Root commands for dev, lint, typecheck, test, and build.
- CI pipeline.
- README local setup guide.
- `.env.example` with names and descriptions, no secrets.

### Acceptance gate
- A fresh clone can install dependencies using the documented package-manager version.
- All workspace scripts run deterministically.
- Lint, typecheck, tests, and build pass.
- No real secret is committed.
- No business logic is added just to populate folders.

---

## Phase 2 — API, database, configuration, and observability foundation

**Objective:** Build a stable backend base before business modules.

### Tasks
- Create Express app composition and separate app/server startup.
- Add startup configuration validation with Zod.
- Add MongoDB connection lifecycle and connection error handling.
- Add Redis/BullMQ connection abstraction (queue consumers can be added later).
- Add request ID/correlation ID middleware.
- Add structured logger and redaction rules.
- Add centralized typed application errors and final error middleware.
- Add 404 handler and consistent success/error response helpers.
- Add health and readiness endpoints (distinguish process health from dependency readiness).
- Add request body limits, security headers, explicit CORS policy, and baseline rate limiting.
- Add graceful shutdown for HTTP and database connections.
- Add Supertest integration tests.

### Deliverables
- Running Express API.
- `/health` and `/ready` (or equivalent) endpoints.
- Config schema and `.env.example`.
- Error taxonomy and standard response shape.
- Logging and request correlation.

### Acceptance gate
- Missing required production config fails startup with a clear safe message.
- Database outage is visible and does not produce a false-ready status.
- Invalid route/body produces a stable error response.
- Unknown error returns a safe public message and logs correlation details.
- Graceful shutdown closes resources.

---

## Phase 3 — Authentication and multi-tenant core

**Objective:** Implement secure dashboard identity and tenant ownership.

### Tasks
- User registration/login/logout/refresh and current-user endpoint.
- Secure session/cookie strategy and password hashing.
- Organization creation and owner membership.
- Organization member invitations/management (invitation delivery may be staged).
- Server-side RBAC for owner/admin/support-agent roles.
- Project CRUD scoped to organization.
- Project API key creation, one-time reveal, hash-at-rest, rotation and revocation.
- Public project identifier separated from secret credentials.
- Audit logs for security-sensitive mutations.
- Add unique indexes and data validation.
- Write tenant-isolation tests for organizations, projects, members, and keys.

### Deliverables
- Auth module.
- Organization/member/project modules.
- API key lifecycle.
- RBAC middleware/policies.
- Audit trail for sensitive actions.

### Acceptance gate
- A user cannot access another organization's project by guessing an ID.
- Revoked credentials stop authenticating.
- API key plaintext is never persisted or logged.
- Role restrictions are tested on the server.
- Tenant-scoped reads and writes have negative tests.

---

## Phase 4 — Knowledge-base management and source registration

**Objective:** Allow organizations to create knowledge bases and associate them with projects.

### Tasks
- Knowledge-base CRUD.
- Project-to-knowledge-base mapping and removal.
- Validate same-organization ownership before mapping.
- Document/source metadata model.
- Manual FAQ and text creation/edit/delete.
- Upload initiation and private object-storage adapter.
- File limits and file signature/type validation.
- Document status lifecycle: pending, processing, completed, failed, deleted.
- Versioning and content hash strategy.
- Dashboard screens for KB list, details, connected projects, and source list.

### Deliverables
- Knowledge-base APIs and UI.
- ProjectKnowledgeBase mapping.
- Secure source metadata and upload flow.
- Document lifecycle contract.

### Acceptance gate
- One KB can be shared by multiple projects within the same organization.
- Cross-organization KB mapping is rejected.
- Project retrieval configuration can only use enabled mapped KBs.
- Invalid/oversized files are rejected safely.
- Original files are private, not publicly enumerable.

---

## Phase 5 — Asynchronous ingestion: files, websites, FAQs, external sources

**Objective:** Convert source content into versioned, searchable chunks without blocking API requests.

### Tasks
- BullMQ queue setup and worker process.
- Idempotent job identity and retry policy.
- PDF, DOCX, TXT parser adapters.
- Text normalization and empty-content handling.
- Website URL and sitemap ingestion.
- Crawler limits: page count, depth, bytes, timeout, content types.
- SSRF protection: DNS/IP checks, redirect revalidation, block private/reserved ranges.
- Chunking with configurable overlap and token-aware limits.
- Deduplication and source versioning.
- Embedding adapter interface (implementation may be finalized with Phase 6).
- Persist chunks with source/page/section/chunk metadata.
- Progress, retry, terminal failure, and operator-visible error state.
- Dead-letter/exhausted-job handling.

### Deliverables
- Ingestion worker.
- File and website adapters.
- FAQ ingestion.
- Chunk records and source attribution.
- Status/progress API and dashboard feedback.

### Acceptance gate
- Reprocessing the same source does not create duplicate chunks.
- Worker retry after a crash is safe.
- Corrupt, unsupported, empty, and oversized sources fail with actionable status.
- Crawler cannot reach localhost/private metadata addresses, including via redirects.
- Long ingestion never blocks the request thread for the full processing duration.

---

## Phase 6 — Gemini provider, embeddings, vector search, and RAG

**Objective:** Answer customer questions from the correct tenant's approved knowledge.

### Tasks
- Define provider interface for generation, streaming, embeddings, and normalized tool calls.
- Implement Gemini adapter.
- Configure embedding model and vector dimensions explicitly.
- Create Atlas Vector Search index with tenant/KB prefilter fields.
- Implement query embedding and filtered retrieval.
- Add relevance threshold and bounded top-K retrieval.
- Build prompt/context assembly with source metadata and context limits.
- Add source citations in response format.
- Add insufficient-evidence behavior.
- Add prompt versioning.
- Record provider/model/prompt version/latency/token usage.
- Build an evaluation dataset for known questions and expected sources.
- Test provider quota, timeout, malformed output, and unavailable service.

### Deliverables
- Gemini provider adapter.
- Embedding generation.
- Vector search service.
- RAG orchestration service.
- Grounded answer response with source references.
- Evaluation cases and metrics.

### Acceptance gate
- Retrieval always filters by server-resolved organization and enabled KB mappings.
- A project cannot retrieve another tenant's content.
- Answers cite relevant sources where evidence exists.
- Unsupported questions are not answered with invented facts.
- Provider failures return safe errors or configured fallback behavior.
- Embedding model/dimensions are consistent with the vector index.

---

## Phase 7 — Agent configuration, prompts, tools, and escalation

**Objective:** Make behavior configurable while keeping execution controlled by the backend.

### Tasks
- Agent CRUD/configuration per project.
- Tone, language, response limits, model, and RAG settings.
- Prompt versioning and rollback.
- Agent test playground using project-scoped test context.
- Tool registry and schemas.
- Generic platform tools: knowledge search, create support ticket, request handover.
- Customer integration tool contract for authorized business APIs.
- Tool argument and result validation.
- Per-tool permissions, timeouts, idempotency, and audit records.
- Sensitive action confirmation/approval.
- Handover rules and escalation reasons.
- Bound orchestration iterations and execution budgets.

### Deliverables
- Agent configuration APIs/UI.
- Prompt version manager.
- Tool registry.
- Escalation policy service.
- Agent test playground.

### Acceptance gate
- Model-proposed tool calls cannot bypass backend authorization.
- Disabled/unregistered tools cannot execute.
- Invalid tool arguments are rejected.
- Sensitive actions require configured approval.
- Human handover records a reason and preserves conversation context.
- Agent behavior is testable and versioned.

---

## Phase 8 — Runtime sessions, chat API, conversation persistence, streaming

**Objective:** Deliver the first complete customer-facing chat path.

### Tasks
- Create short-lived project-scoped runtime sessions.
- Validate allowed origins and widget/project configuration.
- Create conversation and customer identity/session model.
- Runtime chat endpoint with message size/rate limits.
- Conversation ownership and lifecycle checks.
- Persist customer/AI messages and source metadata.
- Integrate RAG + agent orchestration.
- Add SSE streaming only after non-streaming flow is stable.
- Handle disconnects, cancellation, timeouts, and partial stream failures.
- Add feedback and conversation-end endpoints.
- Add usage metering events.

### Deliverables
- Runtime session API.
- Runtime chat API.
- Conversation/message persistence.
- Optional SSE streaming.
- Runtime integration tests.

### Acceptance gate
- A public project identifier alone cannot perform privileged operations.
- Runtime tokens are short-lived and project-scoped.
- Conversations cannot be read or mutated across projects/tenants.
- Duplicate client retries do not duplicate messages when idempotency is required.
- Client disconnect/provider failure is handled without corrupting conversation state.
- Usage events are attributable to organization and project.

---

## Phase 9 — Dashboard and human-support operations

**Objective:** Give business teams a usable control plane and support inbox.

### Tasks
- Authenticated dashboard shell and organization/project switcher.
- Project overview and settings.
- Knowledge-base and source management views.
- Agent configuration and playground.
- Conversation inbox with filtering and pagination.
- Conversation detail timeline.
- Human assignment and handover queue.
- Human replies and status transitions.
- Ticket creation, assignment, priority, and resolution.
- Realtime updates where useful.
- Role-aware UI and server-side API authorization.
- Loading, empty, error, optimistic-update rollback, and success states.

### Deliverables
- Core dashboard workflows.
- Support inbox.
- Human handover and ticket workflow.
- Responsive and accessible UI.

### Acceptance gate
- Support agents see only authorized organization/project conversations.
- Handover status is consistent between runtime and dashboard.
- Human replies are persisted and delivered to the customer channel.
- Large conversation lists are paginated.
- UI has robust loading/error/empty states.

---

## Phase 10 — Widget, SDK, webhooks, and external integrations

**Objective:** Make ResolveAI integrable into customer applications.

### Tasks
- Widget initialization contract using public project identifier and safe runtime session exchange.
- Widget UI, launcher, responsive panel, theme configuration.
- Host-page CSS isolation.
- Keyboard accessibility and focus management.
- Network retry/offline/error states.
- Production build and bundle-size analysis.
- SDK client with typed methods, timeout, error classes, and retry policy.
- SDK documentation and examples.
- Webhook event catalog and payload schemas.
- HMAC signature and timestamp verification.
- Retry scheduling, idempotency, delivery history, and replay protection.
- External API integration framework with destination allowlists and secret storage.

### Deliverables
- Embeddable widget package.
- Typed JS/TS SDK.
- Webhook delivery subsystem.
- Integration examples and docs.

### Acceptance gate
- Widget bundle contains no privileged API secret.
- Widget does not break host-page styles.
- SDK exposes typed and documented errors.
- Webhook receivers can verify signatures.
- Webhook retries do not cause duplicate side effects when consumers use event IDs.
- External integrations enforce timeouts, allowlists, and response limits.

---

## Phase 11 — Usage, quotas, analytics, hardening, deployment, launch

**Objective:** Establish operational readiness and controlled launch.

### Tasks
- Usage metering for messages, tokens, ingestion, and tool execution.
- Per-plan quotas and rate limits (billing integration can follow).
- Organization/project analytics.
- Audit log views and retention controls.
- Production logging, metrics, alerting, tracing, and dashboards.
- Load tests for runtime chat, vector retrieval, and ingestion workers.
- Database query/index review with representative data.
- Security review and dependency audit.
- Backup/restore and data deletion drills.
- Deployment pipeline for dashboard, API, worker, Redis, MongoDB, and object storage.
- Health/readiness checks and graceful shutdown validation.
- Staging smoke tests and rollback plan.
- Operational runbooks for provider outage, queue backlog, storage outage, and database outage.

### Deliverables
- Usage/analytics baseline.
- Production deployment configuration.
- Monitoring and alerts.
- Backup/restore and incident runbooks.
- Release checklist.

### Acceptance gate
- No known critical tenant-isolation or secret-exposure issue.
- Representative load tests meet agreed latency/error budgets.
- Queue backlog and provider failures are observable.
- Backups can be restored in a tested procedure.
- Rollback and incident procedures are documented.
- Production secrets are stored in a secret manager, not source control.
- Staging smoke tests pass before production rollout.

---

## 3. Cross-phase engineering gates

These are not optional final-phase tasks; they apply throughout development.

### Security gate
- Tenant isolation.
- RBAC.
- Secret redaction.
- Input validation.
- Rate limits.
- Safe file handling.
- SSRF controls.
- Tool authorization.
- Webhook verification.

### Reliability gate
- Typed errors.
- Central error handling.
- Timeouts.
- Bounded retries.
- Idempotency.
- Graceful shutdown.
- Health/readiness.
- Failure-state visibility.

### Performance gate
- Pagination.
- Query indexes.
- Bounded concurrency.
- Background jobs.
- AI token/context budgets.
- Bundle-size awareness.
- Measured latency and resource usage.

### Quality gate
- Unit and integration tests.
- Tenant-negative tests.
- API contract tests.
- E2E tests for critical journeys.
- Lint, typecheck, and production build.
- Documentation and `.env.example` kept in sync.

## 4. Recommended first vertical slice

Before broad feature development, deliver this end-to-end path:

1. A user registers and creates an organization.
2. The owner creates one project.
3. The project gets a public identifier and a secret server-side API key.
4. The owner creates one knowledge base and maps it to the project.
5. The owner uploads one supported document.
6. A worker parses, chunks, embeds, and indexes it.
7. The owner configures a Gemini agent.
8. A test/runtime client creates a short-lived session and asks a question.
9. ResolveAI retrieves only the mapped knowledge base and returns a grounded answer with a source.
10. If the answer is unsupported or the customer requests a human, a handover is created and appears in the support inbox.

This vertical slice validates the most important architecture: tenant isolation, ingestion, vector retrieval, AI provider abstraction, runtime credentials, persistence, and escalation.

## 5. Suggested release sequencing

- **Internal prototype:** phases 0–6 with a minimal test interface.
- **Private alpha:** phases 7–9, one or two pilot organizations, manual onboarding.
- **Integration beta:** phase 10, SDK/widget documentation, webhook retries.
- **Production launch candidate:** phase 11 gates satisfied, security review and restore drill complete.

Do not use a calendar deadline as a substitute for acceptance criteria. Release only when the relevant gates pass.

# AGENTS.md — ResolveAI Engineering Handbook

> **Purpose:** This is the primary engineering contract for every human and AI agent contributing to ResolveAI. Read it before planning, editing, generating, or reviewing code.
>
> **Product:** ResolveAI — multi-tenant AI customer-support infrastructure that businesses integrate into their own applications through an embeddable JavaScript widget, REST APIs, and SDKs.
>
> **Engineering standard:** Production-minded, secure by default, observable, testable, maintainable, and performance-conscious. Do not optimize for the number of files or lines generated. Optimize for correctness and long-term operability.

---

## 1. How to use this document

1. Read this file completely before starting a task.
2. Inspect the repository, package manifests, existing conventions, tests, and documentation before proposing changes.
3. If the repository differs from the proposed architecture, identify the difference and preserve working conventions unless there is a justified migration plan.
4. Read the relevant documents in `docs/` before changing architecture, database contracts, APIs, security behavior, or deployment.
5. Work in small, reviewable increments. Do not implement the entire product in one unverified generation.
6. Update this file or the relevant supporting documentation when a lasting engineering rule changes.
7. Never report a task as complete unless the applicable checks have actually run and passed. State any checks that could not be run.

If requirements are ambiguous and the ambiguity affects security, data integrity, billing, customer-visible behavior, or public API compatibility, stop and ask for clarification. For low-risk details, choose a conservative default, document it, and keep it easy to change.

## 2. Product vision and scope

ResolveAI provides reusable customer-support infrastructure to multiple businesses (tenants). Each business can manage projects, agents, knowledge bases, conversations, support staff, integrations, and usage from a dashboard.

### Supported integration channels

- Embeddable JavaScript chat widget.
- Versioned REST API.
- Typed SDK package(s), beginning with TypeScript/JavaScript.

### Knowledge sources

- PDF, DOCX, and TXT uploads.
- Website URLs and sitemaps.
- Manually authored FAQs and text.
- Customer-authorized external API integrations.

### Agent behavior

- AI-first autonomous responses grounded in approved knowledge.
- Explicit human handover when the agent lacks reliable information, a customer requests a person, policy requires escalation, or a configured threshold is reached.
- Controlled tool execution for approved business actions.
- Conversation history and source attribution.

### Core multi-tenant model

- An Organization owns users/members, projects, knowledge bases, settings, and billing/usage.
- An Organization can own multiple Projects.
- An Organization can own multiple Knowledge Bases.
- A Knowledge Base may be explicitly shared with multiple Projects through a mapping collection.
- Each Project has its own Agent configuration and integration credentials.
- Conversations and tickets are scoped to a Project and Organization.
- End customers do not need ResolveAI dashboard accounts to use the widget/API.

### Explicit non-goals for the first release

- Do not split the initial system into microservices without measured operational need.
- Do not build an unrestricted autonomous agent that can execute arbitrary code or arbitrary network requests.
- Do not promise exactly-once delivery from queues or webhooks; implement at-least-once delivery with idempotent consumers.
- Do not add billing complexity before usage metering is reliable.
- Do not support arbitrary customer-provided code execution inside the platform.

## 3. Required technology direction

Use the following as the default stack unless repository evidence or a documented architecture decision justifies a change.

| Area | Default |
|---|---|
| Monorepo | pnpm workspaces |
| Language | TypeScript with strict compiler settings |
| Dashboard | Next.js App Router, React, Tailwind CSS |
| API | Node.js + Express |
| Data | MongoDB Atlas + Mongoose |
| Vector retrieval | MongoDB Atlas Vector Search |
| AI provider | Gemini initially, behind a provider interface |
| Embeddings | Gemini embedding model, fixed per knowledge-base/index version |
| Background jobs | BullMQ + Redis |
| Realtime | Socket.IO where realtime delivery is required |
| Validation | Zod at trust boundaries |
| API contract | REST + OpenAPI/Swagger |
| Unit/integration tests | Vitest + Supertest |
| Browser E2E | Playwright |
| Logging | Structured JSON logs with request/correlation IDs |
| Object storage | Private S3-compatible object storage; use Cloudinary only if its private-file/security model is verified for this use case |

### Dependency policy

- Prefer platform APIs and existing dependencies before adding a package.
- Check package maintenance, license, security posture, bundle impact, TypeScript support, and compatibility.
- Pin or lock dependency versions through the package manager lockfile.
- Do not add two libraries that solve the same problem without a documented reason.
- Keep frontend-only packages out of backend packages and vice versa.
- Do not use a package simply because an AI-generated example uses it.

## 4. Architecture principles

### 4.1 Modular monolith first

Build a modular monolith with clear domain boundaries. Keep modules independently testable and avoid circular dependencies. Extract services only when scale, deployment isolation, team ownership, or reliability data justifies it.

Suggested workspace:

```text
resolveai/
├── AGENTS.md
├── README.md
├── pnpm-workspace.yaml
├── package.json
├── .env.example
├── apps/
│   ├── dashboard/             # Next.js customer/admin dashboard
│   ├── api/                   # Express REST/runtime API
│   └── widget-demo/           # Optional integration playground
├── packages/
│   ├── widget/                # Embeddable browser widget
│   ├── sdk/                   # Typed JS/TS SDK
│   ├── shared/                # Shared types, schemas, constants
│   ├── ui/                    # Shared dashboard UI primitives
│   └── config/                # Shared lint/TS/build configuration
├── docs/
│   ├── SYSTEM_ARCHITECTURE.md
│   ├── DATABASE_SCHEMA.md
│   ├── API_DOCUMENTATION.md
│   ├── SECURITY.md
│   ├── IMPLEMENTATION_ROADMAP.md
│   ├── OPERATIONS.md
│   └── decisions/
├── infrastructure/
│   ├── docker/
│   └── scripts/
└── scripts/
```

Do not create every folder in advance if it has no implementation. Add structure as the corresponding phase begins.

### 4.2 Backend layering

Use a consistent request flow:

`Route → Authentication/Tenant Context → Validation → Controller → Application Service → Repository/Provider → Response`

- **Routes:** URL and middleware composition only.
- **Validators:** Parse and validate untrusted request data.
- **Controllers:** Translate HTTP input/output; keep business rules out.
- **Services/use cases:** Own business workflows and transaction boundaries.
- **Repositories:** Encapsulate persistence queries and tenant scoping.
- **Providers/adapters:** Encapsulate Gemini, storage, email, external APIs, queues, and other vendors.
- **Workers:** Execute asynchronous jobs; must be retry-safe and idempotent.
- **Middleware:** Authentication, authorization, request IDs, rate limits, and error conversion.

Avoid a generic “base service” or repository abstraction unless it provides a concrete benefit. Keep abstractions small and domain-driven.

### 4.3 AI provider abstraction

The application must not call Gemini directly from controllers or domain services. Define a provider contract for text generation, streaming, embeddings, and supported tool/function calls. Implement Gemini first. Provider-specific request/response types must remain inside the adapter.

Record provider, model, prompt version, token usage when available, latency, and outcome for each AI operation. Never log secrets, full sensitive customer payloads, or private source documents by default.

### 4.4 Asynchronous ingestion

File parsing, website crawling, chunking, embedding generation, and large sync operations must run as background jobs. HTTP requests should acknowledge accepted work and return a job/document status rather than waiting for long-running ingestion.

Jobs must:
- Be idempotent.
- Have bounded retries with exponential backoff and jitter.
- Distinguish retryable from permanent failures.
- Record progress and actionable failure reasons.
- Avoid duplicate chunks on retries.
- Support cancellation or superseding versions where feasible.
- Enforce per-tenant concurrency and usage limits.

## 5. Domain boundaries and data model

Use MongoDB collections with explicit `organizationId` ownership on tenant-owned records. Treat the following as logical domain entities; refine exact fields and indexes in `docs/DATABASE_SCHEMA.md` before implementation.

### Core identity and tenancy

- `User`
- `Organization`
- `OrganizationMember` (role and membership status)
- `Project`
- `ApiKey` (store only a cryptographic hash of the secret)
- `AuditLog`

### Knowledge and ingestion

- `KnowledgeBase`
- `ProjectKnowledgeBase` (explicit sharing mapping; unique `{ projectId, knowledgeBaseId }`)
- `Document` (file, website page, FAQ, or API source metadata and processing status)
- `DocumentChunk` (text, embedding, source metadata, model/version identifiers)
- `IngestionJob` if job state is not adequately represented by queue metadata

### Agent and runtime

- `Agent`
- `PromptVersion`
- `ToolDefinition`
- `ExternalIntegration`
- `Conversation`
- `Message`
- `Ticket`
- `Webhook`
- `UsageRecord`

### Required data rules

- Every tenant-owned document must carry `organizationId`.
- Every project-owned record must carry both `organizationId` and `projectId` where useful for safe filtering and auditing.
- Resolve tenant and project context from authenticated credentials on the server. Never trust a client-supplied `organizationId` as authorization.
- Validate that a project belongs to the resolved organization before accessing it.
- Validate that a knowledge base belongs to the same organization before mapping it to a project.
- A runtime retrieval query must be filtered by the server-resolved organization and the knowledge bases currently mapped and enabled for that project.
- Use explicit enums/unions for lifecycle states.
- Use timestamps consistently (`createdAt`, `updatedAt`) and define retention/deletion behavior.
- Add unique and compound indexes for real query patterns; validate index plans with representative data.
- Avoid unbounded arrays in MongoDB documents. Store messages/chunks as separate documents.
- Use transactions for multi-document invariants when supported and justified; otherwise use idempotent workflows and compensating actions.

### Initial index candidates

Validate these against actual query patterns before release:

- Organization: unique `slug`.
- Project: unique `{ organizationId, slug }`.
- Membership: unique `{ organizationId, userId }`.
- ProjectKnowledgeBase: unique `{ projectId, knowledgeBaseId }`.
- Document: `{ organizationId, knowledgeBaseId, status, updatedAt }`.
- DocumentChunk: filter fields for tenant/knowledge-base plus vector index on embedding.
- Conversation: `{ organizationId, projectId, status, updatedAt }`.
- Message: `{ conversationId, createdAt }`.
- Ticket: `{ organizationId, projectId, status, priority, updatedAt }`.
- API key: unique `keyHash`.
- Usage: `{ organizationId, createdAt }`.

The Atlas Vector Search index must use the embedding field and pre-filter fields needed for tenant and knowledge-base isolation. Confirm the vector index dimensions and similarity settings match the configured embedding model. Never mix incompatible embedding dimensions/models in the same index without a deliberate versioning strategy.

## 6. API design contract

- Prefix public endpoints with `/v1`.
- Use nouns and consistent resource nesting.
- Use correct HTTP methods and status codes.
- Validate path params, query params, headers, and bodies with Zod.
- Return a consistent envelope, for example:

```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

Errors should use a stable shape:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request is invalid.",
    "details": [],
    "requestId": "..."
  }
}
```

- Never expose stack traces, database errors, provider responses, secrets, or internal file paths to clients.
- Include pagination for potentially large lists. Prefer cursor pagination for high-volume timelines.
- Define sorting/filter allowlists; never pass raw client sort objects into MongoDB.
- Make mutation endpoints idempotent where retries are possible.
- Keep API response contracts documented in OpenAPI and tested.
- Treat public runtime API compatibility as a product contract. Use additive changes where possible and version breaking changes.

### Expected API domains

Authentication:
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`

Organizations/projects:
- `GET/PATCH /organizations/current`
- `GET/POST /projects`
- `GET/PATCH/DELETE /projects/:projectId`
- `POST /projects/:projectId/api-keys`
- `DELETE /projects/:projectId/api-keys/:keyId`

Knowledge:
- `POST/GET /knowledge-bases`
- `POST/GET /knowledge-bases/:id/documents`
- `GET /documents/:id/status`
- `DELETE /documents/:id`
- `POST /knowledge-bases/:id/websites`
- `POST /knowledge-bases/:id/faqs`
- `POST /knowledge-bases/:id/sync`
- `POST/DELETE /projects/:projectId/knowledge-bases/:knowledgeBaseId`

Agent:
- `GET/POST/PATCH /projects/:projectId/agent`
- `POST /projects/:projectId/agent/test`
- `GET/POST /projects/:projectId/agent/prompts`

Runtime:
- `POST /runtime/sessions`
- `POST /runtime/chat`
- `POST /runtime/chat/stream` (SSE when implemented)
- `GET /runtime/conversations/:conversationId`
- `POST /runtime/conversations/:conversationId/feedback`
- `POST /runtime/conversations/:conversationId/end`

Support:
- `GET /tickets`
- `GET/PATCH /tickets/:ticketId`
- `POST /tickets/:ticketId/assign`
- `POST /conversations/:conversationId/handover`
- `POST /conversations/:conversationId/messages`
- `POST /conversations/:conversationId/resolve`

Do not implement all endpoints in one phase. Build and document them as their dependencies become available.

## 7. Authentication, authorization, and tenant isolation

### Dashboard users

- Use a secure, well-understood session strategy.
- Prefer HttpOnly, Secure, SameSite cookies for browser sessions.
- Hash passwords with Argon2id or a currently recommended bcrypt configuration.
- Implement email verification and password reset safely if account creation is public.
- Enforce organization membership and role permissions on the server.
- Re-check authorization for every protected resource operation.

### Project runtime credentials

- Public widget configuration may expose a public project identifier, never a privileged secret.
- Create short-lived, project-scoped runtime/session tokens for browser clients.
- Server-side API keys must be high entropy, shown once, hashed at rest, revocable, rotatable, and optionally expiring.
- Never put secret API keys in widget JavaScript, browser storage, source maps, logs, or frontend environment variables.

### Tenant isolation is a release blocker

For every tenant-owned query:
1. Resolve the authenticated principal.
2. Resolve the organization membership or project credential server-side.
3. Verify the requested project/resource belongs to that tenant.
4. Apply tenant filters in the database query itself.
5. Verify related-resource ownership before using IDs supplied by a client.
6. Add cross-tenant negative tests.

Do not fetch a record by `_id` and only check tenancy later if the query can safely include tenant scope. Avoid leaking whether another tenant's record exists; return a consistent not-found/forbidden policy.

## 8. AI, RAG, and agent safety

### Ingestion pipeline

1. Accept and validate source metadata.
2. Store uploaded originals in private object storage.
3. Parse using format-specific adapters.
4. Normalize and clean extracted text.
5. Deduplicate with content hashes and source/version identifiers.
6. Chunk using configurable, measured parameters.
7. Generate embeddings through the provider adapter.
8. Persist chunks with source/page/section/chunk metadata.
9. Mark the source indexed only after all required work succeeds.
10. Expose progress and safe failure details.

A starting chunk configuration may be around 700 tokens with 100-token overlap, but treat it as a tunable baseline and evaluate retrieval quality on representative company documents.

### Runtime RAG pipeline

1. Authenticate the project/runtime session.
2. Resolve the tenant, project, agent, and enabled knowledge bases server-side.
3. Validate conversation ownership and status.
4. Apply abuse controls and message limits.
5. Build the query embedding.
6. Run vector retrieval with mandatory tenant and enabled-knowledge-base prefilters.
7. Apply relevance thresholds and optional reranking.
8. Build a bounded context with source metadata.
9. Call the configured AI provider.
10. Validate tool calls and output policy.
11. Save messages, citations, AI metadata, and usage.
12. Return a response with grounded source references where available.

### Grounding and prompt injection

- Retrieved content is untrusted reference data, not instructions.
- System policy and backend authorization always outrank retrieved text.
- The model must not reveal system prompts, secrets, internal logs, or other tenants' data.
- The agent must say when knowledge is insufficient rather than inventing policies, order status, prices, or customer facts.
- Include source citations/links where supported.
- Treat user content, retrieved content, and tool output as untrusted input.
- Do not rely on prompt instructions as the only security boundary.

### Tool execution

- The model may propose a tool call; the backend decides whether it is allowed.
- Only registered, enabled, allowlisted tools can execute.
- Validate arguments and tool output with schemas.
- Enforce tenant/project ownership and customer authorization for every tool.
- Apply timeouts, rate limits, idempotency keys, and audit logs.
- Require confirmation/approval for sensitive or irreversible actions.
- Bound tool iterations and execution time to prevent loops and runaway cost.
- Never execute arbitrary shell commands, code, or arbitrary URLs requested by the model.

### Human handover

Trigger handover when:
- The customer explicitly asks for a human.
- Knowledge confidence/relevance is below configured thresholds.
- The agent encounters a policy-defined sensitive case.
- An approved tool fails in a way requiring human review.
- The configured escalation rules are met.

Persist the handover reason, conversation state, summary, relevant messages, and assignment history. Do not silently claim that a human has been notified unless notification delivery is confirmed.

## 9. Error handling and reliability standards

This section is mandatory. Error handling must be designed, not added as scattered `try/catch` blocks.

### Error taxonomy

Use typed application errors with stable codes, such as:

- `VALIDATION_ERROR`
- `UNAUTHENTICATED`
- `FORBIDDEN`
- `NOT_FOUND`
- `CONFLICT`
- `RATE_LIMITED`
- `QUOTA_EXCEEDED`
- `DEPENDENCY_UNAVAILABLE`
- `AI_PROVIDER_ERROR`
- `INGESTION_FAILED`
- `INTERNAL_ERROR`

Each error should include an internal classification, safe public message, HTTP status, retryability, and optional structured metadata. Do not expose sensitive causes to clients.

### API error middleware

- Use one final Express error middleware.
- Convert known validation/auth/domain errors to consistent responses.
- Log unknown errors with request ID and stack trace in protected server logs.
- Do not send stack traces or raw provider/database messages to clients.
- Handle rejected async route handlers consistently.
- Ensure errors from streaming responses are handled before headers are sent; after streaming starts, emit a safe stream error event and close cleanly.
- Avoid duplicate logging of the same error at every layer.

### Resilience

- Set explicit timeouts for database, AI provider, storage, external APIs, and tool calls.
- Retry only transient failures; use bounded exponential backoff with jitter.
- Do not retry validation, authorization, or permanent provider errors.
- Use circuit breakers or temporary provider fallback only when the fallback behavior is safe and clearly observable.
- Use queue dead-letter handling and an operator-visible failed-job state.
- Use idempotency for payment/usage mutations, ingestion jobs, tool actions, and webhook delivery.
- Implement graceful shutdown: stop accepting traffic, drain active work, close queue/database connections, then exit.
- Return actionable errors without leaking secrets.

### Failure scenarios to test

- MongoDB unavailable or slow.
- Redis unavailable.
- Gemini timeout, quota exhaustion, malformed response, and provider outage.
- Object storage upload/download failure.
- Invalid/corrupt/oversized document.
- Parser failure and empty extracted content.
- Duplicate ingestion request.
- Queue retry exhaustion.
- Website crawl blocked by SSRF policy.
- External API timeout or invalid response.
- User revoked while a session is active.
- Cross-tenant resource identifier.
- Client disconnect during streaming.

## 10. Performance and scalability

Performance is a design requirement, but do not make unsupported “high performance” claims. Measure before and after optimization.

### Dashboard

- Use Server Components for read-heavy server-rendered UI where appropriate.
- Keep client components small and limited to interactive areas.
- Avoid unnecessary global state and repeated fetching.
- Use pagination/virtualization for large conversations and tables.
- Lazy-load heavy editors, charts, and configuration tools.
- Avoid rendering entire message histories at once.
- Use optimized images, fonts, and bundle analysis.
- Prevent N+1 API calls and duplicate requests.

### API

- Keep request handlers short; offload long-running work to queues.
- Use connection pooling and bounded concurrency.
- Paginate all unbounded lists.
- Select only required fields and avoid over-fetching.
- Use lean/read-only queries where Mongoose document behavior is unnecessary.
- Avoid sequential independent I/O; use bounded parallelism.
- Cache only data with a clear invalidation strategy.
- Apply per-user, per-project, and per-tenant rate limits.
- Add request body size limits and response compression only where appropriate.

### Database and vector retrieval

- Build indexes from measured query patterns.
- Inspect explain plans for high-volume queries.
- Avoid unbounded regex searches and unbounded `$in` lists.
- Keep embeddings/chunks separate from large parent documents.
- Enforce vector prefilters for organization and knowledge-base scope.
- Track retrieval latency, result count, and relevance metrics.
- Revisit shard/partition strategy only when real scale and workload justify it.

### AI cost and latency

- Set model, token, context, and tool-call budgets.
- Use bounded retrieval result counts and context length.
- Avoid re-embedding unchanged content.
- Cache only safe, tenant-scoped, version-aware results.
- Record latency and token usage by tenant/project.
- Do not sacrifice tenant isolation or grounding for caching.
- Establish service-level targets from observed usage before promising SLAs.

### Observability

Every request/job should be traceable with:
- `requestId` / correlation ID.
- Tenant/project identifiers in structured logs where safe.
- Route/job name, duration, outcome, and error code.
- AI provider/model, latency, token usage, and prompt version where applicable.
- Queue attempts and terminal job status.

Do not log API keys, passwords, session tokens, full payment details, or sensitive customer content by default. Add metrics for request latency, error rates, queue depth/age, provider failures, retrieval quality, and resource utilization.

## 11. Frontend and design-system standards

- Build a consistent dashboard, not disconnected screens.
- Define typography, color tokens, spacing, radii, shadows, breakpoints, and component variants.
- Use accessible semantic HTML and keyboard-operable controls.
- Every async screen must have loading, empty, success, and error states.
- Forms must show field-level validation and preserve user input after recoverable errors.
- Destructive actions require clear confirmation and safe feedback.
- Do not use fake metrics, fake activity, or hardcoded production-looking data.
- Use mock data only in isolated demos/tests and label it clearly.
- Keep widget CSS isolated to prevent host-page style collisions.
- Widget must support initialization/configuration, responsive sizing, keyboard accessibility, safe origin checks, and graceful network failure.
- Avoid exposing internal dashboard UI components in the public widget bundle unless deliberately shared.

## 12. Testing and quality gates

### Required test layers

- Unit tests for domain rules, validators, services, retrieval filters, and error mapping.
- Integration tests for API routes, database repositories, queue handlers, and provider adapters using controlled mocks/fakes.
- Tenant-isolation tests for every resource family.
- Contract tests for OpenAPI schemas and SDK serialization.
- E2E tests for critical user journeys.
- Load/performance tests for representative runtime chat and ingestion workloads before production scaling claims.

### Minimum critical scenarios

- Organization owner creates a project.
- Project key is created, shown once, and cannot be recovered in plaintext.
- A knowledge base is mapped to a project.
- A document is ingested once and duplicate retries do not create duplicate chunks.
- Runtime answers from the correct project's knowledge bases only.
- Runtime refuses or escalates when evidence is insufficient.
- Human handover persists and is visible to authorized support staff.
- A user from Organization A cannot access Organization B's project, KB, document, conversation, ticket, or usage.
- Invalid requests return stable error shapes.
- Provider/queue/storage failures do not crash the API process.
- Revoked keys/tokens stop working.
- Public widget never contains a secret key.

### Quality gates

Before marking a phase complete, run the relevant:
- formatter
- linter
- TypeScript typecheck
- unit tests
- integration tests
- E2E tests where applicable
- production build
- dependency/security audit where configured

Do not weaken or delete tests simply to get a green build. Explain flaky tests and create a follow-up issue rather than hiding them.

## 13. Configuration and secrets

- Maintain `.env.example` with names and safe descriptions only.
- Validate environment variables at process startup with Zod.
- Fail fast for missing required production configuration.
- Never commit `.env`, credentials, private keys, or real customer data.
- Separate development, test, staging, and production configuration.
- Use secret management provided by the deployment platform in production.
- Avoid reading secrets in frontend code. Only explicitly public variables may be exposed.
- Rotate any secret that may have been exposed.

Expected configuration categories include:
- `NODE_ENV`, `PORT`, `MONGODB_URI`, `REDIS_URL`
- dashboard session/auth secrets
- Gemini API key and model identifiers
- object-storage endpoint/bucket/access credentials
- allowed dashboard/widget origins
- logging/observability configuration

Do not invent variable names in code without adding them to the validated configuration schema and `.env.example`.

## 14. Security checklist

- [ ] Tenant-scoped authorization on every protected query.
- [ ] RBAC enforced server-side.
- [ ] Password/session/API key handling reviewed.
- [ ] CORS uses explicit allowlists; no wildcard credentialed CORS.
- [ ] CSRF protections applied where cookie auth requires them.
- [ ] Rate limiting and request-size limits enabled.
- [ ] File extension, MIME type, file signature, and size validated.
- [ ] Private originals stored outside public web root.
- [ ] Website crawler blocks localhost, private, link-local, metadata, and reserved IP ranges; re-check after redirects and DNS resolution.
- [ ] External integration requests have allowlists, timeouts, and response-size limits.
- [ ] Webhook signatures use HMAC and timestamp/replay protection.
- [ ] Secrets are redacted from logs and errors.
- [ ] Retrieved documents and tool output treated as untrusted.
- [ ] Vector retrieval is tenant/KB prefiltered.
- [ ] Audit logs exist for sensitive actions.
- [ ] Data retention and deletion behavior is documented.

## 15. Development workflow and code conventions

- TypeScript strict mode; avoid `any`. If unavoidable at an external boundary, isolate it and narrow immediately.
- Prefer explicit return types for public service/provider contracts.
- Use named, domain-specific functions and types.
- Keep functions focused and files reasonably cohesive.
- Avoid hidden side effects in utility functions.
- Use async/await and propagate errors to the correct boundary.
- Do not use empty catch blocks.
- Do not add `console.log` in production paths; use the structured logger.
- Avoid magic strings/numbers; define domain constants or validated configuration.
- Use consistent naming: PascalCase for types/components, camelCase for variables/functions, kebab-case for route/file names where the repository convention supports it.
- Use conventional commits where practical: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.
- Keep PR/task scope small and include tests and documentation updates.

## 16. AI coding-agent operating procedure

For every task, follow this sequence:

### A. Inspect
- Read this file and relevant docs.
- Inspect package scripts, current module structure, and related code.
- Identify the source of truth for types, schemas, and API contracts.
- Check git status and do not overwrite user changes.

### B. Plan
- State the goal and constraints.
- List files/modules expected to change.
- Identify data, API, security, and compatibility impact.
- Identify edge cases and tests.
- For cross-module or high-risk work, present the plan before implementation.

### C. Implement
- Make the smallest complete change.
- Reuse established patterns.
- Add validation, authorization, error handling, and observability at the boundary.
- Add tests with the implementation.
- Keep secrets and tenant data protected.

### D. Verify
- Run focused tests first, then broader checks.
- Inspect the diff for accidental changes, dead code, insecure logging, and missing tests.
- Confirm documentation and environment examples are updated.
- Do not claim a command passed if it was not run.

### E. Report
Summarize:
- What changed.
- Important design decisions.
- Files created/modified.
- Commands/tests run and their actual results.
- Known limitations, risks, and follow-up tasks.

### Prohibited behavior

- Do not blindly rewrite large files or replace working architecture.
- Do not make speculative changes unrelated to the task.
- Do not add mock success responses to production paths.
- Do not swallow exceptions or return success after a failed operation.
- Do not trust client-provided tenant/resource ownership.
- Do not expose secrets or private data.
- Do not run destructive database commands without explicit confirmation and a backup/safe migration plan.
- Do not silently change API contracts or database semantics.
- Do not claim deployment, integration, or tests succeeded without evidence.
- Do not introduce microservices, event sourcing, or complex abstractions without a documented need.

## 17. Documentation hierarchy

Keep this file as the primary agent instruction entry point. Put detailed, changing technical specifications in:

- `docs/SYSTEM_ARCHITECTURE.md`
- `docs/DATABASE_SCHEMA.md`
- `docs/API_DOCUMENTATION.md`
- `docs/SECURITY.md`
- `docs/IMPLEMENTATION_ROADMAP.md`
- `docs/OPERATIONS.md`
- `docs/decisions/ADR-xxxx-title.md`

When a rule is duplicated, this file should link to the canonical document rather than maintaining two conflicting copies.

## 18. Definition of Done

A feature is done only when:

1. Its behavior matches an agreed requirement.
2. Authorization and tenant boundaries are enforced server-side.
3. Inputs and external responses are validated.
4. Failure cases return safe, predictable errors.
5. Logs/metrics provide enough information to diagnose failures without exposing sensitive data.
6. Tests cover normal, invalid, unauthorized, and dependency-failure paths as appropriate.
7. Performance implications and query indexes are considered.
8. Accessibility and responsive states are addressed for UI work.
9. OpenAPI/types/SDK/docs are updated where contracts changed.
10. Lint, typecheck, relevant tests, and build have been run successfully—or the exact blocker is documented.
11. No secrets, debug code, dead code, or unrelated changes remain.
12. The final report accurately states what is and is not complete.

---

## 19. Initial implementation order

Follow the detailed `docs/IMPLEMENTATION_ROADMAP.md`. The high-level sequence is:

1. Repository foundation and engineering tooling.
2. Database, configuration, logging, and API foundation.
3. Authentication, organizations, members, projects, and API keys.
4. Knowledge bases, source management, and asynchronous ingestion.
5. Embeddings, vector search, RAG, and Gemini provider.
6. Agent configuration, tool governance, and human handover rules.
7. Runtime chat APIs, sessions, streaming, and conversation persistence.
8. Dashboard experience and support operations.
9. Widget, SDK, webhooks, and external integrations.
10. Analytics, usage limits, hardening, deployment, and launch readiness.


## Mandatory Git Workflow

Before starting development, read `PER_FILE_COMMIT_WORKFLOW.md`.

Follow it strictly during every development phase.

Every individual file created, modified, deleted, or renamed by Antigravity must receive its own meaningful Git commit, subject to the documented safety exceptions.

Use npm as the package manager.
Do not combine multiple changed files into one commit.

**Do not skip phase gates. A later phase may begin only when its dependencies and acceptance criteria are satisfied.**

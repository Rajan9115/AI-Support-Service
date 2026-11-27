# ResolveAI — System Architecture

## 1. Overview

ResolveAI is a multi-tenant AI customer-support SaaS platform built as a **modular monolith** using an npm workspaces TypeScript monorepo. Businesses integrate ResolveAI into their products via an embeddable JavaScript widget, a versioned REST API (`/v1`), and a typed TypeScript/JavaScript SDK.

## 2. Monorepo Topology

```text
resolveai/
├── apps/
│   ├── dashboard/          # Next.js App Router admin & support-operations dashboard
│   └── api/                # Node.js + Express REST & runtime API (+ BullMQ workers)
├── packages/
│   ├── config/             # Shared TypeScript & ESLint/Prettier configuration
│   ├── shared/             # Shared Zod schemas, domain types, error codes, constants
│   ├── sdk/                # Typed JS/TS SDK (added in Phase 10)
│   └── widget/             # Embeddable chat widget (added in Phase 10)
├── docs/                   # Canonical architecture, schema, API, security, ops docs
└── .github/workflows/      # CI/CD pipelines
```

## 3. Core Components

1. **Dashboard (`apps/dashboard`)**: Next.js App Router application serving organization/project management, knowledge-base management, agent configuration/playground, support inbox, and usage analytics. Uses Server Components for read-heavy views and small Client Components for interactive workflows.
2. **API & Workers (`apps/api`)**: Express HTTP server and BullMQ background worker processes.
   - **Layered request flow**: `Route → Auth/Tenant Context → Zod Validation → Controller → Application Service → Repository/Provider → Response`.
   - **Background workers**: Asynchronous file parsing (PDF, DOCX, TXT), website/sitemap crawling, text chunking, embedding generation, and webhook delivery.
3. **Data Layer**:
   - **MongoDB Atlas + Mongoose**: Primary operational store with explicit `organizationId` tenant isolation.
   - **MongoDB Atlas Vector Search**: Semantic retrieval over `DocumentChunk` embeddings with mandatory `organizationId` and `knowledgeBaseId` prefilters.
   - **Redis + BullMQ**: Job queues, rate-limit backing store, and ephemeral caching where explicitly invalidated.
   - **Private S3-compatible Object Storage**: Stores original uploaded documents outside public web roots.
4. **AI Provider Abstraction**:
   - Domain services interact exclusively with a provider interface (`textGeneration`, `streamGeneration`, `embed`, `normalizeToolCalls`).
   - **Gemini** is the initial adapter; provider-specific SDK types never leak into controllers or services.

## 4. Key Request Flows

### 4.1 Asynchronous Knowledge Ingestion

1. Dashboard uploads a file or submits a URL/FAQ to `apps/api`.
2. API validates metadata, file signature/size, and tenant ownership, stores original files in private object storage, creates a `Document` record (`pending`), and enqueues an idempotent BullMQ job.
3. Worker fetches the source, parses/crawls (with SSRF protection), normalizes text, deduplicates via content hash, chunks text (~700 tokens, 100 overlap baseline), generates embeddings via the AI provider, persists `DocumentChunk` records, and marks the document `completed` (or `failed` with safe actionable status).

### 4.2 Runtime Chat & RAG

1. Widget/SDK exchanges a public project identifier (and origin check) for a short-lived, project-scoped runtime session token.
2. Client sends a message to `POST /v1/runtime/chat` (or `/stream`).
3. API resolves tenant, project, agent, and enabled `ProjectKnowledgeBase` mappings server-side.
4. API embeds the query, runs Atlas Vector Search prefiltered by `organizationId` and enabled `knowledgeBaseId`s, applies relevance thresholds, and builds a bounded context.
5. API calls the AI provider, validates any proposed tool calls against backend allowlists/schemas, persists messages/citations/usage, and returns a grounded response or triggers human handover.

## 5. Multi-Tenancy & Isolation Boundaries

- An `Organization` owns users/members, `Project`s, `KnowledgeBase`s, and usage.
- A `KnowledgeBase` can be explicitly shared across multiple `Project`s within the same `Organization` via `ProjectKnowledgeBase`.
- Tenant and project context are always resolved from server-side authenticated credentials—never trusted from client-supplied IDs.

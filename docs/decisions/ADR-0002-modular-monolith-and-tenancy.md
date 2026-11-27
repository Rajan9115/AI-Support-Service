# ADR-0002: Modular Monolith & Multi-Tenant Isolation Strategy

- **Status**: Accepted
- **Date**: 2026-11-27

## Context

ResolveAI requires multi-tenant isolation across organizations, projects, shared knowledge bases, runtime chat, and background ingestion while keeping operational complexity manageable for the first release.

## Decision

1. Build ResolveAI as a **modular monolith** (`apps/dashboard` + `apps/api` with domain modules and BullMQ workers) rather than microservices.
2. Enforce **shared-database, row-level tenant isolation** in MongoDB with mandatory `organizationId` on all tenant-owned records and server-side credential resolution.
3. Share knowledge bases across projects within the same organization exclusively via `ProjectKnowledgeBase` mappings, and prefilter all Atlas Vector Search queries by `organizationId` and enabled `knowledgeBaseId`s.

## Consequences

- Fast local development, simpler transactions/deployments, and clear module boundaries.
- Tenant isolation relies on strict repository/query discipline and mandatory cross-tenant negative tests.

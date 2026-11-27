# ResolveAI — API Documentation

## 1. Conventions

- **Base Path**: `/v1`
- **Validation**: All path params, query params, headers, and JSON bodies are validated with Zod.
- **Correlation**: Every response includes `X-Request-Id` header and `requestId` in error payloads.
- **Pagination**: Cursor-based pagination for timelines (`conversations`, `messages`, `audit-logs`) and offset/cursor pagination for bounded lists.

## 2. Standard Response Envelopes

### Success
```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

### Error
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request is invalid.",
    "details": [],
    "requestId": "req_01J..."
  }
}
```

### Standard Error Codes
`VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `QUOTA_EXCEEDED`, `DEPENDENCY_UNAVAILABLE`, `AI_PROVIDER_ERROR`, `INGESTION_FAILED`, `INTERNAL_ERROR`.

## 3. Endpoint Domains

### Health & Readiness (Phase 2)
- `GET /health` — Process liveness check (no external dependencies).
- `GET /ready` — Dependency readiness check (MongoDB, Redis). Returns `503` if any required dependency is unavailable.

### Authentication (Phase 3)
- `POST /v1/auth/register`
- `POST /v1/auth/login`
- `POST /v1/auth/refresh`
- `POST /v1/auth/logout`
- `GET /v1/auth/me`

### Organizations & Projects (Phase 3)
- `GET/PATCH /v1/organizations/current`
- `GET/POST /v1/projects`
- `GET/PATCH/DELETE /v1/projects/:projectId`
- `POST /v1/projects/:projectId/api-keys`
- `DELETE /v1/projects/:projectId/api-keys/:keyId`

### Knowledge Bases & Ingestion (Phases 4–5)
- `POST/GET /v1/knowledge-bases`
- `POST/GET /v1/knowledge-bases/:id/documents`
- `GET /v1/documents/:id/status`
- `DELETE /v1/documents/:id`
- `POST /v1/knowledge-bases/:id/websites`
- `POST /v1/knowledge-bases/:id/faqs`
- `POST /v1/knowledge-bases/:id/sync`
- `POST/DELETE /v1/projects/:projectId/knowledge-bases/:knowledgeBaseId`

### Agent & Tools (Phase 7)
- `GET/POST/PATCH /v1/projects/:projectId/agent`
- `POST /v1/projects/:projectId/agent/test`
- `GET/POST /v1/projects/:projectId/agent/prompts`

### Runtime Chat (Phase 8)
- `POST /v1/runtime/sessions` — Exchange `publicId` + allowed origin for short-lived runtime token.
- `POST /v1/runtime/chat`
- `POST /v1/runtime/chat/stream` (SSE)
- `GET /v1/runtime/conversations/:conversationId`
- `POST /v1/runtime/conversations/:conversationId/feedback`
- `POST /v1/runtime/conversations/:conversationId/end`

### Support Operations (Phase 9)
- `GET /v1/tickets`
- `GET/PATCH /v1/tickets/:ticketId`
- `POST /v1/tickets/:ticketId/assign`
- `POST /v1/conversations/:conversationId/handover`
- `POST /v1/conversations/:conversationId/messages`
- `POST /v1/conversations/:conversationId/resolve`

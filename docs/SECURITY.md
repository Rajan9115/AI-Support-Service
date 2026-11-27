# ResolveAI — Security Architecture & Controls

## 1. Tenant Isolation & RBAC

- **Server-Side Resolution**: `organizationId` and `projectId` are always resolved from authenticated session cookies, server-side API keys, or short-lived runtime tokens. Client-supplied tenant IDs are never trusted for authorization.
- **Query Scoping**: Every tenant-owned database query and Atlas Vector Search query must include `organizationId` (and `knowledgeBaseId` / `projectId` where applicable) in the query filter itself.
- **RBAC**: Roles (`owner`, `admin`, `support_agent`) are enforced on every protected endpoint on the server.
- **Consistent Not-Found Policy**: Cross-tenant resource lookups return `404 NOT_FOUND` or `403 FORBIDDEN` without leaking existence.

## 2. Authentication & Credentials

- **Dashboard Sessions**: HttpOnly, Secure, SameSite cookies; passwords hashed with Argon2id.
- **Project API Keys**: High-entropy random tokens, shown once upon creation, stored only as cryptographic hashes (`keyHash`), revocable, and rotatable.
- **Runtime Widget Tokens**: Short-lived, project-scoped JWT/opaque tokens issued after verifying `publicId` and request `Origin`. Never embed secret API keys in widget JS or frontend env vars.

## 3. Input, Upload & Crawler Safety

- **CORS**: Explicit origin allowlists; never wildcard credentialed CORS.
- **Uploads**: Validate file extension, MIME type, magic-byte file signature, and size limits. Store originals in private S3-compatible object storage with short-lived signed URLs.
- **Website Crawler SSRF Protection**:
  - Block `localhost`, loopback, private (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), link-local (`169.254.0.0/16`), cloud metadata IPs, and reserved ranges.
  - Re-validate resolved DNS IPs before connecting and on every HTTP redirect.
  - Enforce strict page count, crawl depth, response byte size, and timeout caps.

## 4. AI, RAG & Tool Governance

- **Untrusted Context**: Retrieved knowledge chunks and tool outputs are treated as untrusted data, never system instructions.
- **Tool Execution**: The LLM only proposes tool calls; the backend verifies tool registration, enablement, Zod argument schemas, tenant/customer authorization, timeouts, and approval requirements.
- **No Arbitrary Execution**: Never execute shell commands, arbitrary code, or model-chosen URLs.

## 5. Webhooks & Logging

- **Webhooks**: Signed with HMAC-SHA256, timestamp headers, and replay protection.
- **Log Redaction**: Never log passwords, API keys, session tokens, or raw sensitive customer payloads.

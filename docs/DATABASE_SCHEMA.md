# ResolveAI — Database Schema & Data Model

## 1. Conventions

- **Database**: MongoDB Atlas via Mongoose.
- **Tenant Isolation**: Every tenant-owned collection includes `organizationId` (`ObjectId`, indexed). Project-owned records also include `projectId` where appropriate.
- **Timestamps**: All collections include `createdAt` and `updatedAt` managed by Mongoose.
- **No Unbounded Arrays**: Messages and document chunks are stored as separate collections, not embedded arrays.
- **Soft/Lifecycle States**: Explicit string literal unions/enums for status fields.

## 2. Core Identity & Tenancy

### `User`
- `_id`, `email` (unique, lowercase), `passwordHash` (Argon2id), `name`, `emailVerifiedAt`, `status` (`active | suspended`), `createdAt`, `updatedAt`.

### `Organization`
- `_id`, `name`, `slug` (unique), `plan` (`free | starter | pro | enterprise`), `status` (`active | suspended`), `createdAt`, `updatedAt`.

### `OrganizationMember`
- `_id`, `organizationId`, `userId`, `role` (`owner | admin | support_agent`), `status` (`invited | active | revoked`), `createdAt`, `updatedAt`.
- **Indexes**: Unique `{ organizationId, userId }`.

### `Project`
- `_id`, `organizationId`, `name`, `slug`, `publicId` (unique public identifier for widget init), `allowedOrigins` (`string[]`), `status` (`active | archived`), `createdAt`, `updatedAt`.
- **Indexes**: Unique `{ organizationId, slug }`, unique `{ publicId }`.

### `ApiKey`
- `_id`, `organizationId`, `projectId`, `name`, `keyPrefix` (for display), `keyHash` (unique SHA-256/HMAC hash), `scopes` (`string[]`), `lastUsedAt`, `expiresAt`, `revokedAt`, `createdByUserId`, `createdAt`, `updatedAt`.
- **Indexes**: Unique `{ keyHash }`, `{ organizationId, projectId, revokedAt }`.

### `AuditLog`
- `_id`, `organizationId`, `projectId?`, `actorType` (`user | api_key | system`), `actorId`, `action`, `resourceType`, `resourceId`, `metadata` (redacted), `requestId`, `createdAt`.
- **Indexes**: `{ organizationId, createdAt: -1 }`.

## 3. Knowledge & Ingestion

### `KnowledgeBase`
- `_id`, `organizationId`, `name`, `description`, `embeddingModel`, `embeddingDimensions`, `indexVersion`, `status` (`active | archived`), `createdAt`, `updatedAt`.
- **Indexes**: `{ organizationId, status }`.

### `ProjectKnowledgeBase`
- `_id`, `organizationId`, `projectId`, `knowledgeBaseId`, `enabled` (`boolean`), `createdAt`, `updatedAt`.
- **Indexes**: Unique `{ projectId, knowledgeBaseId }`, `{ organizationId, projectId, enabled }`.

### `Document`
- `_id`, `organizationId`, `knowledgeBaseId`, `sourceType` (`file | website | faq | api`), `title`, `sourceUri` (private object key or URL), `mimeType`, `sizeBytes`, `contentHash`, `version` (`number`), `status` (`pending | processing | completed | failed | deleted`), `errorCode?`, `errorMessage?`, `chunkCount`, `createdAt`, `updatedAt`.
- **Indexes**: `{ organizationId, knowledgeBaseId, status, updatedAt: -1 }`.

### `DocumentChunk`
- `_id`, `organizationId`, `knowledgeBaseId`, `documentId`, `version` (`number`), `chunkIndex` (`number`), `content` (`string`), `tokenCount` (`number`), `embedding` (`number[]`), `embeddingModel`, `metadata` (`{ page?, section?, url?, title? }`), `createdAt`, `updatedAt`.
- **Indexes**:
  - `{ organizationId, knowledgeBaseId, documentId, version }`
  - **Atlas Vector Search Index**: `embedding` vector field + prefilter fields `organizationId`, `knowledgeBaseId`, `version`.

## 4. Agent, Runtime & Support

### `Agent`
- `_id`, `organizationId`, `projectId` (unique per project or active config), `name`, `activePromptVersionId`, `model`, `temperature`, `maxTokens`, `ragTopK`, `ragMinScore`, `tone`, `language`, `handoverRules`, `createdAt`, `updatedAt`.

### `PromptVersion`
- `_id`, `organizationId`, `projectId`, `agentId`, `version` (`number`), `systemPrompt`, `createdByUserId`, `createdAt`.

### `ToolDefinition` & `ExternalIntegration`
- Scoped by `organizationId` and `projectId`, storing allowlisted endpoints, encrypted/vaulted secret references, JSON/Zod parameter schemas, timeout, and `requiresApproval` flag.

### `Conversation`
- `_id`, `organizationId`, `projectId`, `endUserId?`, `channel` (`widget | api | sdk | playground`), `status` (`ai_active | handover_requested | human_active | resolved | closed`), `handoverReason?`, `assignedUserId?`, `lastMessageAt`, `createdAt`, `updatedAt`.
- **Indexes**: `{ organizationId, projectId, status, updatedAt: -1 }`.

### `Message`
- `_id`, `organizationId`, `projectId`, `conversationId`, `senderType` (`customer | ai | human_agent | system`), `senderId?`, `content`, `citations` (`Array<{ documentId, chunkId, title, snippet, score }>`), `aiMetadata` (`{ provider, model, promptVersion, latencyMs, inputTokens, outputTokens }`), `idempotencyKey?`, `createdAt`.
- **Indexes**: `{ conversationId, createdAt: 1 }`, sparse unique `{ conversationId, idempotencyKey }`.

### `Ticket`
- `_id`, `organizationId`, `projectId`, `conversationId`, `title`, `status` (`open | in_progress | resolved | closed`), `priority` (`low | medium | high | urgent`), `assignedUserId?`, `createdAt`, `updatedAt`.
- **Indexes**: `{ organizationId, projectId, status, priority, updatedAt: -1 }`.

### `Webhook` & `UsageRecord`
- `Webhook`: `{ organizationId, projectId, url, events, secretHash/encryptedSecret, enabled, createdAt, updatedAt }`.
- `UsageRecord`: `{ organizationId, projectId, metricType, quantity, idempotencyKey, createdAt }` indexed by `{ organizationId, createdAt: -1 }`.

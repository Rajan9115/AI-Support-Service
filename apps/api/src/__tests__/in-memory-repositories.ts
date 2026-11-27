import { randomUUID } from "node:crypto";
import type { CoreRepositories } from "../container.js";
import type {
  ApiKeyRecord,
  AuditLogInput,
  MemberRecord,
  OrganizationRecord,
  ProjectRecord,
  SessionRecord,
  UserRecord,
} from "../repositories/types.js";

export function createInMemoryRepositories(): CoreRepositories & {
  auditLogsList: AuditLogInput[];
} {
  const users: UserRecord[] = [];
  const sessions: SessionRecord[] = [];
  const organizations: OrganizationRecord[] = [];
  const members: MemberRecord[] = [];
  const projects: ProjectRecord[] = [];
  const apiKeys: ApiKeyRecord[] = [];
  const auditLogsList: AuditLogInput[] = [];

  return {
    auditLogsList,
    users: {
      async findByEmail(email) {
        return users.find((u) => u.email === email.toLowerCase()) ?? null;
      },
      async findById(id) {
        return users.find((u) => u.id === id) ?? null;
      },
      async create(input) {
        const now = new Date();
        const record: UserRecord = {
          id: randomUUID(),
          email: input.email.toLowerCase(),
          passwordHash: input.passwordHash,
          name: input.name,
          status: "active",
          createdAt: now,
          updatedAt: now,
        };
        users.push(record);
        return record;
      },
    },
    sessions: {
      async create(input) {
        const record: SessionRecord = {
          id: randomUUID(),
          userId: input.userId,
          tokenHash: input.tokenHash,
          expiresAt: input.expiresAt,
          createdAt: new Date(),
        };
        sessions.push(record);
        return record;
      },
      async findById(id) {
        return sessions.find((s) => s.id === id) ?? null;
      },
      async findByTokenHash(tokenHash) {
        return sessions.find((s) => s.tokenHash === tokenHash) ?? null;
      },
      async revokeById(id) {
        const found = sessions.find((s) => s.id === id);
        if (found) found.revokedAt = new Date();
      },
      async rotateToken(id, newTokenHash, newExpiresAt) {
        const found = sessions.find((s) => s.id === id);
        if (found) {
          found.tokenHash = newTokenHash;
          found.expiresAt = newExpiresAt;
        }
      },
    },
    organizations: {
      async create(input) {
        const now = new Date();
        const record: OrganizationRecord = {
          id: randomUUID(),
          name: input.name,
          slug: input.slug.toLowerCase(),
          plan: "free",
          status: "active",
          createdAt: now,
          updatedAt: now,
        };
        organizations.push(record);
        return record;
      },
      async findById(id) {
        return organizations.find((o) => o.id === id) ?? null;
      },
      async findBySlug(slug) {
        return organizations.find((o) => o.slug === slug.toLowerCase()) ?? null;
      },
      async updateById(id, input) {
        const found = organizations.find((o) => o.id === id);
        if (!found) return null;
        if (input.name !== undefined) found.name = input.name;
        found.updatedAt = new Date();
        return found;
      },
      async addMember(input) {
        const now = new Date();
        const record: MemberRecord = {
          id: randomUUID(),
          organizationId: input.organizationId,
          userId: input.userId,
          role: input.role,
          status: input.status,
          createdAt: now,
          updatedAt: now,
        };
        members.push(record);
        return record;
      },
      async findMember(organizationId, userId) {
        return (
          members.find((m) => m.organizationId === organizationId && m.userId === userId) ?? null
        );
      },
      async listMembersByUser(userId) {
        return members.filter((m) => m.userId === userId && m.status === "active");
      },
      async listMembersByOrganization(organizationId) {
        return members.filter((m) => m.organizationId === organizationId);
      },
      async updateMemberRole(organizationId, memberId, role) {
        const found = members.find((m) => m.id === memberId && m.organizationId === organizationId);
        if (!found) return null;
        found.role = role;
        found.updatedAt = new Date();
        return found;
      },
      async revokeMember(organizationId, memberId) {
        const found = members.find((m) => m.id === memberId && m.organizationId === organizationId);
        if (!found) return null;
        found.status = "revoked";
        found.updatedAt = new Date();
        return found;
      },
    },
    projects: {
      async create(input) {
        const now = new Date();
        const record: ProjectRecord = {
          id: randomUUID(),
          organizationId: input.organizationId,
          name: input.name,
          slug: input.slug.toLowerCase(),
          publicId: input.publicId,
          allowedOrigins: input.allowedOrigins,
          status: "active",
          createdAt: now,
          updatedAt: now,
        };
        projects.push(record);
        return record;
      },
      async findByIdInOrg(organizationId, projectId) {
        return (
          projects.find((p) => p.id === projectId && p.organizationId === organizationId) ?? null
        );
      },
      async findBySlugInOrg(organizationId, slug) {
        return (
          projects.find(
            (p) => p.organizationId === organizationId && p.slug === slug.toLowerCase(),
          ) ?? null
        );
      },
      async listByOrg(organizationId) {
        return projects.filter((p) => p.organizationId === organizationId);
      },
      async updateByIdInOrg(organizationId, projectId, input) {
        const found = projects.find(
          (p) => p.id === projectId && p.organizationId === organizationId,
        );
        if (!found) return null;
        if (input.name !== undefined) found.name = input.name;
        if (input.allowedOrigins !== undefined) found.allowedOrigins = input.allowedOrigins;
        if (input.status !== undefined) found.status = input.status;
        found.updatedAt = new Date();
        return found;
      },
      async deleteByIdInOrg(organizationId, projectId) {
        const idx = projects.findIndex(
          (p) => p.id === projectId && p.organizationId === organizationId,
        );
        if (idx === -1) return false;
        projects.splice(idx, 1);
        return true;
      },
    },
    apiKeys: {
      async create(input) {
        const now = new Date();
        const record: ApiKeyRecord = {
          id: randomUUID(),
          organizationId: input.organizationId,
          projectId: input.projectId,
          name: input.name,
          keyPrefix: input.keyPrefix,
          keyHash: input.keyHash,
          scopes: input.scopes,
          expiresAt: input.expiresAt,
          createdByUserId: input.createdByUserId,
          createdAt: now,
          updatedAt: now,
        };
        apiKeys.push(record);
        return record;
      },
      async listByProjectInOrg(organizationId, projectId) {
        return apiKeys.filter(
          (k) => k.organizationId === organizationId && k.projectId === projectId,
        );
      },
      async findByIdInProject(organizationId, projectId, keyId) {
        return (
          apiKeys.find(
            (k) =>
              k.id === keyId && k.organizationId === organizationId && k.projectId === projectId,
          ) ?? null
        );
      },
      async findActiveByKeyHash(keyHash) {
        return apiKeys.find((k) => k.keyHash === keyHash && !k.revokedAt) ?? null;
      },
      async revokeByIdInProject(organizationId, projectId, keyId) {
        const found = apiKeys.find(
          (k) =>
            k.id === keyId &&
            k.organizationId === organizationId &&
            k.projectId === projectId &&
            !k.revokedAt,
        );
        if (!found) return null;
        found.revokedAt = new Date();
        found.updatedAt = new Date();
        return found;
      },
    },
    auditLogs: {
      async record(input) {
        auditLogsList.push(input);
      },
    },
  };
}

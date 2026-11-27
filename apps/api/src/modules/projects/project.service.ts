import { conflictError, notFoundError } from "../../errors/app-error.js";
import type { ProjectStatus } from "../../models/project.model.js";
import type {
  ApiKeyRecord,
  ApiKeyRepository,
  AuditLogRepository,
  ProjectRecord,
  ProjectRepository,
} from "../../repositories/types.js";
import {
  generateProjectApiKey,
  generatePublicProjectId,
  sha256Hex,
} from "../../security/crypto.js";

export interface PublicApiKeyView {
  id: string;
  organizationId: string;
  projectId: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt?: Date;
  expiresAt?: Date;
  revokedAt?: Date;
  createdAt: Date;
}

function toPublicApiKeyView(record: ApiKeyRecord): PublicApiKeyView {
  return {
    id: record.id,
    organizationId: record.organizationId,
    projectId: record.projectId,
    name: record.name,
    keyPrefix: record.keyPrefix,
    scopes: record.scopes,
    lastUsedAt: record.lastUsedAt,
    expiresAt: record.expiresAt,
    revokedAt: record.revokedAt,
    createdAt: record.createdAt,
  };
}

export interface ProjectServiceDeps {
  projects: ProjectRepository;
  apiKeys: ApiKeyRepository;
  auditLogs: AuditLogRepository;
}

export class ProjectService {
  constructor(private readonly deps: ProjectServiceDeps) {}

  async createProject(
    organizationId: string,
    actorId: string,
    input: { name: string; slug: string; allowedOrigins?: string[] },
    requestId: string,
  ): Promise<ProjectRecord> {
    const existing = await this.deps.projects.findBySlugInOrg(organizationId, input.slug);
    if (existing) {
      throw conflictError("A project with this slug already exists in the organization.");
    }

    const project = await this.deps.projects.create({
      organizationId,
      name: input.name,
      slug: input.slug,
      publicId: generatePublicProjectId(),
      allowedOrigins: input.allowedOrigins ?? [],
    });

    await this.deps.auditLogs.record({
      organizationId,
      projectId: project.id,
      actorType: "user",
      actorId,
      action: "project.created",
      resourceType: "project",
      resourceId: project.id,
      metadata: { slug: project.slug },
      requestId,
    });

    return project;
  }

  async listProjects(organizationId: string): Promise<ProjectRecord[]> {
    return this.deps.projects.listByOrg(organizationId);
  }

  async getProject(organizationId: string, projectId: string): Promise<ProjectRecord> {
    const project = await this.deps.projects.findByIdInOrg(organizationId, projectId);
    if (!project) {
      throw notFoundError("Project not found.");
    }
    return project;
  }

  async updateProject(
    organizationId: string,
    projectId: string,
    actorId: string,
    input: { name?: string; allowedOrigins?: string[]; status?: ProjectStatus },
    requestId: string,
  ): Promise<ProjectRecord> {
    const updated = await this.deps.projects.updateByIdInOrg(organizationId, projectId, input);
    if (!updated) {
      throw notFoundError("Project not found.");
    }

    await this.deps.auditLogs.record({
      organizationId,
      projectId: updated.id,
      actorType: "user",
      actorId,
      action: "project.updated",
      resourceType: "project",
      resourceId: updated.id,
      requestId,
    });

    return updated;
  }

  async deleteProject(
    organizationId: string,
    projectId: string,
    actorId: string,
    requestId: string,
  ): Promise<void> {
    const deleted = await this.deps.projects.deleteByIdInOrg(organizationId, projectId);
    if (!deleted) {
      throw notFoundError("Project not found.");
    }

    await this.deps.auditLogs.record({
      organizationId,
      projectId,
      actorType: "user",
      actorId,
      action: "project.deleted",
      resourceType: "project",
      resourceId: projectId,
      requestId,
    });
  }

  async createApiKey(
    organizationId: string,
    projectId: string,
    actorId: string,
    input: { name: string; scopes?: string[] },
    requestId: string,
  ): Promise<{ apiKey: PublicApiKeyView; plaintextKey: string }> {
    const project = await this.deps.projects.findByIdInOrg(organizationId, projectId);
    if (!project) {
      throw notFoundError("Project not found.");
    }

    const generated = generateProjectApiKey();
    const created = await this.deps.apiKeys.create({
      organizationId,
      projectId,
      name: input.name,
      keyPrefix: generated.keyPrefix,
      keyHash: generated.keyHash,
      scopes: input.scopes ?? ["runtime:read", "runtime:write"],
      createdByUserId: actorId,
    });

    await this.deps.auditLogs.record({
      organizationId,
      projectId,
      actorType: "user",
      actorId,
      action: "api_key.created",
      resourceType: "api_key",
      resourceId: created.id,
      metadata: { keyPrefix: created.keyPrefix },
      requestId,
    });

    return {
      apiKey: toPublicApiKeyView(created),
      plaintextKey: generated.plaintext,
    };
  }

  async listApiKeys(organizationId: string, projectId: string): Promise<PublicApiKeyView[]> {
    const project = await this.deps.projects.findByIdInOrg(organizationId, projectId);
    if (!project) {
      throw notFoundError("Project not found.");
    }
    const keys = await this.deps.apiKeys.listByProjectInOrg(organizationId, projectId);
    return keys.map(toPublicApiKeyView);
  }

  async revokeApiKey(
    organizationId: string,
    projectId: string,
    keyId: string,
    actorId: string,
    requestId: string,
  ): Promise<PublicApiKeyView> {
    const revoked = await this.deps.apiKeys.revokeByIdInProject(organizationId, projectId, keyId);
    if (!revoked) {
      throw notFoundError("API key not found or already revoked.");
    }

    await this.deps.auditLogs.record({
      organizationId,
      projectId,
      actorType: "user",
      actorId,
      action: "api_key.revoked",
      resourceType: "api_key",
      resourceId: revoked.id,
      metadata: { keyPrefix: revoked.keyPrefix },
      requestId,
    });

    return toPublicApiKeyView(revoked);
  }

  async verifySecretApiKey(plaintextKey: string): Promise<ApiKeyRecord | null> {
    const keyHash = sha256Hex(plaintextKey);
    const record = await this.deps.apiKeys.findActiveByKeyHash(keyHash);
    if (!record || record.revokedAt) {
      return null;
    }
    if (record.expiresAt && record.expiresAt <= new Date()) {
      return null;
    }
    return record;
  }
}

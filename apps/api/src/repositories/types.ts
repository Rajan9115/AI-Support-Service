import type { AuditActorType } from "../models/audit-log.model.js";
import type { MemberRole, MemberStatus } from "../models/organization-member.model.js";
import type { OrganizationPlan, OrganizationStatus } from "../models/organization.model.js";
import type { ProjectStatus } from "../models/project.model.js";
import type { UserStatus } from "../models/user.model.js";

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date;
  createdAt: Date;
}

export interface OrganizationRecord {
  id: string;
  name: string;
  slug: string;
  plan: OrganizationPlan;
  status: OrganizationStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemberRecord {
  id: string;
  organizationId: string;
  userId: string;
  role: MemberRole;
  status: MemberStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectRecord {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  publicId: string;
  allowedOrigins: string[];
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiKeyRecord {
  id: string;
  organizationId: string;
  projectId: string;
  name: string;
  keyPrefix: string;
  keyHash: string;
  scopes: string[];
  lastUsedAt?: Date;
  expiresAt?: Date;
  revokedAt?: Date;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLogInput {
  organizationId: string;
  projectId?: string;
  actorType: AuditActorType;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
  requestId: string;
}

export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  create(input: { email: string; passwordHash: string; name: string }): Promise<UserRecord>;
}

export interface SessionRepository {
  create(input: { userId: string; tokenHash: string; expiresAt: Date }): Promise<SessionRecord>;
  findById(id: string): Promise<SessionRecord | null>;
  findByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  revokeById(id: string): Promise<void>;
  rotateToken(id: string, newTokenHash: string, newExpiresAt: Date): Promise<void>;
}

export interface OrganizationRepository {
  create(input: { name: string; slug: string }): Promise<OrganizationRecord>;
  findById(id: string): Promise<OrganizationRecord | null>;
  findBySlug(slug: string): Promise<OrganizationRecord | null>;
  updateById(id: string, input: { name?: string }): Promise<OrganizationRecord | null>;
  addMember(input: {
    organizationId: string;
    userId: string;
    role: MemberRole;
    status: MemberStatus;
  }): Promise<MemberRecord>;
  findMember(organizationId: string, userId: string): Promise<MemberRecord | null>;
  listMembersByUser(userId: string): Promise<MemberRecord[]>;
  listMembersByOrganization(organizationId: string): Promise<MemberRecord[]>;
  updateMemberRole(
    organizationId: string,
    memberId: string,
    role: MemberRole,
  ): Promise<MemberRecord | null>;
  revokeMember(organizationId: string, memberId: string): Promise<MemberRecord | null>;
}

export interface ProjectRepository {
  create(input: {
    organizationId: string;
    name: string;
    slug: string;
    publicId: string;
    allowedOrigins: string[];
  }): Promise<ProjectRecord>;
  findByIdInOrg(organizationId: string, projectId: string): Promise<ProjectRecord | null>;
  findBySlugInOrg(organizationId: string, slug: string): Promise<ProjectRecord | null>;
  listByOrg(organizationId: string): Promise<ProjectRecord[]>;
  updateByIdInOrg(
    organizationId: string,
    projectId: string,
    input: { name?: string; allowedOrigins?: string[]; status?: ProjectStatus },
  ): Promise<ProjectRecord | null>;
  deleteByIdInOrg(organizationId: string, projectId: string): Promise<boolean>;
}

export interface ApiKeyRepository {
  create(input: {
    organizationId: string;
    projectId: string;
    name: string;
    keyPrefix: string;
    keyHash: string;
    scopes: string[];
    expiresAt?: Date;
    createdByUserId: string;
  }): Promise<ApiKeyRecord>;
  listByProjectInOrg(organizationId: string, projectId: string): Promise<ApiKeyRecord[]>;
  findByIdInProject(
    organizationId: string,
    projectId: string,
    keyId: string,
  ): Promise<ApiKeyRecord | null>;
  findActiveByKeyHash(keyHash: string): Promise<ApiKeyRecord | null>;
  revokeByIdInProject(
    organizationId: string,
    projectId: string,
    keyId: string,
  ): Promise<ApiKeyRecord | null>;
}

export interface AuditLogRepository {
  record(input: AuditLogInput): Promise<void>;
}

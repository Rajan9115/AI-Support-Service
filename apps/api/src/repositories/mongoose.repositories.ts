import { ApiKeyModel, type ApiKeyDocument } from "../models/api-key.model.js";
import { AuditLogModel } from "../models/audit-log.model.js";
import {
  OrganizationMemberModel,
  type OrganizationMemberDocument,
} from "../models/organization-member.model.js";
import { OrganizationModel, type OrganizationDocument } from "../models/organization.model.js";
import { ProjectModel, type ProjectDocument } from "../models/project.model.js";
import { SessionModel, type SessionDocument } from "../models/session.model.js";
import { UserModel, type UserDocument } from "../models/user.model.js";
import type {
  ApiKeyRecord,
  ApiKeyRepository,
  AuditLogInput,
  AuditLogRepository,
  MemberRecord,
  OrganizationRecord,
  OrganizationRepository,
  ProjectRecord,
  ProjectRepository,
  SessionRecord,
  SessionRepository,
  UserRecord,
  UserRepository,
} from "./types.js";

function toUserRecord(doc: UserDocument): UserRecord {
  return {
    id: doc._id.toString(),
    email: doc.email,
    passwordHash: doc.passwordHash,
    name: doc.name,
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function toSessionRecord(doc: SessionDocument): SessionRecord {
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    tokenHash: doc.tokenHash,
    expiresAt: doc.expiresAt,
    revokedAt: doc.revokedAt,
    createdAt: doc.createdAt,
  };
}

function toOrganizationRecord(doc: OrganizationDocument): OrganizationRecord {
  return {
    id: doc._id.toString(),
    name: doc.name,
    slug: doc.slug,
    plan: doc.plan,
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function toMemberRecord(doc: OrganizationMemberDocument): MemberRecord {
  return {
    id: doc._id.toString(),
    organizationId: doc.organizationId.toString(),
    userId: doc.userId.toString(),
    role: doc.role,
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function toProjectRecord(doc: ProjectDocument): ProjectRecord {
  return {
    id: doc._id.toString(),
    organizationId: doc.organizationId.toString(),
    name: doc.name,
    slug: doc.slug,
    publicId: doc.publicId,
    allowedOrigins: doc.allowedOrigins,
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function toApiKeyRecord(doc: ApiKeyDocument): ApiKeyRecord {
  return {
    id: doc._id.toString(),
    organizationId: doc.organizationId.toString(),
    projectId: doc.projectId.toString(),
    name: doc.name,
    keyPrefix: doc.keyPrefix,
    keyHash: doc.keyHash,
    scopes: doc.scopes,
    lastUsedAt: doc.lastUsedAt,
    expiresAt: doc.expiresAt,
    revokedAt: doc.revokedAt,
    createdByUserId: doc.createdByUserId.toString(),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export class MongooseUserRepository implements UserRepository {
  async findByEmail(email: string): Promise<UserRecord | null> {
    const doc = await UserModel.findOne({ email: email.toLowerCase() });
    return doc ? toUserRecord(doc) : null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const doc = await UserModel.findById(id);
    return doc ? toUserRecord(doc) : null;
  }

  async create(input: { email: string; passwordHash: string; name: string }): Promise<UserRecord> {
    const doc = await UserModel.create({
      email: input.email.toLowerCase(),
      passwordHash: input.passwordHash,
      name: input.name,
    });
    return toUserRecord(doc);
  }
}

export class MongooseSessionRepository implements SessionRepository {
  async create(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<SessionRecord> {
    const doc = await SessionModel.create(input);
    return toSessionRecord(doc);
  }

  async findById(id: string): Promise<SessionRecord | null> {
    const doc = await SessionModel.findById(id);
    return doc ? toSessionRecord(doc) : null;
  }

  async findByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    const doc = await SessionModel.findOne({ tokenHash });
    return doc ? toSessionRecord(doc) : null;
  }

  async revokeById(id: string): Promise<void> {
    await SessionModel.updateOne({ _id: id }, { $set: { revokedAt: new Date() } });
  }

  async rotateToken(id: string, newTokenHash: string, newExpiresAt: Date): Promise<void> {
    await SessionModel.updateOne(
      { _id: id },
      { $set: { tokenHash: newTokenHash, expiresAt: newExpiresAt } },
    );
  }
}

export class MongooseOrganizationRepository implements OrganizationRepository {
  async create(input: { name: string; slug: string }): Promise<OrganizationRecord> {
    const doc = await OrganizationModel.create({
      name: input.name,
      slug: input.slug.toLowerCase(),
    });
    return toOrganizationRecord(doc);
  }

  async findById(id: string): Promise<OrganizationRecord | null> {
    const doc = await OrganizationModel.findById(id);
    return doc ? toOrganizationRecord(doc) : null;
  }

  async findBySlug(slug: string): Promise<OrganizationRecord | null> {
    const doc = await OrganizationModel.findOne({ slug: slug.toLowerCase() });
    return doc ? toOrganizationRecord(doc) : null;
  }

  async updateById(id: string, input: { name?: string }): Promise<OrganizationRecord | null> {
    const doc = await OrganizationModel.findByIdAndUpdate(
      id,
      { $set: input },
      { new: true, runValidators: true },
    );
    return doc ? toOrganizationRecord(doc) : null;
  }

  async addMember(input: {
    organizationId: string;
    userId: string;
    role: MemberRecord["role"];
    status: MemberRecord["status"];
  }): Promise<MemberRecord> {
    const doc = await OrganizationMemberModel.create(input);
    return toMemberRecord(doc);
  }

  async findMember(organizationId: string, userId: string): Promise<MemberRecord | null> {
    const doc = await OrganizationMemberModel.findOne({ organizationId, userId });
    return doc ? toMemberRecord(doc) : null;
  }

  async listMembersByUser(userId: string): Promise<MemberRecord[]> {
    const docs = await OrganizationMemberModel.find({ userId, status: "active" });
    return docs.map(toMemberRecord);
  }

  async listMembersByOrganization(organizationId: string): Promise<MemberRecord[]> {
    const docs = await OrganizationMemberModel.find({ organizationId });
    return docs.map(toMemberRecord);
  }

  async updateMemberRole(
    organizationId: string,
    memberId: string,
    role: MemberRecord["role"],
  ): Promise<MemberRecord | null> {
    const doc = await OrganizationMemberModel.findOneAndUpdate(
      { _id: memberId, organizationId },
      { $set: { role } },
      { new: true },
    );
    return doc ? toMemberRecord(doc) : null;
  }

  async revokeMember(organizationId: string, memberId: string): Promise<MemberRecord | null> {
    const doc = await OrganizationMemberModel.findOneAndUpdate(
      { _id: memberId, organizationId },
      { $set: { status: "revoked" } },
      { new: true },
    );
    return doc ? toMemberRecord(doc) : null;
  }
}

export class MongooseProjectRepository implements ProjectRepository {
  async create(input: {
    organizationId: string;
    name: string;
    slug: string;
    publicId: string;
    allowedOrigins: string[];
  }): Promise<ProjectRecord> {
    const doc = await ProjectModel.create({
      ...input,
      slug: input.slug.toLowerCase(),
    });
    return toProjectRecord(doc);
  }

  async findByIdInOrg(organizationId: string, projectId: string): Promise<ProjectRecord | null> {
    const doc = await ProjectModel.findOne({ _id: projectId, organizationId });
    return doc ? toProjectRecord(doc) : null;
  }

  async findBySlugInOrg(organizationId: string, slug: string): Promise<ProjectRecord | null> {
    const doc = await ProjectModel.findOne({ organizationId, slug: slug.toLowerCase() });
    return doc ? toProjectRecord(doc) : null;
  }

  async listByOrg(organizationId: string): Promise<ProjectRecord[]> {
    const docs = await ProjectModel.find({ organizationId }).sort({ createdAt: -1 });
    return docs.map(toProjectRecord);
  }

  async updateByIdInOrg(
    organizationId: string,
    projectId: string,
    input: { name?: string; allowedOrigins?: string[]; status?: ProjectRecord["status"] },
  ): Promise<ProjectRecord | null> {
    const doc = await ProjectModel.findOneAndUpdate(
      { _id: projectId, organizationId },
      { $set: input },
      { new: true, runValidators: true },
    );
    return doc ? toProjectRecord(doc) : null;
  }

  async deleteByIdInOrg(organizationId: string, projectId: string): Promise<boolean> {
    const res = await ProjectModel.deleteOne({ _id: projectId, organizationId });
    return res.deletedCount > 0;
  }
}

export class MongooseApiKeyRepository implements ApiKeyRepository {
  async create(input: {
    organizationId: string;
    projectId: string;
    name: string;
    keyPrefix: string;
    keyHash: string;
    scopes: string[];
    expiresAt?: Date;
    createdByUserId: string;
  }): Promise<ApiKeyRecord> {
    const doc = await ApiKeyModel.create(input);
    return toApiKeyRecord(doc);
  }

  async listByProjectInOrg(organizationId: string, projectId: string): Promise<ApiKeyRecord[]> {
    const docs = await ApiKeyModel.find({ organizationId, projectId }).sort({ createdAt: -1 });
    return docs.map(toApiKeyRecord);
  }

  async findByIdInProject(
    organizationId: string,
    projectId: string,
    keyId: string,
  ): Promise<ApiKeyRecord | null> {
    const doc = await ApiKeyModel.findOne({ _id: keyId, organizationId, projectId });
    return doc ? toApiKeyRecord(doc) : null;
  }

  async findActiveByKeyHash(keyHash: string): Promise<ApiKeyRecord | null> {
    const doc = await ApiKeyModel.findOne({
      keyHash,
      revokedAt: { $exists: false },
    });
    return doc ? toApiKeyRecord(doc) : null;
  }

  async revokeByIdInProject(
    organizationId: string,
    projectId: string,
    keyId: string,
  ): Promise<ApiKeyRecord | null> {
    const doc = await ApiKeyModel.findOneAndUpdate(
      { _id: keyId, organizationId, projectId, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } },
      { new: true },
    );
    return doc ? toApiKeyRecord(doc) : null;
  }
}

export class MongooseAuditLogRepository implements AuditLogRepository {
  async record(input: AuditLogInput): Promise<void> {
    await AuditLogModel.create(input);
  }
}

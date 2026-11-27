import { conflictError, notFoundError } from "../../errors/app-error.js";
import type { MemberRole } from "../../models/organization-member.model.js";
import type {
  AuditLogRepository,
  MemberRecord,
  OrganizationRecord,
  OrganizationRepository,
  UserRepository,
} from "../../repositories/types.js";

export interface OrganizationServiceDeps {
  organizations: OrganizationRepository;
  users: UserRepository;
  auditLogs: AuditLogRepository;
}

export class OrganizationService {
  constructor(private readonly deps: OrganizationServiceDeps) {}

  async getCurrentOrganization(organizationId: string): Promise<OrganizationRecord> {
    const org = await this.deps.organizations.findById(organizationId);
    if (!org) {
      throw notFoundError("Organization not found.");
    }
    return org;
  }

  async updateCurrentOrganization(
    organizationId: string,
    actorId: string,
    input: { name?: string },
    requestId: string,
  ): Promise<OrganizationRecord> {
    const updated = await this.deps.organizations.updateById(organizationId, input);
    if (!updated) {
      throw notFoundError("Organization not found.");
    }

    await this.deps.auditLogs.record({
      organizationId,
      actorType: "user",
      actorId,
      action: "organization.updated",
      resourceType: "organization",
      resourceId: organizationId,
      metadata: { name: updated.name },
      requestId,
    });

    return updated;
  }

  async listMembers(organizationId: string): Promise<MemberRecord[]> {
    return this.deps.organizations.listMembersByOrganization(organizationId);
  }

  async addMemberByEmail(
    organizationId: string,
    actorId: string,
    input: { email: string; role: MemberRole },
    requestId: string,
  ): Promise<MemberRecord> {
    const user = await this.deps.users.findByEmail(input.email);
    if (!user) {
      throw notFoundError("User with this email was not found.");
    }

    const existing = await this.deps.organizations.findMember(organizationId, user.id);
    if (existing && existing.status !== "revoked") {
      throw conflictError("User is already a member of this organization.");
    }

    const member = await this.deps.organizations.addMember({
      organizationId,
      userId: user.id,
      role: input.role,
      status: "active",
    });

    await this.deps.auditLogs.record({
      organizationId,
      actorType: "user",
      actorId,
      action: "organization.member_added",
      resourceType: "organization_member",
      resourceId: member.id,
      metadata: { targetUserId: user.id, role: input.role },
      requestId,
    });

    return member;
  }

  async updateMemberRole(
    organizationId: string,
    actorId: string,
    memberId: string,
    role: MemberRole,
    requestId: string,
  ): Promise<MemberRecord> {
    const updated = await this.deps.organizations.updateMemberRole(organizationId, memberId, role);
    if (!updated) {
      throw notFoundError("Organization member not found.");
    }

    await this.deps.auditLogs.record({
      organizationId,
      actorType: "user",
      actorId,
      action: "organization.member_role_updated",
      resourceType: "organization_member",
      resourceId: updated.id,
      metadata: { role },
      requestId,
    });

    return updated;
  }

  async revokeMember(
    organizationId: string,
    actorId: string,
    memberId: string,
    requestId: string,
  ): Promise<MemberRecord> {
    const revoked = await this.deps.organizations.revokeMember(organizationId, memberId);
    if (!revoked) {
      throw notFoundError("Organization member not found.");
    }

    await this.deps.auditLogs.record({
      organizationId,
      actorType: "user",
      actorId,
      action: "organization.member_revoked",
      resourceType: "organization_member",
      resourceId: revoked.id,
      requestId,
    });

    return revoked;
  }
}

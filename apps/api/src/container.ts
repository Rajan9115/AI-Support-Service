import {
  createRequireAuthMiddleware,
  createRequireTenantMiddleware,
} from "./middleware/auth.js";
import { AuthService } from "./modules/auth/auth.service.js";
import { createAuthRouter } from "./modules/auth/auth.routes.js";
import { OrganizationService } from "./modules/organizations/organization.service.js";
import { createOrganizationRouter } from "./modules/organizations/organization.routes.js";
import { ProjectService } from "./modules/projects/project.service.js";
import { createProjectRouter } from "./modules/projects/project.routes.js";
import {
  MongooseApiKeyRepository,
  MongooseAuditLogRepository,
  MongooseOrganizationRepository,
  MongooseProjectRepository,
  MongooseSessionRepository,
  MongooseUserRepository,
} from "./repositories/mongoose.repositories.js";
import type {
  ApiKeyRepository,
  AuditLogRepository,
  OrganizationRepository,
  ProjectRepository,
  SessionRepository,
  UserRepository,
} from "./repositories/types.js";

export interface CoreRepositories {
  users: UserRepository;
  sessions: SessionRepository;
  organizations: OrganizationRepository;
  projects: ProjectRepository;
  apiKeys: ApiKeyRepository;
  auditLogs: AuditLogRepository;
}

export function createMongooseRepositories(): CoreRepositories {
  return {
    users: new MongooseUserRepository(),
    sessions: new MongooseSessionRepository(),
    organizations: new MongooseOrganizationRepository(),
    projects: new MongooseProjectRepository(),
    apiKeys: new MongooseApiKeyRepository(),
    auditLogs: new MongooseAuditLogRepository(),
  };
}

export function createV1Modules(params: {
  repositories: CoreRepositories;
  sessionSecret: string;
  isProduction: boolean;
}) {
  const { repositories } = params;

  const authService = new AuthService({
    users: repositories.users,
    sessions: repositories.sessions,
    organizations: repositories.organizations,
    auditLogs: repositories.auditLogs,
    sessionSecret: params.sessionSecret,
  });

  const organizationService = new OrganizationService({
    organizations: repositories.organizations,
    users: repositories.users,
    auditLogs: repositories.auditLogs,
  });

  const projectService = new ProjectService({
    projects: repositories.projects,
    apiKeys: repositories.apiKeys,
    auditLogs: repositories.auditLogs,
  });

  const requireAuth = createRequireAuthMiddleware({
    sessionSecret: params.sessionSecret,
    isSessionActive: async (sessionId, userId) => {
      const session = await repositories.sessions.findById(sessionId);
      if (!session || session.userId !== userId || session.revokedAt) {
        return false;
      }
      if (session.expiresAt <= new Date()) {
        return false;
      }
      const user = await repositories.users.findById(userId);
      return Boolean(user && user.status === "active");
    },
    resolveMembership: async (userId, requestedOrgId) => {
      if (requestedOrgId) {
        const member = await repositories.organizations.findMember(requestedOrgId, userId);
        if (!member || member.status !== "active") {
          return null;
        }
        return { organizationId: member.organizationId, role: member.role };
      }
      const memberships = await repositories.organizations.listMembersByUser(userId);
      const first = memberships[0];
      if (!first) {
        return null;
      }
      return { organizationId: first.organizationId, role: first.role };
    },
  });

  const requireTenant = createRequireTenantMiddleware({
    resolveMembership: async (userId, requestedOrgId) => {
      if (requestedOrgId) {
        const member = await repositories.organizations.findMember(requestedOrgId, userId);
        if (!member || member.status !== "active") {
          return null;
        }
        return { organizationId: member.organizationId, role: member.role };
      }
      const memberships = await repositories.organizations.listMembersByUser(userId);
      const first = memberships[0];
      if (!first) {
        return null;
      }
      return { organizationId: first.organizationId, role: first.role };
    },
  });

  return {
    authService,
    organizationService,
    projectService,
    authRouter: createAuthRouter({
      authService,
      requireAuth,
      isProduction: params.isProduction,
    }),
    organizationRouter: createOrganizationRouter({
      organizationService,
      requireAuth,
      requireTenant,
    }),
    projectRouter: createProjectRouter({
      projectService,
      requireAuth,
      requireTenant,
    }),
  };
}

import {
  conflictError,
  forbiddenError,
  unauthenticatedError,
} from "../../errors/app-error.js";
import type {
  AuditLogRepository,
  OrganizationRepository,
  SessionRepository,
  UserRepository,
} from "../../repositories/types.js";
import {
  generateOpaqueToken,
  hashPassword,
  sha256Hex,
  signAccessToken,
  verifyPassword,
} from "../../security/crypto.js";

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ACCESS_TTL_SECONDS = 15 * 60;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthServiceDeps {
  users: UserRepository;
  sessions: SessionRepository;
  organizations: OrganizationRepository;
  auditLogs: AuditLogRepository;
  sessionSecret: string;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export class AuthService {
  constructor(private readonly deps: AuthServiceDeps) {}

  async register(
    input: { email: string; password: string; name: string; organizationName: string },
    requestId: string,
  ): Promise<{
    user: { id: string; email: string; name: string };
    organization: { id: string; name: string; slug: string };
    tokens: AuthTokens;
  }> {
    const existing = await this.deps.users.findByEmail(input.email);
    if (existing) {
      throw conflictError("An account with this email already exists.");
    }

    const baseSlug = slugify(input.organizationName) || "org";
    const slugConflict = await this.deps.organizations.findBySlug(baseSlug);
    const finalSlug = slugConflict ? `${baseSlug}-${generateOpaqueToken(3)}` : baseSlug;

    const passwordHash = await hashPassword(input.password);
    const user = await this.deps.users.create({
      email: input.email,
      passwordHash,
      name: input.name,
    });

    const organization = await this.deps.organizations.create({
      name: input.organizationName,
      slug: finalSlug,
    });

    await this.deps.organizations.addMember({
      organizationId: organization.id,
      userId: user.id,
      role: "owner",
      status: "active",
    });

    const tokens = await this.issueSessionTokens(user.id, user.email);

    await this.deps.auditLogs.record({
      organizationId: organization.id,
      actorType: "user",
      actorId: user.id,
      action: "auth.register",
      resourceType: "user",
      resourceId: user.id,
      requestId,
    });

    return {
      user: { id: user.id, email: user.email, name: user.name },
      organization: { id: organization.id, name: organization.name, slug: organization.slug },
      tokens,
    };
  }

  async login(
    input: { email: string; password: string },
    requestId: string,
  ): Promise<{
    user: { id: string; email: string; name: string };
    tokens: AuthTokens;
  }> {
    const user = await this.deps.users.findByEmail(input.email);
    if (!user) {
      throw unauthenticatedError("Invalid email or password.");
    }

    if (user.status !== "active") {
      throw forbiddenError("Account is suspended.");
    }

    const valid = await verifyPassword(user.passwordHash, input.password);
    if (!valid) {
      throw unauthenticatedError("Invalid email or password.");
    }

    const tokens = await this.issueSessionTokens(user.id, user.email);
    const memberships = await this.deps.organizations.listMembersByUser(user.id);
    if (memberships[0]) {
      await this.deps.auditLogs.record({
        organizationId: memberships[0].organizationId,
        actorType: "user",
        actorId: user.id,
        action: "auth.login",
        resourceType: "user",
        resourceId: user.id,
        requestId,
      });
    }

    return {
      user: { id: user.id, email: user.email, name: user.name },
      tokens,
    };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const tokenHash = sha256Hex(refreshToken);
    const session = await this.deps.sessions.findByTokenHash(tokenHash);
    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw unauthenticatedError("Invalid or expired refresh token.");
    }

    const user = await this.deps.users.findById(session.userId);
    if (!user || user.status !== "active") {
      await this.deps.sessions.revokeById(session.id);
      throw unauthenticatedError("Account is no longer active.");
    }

    const nextRefreshToken = generateOpaqueToken(32);
    const nextExpiresAt = new Date(Date.now() + REFRESH_TTL_MS);
    await this.deps.sessions.rotateToken(session.id, sha256Hex(nextRefreshToken), nextExpiresAt);

    const accessToken = await signAccessToken(
      { sub: user.id, sessionId: session.id, email: user.email },
      this.deps.sessionSecret,
      ACCESS_TTL_SECONDS,
    );

    return { accessToken, refreshToken: nextRefreshToken };
  }

  async logout(sessionId: string): Promise<void> {
    await this.deps.sessions.revokeById(sessionId);
  }

  async getMe(userId: string): Promise<{
    user: { id: string; email: string; name: string; status: string };
    memberships: Array<{ organizationId: string; role: string; status: string }>;
  }> {
    const user = await this.deps.users.findById(userId);
    if (!user || user.status !== "active") {
      throw unauthenticatedError("User not found or inactive.");
    }

    const memberships = await this.deps.organizations.listMembersByUser(user.id);
    return {
      user: { id: user.id, email: user.email, name: user.name, status: user.status },
      memberships: memberships.map((m) => ({
        organizationId: m.organizationId,
        role: m.role,
        status: m.status,
      })),
    };
  }

  private async issueSessionTokens(userId: string, email: string): Promise<AuthTokens> {
    const refreshToken = generateOpaqueToken(32);
    const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);

    const session = await this.deps.sessions.create({
      userId,
      tokenHash: sha256Hex(refreshToken),
      expiresAt,
    });

    const accessToken = await signAccessToken(
      { sub: userId, sessionId: session.id, email },
      this.deps.sessionSecret,
      ACCESS_TTL_SECONDS,
    );

    return { accessToken, refreshToken };
  }
}

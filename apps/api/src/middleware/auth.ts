import type { NextFunction, Request, Response } from "express";
import { forbiddenError, unauthenticatedError } from "../errors/app-error.js";
import type { MemberRole } from "../models/organization-member.model.js";
import { verifyAccessToken } from "../security/crypto.js";

export interface AuthenticatedPrincipal {
  userId: string;
  sessionId: string;
  email: string;
}

export interface TenantContext {
  organizationId: string;
  role: MemberRole;
}

declare module "express-serve-static-core" {
  interface Request {
    auth?: AuthenticatedPrincipal;
    tenant?: TenantContext;
  }
}

export interface AuthMiddlewareDeps {
  sessionSecret: string;
  isSessionActive: (sessionId: string, userId: string) => Promise<boolean>;
  resolveMembership: (
    userId: string,
    requestedOrgId?: string,
  ) => Promise<{ organizationId: string; role: MemberRole } | null>;
}

export const ACCESS_COOKIE_NAME = "resolveai_access";
export const REFRESH_COOKIE_NAME = "resolveai_refresh";

function extractAccessToken(req: Request): string | null {
  const cookieToken = req.cookies?.[ACCESS_COOKIE_NAME];
  if (typeof cookieToken === "string" && cookieToken.length > 0) {
    return cookieToken;
  }
  const authHeader = req.header("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  return null;
}

export function createRequireAuthMiddleware(deps: AuthMiddlewareDeps) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const token = extractAccessToken(req);
    if (!token) {
      next(unauthenticatedError("Authentication required."));
      return;
    }

    const claims = await verifyAccessToken(token, deps.sessionSecret);
    if (!claims) {
      next(unauthenticatedError("Invalid or expired session token."));
      return;
    }

    const active = await deps.isSessionActive(claims.sessionId, claims.sub);
    if (!active) {
      next(unauthenticatedError("Session has been revoked or expired."));
      return;
    }

    req.auth = {
      userId: claims.sub,
      sessionId: claims.sessionId,
      email: claims.email,
    };
    next();
  };
}

export function createRequireTenantMiddleware(deps: Pick<AuthMiddlewareDeps, "resolveMembership">) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.auth) {
      next(unauthenticatedError());
      return;
    }

    const requestedOrgId = req.header("x-organization-id");
    const membership = await deps.resolveMembership(req.auth.userId, requestedOrgId);
    if (!membership) {
      next(forbiddenError("You do not have access to this organization."));
      return;
    }

    req.tenant = membership;
    next();
  };
}

export function requireRole(...allowedRoles: MemberRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.tenant) {
      next(forbiddenError("Organization context required."));
      return;
    }

    if (!allowedRoles.includes(req.tenant.role)) {
      next(forbiddenError("Insufficient permissions for this action."));
      return;
    }

    next();
  };
}

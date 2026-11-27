import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { sendSuccess } from "../../http/response.js";
import {
  requireRole,
  type createRequireAuthMiddleware,
  type createRequireTenantMiddleware,
} from "../../middleware/auth.js";
import { validateRequest } from "../../middleware/validate.js";
import type { OrganizationService } from "./organization.service.js";

const updateOrgSchema = z.object({
  name: z.string().min(2).max(100),
});

const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["owner", "admin", "support_agent"]),
});

const memberParamsSchema = z.object({
  memberId: z.string().min(1),
});

const updateMemberRoleSchema = z.object({
  role: z.enum(["owner", "admin", "support_agent"]),
});

export function createOrganizationRouter(params: {
  organizationService: OrganizationService;
  requireAuth: ReturnType<typeof createRequireAuthMiddleware>;
  requireTenant: ReturnType<typeof createRequireTenantMiddleware>;
}): Router {
  const router = Router();

  router.use(params.requireAuth, params.requireTenant);

  router.get("/current", async (req: Request, res: Response) => {
    const org = await params.organizationService.getCurrentOrganization(req.tenant!.organizationId);
    sendSuccess(res, org);
  });

  router.patch(
    "/current",
    requireRole("owner", "admin"),
    validateRequest({ body: updateOrgSchema }),
    async (req: Request, res: Response) => {
      const org = await params.organizationService.updateCurrentOrganization(
        req.tenant!.organizationId,
        req.auth!.userId,
        req.body,
        req.requestId,
      );
      sendSuccess(res, org);
    },
  );

  router.get("/current/members", async (req: Request, res: Response) => {
    const members = await params.organizationService.listMembers(req.tenant!.organizationId);
    sendSuccess(res, members);
  });

  router.post(
    "/current/members",
    requireRole("owner", "admin"),
    validateRequest({ body: addMemberSchema }),
    async (req: Request, res: Response) => {
      const member = await params.organizationService.addMemberByEmail(
        req.tenant!.organizationId,
        req.auth!.userId,
        req.body,
        req.requestId,
      );
      sendSuccess(res, member, 201);
    },
  );

  router.patch(
    "/current/members/:memberId",
    requireRole("owner"),
    validateRequest({ params: memberParamsSchema, body: updateMemberRoleSchema }),
    async (req: Request, res: Response) => {
      const member = await params.organizationService.updateMemberRole(
        req.tenant!.organizationId,
        req.auth!.userId,
        req.params.memberId!,
        req.body.role,
        req.requestId,
      );
      sendSuccess(res, member);
    },
  );

  router.delete(
    "/current/members/:memberId",
    requireRole("owner", "admin"),
    validateRequest({ params: memberParamsSchema }),
    async (req: Request, res: Response) => {
      const member = await params.organizationService.revokeMember(
        req.tenant!.organizationId,
        req.auth!.userId,
        req.params.memberId!,
        req.requestId,
      );
      sendSuccess(res, member);
    },
  );

  return router;
}

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { sendSuccess } from "../../http/response.js";
import {
  requireRole,
  type createRequireAuthMiddleware,
  type createRequireTenantMiddleware,
} from "../../middleware/auth.js";
import { validateRequest } from "../../middleware/validate.js";
import type { ProjectService } from "./project.service.js";

const createProjectSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/),
  allowedOrigins: z.array(z.string().url()).optional(),
});

const updateProjectSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  allowedOrigins: z.array(z.string().url()).optional(),
  status: z.enum(["active", "archived"]).optional(),
});

const projectParamsSchema = z.object({
  projectId: z.string().min(1),
});

const apiKeyParamsSchema = z.object({
  projectId: z.string().min(1),
  keyId: z.string().min(1),
});

const createApiKeySchema = z.object({
  name: z.string().min(2).max(80),
  scopes: z.array(z.string().min(1)).optional(),
});

export function createProjectRouter(params: {
  projectService: ProjectService;
  requireAuth: ReturnType<typeof createRequireAuthMiddleware>;
  requireTenant: ReturnType<typeof createRequireTenantMiddleware>;
}): Router {
  const router = Router();

  router.use(params.requireAuth, params.requireTenant);

  router.get("/", async (req: Request, res: Response) => {
    const projects = await params.projectService.listProjects(req.tenant!.organizationId);
    sendSuccess(res, projects);
  });

  router.post(
    "/",
    requireRole("owner", "admin"),
    validateRequest({ body: createProjectSchema }),
    async (req: Request, res: Response) => {
      const project = await params.projectService.createProject(
        req.tenant!.organizationId,
        req.auth!.userId,
        req.body,
        req.requestId,
      );
      sendSuccess(res, project, 201);
    },
  );

  router.get(
    "/:projectId",
    validateRequest({ params: projectParamsSchema }),
    async (req: Request, res: Response) => {
      const project = await params.projectService.getProject(
        req.tenant!.organizationId,
        req.params.projectId!,
      );
      sendSuccess(res, project);
    },
  );

  router.patch(
    "/:projectId",
    requireRole("owner", "admin"),
    validateRequest({ params: projectParamsSchema, body: updateProjectSchema }),
    async (req: Request, res: Response) => {
      const project = await params.projectService.updateProject(
        req.tenant!.organizationId,
        req.params.projectId!,
        req.auth!.userId,
        req.body,
        req.requestId,
      );
      sendSuccess(res, project);
    },
  );

  router.delete(
    "/:projectId",
    requireRole("owner"),
    validateRequest({ params: projectParamsSchema }),
    async (req: Request, res: Response) => {
      await params.projectService.deleteProject(
        req.tenant!.organizationId,
        req.params.projectId!,
        req.auth!.userId,
        req.requestId,
      );
      sendSuccess(res, { deleted: true });
    },
  );

  router.get(
    "/:projectId/api-keys",
    requireRole("owner", "admin"),
    validateRequest({ params: projectParamsSchema }),
    async (req: Request, res: Response) => {
      const keys = await params.projectService.listApiKeys(
        req.tenant!.organizationId,
        req.params.projectId!,
      );
      sendSuccess(res, keys);
    },
  );

  router.post(
    "/:projectId/api-keys",
    requireRole("owner", "admin"),
    validateRequest({ params: projectParamsSchema, body: createApiKeySchema }),
    async (req: Request, res: Response) => {
      const created = await params.projectService.createApiKey(
        req.tenant!.organizationId,
        req.params.projectId!,
        req.auth!.userId,
        req.body,
        req.requestId,
      );
      sendSuccess(res, created, 201);
    },
  );

  router.delete(
    "/:projectId/api-keys/:keyId",
    requireRole("owner", "admin"),
    validateRequest({ params: apiKeyParamsSchema }),
    async (req: Request, res: Response) => {
      const revoked = await params.projectService.revokeApiKey(
        req.tenant!.organizationId,
        req.params.projectId!,
        req.params.keyId!,
        req.auth!.userId,
        req.requestId,
      );
      sendSuccess(res, revoked);
    },
  );

  return router;
}

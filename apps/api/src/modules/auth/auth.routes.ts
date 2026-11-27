import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { unauthenticatedError } from "../../errors/app-error.js";
import { sendSuccess } from "../../http/response.js";
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  type createRequireAuthMiddleware,
} from "../../middleware/auth.js";
import { validateRequest } from "../../middleware/validate.js";
import type { AuthService } from "./auth.service.js";

const registerBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100),
  organizationName: z.string().min(2).max(100),
});

const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});

function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
  isProduction: boolean,
): void {
  const baseCookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
  };

  res.cookie(ACCESS_COOKIE_NAME, tokens.accessToken, {
    ...baseCookieOptions,
    maxAge: 15 * 60 * 1000,
  });
  res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, {
    ...baseCookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearAuthCookies(res: Response, isProduction: boolean): void {
  const baseCookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
  };
  res.clearCookie(ACCESS_COOKIE_NAME, baseCookieOptions);
  res.clearCookie(REFRESH_COOKIE_NAME, baseCookieOptions);
}

export function createAuthRouter(params: {
  authService: AuthService;
  requireAuth: ReturnType<typeof createRequireAuthMiddleware>;
  isProduction: boolean;
}): Router {
  const router = Router();

  router.post(
    "/register",
    validateRequest({ body: registerBodySchema }),
    async (req: Request, res: Response) => {
      const result = await params.authService.register(req.body, req.requestId);
      setAuthCookies(res, result.tokens, params.isProduction);
      sendSuccess(res, { user: result.user, organization: result.organization }, 201);
    },
  );

  router.post(
    "/login",
    validateRequest({ body: loginBodySchema }),
    async (req: Request, res: Response) => {
      const result = await params.authService.login(req.body, req.requestId);
      setAuthCookies(res, result.tokens, params.isProduction);
      sendSuccess(res, { user: result.user });
    },
  );

  router.post("/refresh", async (req: Request, res: Response) => {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (typeof refreshToken !== "string" || refreshToken.length === 0) {
      throw unauthenticatedError("Refresh token is required.");
    }
    const tokens = await params.authService.refresh(refreshToken);
    setAuthCookies(res, tokens, params.isProduction);
    sendSuccess(res, { refreshed: true });
  });

  router.post("/logout", params.requireAuth, async (req: Request, res: Response) => {
    if (req.auth) {
      await params.authService.logout(req.auth.sessionId);
    }
    clearAuthCookies(res, params.isProduction);
    sendSuccess(res, { loggedOut: true });
  });

  router.get("/me", params.requireAuth, async (req: Request, res: Response) => {
    const data = await params.authService.getMe(req.auth!.userId);
    sendSuccess(res, data);
  });

  return router;
}

import type { NextFunction, Request, Response } from "express";
import { notFoundError } from "../errors/app-error.js";

export function notFoundMiddleware(_req: Request, _res: Response, next: NextFunction): void {
  next(notFoundError("Route not found."));
}

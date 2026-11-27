import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";
import { validationError } from "../errors/app-error.js";

export interface ValidationSchemas {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
}

export function validateRequest(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        next(validationError("Invalid route parameters.", result.error.issues));
        return;
      }
      req.params = result.data as Record<string, string>;
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        next(validationError("Invalid query parameters.", result.error.issues));
        return;
      }
    }

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        next(validationError("Invalid request body.", result.error.issues));
        return;
      }
      req.body = result.data;
    }

    next();
  };
}

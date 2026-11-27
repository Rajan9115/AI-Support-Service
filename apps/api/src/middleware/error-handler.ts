import type { NextFunction, Request, Response } from "express";
import type { Logger } from "pino";
import { ERROR_CODES } from "@resolveai/shared";
import { AppError } from "../errors/app-error.js";
import { sendError } from "../http/response.js";

interface BodyParserSyntaxError extends SyntaxError {
  status?: number;
  type?: string;
}

function isMalformedJsonError(err: unknown): err is BodyParserSyntaxError {
  return (
    err instanceof SyntaxError &&
    typeof (err as BodyParserSyntaxError).status === "number" &&
    (err as BodyParserSyntaxError).status === 400
  );
}

export function createErrorHandlerMiddleware(logger: Logger) {
  return (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
    const requestId = req.requestId ?? "unknown";

    if (res.headersSent) {
      logger.error({ err, requestId }, "Error occurred after response headers were sent");
      return;
    }

    if (err instanceof AppError) {
      if (err.statusCode >= 500) {
        logger.error({ err, requestId, code: err.code }, err.message);
      } else {
        logger.warn({ requestId, code: err.code, statusCode: err.statusCode }, err.message);
      }

      sendError(res, {
        statusCode: err.statusCode,
        code: err.code,
        message: err.message,
        details: err.details,
        requestId,
      });
      return;
    }

    if (isMalformedJsonError(err)) {
      sendError(res, {
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        message: "Malformed JSON request body.",
        requestId,
      });
      return;
    }

    logger.error({ err, requestId }, "Unhandled internal error");
    sendError(res, {
      statusCode: 500,
      code: ERROR_CODES.INTERNAL_ERROR,
      message: "An unexpected internal error occurred.",
      requestId,
    });
  };
}

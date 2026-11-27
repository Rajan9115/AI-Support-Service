import type { Response } from "express";
import type { ErrorCode } from "@resolveai/shared";

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ErrorEnvelope {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown[];
    requestId: string;
  };
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode: number = 200,
  meta?: Record<string, unknown>,
): Response<SuccessEnvelope<T>> {
  const payload: SuccessEnvelope<T> = meta ? { success: true, data, meta } : { success: true, data };
  return res.status(statusCode).json(payload);
}

export function sendError(
  res: Response,
  params: {
    statusCode: number;
    code: ErrorCode;
    message: string;
    requestId: string;
    details?: unknown[];
  },
): Response<ErrorEnvelope> {
  return res.status(params.statusCode).json({
    success: false,
    error: {
      code: params.code,
      message: params.message,
      ...(params.details ? { details: params.details } : {}),
      requestId: params.requestId,
    },
  });
}

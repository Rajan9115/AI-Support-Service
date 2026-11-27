import { ERROR_CODES, type ErrorCode } from "@resolveai/shared";

export interface AppErrorOptions {
  code: ErrorCode;
  message: string;
  statusCode: number;
  retryable?: boolean;
  details?: unknown[];
  cause?: unknown;
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly retryable: boolean;
  public readonly details?: unknown[];

  constructor(options: AppErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = "AppError";
    this.code = options.code;
    this.statusCode = options.statusCode;
    this.retryable = options.retryable ?? false;
    this.details = options.details;
  }
}

export function validationError(message: string, details?: unknown[]): AppError {
  return new AppError({
    code: ERROR_CODES.VALIDATION_ERROR,
    message,
    statusCode: 400,
    details,
  });
}

export function notFoundError(message: string = "Resource not found."): AppError {
  return new AppError({
    code: ERROR_CODES.NOT_FOUND,
    message,
    statusCode: 404,
  });
}

export function forbiddenError(message: string = "Access denied."): AppError {
  return new AppError({
    code: ERROR_CODES.FORBIDDEN,
    message,
    statusCode: 403,
  });
}

export function unauthenticatedError(message: string = "Authentication required."): AppError {
  return new AppError({
    code: ERROR_CODES.UNAUTHENTICATED,
    message,
    statusCode: 401,
  });
}

export function rateLimitedError(message: string = "Too many requests. Please try again later."): AppError {
  return new AppError({
    code: ERROR_CODES.RATE_LIMITED,
    message,
    statusCode: 429,
    retryable: true,
  });
}

export function dependencyUnavailableError(
  message: string = "A required dependency is unavailable.",
  cause?: unknown,
): AppError {
  return new AppError({
    code: ERROR_CODES.DEPENDENCY_UNAVAILABLE,
    message,
    statusCode: 503,
    retryable: true,
    cause,
  });
}

export function internalError(message: string = "An unexpected error occurred.", cause?: unknown): AppError {
  return new AppError({
    code: ERROR_CODES.INTERNAL_ERROR,
    message,
    statusCode: 500,
    cause,
  });
}

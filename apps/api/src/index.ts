import { ERROR_CODES } from "@resolveai/shared";

export const API_SERVICE_NAME = "resolveai-api";

export function getApiFoundationInfo(): { service: string; defaultErrorCode: string } {
  return {
    service: API_SERVICE_NAME,
    defaultErrorCode: ERROR_CODES.INTERNAL_ERROR,
  };
}

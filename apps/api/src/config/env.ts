import { apiEnvSchema, parseEnv, type ApiEnv } from "@resolveai/shared";

export function loadApiEnv(rawEnv: Record<string, string | undefined> = process.env): ApiEnv {
  return parseEnv(apiEnvSchema, rawEnv);
}

export function getAllowedDashboardOrigins(env: Pick<ApiEnv, "ALLOWED_DASHBOARD_ORIGINS">): string[] {
  return env.ALLOWED_DASHBOARD_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0 && origin !== "*");
}

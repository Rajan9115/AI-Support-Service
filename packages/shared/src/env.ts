import { z } from "zod";

export const nodeEnvSchema = z.enum(["development", "test", "staging", "production"]);

export const apiEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema.default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  ALLOWED_DASHBOARD_ORIGINS: z.string().default("http://localhost:3000"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  GEMINI_EMBEDDING_MODEL: z.string().default("text-embedding-004"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export const dashboardEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema.default("development"),
  NEXT_PUBLIC_API_BASE_URL: z.string().url().default("http://localhost:4000"),
});

export type DashboardEnv = z.infer<typeof dashboardEnvSchema>;

export function parseEnv<T extends z.ZodTypeAny>(
  schema: T,
  env: Record<string, string | undefined>,
): z.infer<T> {
  const result = schema.safeParse(env);
  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${formatted}`);
  }
  return result.data;
}

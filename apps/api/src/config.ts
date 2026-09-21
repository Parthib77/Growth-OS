import { z } from 'zod';

const EnvironmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
  MONGODB_URI: z.string().min(1).default('mongodb://localhost:27017/growthos'),
  SESSION_SECRET: z.string().min(32),
  COOKIE_SECURE: z.coerce.boolean().default(false),
});

export type AppConfig = z.infer<typeof EnvironmentSchema>;

export function readConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvironmentSchema.safeParse(env);
  if (!parsed.success) throw new Error(`Invalid environment: ${parsed.error.message}`);
  return parsed.data;
}

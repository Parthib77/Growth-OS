import { z } from 'zod';

const EnvironmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
    MONGODB_URI: z.string().min(1).default('mongodb://localhost:27017/growthos'),
    SESSION_SECRET: z.string().min(32),
    COOKIE_SECURE: z.preprocess((value) => {
      if (typeof value === 'boolean') return value;
      if (typeof value !== 'string') return value;
      if (value === 'true') return true;
      if (value === 'false') return false;
      return value;
    }, z.boolean().default(false)),
    PASSWORD_RESET_WEBHOOK_URL: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().url().optional(),
    ),
    PASSWORD_RESET_WEBHOOK_SECRET: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().min(16).optional(),
    ),
    PASSWORD_RESET_EXPOSE_TOKEN: z.preprocess((value) => {
      if (typeof value === 'boolean') return value;
      if (typeof value !== 'string') return value;
      if (value === 'true') return true;
      if (value === 'false') return false;
      return value;
    }, z.boolean().default(false)),
  })
  .superRefine((value, context) => {
    if (Boolean(value.PASSWORD_RESET_WEBHOOK_URL) !== Boolean(value.PASSWORD_RESET_WEBHOOK_SECRET))
      context.addIssue({
        code: 'custom',
        message:
          'PASSWORD_RESET_WEBHOOK_URL and PASSWORD_RESET_WEBHOOK_SECRET must be set together.',
      });
    if (value.NODE_ENV === 'production' && value.PASSWORD_RESET_EXPOSE_TOKEN)
      context.addIssue({
        code: 'custom',
        message: 'PASSWORD_RESET_EXPOSE_TOKEN cannot be enabled in production.',
      });
  });

export type AppConfig = z.infer<typeof EnvironmentSchema>;

export function readConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvironmentSchema.safeParse(env);
  if (!parsed.success) throw new Error(`Invalid environment: ${parsed.error.message}`);
  return parsed.data;
}

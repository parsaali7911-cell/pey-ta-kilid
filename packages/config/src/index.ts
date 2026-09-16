import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default('redis://127.0.0.1:6379'),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  API_INTERNAL_URL: z.string().url().default('http://127.0.0.1:4000'),
  AI_PROVIDER: z.enum(['none', 'openai', 'anthropic']).default('none'),
  /** ERP adapter: none (retryable unavailable) | memory (local idempotent) */
  ERP_PROVIDER: z.enum(['none', 'memory']).default('none'),
  AI_MAX_COMPLETE_TOKENS: z.coerce.number().int().positive().default(512),
  AI_MAX_EMBED_TEXTS: z.coerce.number().int().positive().default(16),
  AI_MAX_VISION_TOKENS: z.coerce.number().int().positive().default(256),
  /** Optional — required only when AI_PROVIDER=openai */
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().min(1).default('gpt-4o-mini'),
  /** Image model for designer product-in-space (gpt-image-1 or dall-e-3). */
  OPENAI_IMAGE_MODEL: z.string().min(1).default('gpt-image-1'),
  OPENAI_INPUT_COST_PER_1M: z.coerce.number().nonnegative().default(0.15),
  OPENAI_OUTPUT_COST_PER_1M: z.coerce.number().nonnegative().default(0.6),
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Invalid environment: ${details}`);
  }
  const env = parsed.data;
  if (env.AI_PROVIDER === 'openai' && !env.OPENAI_API_KEY) {
    throw new Error('Invalid environment: OPENAI_API_KEY is required when AI_PROVIDER=openai');
  }
  return env;
}

export { envSchema };
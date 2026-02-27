import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  ANTHROPIC_API_KEY: z.string().min(10, 'ANTHROPIC_API_KEY is required'),
  APIFY_API_TOKEN: z.string().min(10, 'APIFY_API_TOKEN is required'),
  JINA_API_KEY: z.string().optional(),
  SMARTLEAD_API_KEY: z.string().optional(),
  ADMIN_PASSWORD: z.string().min(4).default('gamic2024'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  parsed.error.issues.forEach((issue) => {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  });
  process.exit(1);
}

export const env = parsed.data;

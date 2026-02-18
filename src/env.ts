import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  CORS_ORIGINS: z.string().default('http://localhost:4200'),

  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('8h'),

  DATABASE_URL: z.string().min(1),

  // SMTP (opcional)
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  SMTP_FROM: z.string().default(''),
});

export const env = envSchema.parse(process.env);

export const corsOrigins = env.CORS_ORIGINS
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

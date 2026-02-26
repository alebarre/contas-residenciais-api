import { z } from 'zod';

export const dashboardQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12)
});

// month no formato YYYY-MM (ex.: 2026-02)
export const dashboardMonthQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .refine((v) => {
      const [y, m] = v.split('-').map(Number);
      return y >= 2000 && y <= 2100 && m >= 1 && m <= 12;
    }, 'month inválido')
});

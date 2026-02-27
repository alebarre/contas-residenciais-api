import { z } from 'zod';

export const monthQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'month deve ser YYYY-MM'),
  itemId: z.string().uuid().optional(),
  paid: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      if (typeof v === 'boolean') return v;
      return v === 'true';
    })
});

export const createExpenseSchema = z.object({
  itemId: z.string().uuid(),
  descricao: z.string().min(1),
  valor: z.coerce.number().positive(),
  dataVencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dataPagamento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(), // ✅ NOVO
  bancoCode: z.coerce.number().int().nullable().optional(),
});

export const updateExpenseSchema = z.object({
  dataVencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dataPagamento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  itemId: z.string().uuid().optional(),
  descricao: z.string().min(2).max(255).optional(),
  bancoCode: z.number().int().positive().nullable().optional(),
  valor: z.number().optional()
}).refine((v) => Object.keys(v).length > 0, {
  message: 'Informe ao menos um campo para atualizar'
});

export const paymentSchema = z.object({
  dataPagamento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()
});

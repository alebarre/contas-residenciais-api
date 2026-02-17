import { z } from 'zod';

export const itemTipoSchema = z.enum(['EMPRESA', 'PROFISSIONAL', 'SERVICO', 'DESPESA']);

export const createItemSchema = z.object({
  tipo: itemTipoSchema,
  nome: z.string().min(2).max(120),
  atividade: z.string().min(2).max(120)
});

export const updateItemSchema = z.object({
  tipo: itemTipoSchema.optional(),
  nome: z.string().min(2).max(120).optional(),
  atividade: z.string().min(2).max(120).optional()
}).refine((v) => Object.keys(v).length > 0, {
  message: 'Informe ao menos um campo para atualizar'
});

export const listItemsQuerySchema = z.object({
  onlyActive: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      if (typeof v === 'boolean') return v;
      return v === 'true';
    }),
  tipo: z.string().optional()
});

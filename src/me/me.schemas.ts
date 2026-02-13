import { z } from 'zod';

export const patchMeSchema = z.object({
  telefone: z
    .string()
    .regex(/^\d{10,11}$/, 'Telefone deve ter 10 ou 11 dígitos')
    .optional(),
  avatarUrl: z.string().min(1).max(200000).optional() // MVP: aceita URL ou DataURL; limite simples
});

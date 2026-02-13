import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth/require-auth';
import { AppError } from '../errors/app-error';
import {
  getCatalog,
  getInactiveCodesForUser,
  inactivateBank,
  listBanksForUser,
  reactivateBank
} from './banks.service';

const listQuerySchema = z.object({
  onlyActive: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      if (typeof v === 'boolean') return v;
      return v === 'true';
    }),
  q: z.string().optional()
});

const codeParamSchema = z.object({
  code: z.coerce.number().int().positive()
});

export async function bankRoutes(app: FastifyInstance) {
  // GET /api/banks?onlyActive=true&q=...
  app.get('/banks', async (req) => {
    requireAuth(req);

    const query = listQuerySchema.parse(req.query);
    const userId = req.user!.id;

    const banks = await listBanksForUser({
      userId,
      onlyActive: query.onlyActive ?? true,
      q: query.q
    });

    return banks;
  });

  // GET /api/banks/overrides
  app.get('/banks/overrides', async (req) => {
    requireAuth(req);
    const userId = req.user!.id;

    const inactiveCodes = await getInactiveCodesForUser(userId);
    inactiveCodes.sort((a, b) => a - b);

    return { inactiveCodes };
  });

  // POST /api/banks/overrides/{code}/inactivate
  app.post('/banks/overrides/:code/inactivate', async (req, reply) => {
    requireAuth(req);

    const params = codeParamSchema.parse(req.params);
    const userId = req.user!.id;

    await inactivateBank(userId, params.code);

    return reply.code(204).send();
  });

  // DELETE /api/banks/overrides/{code}/inactivate
  app.delete('/banks/overrides/:code/inactivate', async (req, reply) => {
    requireAuth(req);

    const params = codeParamSchema.parse(req.params);
    const userId = req.user!.id;

    await reactivateBank(userId, params.code);

    return reply.code(204).send();
  });

  // POST /api/banks/refresh
  app.post('/banks/refresh', async (req) => {
    requireAuth(req);

    // Força refresh. Se BrasilAPI falhar, vai 502 com code BRASILAPI_UNAVAILABLE
    await getCatalog({ forceRefresh: true });

    return { status: 'REFRESH_SCHEDULED' };
  });

  // Pequeno endpoint opcional de diagnóstico (se quiser remover depois)
  app.get('/banks/_cache', async (req) => {
    requireAuth(req);

    // evita vazar dados sensíveis, só status
    try {
      await getCatalog();
      return { ok: true };
    } catch (e) {
      throw new AppError({
        status: 500,
        code: 'CACHE_ERROR',
        error: 'INTERNAL_ERROR',
        message: 'Falha ao acessar cache de bancos'
      });
    }
  });
}

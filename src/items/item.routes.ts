import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth/require-auth';

import {
  createItemSchema,
  listItemsQuerySchema,
  updateItemSchema
} from './item.schemas';

import {
  activateItem,
  createItem,
  deactivateItem,
  listItems,
  updateItem
} from './item.service';

const idParamSchema = z.object({
  id: z.string().uuid()
});

export async function itemRoutes(app: FastifyInstance) {
  // GET /api/items?onlyActive=false&tipo=SERVICO
  app.get('/items', async (req) => {
    requireAuth(req);

    const query = listItemsQuerySchema.parse(req.query);
    const userId = req.user!.id;

    // valida "tipo" se veio, reaproveitando enum por segurança
    const tipo = query.tipo?.toUpperCase();
    if (tipo && !['EMPRESA', 'PROFISSIONAL', 'SERVICO'].includes(tipo)) {
      // deixa cair no handler padrão com fieldErrors
      throw new (await import('zod')).ZodError([
        {
          code: 'custom',
          path: ['tipo'],
          message: 'Tipo inválido',
          fatal: false
        } as any
      ]);
    }

    return listItems({
      userId,
      onlyActive: query.onlyActive ?? false,
      tipo
    });
  });

  // POST /api/items
  app.post('/items', async (req, reply) => {
    requireAuth(req);

    const body = createItemSchema.parse(req.body);
    const userId = req.user!.id;

    const item = await createItem({
      userId,
      tipo: body.tipo,
      nome: body.nome,
      atividade: body.atividade
    });

    return reply.code(201).send(item);
  });

  // PATCH /api/items/:id
  app.patch('/items/:id', async (req) => {
    requireAuth(req);

    const params = idParamSchema.parse(req.params);
    const body = updateItemSchema.parse(req.body);
    const userId = req.user!.id;

    const item = await updateItem({
      userId,
      id: params.id,
      data: body
    });

    return item;
  });

  // PATCH /api/items/:id/activate
  app.patch('/items/:id/activate', async (req) => {
    requireAuth(req);

    const params = idParamSchema.parse(req.params);
    const userId = req.user!.id;

    return activateItem({ userId, id: params.id });
  });

  // PATCH /api/items/:id/deactivate
  app.patch('/items/:id/deactivate', async (req) => {
    requireAuth(req);

    const params = idParamSchema.parse(req.params);
    const userId = req.user!.id;

    return deactivateItem({ userId, id: params.id });
  });
}

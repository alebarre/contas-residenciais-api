import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db';
import { AppError } from '../errors/app-error';
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

const idSchema = z.string().uuid();

export async function itemRoutes(app: FastifyInstance) {
  // GET /api/items?onlyActive=false&tipo=SERVICO
  app.get('/items', async (req) => {
    requireAuth(req);

    const query = listItemsQuerySchema.parse(req.query);
    const userId = req.user!.id;

    // valida "tipo" se veio, reaproveitando enum por segurança
    const tipo = query.tipo?.toUpperCase();
    if (tipo && !['EMPRESA', 'PROFISSIONAL', 'SERVICO', 'DESPESA'].includes(tipo)) {
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

  const idSchema = z.string().uuid();

  // PATCH /api/items/:id
  app.patch("/items/:id/activate", async (req, reply) => {
    requireAuth(req);

    const itemId = idSchema.parse((req.params as any).id);

    const item = await prisma.item.findUnique({ where: { id: itemId } });
    if (!item) {
      throw new AppError({
        status: 404,
        code: "ITEM_NOT_FOUND",
        error: "NOT_FOUND",
        message: "Item não encontrado.",
      });
    }

    const updated = await prisma.item.update({
      where: { id: itemId },
      data: { ativo: true },
    });

    return reply.send(updated);
  });

  // PATCH /api/items/:id
  app.patch("/items/:id/deactivate", async (req, reply) => {
    requireAuth(req);

    const itemId = idSchema.parse((req.params as any).id);

    // 1) valida se item existe
    const item = await prisma.item.findUnique({ where: { id: itemId } });
    if (!item) {
      throw new AppError({
        status: 404,
        code: "ITEM_NOT_FOUND",
        error: "NOT_FOUND",
        message: "Item não encontrado.",
      });
    }

    // 2) REGRA: não inativar se houver despesas vinculadas
    const vinculadas = await prisma.expense.count({
      where: { itemId }, // ajuste se sua tabela chama "despesa" / "expenses"
    });

    if (vinculadas > 0) {
      throw new AppError({
        status: 409,
        code: "ITEM_HAS_EXPENSES",
        error: "BUSINESS_ERROR",
        message: "Não é possível inativar: existe despesa vinculada.",
      });
    }

    // 3) inativa
    const updated = await prisma.item.update({
      where: { id: itemId },
      data: { ativo: false },
    });

    return reply.send(updated);
  });
}

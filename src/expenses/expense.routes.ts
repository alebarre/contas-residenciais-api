import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth/require-auth';
import {
  createExpenseSchema,
  monthQuerySchema,
  paymentSchema,
  updateExpenseSchema
} from './expense.schemas';
import {
  createExpense,
  deleteExpense,
  listMonthlyExpenses,
  updateExpense,
  updatePayment
} from './expenses.service';

const idParamSchema = z.object({
  id: z.string().uuid()
});

export async function expenseRoutes(app: FastifyInstance) {
  // GET /api/expenses?month=YYYY-MM&itemId=&paid=
  app.get('/expenses', async (req) => {
    requireAuth(req);

    const query = monthQuerySchema.parse(req.query);
    const userId = req.user!.id;

    return listMonthlyExpenses({
      userId,
      month: query.month,
      itemId: query.itemId,
      paid: query.paid
    });
  });

  // POST /api/expenses
  app.post('/expenses', async (req, rep) => {
    requireAuth(req);

    const body = createExpenseSchema.parse(req.body);
    const userId = req.user!.id;

    const created = await createExpense({
      userId,
      dataVencimento: body.dataVencimento,
      dataPagamento: body.dataPagamento ?? null,
      itemId: body.itemId,
      descricao: body.descricao,
      bancoCode: body.bancoCode ?? null,
      valor: body.valor
    });

    return rep.code(201).send(created);
  });

  // PATCH /api/expenses/:id
  app.patch('/expenses/:id', async (req) => {
    requireAuth(req);

    const params = idParamSchema.parse(req.params);
    const body = updateExpenseSchema.parse(req.body);
    const userId = req.user!.id;

    return updateExpense({
      userId,
      id: params.id,
      data: body
    });
  });

  // PATCH /api/expenses/:id/payment
  app.patch('/expenses/:id/payment', async (req) => {
    requireAuth(req);

    const params = idParamSchema.parse(req.params);
    const body = paymentSchema.parse(req.body);
    const userId = req.user!.id;

    return updatePayment({
      userId,
      id: params.id,
      dataPagamento: body.dataPagamento
    });
  });

  // DELETE /api/expenses/:id
  app.delete('/expenses/:id', async (req, rep) => {
    requireAuth(req);

    const params = idParamSchema.parse(req.params);
    const userId = req.user!.id;

    await deleteExpense({ userId, id: params.id });
    return rep.code(204).send();
  });
}

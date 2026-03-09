import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../auth/require-auth";
import {
  createExpenseSchema,
  yearQuerySchema,
  monthQuerySchema,
  paymentSchema,
  updateExpenseSchema,
} from "./expense.schemas";
import {
  createExpense,
  deleteExpense,
  getAnualExpenses,
  listMonthlyExpenses,
  updateExpense,
  updatePayment,
} from "./expenses.service";
import { AppError } from "../errors/app-error";
import { prisma } from "../db"; // ✅ FIX: necessário (seu arquivo atual não importava)

const idParamSchema = z.object({
  id: z.string().uuid(),
});

export async function expenseRoutes(app: FastifyInstance) {
  // GET /api/expenses?month=YYYY-MM&itemId=&paid=
  app.get("/expenses", async (req) => {
    requireAuth(req);

    // Verifica se é consulta anual (year) ou mensal (month)
    const parsedQuery = yearQuerySchema.safeParse(req.query);
    if(parsedQuery.success && parsedQuery.data.year) {
      const userId = req.user!.id;
      return getAnualExpenses({ userId, year: parsedQuery.data.year });
    }

    const query = monthQuerySchema.parse(req.query);
    const userId = req.user!.id;
    return listMonthlyExpenses({
      userId,
      month: query.month,
      itemId: query.itemId,
      paid: query.paid,
    });
  });

    // POST /api/expenses
  app.post("/expenses", async (req, rep) => {
    requireAuth(req);

    const body = createExpenseSchema.parse(req.body);
    const userId = req.user!.id;

    // valida item existe + ativo (mesma regra que você já usava)
    const item = await prisma.item.findUnique({ where: { id: body.itemId } });

    if (!item) {
      throw new AppError({
        status: 404,
        code: "ITEM_NOT_FOUND",
        error: "NOT_FOUND",
        message: "Item não encontrado.",
      });
    }

    if (!item.ativo) {
      throw new AppError({
        status: 409,
        code: "ITEM_INACTIVE",
        error: "BUSINESS_ERROR",
        message: "Não é possível criar despesa com item inativo.",
      });
    }

    const created = await createExpense({
      userId,
      dataVencimento: body.dataVencimento,
      dataPagamento: body.dataPagamento ?? null,
      itemId: body.itemId,
      descricao: body.descricao ?? "",
      bancoCode: body.bancoCode ?? null,
      valor: body.valor,

      // ✅ NOVO
      paymentMethod: body.paymentMethod ?? "OUTROS",
    });

    return rep.code(201).send(created);
  });

  // PATCH /api/expenses/:id
  app.patch("/expenses/:id", async (req) => {
    requireAuth(req);

    const params = idParamSchema.parse(req.params);
    const body = updateExpenseSchema.parse(req.body);
    const userId = req.user!.id;

    return updateExpense({
      userId,
      id: params.id,
      data: body,
    });
  });

  // PATCH /api/expenses/:id/payment
  app.patch("/expenses/:id/payment", async (req) => {
    requireAuth(req);

    const params = idParamSchema.parse(req.params);
    const body = paymentSchema.parse(req.body);
    const userId = req.user!.id;

    return updatePayment({
      userId,
      id: params.id,
      dataPagamento: body.dataPagamento,
    });
  });

  // DELETE /api/expenses/:id
  app.delete("/expenses/:id", async (req, rep) => {
    requireAuth(req);

    const params = idParamSchema.parse(req.params);
    const userId = req.user!.id;

    await deleteExpense({ userId, id: params.id });
    return rep.code(204).send();
  });
}

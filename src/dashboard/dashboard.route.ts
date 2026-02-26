import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth/require-auth";
import {
  dashboardMonthQuerySchema,
  dashboardQuerySchema,
} from "./dashboard.schemas";
import { getDashboardSummary } from "./dashboard.service";
import { listMonthlyExpenses } from "../expenses/expenses.service";

export async function dashboardRoutes(app: FastifyInstance) {
  // GET /api/dashboard?month=YYYY-MM
  // Endpoint agregado para evitar múltiplas chamadas no front.
  // Retorna: summary (inclui historicoMensal) + expenses do mês.
  app.get("/dashboard", async (req) => {
    requireAuth(req);

    const query = dashboardMonthQuerySchema.parse(req.query);
    const userId = req.user!.id;

    const [yearStr, monthStr] = query.month.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr); // 1..12

    const [summary, expenses] = await Promise.all([
      getDashboardSummary({ userId, year, month }),
      listMonthlyExpenses({ userId, month: query.month }),
    ]);

    return {
      month: query.month,
      summary,
      expenses,
    };
  });

  // GET /api/dashboard/summary?year=2026&month=2
  app.get("/dashboard/summary", async (req) => {
    requireAuth(req);

    const query = dashboardQuerySchema.parse(req.query);
    const userId = req.user!.id;

    return getDashboardSummary({
      userId,
      year: query.year,
      month: query.month,
    });
  });
}

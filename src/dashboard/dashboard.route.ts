import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../auth/require-auth';
import { dashboardQuerySchema } from './dashboard.schemas';
import { getDashboardSummary } from './dashboard.service';

export async function dashboardRoutes(app: FastifyInstance) {
  // GET /api/dashboard/summary?year=2026&month=2
  app.get('/dashboard/summary', async (req) => {
    requireAuth(req);

    const query = dashboardQuerySchema.parse(req.query);
    const userId = req.user!.id;

    return getDashboardSummary({
      userId,
      year: query.year,
      month: query.month
    });
  });
}

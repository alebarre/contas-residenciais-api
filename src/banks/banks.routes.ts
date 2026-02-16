import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../auth/require-auth";
import { AppError } from "../errors/app-error";
import { prisma } from "../db";
import {
  getCatalog,
  getInactiveCodesForUser,
  listBanksForUser,
} from "./banks.service";

const listQuerySchema = z.object({
  onlyActive: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      if (typeof v === "boolean") return v;
      return v === "true";
    }),
  q: z.string().optional(),
});

const bulkSchema = z.object({
  codes: z.array(z.coerce.number().int().positive()).min(1).max(2000),
});

export async function bankRoutes(app: FastifyInstance) {
  // GET /api/banks?onlyActive=true&q=...
  app.get("/banks", async (req) => {
    requireAuth(req);

    const query = listQuerySchema.parse(req.query);
    const userId = req.user!.id;

    const banks = await listBanksForUser({
      userId,
      onlyActive: query.onlyActive ?? true,
      q: query.q,
    });

    return banks;
  });

  // GET /api/banks/overrides
  app.get("/banks/overrides", async (req) => {
    requireAuth(req);
    const userId = req.user!.id;

    const inactiveCodes = await getInactiveCodesForUser(userId);
    inactiveCodes.sort((a, b) => a - b);

    return { inactiveCodes };
  });

  // POST /api/banks/overrides/:code/inactivate -> 204
  app.post("/banks/overrides/:code/inactivate", async (req, reply) => {
    requireAuth(req);
    const userId = req.user!.id;

    const code = z.coerce
      .number()
      .int()
      .positive()
      .parse((req.params as any).code);

    await prisma.bankOverride.upsert({
      where: { userId_code: { userId, code } },
      create: { userId, code, inactive: true },
      update: { inactive: true },
    });

    return reply.code(204).send();
  });

  // DELETE /api/banks/overrides/:code/inactivate -> 204
  app.delete("/banks/overrides/:code/inactivate", async (req, reply) => {
    requireAuth(req);
    const userId = req.user!.id;

    const code = z.coerce
      .number()
      .int()
      .positive()
      .parse((req.params as any).code);

    await prisma.bankOverride.deleteMany({
      where: { userId, code },
    });

    return reply.code(204).send();
  });

  // POST /api/banks/overrides/bulk/reactivate  { codes: number[] } -> 204
  // (POST em vez de DELETE com body => evita 400 por body undefined)
  app.post("/banks/overrides/bulk/reactivate", async (req, reply) => {
    requireAuth(req);
    const userId = req.user!.id;

    const body = bulkSchema.parse(req.body);
    const distinct = Array.from(new Set(body.codes));

    await prisma.bankOverride.deleteMany({
      where: { userId, code: { in: distinct } },
    });

    return reply.code(204).send();
  });

  // POST /api/banks/overrides/inactivate-all -> 204
  // Inativa TODOS os bancos do catálogo (sem payload do front)
  app.post("/banks/overrides/inactivate-all", async (req, reply) => {
    requireAuth(req);
    const userId = req.user!.id;

    const catalog = await getCatalog({ forceRefresh: false });
    const codes = Array.from(new Set(catalog.map((b) => b.code)));

    await prisma.bankOverride.createMany({
      data: codes.map((code) => ({ userId, code, inactive: true })),
      skipDuplicates: true,
    });

    await prisma.bankOverride.updateMany({
      where: { userId, code: { in: codes } },
      data: { inactive: true },
    });

    return reply.code(204).send();
  });

  // POST /api/banks/overrides/reactivate-all -> 204
  // Remove todos overrides (volta tudo a ativo)
  app.post("/banks/overrides/reactivate-all", async (req, reply) => {
    requireAuth(req);
    const userId = req.user!.id;

    await prisma.bankOverride.deleteMany({
      where: { userId },
    });

    return reply.code(204).send();
  });

  // POST /api/banks/refresh
  app.post("/banks/refresh", async (req) => {
    requireAuth(req);

    // Força refresh. Se BrasilAPI falhar, vai 502 com code BRASILAPI_UNAVAILABLE
    await getCatalog({ forceRefresh: true });

    return { status: "REFRESH_SCHEDULED" };
  });

  // Endpoint opcional de diagnóstico do cache
  app.get("/banks/_cache", async (req) => {
    requireAuth(req);

    try {
      await getCatalog();
      return { ok: true };
    } catch {
      throw new AppError({
        status: 500,
        code: "CACHE_ERROR",
        error: "INTERNAL_ERROR",
        message: "Falha ao acessar cache de bancos",
      });
    }
  });
}

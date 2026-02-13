import type { FastifyInstance } from 'fastify';
import { prisma } from '../db';
import { AppError } from '../errors/app-error';
import { requireAuth } from '../auth/require-auth';
import { patchMeSchema } from './me.schemas';

export async function meRoutes(app: FastifyInstance) {
  app.get('/me', async (req) => {
    requireAuth(req);

    const userId = req.user!.id;

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new AppError({
        status: 404,
        code: 'USER_NOT_FOUND',
        error: 'NOT_FOUND',
        message: 'Usuário não encontrado'
      });
    }

    return {
      id: user.id,
      nome: user.nome,
      email: user.email,
      telefone: user.telefone,
      avatarUrl: user.avatarUrl
    };
  });

  app.patch('/me', async (req) => {
    requireAuth(req);

    const userId = req.user!.id;
    const body = patchMeSchema.parse(req.body);

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(body.telefone !== undefined ? { telefone: body.telefone } : {}),
        ...(body.avatarUrl !== undefined ? { avatarUrl: body.avatarUrl } : {})
      }
    });

    return {
      id: user.id,
      nome: user.nome,
      email: user.email,
      telefone: user.telefone,
      avatarUrl: user.avatarUrl
    };
  });
}

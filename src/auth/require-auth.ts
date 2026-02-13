import type { FastifyInstance, FastifyRequest } from 'fastify';
import { AppError } from '../errors/app-error';
import { verifyAccessToken } from './jwt';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      email: string;
    };
  }
}

export function registerAuth(app: FastifyInstance) {
  app.decorateRequest('user', undefined);

  app.addHook('preHandler', async (req) => {
    // Rotas públicas ficam fora deste hook global (vamos aplicar por route-level)
    // Aqui não faz nada.
  });
}

export function requireAuth(req: FastifyRequest) {
  const auth = req.headers.authorization;

  if (!auth || !auth.startsWith('Bearer ')) {
    throw new AppError({
      status: 401,
      code: 'UNAUTHORIZED',
      error: 'UNAUTHORIZED',
      message: 'Token ausente'
    });
  }

  const token = auth.slice('Bearer '.length).trim();
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, email: payload.email };
  } catch {
    throw new AppError({
      status: 401,
      code: 'UNAUTHORIZED',
      error: 'UNAUTHORIZED',
      message: 'Token inválido'
    });
  }
}

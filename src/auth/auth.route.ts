import type { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import bcrypt from 'bcryptjs';

import { prisma } from '../db';
import { AppError } from '../errors/app-error';
import { signAccessToken } from './jwt';
import { loginSchema, registerSchema } from './auth.schemas';

export async function authRoutes(app: FastifyInstance) {
  // rate-limit somente no login
  await app.register(rateLimit, {
    max: 10,
    timeWindow: '1 minute'
  });

  app.post('/auth/register', async (req) => {
    const body = registerSchema.parse(req.body);

    const existing = await prisma.user.findUnique({
      where: { email: body.email }
    });

    if (existing) {
      throw new AppError({
        status: 409,
        code: 'EMAIL_ALREADY_EXISTS',
        error: 'BUSINESS_ERROR',
        message: 'E-mail já cadastrado'
      });
    }

    const passwordHash = await bcrypt.hash(body.senha, 10);

    const user = await prisma.user.create({
      data: {
        nome: body.nome,
        email: body.email,
        passwordHash
      }
    });

    const token = signAccessToken({ sub: user.id, email: user.email });

    return {
      token,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        telefone: user.telefone,
        avatarUrl: user.avatarUrl
      }
    };
  });

  app.post('/auth/login', {
    // rate limit mais “forte” aqui também (por rota)
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '1 minute'
      }
    }
  }, async (req) => {
    const body = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: body.email }
    });

    if (!user) {
      throw new AppError({
        status: 401,
        code: 'INVALID_CREDENTIALS',
        error: 'UNAUTHORIZED',
        message: 'Credenciais inválidas'
      });
    }

    const ok = await bcrypt.compare(body.senha, user.passwordHash);

    if (!ok) {
      throw new AppError({
        status: 401,
        code: 'INVALID_CREDENTIALS',
        error: 'UNAUTHORIZED',
        message: 'Credenciais inválidas'
      });
    }

    const token = signAccessToken({ sub: user.id, email: user.email });

    return {
      token,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        telefone: user.telefone,
        avatarUrl: user.avatarUrl
      }
    };
  });
}

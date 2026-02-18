// src/routes/auth.routes.ts
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../db';
import { env } from '../env';
import { AppError } from '../errors/app-error';
import { sendMail } from '../mailer/mailer';

function signAccessToken(userId: string, email: string) {
  return (global as any).jwtSign
    ? (global as any).jwtSign({ sub: userId, email }) // (se você tiver wrapper global)
    : require('jsonwebtoken').sign({ sub: userId, email }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function generate6DigitsCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

const registerSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  senha: z.string().min(6).max(72),
  telefone: z.string().trim().optional(),
  avatarUrl: z.string().trim().url().optional()
});

const loginSchema = z.object({
  email: z.string().trim().email().max(255),
  senha: z.string().min(1).max(72)
});

const forgotSchema = z.object({
  email: z.string().trim().email().max(255)
});

const resetSchema = z.object({
  email: z.string().trim().email().max(255),
  code: z.string().trim().min(1, 'Código é obrigatório').max(12),
  newPassword: z.string().min(6).max(72)
});

export const authRoutes: FastifyPluginAsync = async (app) => {
  // -------------------------
  // POST /api/auth/register
  // -------------------------
  app.post('/auth/register', async (req, reply) => {
    const body = registerSchema.parse(req.body);
    const email = normalizeEmail(body.email);

    const existing = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true }
    });

    if (existing) {
      throw new AppError({
        status: 400,
        error: 'BAD_REQUEST',
        code: 'EMAIL_ALREADY_EXISTS',
        message: 'E-mail já cadastrado.'
      });
    }

    const passwordHash = await bcrypt.hash(body.senha, 10);

    const user = await prisma.user.create({
      data: {
        nome: body.nome.trim(),
        email,
        passwordHash,
        telefone: body.telefone?.trim() || null,
        avatarUrl: body.avatarUrl?.trim() || null
      },
      select: {
        id: true,
        nome: true,
        email: true,
        telefone: true,
        avatarUrl: true
      }
    });

    const token = signAccessToken(user.id, user.email);

    return reply.status(201).send({
      token,
      user
    });
  });

  // -------------------------
  // POST /api/auth/login
  // -------------------------
  app.post('/auth/login', async (req, reply) => {
    const body = loginSchema.parse(req.body);
    const email = normalizeEmail(body.email);

    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: {
        id: true,
        nome: true,
        email: true,
        telefone: true,
        avatarUrl: true,
        passwordHash: true
      }
    });

    if (!user) {
      throw new AppError({
        status: 401,
        error: 'UNAUTHORIZED',
        code: 'INVALID_CREDENTIALS',
        message: 'Credenciais inválidas.'
      });
    }

    const ok = await bcrypt.compare(body.senha, user.passwordHash);
    if (!ok) {
      throw new AppError({
        status: 401,
        error: 'UNAUTHORIZED',
        code: 'INVALID_CREDENTIALS',
        message: 'Credenciais inválidas.'
      });
    }

    const token = signAccessToken(user.id, user.email);

    return reply.send({
      token,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        telefone: user.telefone,
        avatarUrl: user.avatarUrl
      }
    });
  });

  // ---------------------------------------
  // POST /api/auth/forgot-password
  // - sempre retorna 204 (não vaza usuário)
  // - se existir, gera código (5min) e envia
  // ---------------------------------------
  app.post('/auth/forgot-password', async (req, reply) => {
    const body = forgotSchema.parse(req.body);
    const email = normalizeEmail(body.email);

    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, email: true, nome: true }
    });

    if (!user) {
      return reply.status(204).send();
    }

    // invalida qualquer token pendente anterior (uso único por solicitação)
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() }
    });

    const code = generate6DigitsCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min em ms

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        codeHash,
        expiresAt
      }
    });

    // envio real (se SMTP configurado)
    // se não estiver, faz fallback em log (para dev)
    const smtpConfigured =
      !!env.SMTP_HOST && !!env.SMTP_PORT && !!env.SMTP_USER && !!env.SMTP_PASS && !!env.SMTP_FROM;

    if (smtpConfigured) {
      await sendMail({
        to: user.email,
        subject: 'Código de Reset de Senha',
        text: `Olá ${user.nome},\n\nSeu código de reset de senha é: ${code}\n\nEste código expira em 5 minutos.`
      });
    } else {
      // fallback dev: não quebra fluxo local
      // eslint-disable-next-line no-console
      console.log('[FORGOT] SMTP não configurado. Código para', user.email, '=>', code);
    }

    return reply.status(204).send();
  });

  // ---------------------------------------
  // POST /api/auth/reset-password
  // - valida código
  // - diferencia INVALID vs EXPIRED
  // - código é uso único
  // ---------------------------------------
  app.post('/auth/reset-password', async (req, reply) => {
    const body = resetSchema.parse(req.body);
    const email = normalizeEmail(body.email);

    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true }
    });

    if (!user) {
      throw new AppError({
        status: 400,
        error: 'BAD_REQUEST',
        code: 'INVALID_RESET_CODE',
        message: 'Código inválido.'
      });
    }

    // pega alguns tokens pendentes recentes (não usados)
    const pending = await prisma.passwordResetToken.findMany({
      where: { userId: user.id, usedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    if (pending.length === 0) {
      throw new AppError({
        status: 400,
        error: 'BAD_REQUEST',
        code: 'INVALID_RESET_CODE',
        message: 'Código inválido.'
      });
    }

    const inputCode = String(body.code).trim();
    const nowMs = Date.now();

    let matchedValid: (typeof pending)[number] | null = null;
    let matchedExpired: (typeof pending)[number] | null = null;

    // compara o código contra TODOS os pendentes (válidos e expirados),
    // para retornar EXPIRED se o código existir mas tiver expirado.
    for (const t of pending) {
      const ok = await bcrypt.compare(inputCode, t.codeHash);
      if (!ok) continue;

      if (t.expiresAt.getTime() > nowMs) {
        matchedValid = t;
        break; // válido tem prioridade
      } else {
        matchedExpired = t; // bateu, mas expirou
      }
    }

    if (matchedValid) {
      const newHash = await bcrypt.hash(body.newPassword, 10);

      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: { passwordHash: newHash }
        }),
        prisma.passwordResetToken.update({
          where: { id: matchedValid.id },
          data: { usedAt: new Date() }
        })
      ]);

      return reply.status(204).send();
    }

    if (matchedExpired) {
      throw new AppError({
        status: 400,
        error: 'BAD_REQUEST',
        code: 'RESET_CODE_EXPIRED',
        message: 'Código expirado. Solicite um novo código.'
      });
    }

    // não bateu em nenhum token
    const hasAnyValid = pending.some((t: { expiresAt: { getTime: () => number; }; }) => t.expiresAt.getTime() > nowMs);

    throw new AppError({
      status: 400,
      error: 'BAD_REQUEST',
      code: hasAnyValid ? 'INVALID_RESET_CODE' : 'RESET_CODE_EXPIRED',
      message: hasAnyValid ? 'Código inválido.' : 'Código expirado. Solicite um novo código.'
    });
  });
};

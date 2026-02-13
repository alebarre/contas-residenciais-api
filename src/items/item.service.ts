import { prisma } from '../db';
import { AppError } from '../errors/app-error';

export async function listItems(params: {
  userId: string;
  onlyActive?: boolean;
  tipo?: string;
}) {
  const onlyActive = params.onlyActive ?? false;

  return prisma.item.findMany({
    where: {
      userId: params.userId,
      ...(onlyActive ? { ativo: true } : {}),
      ...(params.tipo ? { tipo: params.tipo } : {})
    },
    orderBy: [{ ativo: 'desc' }, { nome: 'asc' }]
  });
}

export async function createItem(params: {
  userId: string;
  tipo: string;
  nome: string;
  atividade: string;
}) {
  return prisma.item.create({
    data: {
      userId: params.userId,
      tipo: params.tipo,
      nome: params.nome,
      atividade: params.atividade
    }
  });
}

export async function updateItem(params: {
  userId: string;
  id: string;
  data: { tipo?: string; nome?: string; atividade?: string };
}) {
  const existing = await prisma.item.findFirst({
    where: { id: params.id, userId: params.userId }
  });

  if (!existing) {
    throw new AppError({
      status: 404,
      code: 'ITEM_NOT_FOUND',
      error: 'NOT_FOUND',
      message: 'Item não encontrado'
    });
  }

  return prisma.item.update({
    where: { id: params.id },
    data: {
      ...(params.data.tipo !== undefined ? { tipo: params.data.tipo } : {}),
      ...(params.data.nome !== undefined ? { nome: params.data.nome } : {}),
      ...(params.data.atividade !== undefined ? { atividade: params.data.atividade } : {})
    }
  });
}

export async function activateItem(params: { userId: string; id: string }) {
  const existing = await prisma.item.findFirst({
    where: { id: params.id, userId: params.userId }
  });

  if (!existing) {
    throw new AppError({
      status: 404,
      code: 'ITEM_NOT_FOUND',
      error: 'NOT_FOUND',
      message: 'Item não encontrado'
    });
  }

  return prisma.item.update({
    where: { id: params.id },
    data: { ativo: true }
  });
}

export async function deactivateItem(params: { userId: string; id: string }) {
  const existing = await prisma.item.findFirst({
    where: { id: params.id, userId: params.userId }
  });

  if (!existing) {
    throw new AppError({
      status: 404,
      code: 'ITEM_NOT_FOUND',
      error: 'NOT_FOUND',
      message: 'Item não encontrado'
    });
  }

  // REGRA DE NEGÓCIO: não inativar se existir despesa vinculada
  const linked = await prisma.expense.count({
    where: { userId: params.userId, itemId: params.id }
  });

  if (linked > 0) {
    throw new AppError({
      status: 409,
      code: 'ITEM_HAS_EXPENSES',
      error: 'BUSINESS_ERROR',
      message: 'Não é possível inativar: existe despesa vinculada a este item.'
    });
  }

  return prisma.item.update({
    where: { id: params.id },
    data: { ativo: false }
  });
}

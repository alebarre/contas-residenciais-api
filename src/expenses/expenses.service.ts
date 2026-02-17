import { prisma } from '../db';
import { AppError } from '../errors/app-error';
import { fromCents, toCents } from './money';
import { getCatalog } from '../banks/banks.service';

function parseDateOnly(dateStr: string): Date {
  // Interpreta como date-only. Date('YYYY-MM-DD') vira UTC em JS, então fazemos manual.
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function formatDateOnly(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function monthRange(month: string): { start: Date; end: Date } {
  const [y, m] = month.split('-').map(Number);
  const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const end = new Date(y, m, 1, 0, 0, 0, 0); // primeiro dia do próximo mês
  return { start, end };
}

async function resolveBankNameByCode(code: number | null | undefined): Promise<string | null> {
  if (!code) return null;
  const catalog = await getCatalog(); // usa cache 24h
  const b = catalog.find((x) => x.code === code);
  return b ? b.name : null;
}

export type ExpenseReadDTO = {
  id: string;
  dataVencimento: string;
  dataPagamento: string | null;
  itemId: string;
  itemNome: string;
  descricao: string;
  bancoCode: number | null;
  bancoPagamento: string | null;
  valor: number;
};

export async function listMonthlyExpenses(params: {
  userId: string;
  month: string;
  itemId?: string;
  paid?: boolean;
}): Promise<ExpenseReadDTO[]> {
  const { start, end } = monthRange(params.month);

  const where: any = {
    userId: params.userId,
    dataVencimento: { gte: start, lt: end }
  };

  if (params.itemId) where.itemId = params.itemId;

  if (params.paid === true) where.dataPagamento = { not: null };
  if (params.paid === false) where.dataPagamento = null;

  const expenses = await prisma.expense.findMany({
    where,
    include: { item: true },
    orderBy: [{ dataVencimento: 'asc' }, { createdAt: 'asc' }]
  });

  // Resolver nomes de bancos em lote (via catálogo cacheado)
  const catalog = await getCatalog();
  const bankNameMap = new Map<number, string>();
  for (const b of catalog) bankNameMap.set(b.code, b.name);

  return expenses.map((e: { 
      id: any; 
      dataVencimento: Date; 
      dataPagamento: Date | null; 
      itemId: any; 
      item: { nome: any; }; 
      descricao: any; 
      bancoCode: number | null; 
      valorCents: number; 
    }) => ({
    id: e.id,
    dataVencimento: formatDateOnly(e.dataVencimento),
    dataPagamento: e.dataPagamento ? formatDateOnly(e.dataPagamento) : null,
    itemId: e.itemId,
    itemNome: e.item.nome,
    descricao: e.descricao,
    bancoCode: e.bancoCode ?? null,
    bancoPagamento: e.bancoCode ? bankNameMap.get(e.bancoCode) ?? null : null,
    valor: fromCents(e.valorCents)
  }));
}

export async function createExpense(params: {
  userId: string;
  dataVencimento: string;
  dataPagamento?: string | null;
  itemId: string;
  descricao: string;
  bancoCode?: number | null;
  valor: number;
}): Promise<ExpenseReadDTO> {
  // valida item pertence ao usuário
  const item = await prisma.item.findFirst({
    where: { id: params.itemId, userId: params.userId }
  });

  if (!item) {
    throw new AppError({
      status: 404,
      code: 'ITEM_NOT_FOUND',
      error: 'NOT_FOUND',
      message: 'Item não encontrado'
    });
  }

  // se veio bancoCode, validar existe no catálogo
  if (params.bancoCode) {
    const name = await resolveBankNameByCode(params.bancoCode);
    if (!name) {
      throw new AppError({
        status: 404,
        code: 'BANK_NOT_FOUND_IN_CATALOG',
        error: 'NOT_FOUND',
        message: 'Banco não encontrado no catálogo'
      });
    }
  }

  const created = await prisma.expense.create({
    data: {
      userId: params.userId,
      itemId: params.itemId,
      dataVencimento: parseDateOnly(params.dataVencimento),
      dataPagamento: params.dataPagamento ? parseDateOnly(params.dataPagamento) : null,
      descricao: params.descricao,
      bancoCode: params.bancoCode ?? null,
      valorCents: toCents(params.valor)
    },
    include: { item: true }
  });

  const bancoPagamento = await resolveBankNameByCode(created.bancoCode ?? null);

  return {
    id: created.id,
    dataVencimento: formatDateOnly(created.dataVencimento),
    dataPagamento: created.dataPagamento ? formatDateOnly(created.dataPagamento) : null,
    itemId: created.itemId,
    itemNome: created.item.nome,
    descricao: created.descricao,
    bancoCode: created.bancoCode ?? null,
    bancoPagamento,
    valor: fromCents(created.valorCents)
  };
}

export async function updateExpense(params: {
  userId: string;
  id: string;
  data: {
    dataVencimento?: string;
    dataPagamento?: string | null;
    itemId?: string;
    descricao?: string;
    bancoCode?: number | null;
    valor?: number;
  };
}): Promise<ExpenseReadDTO> {
  const existing = await prisma.expense.findFirst({
    where: { id: params.id, userId: params.userId },
    include: { item: true }
  });

  if (!existing) {
    throw new AppError({
      status: 404,
      code: 'EXPENSE_NOT_FOUND',
      error: 'NOT_FOUND',
      message: 'Despesa não encontrada'
    });
  }

  // Se mudar itemId, validar pertence ao usuário
  if (params.data.itemId) {
    const item = await prisma.item.findFirst({
      where: { id: params.data.itemId, userId: params.userId }
    });
    if (!item) {
      throw new AppError({
        status: 404,
        code: 'ITEM_NOT_FOUND',
        error: 'NOT_FOUND',
        message: 'Item não encontrado'
      });
    }
  }

  // Se veio bancoCode (inclui null), se number -> validar existe no catálogo
  if (params.data.bancoCode !== undefined && params.data.bancoCode !== null) {
    const name = await resolveBankNameByCode(params.data.bancoCode);
    if (!name) {
      throw new AppError({
        status: 404,
        code: 'BANK_NOT_FOUND_IN_CATALOG',
        error: 'NOT_FOUND',
        message: 'Banco não encontrado no catálogo'
      });
    }
  }

  const updated = await prisma.expense.update({
    where: { id: params.id },
    data: {
      ...(params.data.dataVencimento !== undefined
        ? { dataVencimento: parseDateOnly(params.data.dataVencimento) }
        : {}),
      ...(params.data.dataPagamento !== undefined
        ? { dataPagamento: params.data.dataPagamento ? parseDateOnly(params.data.dataPagamento) : null }
        : {}),
      ...(params.data.itemId !== undefined ? { itemId: params.data.itemId } : {}),
      ...(params.data.descricao !== undefined ? { descricao: params.data.descricao } : {}),
      ...(params.data.bancoCode !== undefined ? { bancoCode: params.data.bancoCode } : {}),
      ...(params.data.valor !== undefined ? { valorCents: toCents(params.data.valor) } : {})
    },
    include: { item: true }
  });

  // Resolver banco mesmo se estiver inativo (catálogo é o mesmo; inativo é override só para seleção)
  const bancoPagamento = updated.bancoCode ? await resolveBankNameByCode(updated.bancoCode) : null;

  return {
    id: updated.id,
    dataVencimento: formatDateOnly(updated.dataVencimento),
    dataPagamento: updated.dataPagamento ? formatDateOnly(updated.dataPagamento) : null,
    itemId: updated.itemId,
    itemNome: updated.item.nome,
    descricao: updated.descricao,
    bancoCode: updated.bancoCode ?? null,
    bancoPagamento,
    valor: fromCents(updated.valorCents)
  };
}

export async function updatePayment(params: {
  userId: string;
  id: string;
  dataPagamento: string | null;
}): Promise<ExpenseReadDTO> {
  const existing = await prisma.expense.findFirst({
    where: { id: params.id, userId: params.userId },
    include: { item: true }
  });

  if (!existing) {
    throw new AppError({
      status: 404,
      code: 'EXPENSE_NOT_FOUND',
      error: 'NOT_FOUND',
      message: 'Despesa não encontrada'
    });
  }

  const updated = await prisma.expense.update({
    where: { id: params.id },
    data: {
      dataPagamento: params.dataPagamento ? parseDateOnly(params.dataPagamento) : null
    },
    include: { item: true }
  });

  const bancoPagamento = updated.bancoCode ? await resolveBankNameByCode(updated.bancoCode) : null;

  return {
    id: updated.id,
    dataVencimento: formatDateOnly(updated.dataVencimento),
    dataPagamento: updated.dataPagamento ? formatDateOnly(updated.dataPagamento) : null,
    itemId: updated.itemId,
    itemNome: updated.item.nome,
    descricao: updated.descricao,
    bancoCode: updated.bancoCode ?? null,
    bancoPagamento,
    valor: fromCents(updated.valorCents)
  };
}

export async function deleteExpense(params: { userId: string; id: string }) {
  const existing = await prisma.expense.findFirst({
    where: { id: params.id, userId: params.userId }
  });

  if (!existing) {
    throw new AppError({
      status: 404,
      code: 'EXPENSE_NOT_FOUND',
      error: 'NOT_FOUND',
      message: 'Despesa não encontrada'
    });
  }

  await prisma.expense.delete({ where: { id: params.id } });
}

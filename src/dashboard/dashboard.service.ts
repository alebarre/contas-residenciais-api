import { prisma } from '../db';
import { fromCents } from '../expenses/money';

function monthRange(year: number, month: number): { start: Date; end: Date } {
  // month: 1..12
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 1, 0, 0, 0, 0);
  return { start, end };
}

function yearRange(year: number): { start: Date; end: Date } {
  const start = new Date(year, 0, 1, 0, 0, 0, 0);
  const end = new Date(year + 1, 0, 1, 0, 0, 0, 0);
  return { start, end };
}

export type DashboardSummaryDTO = {
  contasDoMes: number;
  maiorDespesaDoMes: { itemNome: string; valor: number } | null;
  totalPagoNoMes: number;
  historicoMensal: { mes: number; total: number }[];
};

export async function getDashboardSummary(params: {
  userId: string;
  year: number;
  month: number;
}): Promise<DashboardSummaryDTO> {
  const { start, end } = monthRange(params.year, params.month);

  // 1) Quantidade de contas do mês (todas as despesas do mês)
  const contasDoMesPromise = prisma.expense.count({
    where: { userId: params.userId, dataVencimento: { gte: start, lt: end } }
  });

  // 2) Total pago no mês (despesas com dataPagamento != null e dentro do mês por vencimento)
  // OBS: estamos usando dataVencimento como referência mensal (coerente com listagem mensal do app).
  const totalPagoAggPromise = prisma.expense.aggregate({
    where: {
      userId: params.userId,
      dataVencimento: { gte: start, lt: end },
      dataPagamento: { not: null }
    },
    _sum: { valorCents: true }
  });

  // 3) Maior despesa do mês (por valorCents) — join com Item para itemNome
  const maiorDespesaPromise = prisma.expense.findFirst({
    where: { userId: params.userId, dataVencimento: { gte: start, lt: end } },
    orderBy: { valorCents: 'desc' },
    include: { item: true }
  });

  // 4) Histórico mensal do ano (12 pontos, soma de valorCents por mês)
  const { start: yStart, end: yEnd } = yearRange(params.year);

  // Busca todas as despesas do ano e agrega em memória por mês (simples e suficiente pro MVP).
  // Se crescer, dá para otimizar com query raw/groupBy.
  const yearExpensesPromise = prisma.expense.findMany({
    where: { userId: params.userId, dataVencimento: { gte: yStart, lt: yEnd } },
    select: { dataVencimento: true, valorCents: true }
  });

  const [contasDoMes, totalPagoAgg, maiorDespesa, yearExpenses] = await Promise.all([
    contasDoMesPromise,
    totalPagoAggPromise,
    maiorDespesaPromise,
    yearExpensesPromise
  ]);

  const totalPagoNoMesCents = totalPagoAgg._sum.valorCents ?? 0;

  const totalsByMonthCents = new Array<number>(12).fill(0);
  for (const e of yearExpenses) {
    const m = e.dataVencimento.getMonth(); // 0..11
    totalsByMonthCents[m] += e.valorCents;
  }

  const historicoMensal = totalsByMonthCents.map((cents, idx) => ({
    mes: idx + 1,
    total: fromCents(cents)
  }));

  return {
    contasDoMes,
    maiorDespesaDoMes: maiorDespesa
      ? { itemNome: maiorDespesa.item.nome, valor: fromCents(maiorDespesa.valorCents) }
      : null,
    totalPagoNoMes: fromCents(totalPagoNoMesCents),
    historicoMensal
  };
}

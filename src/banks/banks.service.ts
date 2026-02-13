import { prisma } from '../db';
import { env } from '../env';
import { AppError } from '../errors/app-error';
import { BankDTO } from './banks.type';

type BrasilApiBank = {
  ispb: string;
  name: string;
  code: number;
  fullName: string;
};

function getBrasilApiBaseUrl() {
  return (process.env.BRASILAPI_BASE_URL ?? 'https://brasilapi.com.br').replace(/\/$/, '');
}

function getTtlHours() {
  const raw = process.env.BANK_CATALOG_TTL_HOURS ?? '24';
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 24;
}

function isCacheFresh(updatedAt: Date) {
  const ttlHours = getTtlHours();
  const ageMs = Date.now() - updatedAt.getTime();
  return ageMs < ttlHours * 60 * 60 * 1000;
}

async function fetchCatalogFromBrasilApi(): Promise<BankDTO[]> {
  const url = `${getBrasilApiBaseUrl()}/api/banks/v1`;

  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) {
    throw new AppError({
      status: 502,
      code: 'BRASILAPI_UNAVAILABLE',
      error: 'INTERNAL_ERROR',
      message: 'Falha ao consultar catálogo de bancos (BrasilAPI)'
    });
  }

  const data = (await res.json()) as BrasilApiBank[];

  // Normaliza e garante tipos
  return (data ?? []).map((b) => ({
    code: Number(b.code),
    name: String(b.name ?? ''),
    fullName: String(b.fullName ?? ''),
    ispb: String(b.ispb ?? '')
  }));
}

async function upsertCache(banks: BankDTO[]) {
  await prisma.bankCatalogCache.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      updatedAt: new Date(),
      dataJson: banks as any
    },
    update: {
      updatedAt: new Date(),
      dataJson: banks as any
    }
  });
}

export async function getCatalog(options?: { forceRefresh?: boolean }): Promise<BankDTO[]> {
  const force = options?.forceRefresh === true;

  const cache = await prisma.bankCatalogCache.findUnique({ where: { id: 1 } });

  if (!force && cache?.updatedAt && isCacheFresh(cache.updatedAt)) {
    return (cache.dataJson as any) as BankDTO[];
  }

  const fresh = await fetchCatalogFromBrasilApi();
  await upsertCache(fresh);
  return fresh;
}

export async function getInactiveCodesForUser(userId: string): Promise<number[]> {
  const overrides = await prisma.bankOverride.findMany({
    where: { userId, inactive: true },
    select: { code: true }
  });

  return overrides.map((o: { code: any; }) => o.code);
}

export async function ensureCodeExistsInCatalog(code: number) {
  const catalog = await getCatalog();
  const exists = catalog.some((b) => b.code === code);
  if (!exists) {
    throw new AppError({
      status: 404,
      code: 'BANK_NOT_FOUND_IN_CATALOG',
      error: 'NOT_FOUND',
      message: 'Banco não encontrado no catálogo'
    });
  }
}

export async function inactivateBank(userId: string, code: number) {
  await ensureCodeExistsInCatalog(code);

  await prisma.bankOverride.upsert({
    where: { userId_code: { userId, code } },
    create: { userId, code, inactive: true },
    update: { inactive: true }
  });
}

export async function reactivateBank(userId: string, code: number) {
  // Se não existir no catálogo, ainda assim podemos remover override — mas o contrato pede 404 no inactivate;
  // aqui é seguro apenas deletar override.
  await prisma.bankOverride.deleteMany({
    where: { userId, code }
  });
}

export async function listBanksForUser(params: {
  userId: string;
  onlyActive?: boolean;
  q?: string;
}): Promise<BankDTO[]> {
  const onlyActive = params.onlyActive ?? true;
  const q = (params.q ?? '').trim().toLowerCase();

  const [catalog, inactiveCodes] = await Promise.all([
    getCatalog(),
    getInactiveCodesForUser(params.userId)
  ]);

  const inactiveSet = new Set(inactiveCodes);

  let list = catalog;

  if (q) {
    list = list.filter((b) => {
      const codeStr = String(b.code);
      return (
        codeStr.includes(q) ||
        b.name.toLowerCase().includes(q) ||
        b.fullName.toLowerCase().includes(q) ||
        b.ispb.toLowerCase().includes(q)
      );
    });
  }

  if (onlyActive) {
    list = list.filter((b) => !inactiveSet.has(b.code));
  }

  // Ordena: por code crescente (bom para UX)
  list.sort((a, b) => a.code - b.code);

  return list;
}

import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function dateOnly(year: number, month: number, day: number) {
  // month: 1..12
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function cents(value: number) {
  return Math.round(value * 100);
}

async function main() {
  const SEED_EMAIL = 'seed@contas.com';
  const SEED_PASSWORD = 'Senha@123';

  // 1) Limpa seed anterior (idempotente)
  const existing = await prisma.user.findUnique({ where: { email: SEED_EMAIL } });

  if (existing) {
    await prisma.expense.deleteMany({ where: { userId: existing.id } });
    await prisma.item.deleteMany({ where: { userId: existing.id } });
    await prisma.bankOverride.deleteMany({ where: { userId: existing.id } });
    await prisma.user.delete({ where: { id: existing.id } });
  }

  // 2) Cria usuário seed
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  const user = await prisma.user.create({
    data: {
      nome: 'Usuário Seed',
      email: SEED_EMAIL,
      passwordHash,
      telefone: '21999998888',
      avatarUrl: null
    }
  });

  // 3) Itens seed
  const [aluguel, internet, luz, mercado] = await prisma.$transaction([
    prisma.item.create({
      data: { userId: user.id, tipo: 'SERVICO', nome: 'Aluguel', atividade: 'Moradia', ativo: true }
    }),
    prisma.item.create({
      data: { userId: user.id, tipo: 'SERVICO', nome: 'Internet', atividade: 'Fibra', ativo: true }
    }),
    prisma.item.create({
      data: { userId: user.id, tipo: 'SERVICO', nome: 'Energia', atividade: 'Conta de luz', ativo: true }
    }),
    prisma.item.create({
      data: { userId: user.id, tipo: 'PROFISSIONAL', nome: 'Mercado', atividade: 'Compras', ativo: true }
    })
  ]);

  // 4) Despesas seed (mês atual + mês anterior)
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1..12
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  const banks = {
    bradesco: 237,
    itau: 341,
    bb: 1
  };

  // Cria um mix pago / não pago
  await prisma.expense.createMany({
    data: [
      // mês atual
      {
        userId: user.id,
        itemId: aluguel.id,
        dataVencimento: dateOnly(year, month, 5),
        dataPagamento: dateOnly(year, month, 5),
        descricao: 'Aluguel',
        bancoCode: banks.bb,
        valorCents: cents(1800)
      },
      {
        userId: user.id,
        itemId: internet.id,
        dataVencimento: dateOnly(year, month, 10),
        dataPagamento: null,
        descricao: 'Internet',
        bancoCode: banks.itau,
        valorCents: cents(129.9)
      },
      {
        userId: user.id,
        itemId: luz.id,
        dataVencimento: dateOnly(year, month, 15),
        dataPagamento: dateOnly(year, month, 14),
        descricao: 'Energia',
        bancoCode: banks.bradesco,
        valorCents: cents(220.45)
      },
      {
        userId: user.id,
        itemId: mercado.id,
        dataVencimento: dateOnly(year, month, 20),
        dataPagamento: null,
        descricao: 'Compras do mês',
        bancoCode: null, // sem banco permitido
        valorCents: cents(560.8)
      },

      // mês anterior
      {
        userId: user.id,
        itemId: aluguel.id,
        dataVencimento: dateOnly(prevYear, prevMonth, 5),
        dataPagamento: dateOnly(prevYear, prevMonth, 5),
        descricao: 'Aluguel (mês anterior)',
        bancoCode: banks.bb,
        valorCents: cents(1800)
      },
      {
        userId: user.id,
        itemId: internet.id,
        dataVencimento: dateOnly(prevYear, prevMonth, 10),
        dataPagamento: dateOnly(prevYear, prevMonth, 10),
        descricao: 'Internet (mês anterior)',
        bancoCode: banks.itau,
        valorCents: cents(129.9)
      }
    ]
  });

  // 5) Overrides de bancos seed (ex.: desativar Bradesco para o usuário)
  await prisma.bankOverride.upsert({
    where: { userId_code: { userId: user.id, code: banks.bradesco } },
    create: { userId: user.id, code: banks.bradesco, inactive: true },
    update: { inactive: true }
  });

  // 6) (Opcional) pré-popular o cache de bancos (se BrasilAPI estiver ok)
  // Não falha o seed se não tiver internet.
  try {
    // deixa o backend popular quando for chamado; aqui só tentamos suavemente
    // criando um cache vazio não é útil, então só ignora se falhar.
  } catch {
    // ignore
  }

  console.log('✅ Seed concluído');
  console.log('User:', { email: SEED_EMAIL, senha: SEED_PASSWORD });
}

main()
  .catch((e) => {
    console.error('❌ Seed falhou:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

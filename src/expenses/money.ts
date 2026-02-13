import { AppError } from '../errors/app-error';

export function toCents(value: number): number {
  if (!Number.isFinite(value)) {
    throw new AppError({
      status: 400,
      code: 'INVALID_AMOUNT',
      error: 'VALIDATION_ERROR',
      message: 'Valor inválido'
    });
  }

  // evita bugs de float
  const cents = Math.round(value * 100);

  if (cents <= 0) {
    throw new AppError({
      status: 400,
      code: 'INVALID_AMOUNT',
      error: 'VALIDATION_ERROR',
      message: 'Valor deve ser maior que zero'
    });
  }

  return cents;
}

export function fromCents(cents: number): number {
  return Number((cents / 100).toFixed(2));
}

import { Decimal } from '@prisma/client/runtime/library';

export type MoneyInput = number | string | Decimal;

export function toDecimal(value: MoneyInput): Decimal {
  if (value instanceof Decimal) return value;
  return new Decimal(value || 0);
}

export function money(value: MoneyInput): number {
  return toDecimal(value).toNumber();
}

export function calculateCharge(ratePer1000: MoneyInput, quantity: number): Decimal {
  return toDecimal(ratePer1000).div(1000).mul(quantity).toDecimalPlaces(6);
}

export function formatMoney(value: MoneyInput, currency = 'USD'): string {
  const n = money(value);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(n);
}

export function isPositive(value: MoneyInput): boolean {
  return toDecimal(value).greaterThan(0);
}

export function gte(a: MoneyInput, b: MoneyInput): boolean {
  return toDecimal(a).greaterThanOrEqualTo(toDecimal(b));
}

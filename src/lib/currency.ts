const FALLBACK_CURRENCY = "EUR";

export function normalizeCurrencyCode(value?: string | null) {
  const trimmed = value?.trim();

  if (!trimmed) return FALLBACK_CURRENCY;

  return trimmed.toUpperCase();
}

export function formatMoneyAmount(value: number, currency?: string | null) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: normalizeCurrencyCode(currency),
    maximumFractionDigits: 0,
  }).format(value / 100);
}

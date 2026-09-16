export function formatMoney(
  amount: number | null | undefined,
  currency?: string | null,
  locale = 'fa',
): string {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  const value = Number(amount);
  try {
    return new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : locale === 'ar' ? 'ar' : 'en', {
      style: currency ? 'currency' : 'decimal',
      currency: currency || undefined,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return currency ? `${value} ${currency}` : String(value);
  }
}

export function formatQty(
  value: number | null | undefined,
  uom?: string | null,
  locale = 'fa',
): string {
  if (value == null) return '—';
  const n = new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : locale === 'ar' ? 'ar' : 'en').format(
    Number(value),
  );
  return uom ? `${n} ${uom}` : n;
}

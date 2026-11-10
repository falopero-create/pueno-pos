export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function formatMoney(n: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(n);
}

export function splitTaxIncluded(
  totalConIva: number,
  tasa: number,
): { subtotal: number; iva: number; total: number } {
  const total = round2(totalConIva);
  if (!tasa || tasa <= 0) {
    return { subtotal: total, iva: 0, total };
  }
  const subtotal = round2(total / (1 + tasa));
  const iva = round2(total - subtotal);
  return { subtotal, iva, total };
}

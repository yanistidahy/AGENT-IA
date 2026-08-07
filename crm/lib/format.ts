/** Formatage fr-FR, repris du prototype. */

const EUR = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

/** Montant complet : « 6 480 € ». */
export function money(value: number): string {
  return EUR.format(value || 0);
}

/** Montant compact : « 6,5k€ », « 15k€ », « 480 € ». */
export function moneyShort(value: number): string {
  const n = value || 0;
  if (Math.abs(n) >= 1000) {
    const decimals = Math.abs(n) >= 10000 ? 0 : 1;
    return `${(n / 1000).toFixed(decimals).replace(".", ",")}k€`;
  }
  return `${Math.round(n)}€`;
}

export function formatDate(date: Date | null): string {
  if (date === null) return "—";
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}

export function formatDateLong(date: Date): string {
  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function percent(value: number): string {
  return `${Math.round(value)} %`;
}

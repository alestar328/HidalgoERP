import { APP } from '../config/app';

const moneyFmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qtyFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 });

/** 1234.5 → "S/ 1,234.50" */
export function formatMoney(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  const abs = moneyFmt.format(Math.abs(n));
  return `${n < 0 ? '−' : ''}${APP.currencySymbol} ${abs}`;
}

/** Cantidades: sin decimales de más (12, 1.5, 0.250 → "0.25"). */
export function formatQty(value: number | null | undefined): string {
  return qtyFmt.format(Number(value ?? 0));
}

/** Acepta "12,50" o "12.50". Devuelve null si está vacío o no es un número. */
export function parseNumber(text: string): number | null {
  const clean = text.trim().replace(/\s/g, '').replace(',', '.');
  if (clean === '') return null;
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
}

const dateTimeFmt = new Intl.DateTimeFormat(APP.locale, {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: APP.timeZone,
});

export function formatDateTime(iso: string): string {
  return dateTimeFmt.format(new Date(iso));
}

const dateFmt = new Intl.DateTimeFormat(APP.locale, { day: 'numeric', month: 'short', timeZone: APP.timeZone });

/** "21 nov." */
export function formatDate(iso: string): string {
  return dateFmt.format(new Date(iso));
}

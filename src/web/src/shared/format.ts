// Display formatting for numbers, money, prices and addresses, used by trading and the game alike.

export const fmtUsd = (n: number, digits = 2) =>
  (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const fmtNum = (n: number, digits = 2) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: digits });

export const fmtAura = (n: number) => Math.round(n).toLocaleString('en-US');

export function fmtPx(px: number): string {
  if (!Number.isFinite(px)) return '—';
  if (px >= 1000) return px.toLocaleString('en-US', { maximumFractionDigits: 1 });
  if (px >= 1) return px.toLocaleString('en-US', { maximumFractionDigits: 4 });
  return Number(px.toPrecision(5)).toString();
}

export const fmtPct = (n: number, digits = 2) => `${n >= 0 ? '+' : ''}${n.toFixed(digits)}%`;

export const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

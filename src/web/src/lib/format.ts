// Price/size rules for Hyperliquid perps and display helpers.

import { AURA_PER_USD_FEE, BUILDER_FEE_RATE } from '../config';

const trimZeros = (s: string) => (s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s);

/**
 * Format a perp price for the API: at most 5 significant figures and at most (6 - szDecimals) decimals.
 * Integer prices are always valid.
 */
export function formatPrice(px: number, szDecimals: number): string {
  if (!Number.isFinite(px) || px <= 0) return '0';
  if (Number.isInteger(px)) return String(px);
  const maxDecimals = Math.max(0, 6 - szDecimals);
  const sig = Number(px.toPrecision(5));
  return trimZeros(sig.toFixed(maxDecimals));
}

/** Round a size down to the asset's size decimals. */
export function formatSize(sz: number, szDecimals: number): string {
  if (!Number.isFinite(sz) || sz <= 0) return '0';
  const f = 10 ** szDecimals;
  return (Math.floor(sz * f) / f).toFixed(szDecimals);
}

/** $aura earned for a builder fee paid in USD. */
export const auraForFee = (feeUsd: number) => Math.max(0, feeUsd) * AURA_PER_USD_FEE;

/** $aura a fill of this notional would earn at the current builder fee. */
export const auraForNotional = (notionalUsd: number) => auraForFee(notionalUsd * BUILDER_FEE_RATE);

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

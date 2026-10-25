// Price and size rules for Hyperliquid perp orders.

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

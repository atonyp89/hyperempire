// Exchange rewards: a fixed amount of $aura every UTC day, shared by the builder fees paid that day. A player's
// reward is DAILY_EMISSION × their fees ÷ everyone's fees, so $aura per $1 floats with trading: quiet days pay
// more per $1, busy days less, and total emission never grows with volume. Days match Hyperliquid's daily
// builder-fill files, which are the source of truth on mainnet.

export const DAY_MS = 86_400_000;

/** $aura shared out per UTC day, per network. Set by the team; tune here. */
export const DAILY_EMISSION = 100_000;

/** A day's id: its UTC date as YYYYMMDD, the same as Hyperliquid's file names. */
export const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10).replaceAll('-', '');
export const dayStart = (day: string) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(4, 6)) - 1, Number(day.slice(6, 8)));
export const nextDay = (day: string) => dayOf(dayStart(day) + DAY_MS);

/** Fees are stored in micro-USD (1 USD = 1,000,000), the precision Hyperliquid reports them in. */
export const MICRO = 1_000_000;
export const toMicro = (usd: number | string) => Math.round(Number(usd) * MICRO);
export const fromMicro = (micro: number) => micro / MICRO;

/** A player's share of a day's pool, in $aura. */
export const shareOf = (emission: number, yours: number, total: number) => (total > 0 ? (emission * yours) / total : 0);

/**
 * Extra $aura that paying `fee` more today would add to a player's share, given today's totals so far. Bounded by
 * the emission: the first $1 of a quiet day takes the whole pool.
 */
export const marginalShare = (emission: number, yours: number, total: number, fee: number) =>
  fee > 0 ? shareOf(emission, yours + fee, total + fee) - shareOf(emission, yours, total) : 0;

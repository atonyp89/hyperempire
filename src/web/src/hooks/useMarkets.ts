import { useQuery } from '@tanstack/react-query';
import { info } from '../lib/hl';

export type Market = {
  name: string;
  /** Asset index used in order actions. */
  asset: number;
  szDecimals: number;
  maxLeverage: number;
  markPx: number;
  midPx: number;
  change24h: number;
  funding: number;
  dayNtlVlm: number;
  openInterest: number;
};

export function useMarkets() {
  return useQuery({
    queryKey: ['markets'],
    refetchInterval: 5_000,
    queryFn: async (): Promise<Market[]> => {
      const [meta, ctxs] = await info.metaAndAssetCtxs();
      return meta.universe
        .map((u, asset) => {
          const c = ctxs[asset];
          const markPx = Number(c.markPx);
          const prev = Number(c.prevDayPx);
          return {
            name: u.name,
            asset,
            szDecimals: u.szDecimals,
            maxLeverage: u.maxLeverage,
            markPx,
            midPx: c.midPx ? Number(c.midPx) : markPx,
            change24h: prev > 0 ? ((markPx - prev) / prev) * 100 : 0,
            funding: Number(c.funding),
            dayNtlVlm: Number(c.dayNtlVlm),
            openInterest: Number(c.openInterest) * markPx,
            delisted: u.isDelisted === true,
          };
        })
        .filter((m) => !m.delisted)
        .sort((a, b) => b.dayNtlVlm - a.dayNtlVlm);
    },
  });
}

export function useCandles(coin: string | undefined) {
  return useQuery({
    queryKey: ['candles', coin],
    enabled: !!coin,
    refetchInterval: 60_000,
    queryFn: async () => {
      const candles = await info.candleSnapshot({
        coin: coin!,
        interval: '15m',
        startTime: Date.now() - 24 * 60 * 60 * 1000,
      });
      return candles.map((c) => ({ t: c.t, c: Number(c.c) }));
    },
  });
}

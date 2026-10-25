import { useQuery } from '@tanstack/react-query';
import { info } from '../lib/hl';
import { auraForFee } from '../lib/format';

type Address = `0x${string}`;

export function useClearinghouse(user: Address | undefined) {
  return useQuery({
    queryKey: ['clearinghouse', user],
    enabled: !!user,
    refetchInterval: 3_000,
    queryFn: () => info.clearinghouseState({ user: user! }),
  });
}

export function useOpenOrders(user: Address | undefined) {
  return useQuery({
    queryKey: ['openOrders', user],
    enabled: !!user,
    refetchInterval: 3_000,
    queryFn: () => info.frontendOpenOrders({ user: user! }),
  });
}

export function useFills(user: Address | undefined) {
  return useQuery({
    queryKey: ['fills', user],
    enabled: !!user,
    refetchInterval: 5_000,
    queryFn: async () => {
      const fills = await info.userFills({ user: user! });
      return fills.map((f) => {
        const builderFee = Number(f.builderFee ?? 0);
        return { ...f, builderFeeUsd: builderFee, aura: auraForFee(builderFee) };
      });
    },
  });
}

export function useActiveAsset(user: Address | undefined, coin: string | undefined) {
  return useQuery({
    queryKey: ['activeAsset', user, coin],
    enabled: !!user && !!coin,
    refetchInterval: 10_000,
    queryFn: () => info.activeAssetData({ user: user!, coin: coin! }),
  });
}

/** The account's own fee rates (taker = cross, maker = add), as fractions. */
export function useUserFees(user: Address | undefined) {
  return useQuery({
    queryKey: ['userFees', user],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const f = await info.userFees({ user: user! });
      return { taker: Number(f.userCrossRate), maker: Number(f.userAddRate) };
    },
  });
}

/** Top of the order book: shown in the Exchange, and used for the market-order slippage estimate. */
export function useBook(coin: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['l2Book', coin],
    enabled: enabled && !!coin,
    refetchInterval: 1_000,
    queryFn: async () => {
      const book = await info.l2Book({ coin: coin! });
      const side = (levels: { px: string; sz: string }[]) => levels.map((l) => ({ px: Number(l.px), sz: Number(l.sz) }));
      return { bids: side(book?.levels[0] ?? []), asks: side(book?.levels[1] ?? []) };
    },
  });
}

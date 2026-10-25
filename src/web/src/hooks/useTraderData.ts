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

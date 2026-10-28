// Exchange rewards, game side: today's $aura pool and the player's share (from the API), the hooks the trading
// terminal uses to report orders and estimate $aura, and the player's unsettled $aura.

import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { marginalShare, type ExchangeView } from '@server/contract';
import { fmtAura } from '../../shared/format';
import { NETWORK } from '../../shared/network';
import { useSession } from '../../shared/session';
import type { TradingRewards } from '../../trading';

export function useExchangeRewards() {
  const session = useSession();
  const qc = useQueryClient();
  const key = ['exchange', NETWORK, session.address?.toLowerCase()];
  const q = useQuery({ queryKey: key, enabled: session.signedIn, queryFn: () => session.call<ExchangeView>('/exchange'), refetchInterval: 30_000 });
  const view = q.data;

  const rewards = useMemo<TradingRewards>(
    () => ({
      onOrders: (oids) => {
        if (!session.signedIn) return;
        void session
          .call('/exchange/orders', { body: { oids } })
          // Fills land a moment after the order; look again shortly so pending $aura shows up.
          .then(() => setTimeout(() => void qc.invalidateQueries({ queryKey: ['exchange', NETWORK] }).then(() => qc.invalidateQueries({ queryKey: ['me', NETWORK] })), 3_000))
          .catch(() => undefined);
      },
      auraForFee: (fee) => (view ? marginalShare(view.emission, view.yourWeight, view.totalWeight, fee) : null),
      howItWorks: view
        ? `Each day ${fmtAura(view.emission)} $aura is shared by everyone's builder fees that day.`
        : 'Each day a fixed pool of $aura is shared by everyone’s builder fees that day.',
      feeTenthsBps: view?.feeTenthsBps ?? null,
    }),
    [session, qc, view],
  );

  return { view, rewards, loading: q.isLoading };
}

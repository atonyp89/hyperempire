// Townhall state, kept by the HyperEmpire API (in this browser while developing, on the server in production).
// The server checks every rule and rolls every upgrade; this hook only reads and asks.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TownhallView, UpgradeResponse } from '@server/contract';
import { NETWORK } from '../../shared/network';
import { useSession } from '../../shared/session';

export type UpgradeResult = { ok: boolean; level: number; spent: number; chance: number };

export function useTownhall() {
  const session = useSession();
  const qc = useQueryClient();
  const key = ['townhall', NETWORK, session.address?.toLowerCase()];
  const q = useQuery({ queryKey: key, enabled: session.signedIn, queryFn: () => session.call<TownhallView>('/townhall') });

  const upgradeM = useMutation({
    mutationFn: (chance: number) => session.call<UpgradeResponse>('/townhall/upgrade', { body: { chance } }),
    onSuccess: (r) => {
      qc.setQueryData(key, r.townhall);
      void qc.invalidateQueries({ queryKey: ['me', NETWORK] });
    },
  });

  const t = q.data;

  /** Pay `chance`% of the next level's cost for a `chance`% shot at levelling up. The $aura burns either way. */
  async function upgrade(chance: number): Promise<UpgradeResult> {
    const r = await upgradeM.mutateAsync(chance);
    return { ok: r.ok, level: r.townhall.level, spent: r.spent, chance: r.chance };
  }

  return {
    session,
    ready: !!t,
    loading: q.isLoading,
    busy: upgradeM.isPending,
    error: (upgradeM.error ?? q.error)?.message ?? null,
    level: t?.level ?? 1,
    balance: t?.aura ?? 0,
    nextCost: t?.nextCost ?? 0,
    masteryCap: t?.masteryCap ?? 1,
    masteryXpBonus: t?.masteryXpBonus ?? 0,
    upgrade,
  };
}

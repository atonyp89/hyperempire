// Townhall state, kept by the HyperEmpire API (in this browser while developing, on the server in production).
// The server checks every rule and rolls every upgrade; this hook only reads and asks.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { branchSpent, PERKS, TIER_POINTS, type TownhallView, type UpgradeResponse } from '@server/contract';
import { NETWORK } from '../../shared/network';
import { useSession } from '../../shared/session';

export type UpgradeResult = { ok: boolean; level: number; spent: number; chance: number };

export function useTownhall() {
  const session = useSession();
  const qc = useQueryClient();
  const key = ['townhall', NETWORK, session.address?.toLowerCase()];
  const q = useQuery({ queryKey: key, enabled: session.signedIn, queryFn: () => session.call<TownhallView>('/townhall') });

  const store = (t: TownhallView) => {
    qc.setQueryData(key, t);
    void qc.invalidateQueries({ queryKey: ['me', NETWORK] });
  };
  const upgradeM = useMutation({
    mutationFn: (chance: number) => session.call<UpgradeResponse>('/townhall/upgrade', { body: { chance } }),
    onSuccess: (r) => store(r.townhall),
  });
  const rankM = useMutation({ mutationFn: (perkId: string) => session.call<TownhallView>('/townhall/perks', { body: { perkId } }), onSuccess: store });
  const respecM = useMutation({ mutationFn: () => session.call<TownhallView>('/townhall/respec', { method: 'POST' }), onSuccess: store });

  const t = q.data;
  const level = t?.level ?? 1;
  const ranks = t?.ranks ?? {};
  const balance = t?.aura ?? 0;
  const points = t?.points ?? 0;
  const busy = upgradeM.isPending || rankM.isPending || respecM.isPending;

  /** Pay `chance`% of the next level's cost for a `chance`% shot at levelling up. The $aura burns either way. */
  async function upgrade(chance: number): Promise<UpgradeResult> {
    const r = await upgradeM.mutateAsync(chance);
    return { ok: r.ok, level: r.townhall.level, spent: r.spent, chance: r.chance };
  }

  /** A quick check so the + buttons grey out; the server decides. */
  function canRank(perkId: string): boolean {
    const p = PERKS.find((x) => x.id === perkId);
    if (!t || busy || !p || points < 1) return false;
    if ((ranks[p.id] ?? 0) >= p.maxRank) return false;
    return branchSpent(ranks, p.branch) >= TIER_POINTS[p.tier];
  }

  const error = (upgradeM.error ?? rankM.error ?? respecM.error ?? q.error)?.message ?? null;

  return {
    session,
    ready: !!t,
    loading: q.isLoading,
    busy,
    error,
    level,
    ranks,
    respecs: t?.respecs ?? 0,
    balance,
    nextCost: t?.nextCost ?? 0,
    points,
    respec: t?.respecCost ?? 0,
    upgrade,
    canRank,
    addRank: (perkId: string) => rankM.mutate(perkId),
    doRespec: () => respecM.mutate(),
  };
}

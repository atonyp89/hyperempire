// One building's Mastery, kept by the API: level (capped by the Townhall), XP, points and perk ranks.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MasteryDetail, MasteryId } from '@server/contract';
import { NETWORK } from '../../shared/network';
import { useSession } from '../../shared/session';

export function useMastery(building: MasteryId) {
  const session = useSession();
  const qc = useQueryClient();
  const key = ['mastery', NETWORK, building, session.address?.toLowerCase()];
  const q = useQuery({ queryKey: key, enabled: session.signedIn, queryFn: () => session.call<MasteryDetail>(`/mastery/${building}`), refetchInterval: 60_000 });

  const done = (m: MasteryDetail) => {
    qc.setQueryData(key, m);
    // The fee discount and $aura balance may change: refresh what shows them.
    void qc.invalidateQueries({ queryKey: ['exchange', NETWORK] });
    void qc.invalidateQueries({ queryKey: ['me', NETWORK] });
    void qc.invalidateQueries({ queryKey: ['townhall', NETWORK] });
  };
  const rank = useMutation({ mutationFn: (perkId: string) => session.call<MasteryDetail>(`/mastery/${building}/perks`, { body: { perkId } }), onSuccess: done });
  const respec = useMutation({ mutationFn: () => session.call<MasteryDetail>(`/mastery/${building}/respec`, { method: 'POST' }), onSuccess: done });

  return {
    session,
    m: q.data,
    loading: q.isLoading,
    busy: rank.isPending || respec.isPending,
    error: (rank.error ?? respec.error ?? q.error)?.message ?? null,
    addRank: (perkId: string) => rank.mutate(perkId),
    respec: () => respec.mutate(),
  };
}

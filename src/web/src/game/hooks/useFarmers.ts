// Farmers, kept by the HyperEmpire API: every Farmer the player has recruited, which ones work the Garden, what
// their perks add up to, and their hunger. Recruiting happens at the Tavern; assigning and feeding in the Garden;
// reviving in either.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FarmersView, FarmerView } from '@server/contract';
import { NETWORK } from '../../shared/network';
import { useSession } from '../../shared/session';

export function useFarmers(enabled = true) {
  const session = useSession();
  const qc = useQueryClient();
  const key = ['farmers', NETWORK, session.address?.toLowerCase()];
  const q = useQuery({ queryKey: key, enabled: enabled && session.signedIn, queryFn: () => session.call<FarmersView>('/farmers') });

  const store = (v: FarmersView) => {
    qc.setQueryData(key, v);
    // The Garden shows the working Farmers and their bonus; recruiting spends $aura.
    void qc.invalidateQueries({ queryKey: ['garden', NETWORK] });
    void qc.invalidateQueries({ queryKey: ['me', NETWORK] });
  };
  const recruitM = useMutation({
    mutationFn: () => session.call<FarmersView & { farmer: FarmerView }>('/farmers/recruit', { method: 'POST' }),
    onSuccess: store,
  });
  const assignM = useMutation({
    mutationFn: (v: { id: number; on: boolean }) => session.call<FarmersView>(`/farmers/${v.id}/${v.on ? 'assign' : 'unassign'}`, { method: 'POST' }),
    onSuccess: store,
  });

  /** Feed one bread, revive for $aura, or (dev only) drain hunger. */
  const actM = useMutation({
    mutationFn: (v: { id: number; act: 'feed' | 'revive' | 'drain' }) => session.call<FarmersView>(`/farmers/${v.id}/${v.act}`, { method: 'POST' }),
    onSuccess: store,
  });

  const busy = recruitM.isPending || assignM.isPending || actM.isPending;
  const v = q.data;
  return {
    session,
    ready: !!v,
    loading: q.isLoading,
    error: (recruitM.error ?? assignM.error ?? actM.error ?? q.error)?.message ?? null,
    farmers: v?.farmers ?? [],
    working: (v?.farmers ?? []).filter((f) => f.assigned),
    slots: v?.slots ?? 3,
    recruitAura: v?.recruitAura ?? 1_000,
    bonus: v?.bonus ?? { yieldPct: 0, growthPct: 0 },
    /** Server time now (the view's clock plus what has passed here since), and the game speed, for hunger. */
    now: v ? v.now + (Date.now() - q.dataUpdatedAt) : Date.now(),
    speed: v?.speed ?? 1,
    /** Dev tools (draining hunger) are on: the in-browser dev server. */
    dev: v?.dev ?? false,
    /** The Farmer the last recruit gave, until the next one. */
    recruited: recruitM.data?.farmer ?? null,
    clearRecruited: () => recruitM.reset(),
    // Clicks during a request are ignored rather than disabling every control (see useGarden).
    recruit: () => !busy && recruitM.mutate(),
    assign: (id: number, on: boolean) => !busy && assignM.mutate({ id, on }),
    feed: (id: number) => !busy && actM.mutate({ id, act: 'feed' }),
    revive: (id: number) => !busy && actM.mutate({ id, act: 'revive' }),
    drain: (id: number) => !busy && actM.mutate({ id, act: 'drain' }),
    /** Fetch again, e.g. when a Farmer's hunger runs out and the server now counts it dead. */
    refresh: () => {
      void qc.invalidateQueries({ queryKey: key });
      void qc.invalidateQueries({ queryKey: ['garden', NETWORK] });
    },
  };
}

export type Farmers = ReturnType<typeof useFarmers>;

// Farmers, kept by the HyperEmpire API: every Farmer the player has recruited, which ones work the Garden, and
// what their perks add up to. Recruiting happens at the Tavern; assigning in the Garden.

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

  const busy = recruitM.isPending || assignM.isPending;
  const v = q.data;
  return {
    session,
    ready: !!v,
    loading: q.isLoading,
    error: (recruitM.error ?? assignM.error ?? q.error)?.message ?? null,
    farmers: v?.farmers ?? [],
    working: (v?.farmers ?? []).filter((f) => f.assigned),
    slots: v?.slots ?? 3,
    recruitAura: v?.recruitAura ?? 1_000,
    bonus: v?.bonus ?? { yieldPct: 0, growthPct: 0 },
    /** The Farmer the last recruit gave, until the next one. */
    recruited: recruitM.data?.farmer ?? null,
    clearRecruited: () => recruitM.reset(),
    // Clicks during a request are ignored rather than disabling every control (see useGarden).
    recruit: () => !busy && recruitM.mutate(),
    assign: (id: number, on: boolean) => !busy && assignM.mutate({ id, on }),
  };
}

export type Farmers = ReturnType<typeof useFarmers>;

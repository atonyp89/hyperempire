// $gold, kept by the HyperEmpire API: the balance, and the testing faucet where the API has one (local
// development and testnet servers).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { GoldView } from '@server/contract';
import { NETWORK } from '../../shared/network';
import { useSession } from '../../shared/session';

export function useGold() {
  const session = useSession();
  const qc = useQueryClient();
  const key = ['gold', NETWORK, session.address?.toLowerCase()];
  const q = useQuery({ queryKey: key, enabled: session.signedIn, queryFn: () => session.call<GoldView>('/gold') });

  const claimM = useMutation({
    mutationFn: () => session.call<GoldView>('/gold/faucet', { method: 'POST' }),
    onSuccess: (r) => {
      qc.setQueryData(key, r);
      void qc.invalidateQueries({ queryKey: ['me', NETWORK] });
    },
  });

  return {
    gold: q.data?.gold ?? null,
    /** $gold per faucet claim; null where there is no faucet. */
    faucet: q.data?.faucet ?? null,
    claiming: claimM.isPending,
    error: (claimM.error ?? q.error)?.message ?? null,
    claim: () => claimM.mutate(),
  };
}

// One-time setup before trading: approve the HyperEmpire builder fee, then approve a local trading agent.

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWalletClient } from 'wagmi';
import { AGENT_NAME, BUILDER_ADDRESS, BUILDER_FEE_TENTHS_BPS, BUILDER_MAX_FEE_RATE } from '../config';
import { clearAgent, createAgent, loadAgent } from '../lib/agent';
import { errorMessage, exchangeFor, info } from '../lib/hl';

type Address = `0x${string}`;

export function useOnboarding(user: Address | undefined) {
  const qc = useQueryClient();
  const { data: walletClient } = useWalletClient();
  const [busy, setBusy] = useState<'builder' | 'agent' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agentVersion, setAgentVersion] = useState(0);

  const maxFee = useQuery({
    queryKey: ['maxBuilderFee', user, BUILDER_ADDRESS],
    enabled: !!user && !!BUILDER_ADDRESS,
    queryFn: () => info.maxBuilderFee({ user: user!, builder: BUILDER_ADDRESS! }),
  });

  const agents = useQuery({
    queryKey: ['extraAgents', user],
    enabled: !!user,
    queryFn: () => info.extraAgents({ user: user! }),
  });

  const agent = useMemo(() => (user ? loadAgent(user) : null), [user, agentVersion]);

  const builderApproved = (maxFee.data ?? 0) >= BUILDER_FEE_TENTHS_BPS;
  const agentApproved =
    !!agent &&
    (agents.data ?? []).some(
      (a) => a.address.toLowerCase() === agent.address.toLowerCase() && (a.validUntil == null || a.validUntil > Date.now()),
    );

  /** Exchange client that signs with the approved agent, used for orders. */
  const trader = useMemo(() => (agent && agentApproved ? exchangeFor(agent) : null), [agent, agentApproved]);

  async function approveBuilder() {
    if (!walletClient || !BUILDER_ADDRESS) return;
    setBusy('builder');
    setError(null);
    try {
      await exchangeFor(walletClient).approveBuilderFee({ builder: BUILDER_ADDRESS, maxFeeRate: BUILDER_MAX_FEE_RATE });
      await qc.invalidateQueries({ queryKey: ['maxBuilderFee'] });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function enableTrading() {
    if (!walletClient || !user) return;
    setBusy('agent');
    setError(null);
    try {
      const next = createAgent(user);
      await exchangeFor(walletClient).approveAgent({ agentAddress: next.address, agentName: AGENT_NAME });
      setAgentVersion((v) => v + 1);
      await qc.invalidateQueries({ queryKey: ['extraAgents'] });
    } catch (err) {
      clearAgent(user);
      setAgentVersion((v) => v + 1);
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return {
    loading: maxFee.isLoading || agents.isLoading,
    builderApproved,
    agentApproved,
    ready: builderApproved && agentApproved,
    trader,
    busy,
    error,
    canSign: !!walletClient,
    approveBuilder,
    enableTrading,
  };
}

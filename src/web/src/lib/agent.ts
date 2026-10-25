// Local trading agent ("API wallet").
//
// Browser wallets can't sign Hyperliquid L1 actions directly (they are signed for chain 1337), so the
// user approves a locally generated agent key once, and that key signs orders. An agent can trade
// but can never withdraw funds.

import type { Hex } from 'viem';
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { NETWORK } from '../config';

const storageKey = (user: string) => `hyperhero.agent.${NETWORK}.${user.toLowerCase()}`;

export function loadAgent(user: string): PrivateKeyAccount | null {
  try {
    const pk = localStorage.getItem(storageKey(user));
    return pk ? privateKeyToAccount(pk as Hex) : null;
  } catch {
    return null;
  }
}

export function createAgent(user: string): PrivateKeyAccount {
  const pk = generatePrivateKey();
  try {
    localStorage.setItem(storageKey(user), pk);
  } catch {
    // Storage blocked: the agent still works for this session.
  }
  return privateKeyToAccount(pk);
}

export function clearAgent(user: string): void {
  try {
    localStorage.removeItem(storageKey(user));
  } catch {
    // Nothing stored.
  }
}

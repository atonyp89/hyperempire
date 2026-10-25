// Hyperliquid network (testnet or mainnet), shared by trading and the game: trading keys, API clients
// and Townhall progress are all kept per network.

const env = import.meta.env;

export type Network = 'mainnet' | 'testnet';

/**
 * The player's network choice, from the header toggle. It overrides VITE_HL_NETWORK, the default. Everything
 * network-specific (the API client, trading keys, Townhall progress) reads NETWORK once at load, so switching
 * saves the choice and reloads the page.
 */
const NETWORK_KEY = 'hyperempire.network';
const DEFAULT_NETWORK: Network = env.VITE_HL_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';

function savedNetwork(): Network | null {
  try {
    const v = localStorage.getItem(NETWORK_KEY);
    return v === 'mainnet' || v === 'testnet' ? v : null;
  } catch {
    return null;
  }
}

export const NETWORK: Network = savedNetwork() ?? DEFAULT_NETWORK;
export const IS_TESTNET = NETWORK === 'testnet';

export function switchNetwork(next: Network) {
  if (next === NETWORK) return;
  try {
    localStorage.setItem(NETWORK_KEY, next);
  } catch {
    return; // Storage blocked: the env default stays.
  }
  window.location.reload();
}

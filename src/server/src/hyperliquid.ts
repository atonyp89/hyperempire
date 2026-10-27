// Reading fills from Hyperliquid for the fee sync. Used by both the browser runtime and the server.

import { HttpTransport, InfoClient } from '@nktkas/hyperliquid';
import type { Fill, Network } from './deps';

export function fillsReader(network: Network) {
  const info = new InfoClient({ transport: new HttpTransport({ isTestnet: network === 'testnet' }) });
  return async (address: `0x${string}`, sinceMs: number): Promise<Fill[]> => {
    const fills = await info.userFillsByTime({ user: address, startTime: sinceMs });
    return fills.map((f) => ({ tid: f.tid, time: f.time, builderFee: f.builderFee }));
  };
}

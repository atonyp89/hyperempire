// Hyperliquid clients shared across the app.

import { ExchangeClient, HttpTransport, InfoClient } from '@nktkas/hyperliquid';
import type { AbstractWallet } from '@nktkas/hyperliquid/signing';
import { IS_TESTNET } from '../config';

export const transport = new HttpTransport({ isTestnet: IS_TESTNET });
export const info = new InfoClient({ transport });

/** Exchange client that signs with the given wallet (the user's wallet or the local agent). */
export function exchangeFor(wallet: AbstractWallet): ExchangeClient {
  return new ExchangeClient({ transport, wallet });
}

/** Readable message from SDK and wallet errors. */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    const short = (err as { shortMessage?: string }).shortMessage;
    return short ?? err.message;
  }
  return String(err);
}

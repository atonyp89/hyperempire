import { createConfig, http } from 'wagmi';
import { arbitrum, mainnet } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';

// The wallet's chain only sets the EIP-712 signatureChainId for approvals; trading happens on Hyperliquid.
export const wagmiConfig = createConfig({
  chains: [arbitrum, mainnet],
  connectors: [injected()],
  transports: {
    [arbitrum.id]: http(),
    [mainnet.id]: http(),
  },
});

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig;
  }
}

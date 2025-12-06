// packages/nextjs/services/web3/wagmiConfig.tsx

import { wagmiConnectors } from "./wagmiConnectors";
import { type Chain, createClient, fallback, http } from "viem";
import { hardhat, mainnet } from "viem/chains";
import { createConfig } from "wagmi";
import ScaffoldConfig from "~~/scaffold.config";
import { getAlchemyHttpUrl } from "~~/utils/scaffold-eth";

const scaffoldConfig = ScaffoldConfig;
const { targetNetworks } = scaffoldConfig;

// Always include mainnet once (for ENS, prices, etc.)
const hasMainnet = targetNetworks.some((network: Chain) => network.id === mainnet.id);

export const enabledChains: readonly [Chain, ...Chain[]] = (
  hasMainnet ? targetNetworks : [...targetNetworks, mainnet]
) as unknown as readonly [Chain, ...Chain[]];

export const wagmiConfig = createConfig({
  chains: enabledChains,
  connectors: wagmiConnectors(),
  ssr: true,
  client: ({ chain }) => {
    let rpcFallbacks = [http()];

    // FIX APPLIED HERE:
    // We cast rpcOverrides to a generic Record<number, string> so TypeScript
    // allows us to index it with 'chain.id' (which is a generic number).
    const rpcOverrideUrl = (
      scaffoldConfig.rpcOverrides as Record<number, string> | undefined
    )?.[chain.id];

    if (rpcOverrideUrl) {
      // If you explicitly override, use that first
      rpcFallbacks = [http(rpcOverrideUrl), http()];
    } else {
      // Otherwise try Alchemy first, then public RPC as backup
      const alchemyHttpUrl = getAlchemyHttpUrl(chain.id);
      if (alchemyHttpUrl) {
        rpcFallbacks = [http(alchemyHttpUrl), http()];
      }
    }

    return createClient({
      chain,
      transport: fallback(rpcFallbacks),
      // Don’t spam-poll hardhat; use configured interval elsewhere
      ...(chain.id !== hardhat.id
        ? { pollingInterval: scaffoldConfig.pollingInterval }
        : {}),
    });
  },
});
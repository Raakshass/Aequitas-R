// packages/nextjs/scaffold.config.ts
import * as chains from "viem/chains";

export type BaseConfig = {
  targetNetworks: readonly typeof chains.hardhat[] | readonly typeof chains.sepolia[] | readonly any[];
  pollingInterval: number;
  alchemyApiKey: string;
  rpcOverrides?: Record<number, string>;
  walletConnectProjectId: string;
  onlyLocalBurnerWallet: boolean;
};

export type ScaffoldConfig = BaseConfig;

export const DEFAULT_ALCHEMY_API_KEY = "cR4WnXePioePZ5fFrnSiR";

const scaffoldConfig = {
  // 🔴 OLD: [chains.hardhat]
  // 🔵 NEW: we run on Sepolia now
  targetNetworks: [chains.sepolia],

  // Polling can stay as-is for testnet
  pollingInterval: 30000,

  // Uses your NEXT_PUBLIC_ALCHEMY_API_KEY from .env.local / Vercel
  alchemyApiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || DEFAULT_ALCHEMY_API_KEY,

  // You can optionally override RPCs per-chain here
  rpcOverrides: {
    // Example:
    // [chains.sepolia.id]: "https://eth-sepolia.g.alchemy.com/v2/your_key",
  },

  // WalletConnect
  walletConnectProjectId:
    process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "3a8170812b534d0ff9d794f19a901d64",

  // For live dApp, allow normal wallets (Metamask, WC) – burner is only for local
  onlyLocalBurnerWallet: false,
} as const satisfies ScaffoldConfig;

export default scaffoldConfig;

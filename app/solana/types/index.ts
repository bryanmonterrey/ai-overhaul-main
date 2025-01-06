// app/solana/types/index.ts
import { PublicKey } from '@solana/web3.js';

export interface SolanaServiceConfig {
    rpcUrl: string;
    openaiApiKey?: string;  // Add this
  }

export interface TradeParams {
  outputMint: PublicKey;
  inputAmount: number;
  inputMint?: PublicKey;
  slippage?: number;
}
// app/solana/config.ts
export const SOLANA_CONFIG = {
    rpcUrl: process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
    openaiApiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY  // Add this
  };
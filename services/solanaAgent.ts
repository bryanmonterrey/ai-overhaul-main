import { SolanaAgentKit, createSolanaTools } from "solana-agent-kit";
import { PublicKey } from "@solana/web3.js";

export class SolanaAgentService {
  private agent: SolanaAgentKit;
  private tools: any; // Type this properly based on createSolanaTools return type

  constructor() {
    this.agent = new SolanaAgentKit(
      process.env.NEXT_PUBLIC_WALLET_PRIVATE_KEY!,
      process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com",
      process.env.NEXT_PUBLIC_OPENAI_API_KEY
    );
    this.tools = createSolanaTools(this.agent);
  }

  async executeTrade(params: {
    targetToken: PublicKey;
    amount: number;
    sourceToken: PublicKey;
    slippage?: number;
  }) {
    try {
      const signature = await this.agent.trade(
        params.targetToken,
        params.amount,
        params.sourceToken,
        params.slippage || 300
      );
      return { success: true, signature };
    } catch (error) {
      console.error('Trade execution error:', error);
      return { success: false, error };
    }
  }

  async fetchPrices(pythPriceId: string) {
    try {
      const price = await this.agent.pythFetchPrice(pythPriceId);
      return { success: true, price };
    } catch (error) {
      console.error('Price fetch error:', error);
      return { success: false, error };
    }
  }

  // Add more methods as needed
}
// app/lib/solana.ts
import { SolanaAgentKit } from 'solana-agent-kit';
import { Connection, PublicKey, TokenAccountsFilter, clusterApiUrl } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

interface TradeParams {
  targetMint: PublicKey;
  amount: number;
  inputMint: PublicKey;
  slippage: number;
  walletInfo?: {
    publicKey: string;
    sessionId?: string;
    sessionSignature?: string;
    credentials?: {
      signature?: string;
      signTransaction?: boolean;
      signAllTransactions?: boolean;
      connected?: boolean;
    };
  };
}

export class SolanaService {
  private connection: Connection;
  private agent: SolanaAgentKit | null = null;
  private initialized = false;
  private walletPublicKey: PublicKey | null = null;

  constructor() {
    this.connection = new Connection(
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl('mainnet-beta')
    );
  }

  private initializeIfNeeded() {
    if (!this.initialized) {
      try {
        this.agent = new SolanaAgentKit(
          "", // Empty string for initial setup
          this.connection.rpcEndpoint,
          "" // Empty string for initial setup
        );
        this.initialized = true;
      } catch (error) {
        console.error('Failed to initialize SolanaAgentKit:', error);
        throw error;
      }
    }
  }

  updateWalletConnection(publicKey: PublicKey) {
    try {
      // Only update if we have a valid public key
      if (!publicKey) return;
  
      // Do not try to create SolanaAgentKit with public key
      // Instead, just store the public key for reference
      this.initialized = true;
      this.walletPublicKey = publicKey;
      
    } catch (error) {
      console.error('Failed to update wallet connection:', error);
      throw error;
    }
  }

  async getPortfolio(walletAddress: PublicKey) {
    try {
      const filter: TokenAccountsFilter = {
        programId: TOKEN_PROGRAM_ID
      };
   
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        walletAddress,
        filter
      );
      return tokenAccounts.value.map(account => ({
        mint: account.account.data.parsed.info.mint,
        amount: account.account.data.parsed.info.tokenAmount.uiAmount,
        decimals: account.account.data.parsed.info.tokenAmount.decimals
      }));
    } catch (error) {
      console.error('Failed to fetch portfolio:', error);
      throw error;
    }
  }

  async trade(params: TradeParams) {
    this.initializeIfNeeded();
    if (!this.agent) throw new Error('Solana Agent not initialized');

    try {
      return await this.agent.trade(
        params.targetMint,
        params.amount,
        params.inputMint,
        params.slippage
      );
    } catch (error) {
      console.error('Trade failed:', error);
      throw error;
    }
  }

  async pythFetchPrice(priceId: string) {
    this.initializeIfNeeded();
    if (!this.agent) throw new Error('Solana Agent not initialized');

    try {
      return await this.agent.pythFetchPrice(priceId);
    } catch (error) {
      console.error('Failed to fetch Pyth price:', error);
      throw error;
    }
  }

  async getTokenData(tokenAddress: string) {
    this.initializeIfNeeded();
    if (!this.agent) throw new Error('Solana Agent not initialized');

    try {
      return await this.agent.getTokenDataByAddress(tokenAddress);
    } catch (error) {
      console.error('Failed to get token data:', error);
      throw error;
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

export const solanaService = new SolanaService();
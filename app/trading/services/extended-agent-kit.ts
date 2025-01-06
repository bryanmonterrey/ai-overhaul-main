import { SolanaAgentKit } from 'solana-agent-kit';
import { Keypair, PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import Decimal from 'decimal.js';
import type { JupiterTokenData } from 'solana-agent-kit'; 
import { 
  ISolanaAgentKit, 
  SessionResponse, 
  TokenInfo,
  TokenDeploymentResponse,
  NFTMintResponse 
} from '../types/agent-kit';
import { Buffer } from 'buffer';

import bs58 from 'bs58';

export function generateReadOnlyKey(): string {
  // Generate a proper Solana keypair for readonly mode
  const keypair = Keypair.generate();
  // Convert to base58 string
  return bs58.encode(keypair.secretKey);
}

export class ExtendedSolanaAgentKit extends SolanaAgentKit implements ISolanaAgentKit {
  private readonly isReadonly: boolean;

  constructor(
    key: string | 'readonly',
    rpcUrl: string,
    openaiApiKey: string
) {
    // Generate a valid Solana keypair for readonly mode
    const baseKey = key === 'readonly' 
        ? generateReadOnlyKey()
        : key;
        
    super(baseKey, rpcUrl, openaiApiKey);
    this.isReadonly = key === 'readonly';
}

    // Session management
    async initSession(params: { wallet: { publicKey: string; sessionProof?: string; } }): Promise<SessionResponse> {
      if (this.isReadonly && !params.wallet.sessionProof) {
        throw new Error('Session proof required in readonly mode');
      }
      return {
        success: true,
        sessionId: Math.random().toString(),
        timestamp: new Date().toISOString()
      };
    }
  
    async validateSession(sessionId: string): Promise<boolean> {
      return !this.isReadonly;
    }
    
    // Token operations
    async getTokenDataByAddress(mint: string): Promise<TokenInfo> {
      const result = await super.getTokenDataByAddress(mint);
      if (!result) {
        throw new Error('Token not found');
      }
  
      return {
        address: result.address,
        symbol: result.symbol,
        decimals: result.decimals,
        name: result.name,
        logoURI: result.logoURI ?? '',
        tags: result.tags ?? [],
        daily_volume: result.daily_volume ?? 0,
        freeze_authority: result.freeze_authority ?? null,
        mint_authority: result.mint_authority ?? null,
        permanent_delegate: result.permanent_delegate ?? null,
        extensions: {
          coingeckoId: result.extensions?.coingeckoId
        }
      };
    }

    async deployToken(
        name: string,
        uri: string,
        symbol: string,
        decimals?: number,
        initialSupply?: number
      ): Promise<TokenDeploymentResponse> {
        if (this.isReadonly) {
          throw new Error('Cannot deploy tokens in readonly mode');
        }
        const result = await super.deployToken(name, uri, symbol, decimals, initialSupply);
        return {
          success: true,
          mint: result.mint,
          timestamp: new Date().toISOString()
        };
    }
    
    async mintNFT(
        collectionMint: PublicKey,
        metadata: any,
        recipient?: PublicKey
    ): Promise<NFTMintResponse> {
        if (this.isReadonly) {
          throw new Error('Cannot mint NFTs in readonly mode');
        }
        const result = await super.mintNFT(collectionMint, metadata, recipient);
        return {
          success: true,
          mint: result.mint,
          metadata: result.metadata,
          edition: result.mint,
          signature: 'pending',
          timestamp: new Date().toISOString()
        };
    }

    async pythFetchPrice(priceFeedID: string): Promise<string> {
        return super.pythFetchPrice(priceFeedID);
    }

    // Pass through methods with readonly checks
    async fetchTokenPrice(mint: string): Promise<string> {
        return super.fetchTokenPrice(mint);
    }

    async getTPS(): Promise<number> {
        return super.getTPS();
    }

    async trade(outputMint: PublicKey, amount: number, inputMint: PublicKey, slippageBps: number): Promise<string> {
        if (this.isReadonly) {
          throw new Error('Cannot execute trades in readonly mode');
        }
        return super.trade(outputMint, amount, inputMint, slippageBps);
    }

    async transfer(to: PublicKey, amount: number, mint?: PublicKey): Promise<string> {
        if (this.isReadonly) {
          throw new Error('Cannot execute transfers in readonly mode');
        }
        return super.transfer(to, amount, mint);
    }

    async getBalance(tokenAddress?: PublicKey): Promise<number> {
        return super.getBalance(tokenAddress);
    }

    async lendAssets(amount: number): Promise<string> {
        if (this.isReadonly) {
          throw new Error('Cannot lend assets in readonly mode');
        }
        return super.lendAssets(amount);
    }

    async stake(amount: number): Promise<string> {
        if (this.isReadonly) {
          throw new Error('Cannot stake in readonly mode');
        }
        return super.stake(amount);
    }

    // Domain operations with readonly checks
    async resolveAllDomains(domain: string): Promise<PublicKey | undefined> {
        return super.resolveAllDomains(domain);
    }

    async getOwnedAllDomains(owner: PublicKey): Promise<string[]> {
        return super.getOwnedAllDomains(owner);
    }

    async getOwnedDomainsForTLD(tld: string): Promise<string[]> {
        return super.getOwnedDomainsForTLD(tld);
    }

    async getAllDomainsTLDs(): Promise<string[]> {
        return super.getAllDomainsTLDs();
    }

    async getAllRegisteredAllDomains(): Promise<string[]> {
        return super.getAllRegisteredAllDomains();
    }

    async getMainAllDomainsDomain(owner: PublicKey): Promise<string | null> {
        return super.getMainAllDomainsDomain(owner);
    }

    async getPrimaryDomain(account: PublicKey): Promise<string> {
        return super.getPrimaryDomain(account);
    }

    async registerDomain(name: string, spaceKB?: number): Promise<string> {
        if (this.isReadonly) {
          throw new Error('Cannot register domains in readonly mode');
        }
        return super.registerDomain(name, spaceKB);
    }

    async resolveSolDomain(domain: string): Promise<PublicKey> {
        return super.resolveSolDomain(domain);
    }

    async createOrcaSingleSidedWhirlpool(
        depositTokenAmount: BN,
        depositTokenMint: PublicKey,
        otherTokenMint: PublicKey,
        initialPrice: Decimal,
        maxPrice: Decimal,
        feeTier: 0.01 | 0.02 | 0.04 | 0.05 | 0.16 | 0.3 | 0.65
    ): Promise<string> {
        if (this.isReadonly) {
          throw new Error('Cannot create whirlpools in readonly mode');
        }
        return super.createOrcaSingleSidedWhirlpool(
          depositTokenAmount,
          depositTokenMint,
          otherTokenMint,
          initialPrice,
          maxPrice,
          feeTier
        );
    }

    async createGibworkTask(
        title: string,
        content: string,
        requirements: string,
        tags: string[],
        tokenMintAddress: string,
        tokenAmount: number,
        payer?: string
    ): Promise<{ taskId: string }> {
        if (this.isReadonly) {
          throw new Error('Cannot create tasks in readonly mode');
        }
        return {
          taskId: Math.random().toString()
        };
    }
}
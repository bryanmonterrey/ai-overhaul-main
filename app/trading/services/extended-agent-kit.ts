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
    async initSession(params: { 
        wallet: { 
            publicKey: string; 
            signature?: string;
            credentials?: {
                publicKey: string;
                signature: string;
                signTransaction: boolean;
                signAllTransactions: boolean;
                connected: boolean;
            }
        } 
    }): Promise<SessionResponse> {
        try {
            // Use direct signature first, then credentials signature
            const signature = params.wallet.signature || params.wallet.credentials?.signature;
            const publicKey = params.wallet.publicKey || params.wallet.credentials?.publicKey;
            
            if (!signature) {
                return {
                    success: false,
                    error: "Missing signature",
                    code: "MISSING_SIGNATURE"
                };
            }

            // Create a new session first
            const { data: sessionData, error: insertError } = await this.supabase
                .from('sessions')
                .insert({
                    wallet_address: publicKey,
                    signature: signature,
                    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
                    is_active: true,
                    user_agent: 'trading-bot',
                    tag: 'trading_session'
                })
                .select()
                .maybeSingle();

            if (insertError) {
                console.error('Session creation error:', insertError);
                return {
                    success: false,
                    error: insertError.message,
                    code: insertError.code
                };
            }

            return {
                success: true,
                sessionId: sessionData?.id,
                sessionSignature: signature,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('Session initialization error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
                code: "SESSION_INIT_ERROR"
            };
        }
    }

    private async verifyWalletSignature(publicKey: string, signature: string): Promise<boolean> {
        try {
            // Create message buffer - MUST match exactly what was signed
            const message = new TextEncoder().encode("authorize_trading_session");
            
            // Convert the signature from base58 to Uint8Array
            const signatureBytes = bs58.decode(signature);
            
            // Create PublicKey instance
            const pubKey = new PublicKey(publicKey);
            
            // Log verification details
            console.log('Verifying signature:', {
                publicKey,
                signaturePrefix: signature.slice(0, 10) + '...',
                messageText: "authorize_trading_session",
                signatureBytesLength: signatureBytes.length
            });

            // Use nacl for verification instead of connection.verify
            const messageHash = await crypto.subtle.digest('SHA-256', message);
            const verified = nacl.sign.detached.verify(
                new Uint8Array(messageHash),
                signatureBytes,
                pubKey.toBytes()
            );

            console.log('Signature verification result:', verified);
            return verified;

        } catch (error) {
            console.error('Signature verification error:', error);
            return false;
        }
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
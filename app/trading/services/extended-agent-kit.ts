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
import { createClient } from '@supabase/supabase-js';

// Function to derive private key from signature
function deriveKeyFromSignature(signature: string): string {
  // Convert signature to byte array
  const signatureBytes = bs58.decode(signature);
  // Use first 32 bytes of signature as seed
  const seed = signatureBytes.slice(0, 32);
  // Generate keypair from seed
  const keypair = Keypair.fromSeed(new Uint8Array(seed));
  // Return secret key in base58
  return bs58.encode(keypair.secretKey);
}

export function generateReadOnlyKey(): string {
  const keypair = Keypair.generate();
  return bs58.encode(keypair.secretKey);
}

export class ExtendedSolanaAgentKit extends SolanaAgentKit implements ISolanaAgentKit {
  private readonly isReadonly: boolean;
  private tradingKeypair: Keypair | null = null;
  private supabase: any;

  constructor(
    key: string | 'readonly',
    rpcUrl: string,
    openaiApiKey: string
  ) {
    const baseKey = key === 'readonly' 
      ? generateReadOnlyKey()
      : deriveKeyFromSignature(key);
        
    super(baseKey, rpcUrl, openaiApiKey);
    this.isReadonly = key === 'readonly';
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    if (!this.isReadonly) {
      const secretKey = bs58.decode(baseKey);
      this.tradingKeypair = Keypair.fromSecretKey(secretKey);
      this.wallet_address = this.tradingKeypair.publicKey;
    }
  }

  // Session management
  async initSession(params: { wallet: { publicKey: string; signature?: string; credentials?: any } }): Promise<SessionResponse> {
    try {
        const signature = params.wallet.signature || params.wallet.credentials?.signature;
        const publicKey = params.wallet.publicKey || params.wallet.credentials?.publicKey;
        
        if (!signature || !publicKey) {
            return {
                success: false,
                error: "Missing signature",
                code: "MISSING_SIGNATURE"
            };
        }

        // First deactivate any existing sessions
        const { error: updateError } = await this.supabase
            .from('trading_sessions')
            .update({ is_active: false })
            .eq('public_key', publicKey)
            .eq('is_active', true);

        if (updateError) {
            console.error('Error deactivating existing sessions:', updateError);
        }

        // Create new session
        const sessionData = {
            public_key: publicKey,
            signature: signature,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            is_active: true,
            wallet_data: {
                publicKey,
                connected: true,
                tradingPublicKey: this.tradingKeypair?.publicKey.toString()
            }
        };

        const { error: insertError } = await this.supabase
            .from('trading_sessions')
            .insert(sessionData);

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
            sessionId: signature,
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

  // The rest of your methods stay the same but use this.tradingKeypair for transactions
  async trade(outputMint: PublicKey, amount: number, inputMint: PublicKey, slippageBps: number): Promise<string> {
    if (this.isReadonly || !this.tradingKeypair) {
      throw new Error('Cannot execute trades in readonly mode or without trading keypair');
    }
    return super.trade(outputMint, amount, inputMint, slippageBps);
  }

  async validateSession(sessionId: string): Promise<boolean> {
    try {
        // Get latest active session
        const { data, error } = await this.supabase
            .from('trading_sessions')
            .select('*')
            .eq('signature', sessionId)
            .eq('is_active', true)
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error) {
            console.error('Session validation error:', error);
            return false;
        }

        return !!data;
    } catch (error) {
        console.error('Session validation error:', error);
        return false;
    }
  }

  async createOrcaSingleSidedWhirlpool(
    depositTokenAmount: BN,
    depositTokenMint: PublicKey,
    otherTokenMint: PublicKey,
    initialPrice: Decimal,
    maxPrice: Decimal,
    feeTier: 0.01 | 0.02 | 0.04 | 0.05 | 0.16 | 0.3 | 0.65
  ): Promise<string> {
    if (this.isReadonly || !this.tradingKeypair) {
      throw new Error('Cannot create whirlpools in readonly mode or without trading keypair');
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

  async getTokenDataByAddress(address: string): Promise<TokenInfo> {
    const jupiterData = await super.getTokenDataByAddress(address);
    if (!jupiterData) {
      throw new Error(`No token data found for address ${address}`);
    }
    
    return {
      address: jupiterData.address,
      symbol: jupiterData.symbol,
      decimals: jupiterData.decimals,
      verified: jupiterData.verified || false,
      source: 'jupiter'
    };
  }

  async deployToken(
    name: string, 
    uri: string, 
    symbol: string, 
    decimals?: number, 
    initialSupply?: number
  ): Promise<TokenDeploymentResponse> {
    const result = await super.deployToken(name, uri, symbol, decimals, initialSupply);
    return {
      success: true,
      mint: result.mint,
      timestamp: new Date().toISOString()
    };
  }

  async fetchTokenPrice(mint: string): Promise<string> {
    return super.fetchTokenPrice(mint);
  }

  async getTPS(): Promise<number> {
    return super.getTPS();
  }

  async transfer(to: PublicKey, amount: number, mint?: PublicKey): Promise<string> {
    if (this.isReadonly || !this.tradingKeypair) {
      throw new Error('Cannot transfer in readonly mode or without trading keypair');
    }
    return super.transfer(to, amount, mint);
  }

  async getBalance(tokenAddress?: PublicKey): Promise<number> {
    return super.getBalance(tokenAddress);
  }

  async mintNFT(collectionMint: PublicKey, metadata: any, recipient?: PublicKey): Promise<NFTMintResponse> {
    const result = await super.mintNFT(collectionMint, metadata, recipient) as MintCollectionNFTResponse;
    return {
      success: true,
      mint: result.mint,
      metadata: result.metadata,
      edition: new PublicKey(result.mint),
      signature: result.signature,
      timestamp: new Date().toISOString()
    };
  }

  async lendAssets(amount: number): Promise<string> {
    throw new Error('Not implemented');
  }

  async stake(amount: number): Promise<string> {
    throw new Error('Not implemented');
  }

  async pythFetchPrice(priceFeedID: string): Promise<string> {
    throw new Error('Not implemented');
  }

  async resolveAllDomains(domain: string): Promise<PublicKey | undefined> {
    throw new Error('Not implemented');
  }

  async getOwnedAllDomains(owner: PublicKey): Promise<string[]> {
    throw new Error('Not implemented');
  }

  async getOwnedDomainsForTLD(tld: string): Promise<string[]> {
    throw new Error('Not implemented');
  }

  async getAllDomainsTLDs(): Promise<string[]> {
    throw new Error('Not implemented');
  }

  async getAllRegisteredAllDomains(): Promise<string[]> {
    throw new Error('Not implemented');
  }

  async getMainAllDomainsDomain(owner: PublicKey): Promise<string | null> {
    throw new Error('Not implemented');
  }

  async getPrimaryDomain(account: PublicKey): Promise<string> {
    throw new Error('Not implemented');
  }

  async registerDomain(name: string, spaceKB?: number): Promise<string> {
    throw new Error('Not implemented');
  }

  async resolveSolDomain(domain: string): Promise<PublicKey> {
    throw new Error('Not implemented');
  }
}
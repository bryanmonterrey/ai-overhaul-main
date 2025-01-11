// types/agent-kit.ts

import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import Decimal from 'decimal.js';

export interface SessionResponse {
    success: boolean;
    sessionId?: string;
    sessionSignature?: string;
    timestamp?: string;
    publicKey?: string;
    expiresAt?: string;
    error?: string;
    code?: string;
}

export interface TokenInfo {
    address: string;
    symbol: string;
    decimals: number;
    verified: boolean;
    source: string;
}

export interface TokenDeploymentResponse {
    success: boolean;
    mint: PublicKey;
    timestamp: string;
}

export interface NFTMintResponse {
    success: boolean;
    mint: PublicKey;
    metadata: any;
    edition: PublicKey;
    signature: string;
    timestamp: string;
}

export interface TradeResponse {
    success: boolean;
    signature: string;
    timestamp: string;
    outputAmount?: number;
    inputAmount?: number;
}

export interface Config {
    OPENAI_API_KEY?: string;
    rateLimit?: number;
    maxRetries?: number;
    timeout?: number;
}

export interface ISolanaAgentKit {
    // Session Management
    initSession(params: { wallet: { publicKey: string; signature?: string; credentials?: any } }): Promise<SessionResponse>;
    validateSession(sessionId: string): Promise<boolean>;

    // Core Trading Operations
    trade(outputMint: PublicKey, amount: number, inputMint: PublicKey, slippageBps: number): Promise<string>;
    getTokenDataByAddress(address: string): Promise<TokenInfo>;
    deployToken(name: string, uri: string, symbol: string, decimals?: number, initialSupply?: number): Promise<TokenDeploymentResponse>;
    
    // NFT Operations
    mintNFT(collectionMint: PublicKey, metadata: any, recipient?: PublicKey): Promise<NFTMintResponse>;
    
    // Asset Management
    transfer(to: PublicKey, amount: number, mint?: PublicKey): Promise<string>;
    getBalance(tokenAddress?: PublicKey): Promise<number>;
    lendAssets(amount: number): Promise<string>;
    stake(amount: number): Promise<string>;
    
    // Market Data
    pythFetchPrice(priceFeedID: string): Promise<string>;
    fetchTokenPrice(mint: string): Promise<string>;
    getTPS(): Promise<number>;
    
    // Domain Operations
    resolveAllDomains(domain: string): Promise<PublicKey | undefined>;
    getOwnedAllDomains(owner: PublicKey): Promise<string[]>;
    getOwnedDomainsForTLD(tld: string): Promise<string[]>;
    getAllDomainsTLDs(): Promise<string[]>;
    getAllRegisteredAllDomains(): Promise<string[]>;
    getMainAllDomainsDomain(owner: PublicKey): Promise<string | null>;
    getPrimaryDomain(account: PublicKey): Promise<string>;
    registerDomain(name: string, spaceKB?: number): Promise<string>;
    resolveSolDomain(domain: string): Promise<PublicKey>;
}
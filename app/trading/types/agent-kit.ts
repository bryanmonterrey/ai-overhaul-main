// app/trading/types/agent-kit.ts

import Decimal from 'decimal.js';
import { PublicKey } from "@solana/web3.js";
import { RouteInfo } from "@jup-ag/core";
import { BN } from "@coral-xyz/anchor";
import type { JupiterTokenData } from 'solana-agent-kit';

// Base Types
export interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
  logoURI: string;  // Required to match JupiterTokenData
  tags: string[];
  daily_volume: number;
  freeze_authority: string | null;
  mint_authority: string | null;
  permanent_delegate: string | null;
  extensions: {
    coingeckoId?: string;  // Match JupiterTokenData exactly
  };
}

// Separate base responses for different timestamp types
export interface BaseResponse {
  success: boolean;
  error?: string;
  timestamp?: string;
}

export interface BaseResponseWithUnixTime {
  success: boolean;
  error?: string;
  timestamp: number;
}

// Token Management Responses
export interface TokenDeploymentResponse extends BaseResponse {
  mint: PublicKey;
  metadata?: PublicKey;
  freezeAuthority?: PublicKey;
  mintAuthority?: PublicKey;
}

export interface TokenBalanceResponse extends BaseResponse {
  balance: number;
  decimals: number;
  uiBalance: string;
}

export interface TokenTransferResponse extends BaseResponse {
  signature: string;
  source: PublicKey;
  destination: PublicKey;
  amount: number;
}

// NFT Responses
export interface CollectionDeployment {
  collectionMint: PublicKey;
  metadata: PublicKey;
  masterEdition: PublicKey;
}

export interface CollectionDeploymentResponse extends BaseResponse {
  mint: PublicKey;
  metadata: PublicKey;
  masterEdition: PublicKey;
}

export interface MintCollectionNFTResponse {
  mint: PublicKey;
  metadata: PublicKey;
  signature: string;
}

export interface NFTMintResponse extends BaseResponse {
  mint: PublicKey;
  metadata: PublicKey;
  edition: PublicKey;
  signature: string;
}

// Trading Responses
export interface TradeExecutionResponse extends BaseResponse {
  signature: string;
  signatures?: string[];
  route?: RouteInfo;
  inputAmount: number;
  outputAmount: number;
  priceImpact: number;
  networkStats?: {
    tps: number;
  };
  tokenData?: {
    input: TokenInfo;
    output: TokenInfo;
  };
}

export interface RouteQuoteResponse extends BaseResponse {
  price: number;
  priceImpact: number;
  route: RouteInfo;
  minOutputAmount: number;
  tokenData?: {
    input: TokenInfo;
    output: TokenInfo;
  };
}

// Domain Service Responses
export interface DomainResponse extends BaseResponse {
  domain: string;
  owner: PublicKey;
  space?: number;
  expiry?: number;
}

export interface DomainResolutionResponse extends BaseResponse {
  address: PublicKey;
  domain: string;
  owner: PublicKey;
}

// DeFi Responses
export interface LendingResponse extends BaseResponse {
  signature: string;
  amount: number;
  apy: number;
  collateral?: number;
}

export interface StakingResponse extends BaseResponse {
  signature: string;
  amount: number;
  apy: number;
  validatorAddress?: PublicKey;
  epoch?: number;
}

// Token Launch Responses
export interface PumpfunLaunchResponse extends BaseResponse {
  tokenMint: PublicKey;
  signature: string;
  marketId?: string;
  initialPrice?: number;
}

// Airdrop Responses
export interface CompressedAirdropResponse extends BaseResponse {
  signatures: string[];
  successCount: number;
  failedRecipients?: string[];
  totalAmount: number;
}

// AMM Responses
export interface WhirlpoolCreationResponse extends BaseResponse {
  poolAddress: PublicKey;
  signature: string;
  tokenAVault: PublicKey;
  tokenBVault: PublicKey;
  initialPrice: string;
}

export interface RaydiumAMMResponse extends BaseResponse {
  signature: string;
  poolId: PublicKey;
  marketId: PublicKey;
  baseVault: PublicKey;
  quoteVault: PublicKey;
}

// DEX Responses
export interface OpenbookMarketResponse extends BaseResponse {
  market: PublicKey;
  baseVault: PublicKey;
  quoteVault: PublicKey;
  signatures: string[];
}

// Price Oracle Responses - Using BaseResponseWithUnixTime
export interface PythPriceResponse extends BaseResponseWithUnixTime {
  price: number;
  confidence: number;
  previousPrice?: number;
  priceChange24h?: number;
}

// Task System Responses
export interface GibworkCreateTaskReponse extends BaseResponse {
  taskId: string;
  creator: PublicKey;
  bounty: {
    mint: string;
    amount: number;
  };
  status: string;
}

// Market Data Response
export interface MarketDataResponse extends BaseResponse {
  price?: number;
  volume24h?: number;
  liquidity?: number;
  priceChange24h?: number;
  pairs?: Array<{
    dexId: string;
    pairAddress: string;
    baseToken: TokenInfo;
    quoteToken: TokenInfo;
    priceUsd: number;
    volume24h: number;
  }>;
}

export interface CollectionOptions {
    name: string;
    symbol: string;
    uri: string;
    sellerFeeBasisPoints?: number;
    creators?: Array<{
      address: string;
      percentage: number;
    }>;
    isMutable?: boolean;
  }

  export interface PumpFunTokenOptions {
    supply?: number;
    decimals?: number;
    mintCap?: number;
    vesting?: {
      amount: number;
      duration: number;
      interval: number;
    };
    liquiditySettings?: {
      percentage: number;
      lockDuration: number;
    };
    tradingSettings?: {
      maxTxAmount?: number;
      maxWalletAmount?: number;
    };
    fees?: {
      buyTax?: number;
      sellTax?: number;
      transferTax?: number;
      reflectionPercentage?: number;
    };
  }

  export const FEE_TIERS = {
    STABLE: 0.0001,  // 0.01%
    LOW: 0.0004,     // 0.04%
    MEDIUM: 0.0010,  // 0.1%
    HIGH: 0.0020,    // 0.2%
    ULTRA: 0.0040    // 0.4%
  } as const;
  
  export type FeeTier = keyof typeof FEE_TIERS;

// Trade Parameters
export interface TradeParams {
  inputMint: string;
  outputMint: string;
  amount: number;
  slippage: number;
  useMev: boolean;
  priorityFee?: number;
  agentParams?: {
    routeType?: 'BEST' | 'SAFE' | 'SHORT';
    maxAccounts?: number;
    validateRoute?: boolean;
    simulateTransaction?: boolean;
  };
}

// WebSocket Event Types
export interface TradeStatusUpdate {
  type: 'trade';
  data: {
    signature: string;
    status: 'pending' | 'confirmed' | 'failed';
    confirmations?: number;
    error?: string;
  };
}

export interface CollectionDeployment {
  collectionMint: PublicKey;
  metadata: PublicKey;
  masterEdition: PublicKey;
}

export interface MintCollectionNFTResponse {
  mint: PublicKey;
  metadata: PublicKey;  
  signature: string;
}

// Parameters interface for deployToken
export interface DeployTokenParams {
  name: string;
  uri: string;
  symbol: string;
  decimals?: number;
  initialSupply?: number;
}

export interface BlockchainResponse {
  signature?: string;
  signatures?: string[];
  error?: string;
}

export interface ISolanaAgentKit {
  // Session management
  initSession(params: { wallet: { publicKey: string; sessionProof?: string; } }): Promise<SessionResponse>;
  validateSession(sessionId: string): Promise<boolean>;
  
  // Token operations
  getTokenDataByAddress(mint: string): Promise<TokenInfo>;
  fetchTokenPrice(mint: string): Promise<string>;
  getTPS(): Promise<number>;
  trade(outputMint: PublicKey, amount: number, inputMint: PublicKey, slippageBps: number): Promise<string>;
  transfer(to: PublicKey, amount: number, mint?: PublicKey): Promise<string>;
  getBalance(tokenAddress?: PublicKey): Promise<number>;
  deployToken(name: string, uri: string, symbol: string, decimals?: number, initialSupply?: number): Promise<TokenDeploymentResponse>;
  
  // NFT operations
  mintNFT(collectionMint: PublicKey, metadata: any, recipient?: PublicKey): Promise<NFTMintResponse>;
  
  // DeFi operations
  lendAssets(amount: number): Promise<string>;
  stake(amount: number): Promise<string>;
  pythFetchPrice(priceFeedID: string): Promise<string>;
  
  // Domain operations
  resolveAllDomains(domain: string): Promise<PublicKey | undefined>;
  getOwnedAllDomains(owner: PublicKey): Promise<string[]>;
  getOwnedDomainsForTLD(tld: string): Promise<string[]>;
  getAllDomainsTLDs(): Promise<string[]>;
  getAllRegisteredAllDomains(): Promise<string[]>;
  getMainAllDomainsDomain(owner: PublicKey): Promise<string | null>;
  getPrimaryDomain(account: PublicKey): Promise<string>;
  registerDomain(name: string, spaceKB?: number): Promise<string>;
  resolveSolDomain(domain: string): Promise<PublicKey>;
  
  // AMM operations
  createOrcaSingleSidedWhirlpool(
    depositTokenAmount: BN,
    depositTokenMint: PublicKey,
    otherTokenMint: PublicKey,
    initialPrice: Decimal,
    maxPrice: Decimal,
    feeTier: 0.01 | 0.02 | 0.04 | 0.05 | 0.16 | 0.3 | 0.65
  ): Promise<string>;
  
  // Properties
  wallet_address: PublicKey;
}

export interface Config {
  OPENAI_API_KEY?: string;
  JUPITER_REFERRAL_ACCOUNT?: string;
  JUPITER_FEE_BPS?: number;
}

// Add the session response interface
export interface SessionResponse {
  success: boolean;
  sessionId: string;
  sessionSignature?: string;  // Make it optional since not all responses include it
  timestamp: string;
}

// Add response type for sessions
export interface SessionResponse extends BaseResponse {
  sessionId?: string;
  session_message?: string;
  error?: string;
}

export interface NetworkStatusUpdate {
  type: 'network';
  data: {
    tps: number;
    slot: number;
    blockTime: number;
  };
}

export const DEFAULT_OPTIONS = {
  TOKEN_DECIMALS: 9,
  SLIPPAGE_BPS: 100, // 1%
  BASE_TICKS_PER_SECOND: 1500,
  DEFAULT_PRIORITY_FEE: 10000 // lamports
} as const;

export interface Creator {
  address: string;
  verified: boolean;
  share: number;
}

export type WebSocketUpdate = TradeStatusUpdate | NetworkStatusUpdate;
// Part 1: Imports and Basic Interfaces
import { Connection, PublicKey, TransactionInstruction, Transaction, VersionedTransaction } from '@solana/web3.js';
import JSBI from 'jsbi';
import { Jupiter, RouteInfo, TOKEN_LIST_URL } from '@jup-ag/core';
import { WalletAdapter } from '../types/wallet';
import { BN } from '@coral-xyz/anchor';
import Decimal from 'decimal.js';
import { SolanaAgentKit } from 'solana-agent-kit';
import type { ISolanaAgentKit, Config } from '../types/agent-kit';
import type { PumpFunTokenOptions } from 'solana-agent-kit';
import { 
  TradeParams,
  TradeExecutionResponse,
  RouteQuoteResponse,
  TokenDeploymentResponse,
  CollectionDeploymentResponse,
  NFTMintResponse,
  DomainResponse,
  StakingResponse,
  PumpfunLaunchResponse,
  CompressedAirdropResponse,
  WhirlpoolCreationResponse,
  RaydiumAMMResponse,
  OpenbookMarketResponse,
  PythPriceResponse,
  MarketDataResponse,
  TokenInfo,
  CollectionOptions,
  FEE_TIERS,
  BaseResponse,
  TokenBalanceResponse,
  TokenTransferResponse,
  DomainResolutionResponse,
  LendingResponse,
  SessionResponse,
  GibworkCreateTaskReponse
} from '../types/agent-kit';
import bs58 from 'bs58';
import { ExtendedSolanaAgentKit } from './extended-agent-kit';
import { createClient } from '@supabase/supabase-js';

// Interface Definitions
interface TradingSession {
  publicKey: string;
  signature: string;
  timestamp: number;
  expiresAt: number;
  wallet: {
    name: string;
    connected: boolean;
  };
}

interface WebSocketMessage {
  type: 'trade_status' | 'quote_update' | 'execution_update' | 'session_status';
  data: any;
}

interface WebSocketTradeStatus {
  tradeId: string;
  status: 'initiated' | 'pending' | 'executed' | 'failed';
  signature?: string;
  error?: string;
}

interface WebSocketQuoteUpdate {
  inputMint: string;
  outputMint: string;
  price: number;
  priceImpact: number;
}

interface WebSocketExecutionUpdate {
  tradeId: string;
  signature: string;
  status: 'confirmed' | 'finalized';
  slot: number;
}

interface WebSocketSessionStatus {
  status: 'active' | 'expired' | 'invalid';
  publicKey: string;
  expiresAt?: number;
}

class TradeExecutionService {
  private connection: Connection;
  private jupiter!: Jupiter;
  private blockEngineUrl: string;
  private agentKit: ExtendedSolanaAgentKit; 
  private wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/ws';
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private listeners: { [key: string]: Function[] } = {};
  private activeSessions: Map<string, TradingSession> = new Map();
  private readonly SESSION_DURATION = 30 * 60 * 1000; // 30 minutes
  private readonly SESSION_REFRESH_WINDOW = 5 * 60 * 1000; // 5 minutes
  private supabase;

  constructor() {
    this.connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL!);
    this.blockEngineUrl = 'https://frankfurt.jito.wtf/';
    
    // Pass OPENAI_API_KEY directly as string
    this.agentKit = new ExtendedSolanaAgentKit(
      'readonly',
      process.env.NEXT_PUBLIC_RPC_URL!,
      process.env.OPENAI_API_KEY!
    );
    
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    this.initializeJupiter();
    this.connectWebSocket();
    this.startSessionCleanup();
  }

  private async getOrCreateAgentKit(wallet?: WalletAdapter, session?: TradingSession): Promise<ExtendedSolanaAgentKit> {
    if (!wallet) {
      return this.agentKit;
    }
  
    // Create new instance with session if available
    const credentials = session ? session.signature : wallet.publicKey.toString();
    
    return new ExtendedSolanaAgentKit(
      credentials,
      process.env.NEXT_PUBLIC_RPC_URL!,
      process.env.OPENAI_API_KEY!  // Pass API key directly
    );
  }

  private async getSession(publicKey: string): Promise<TradingSession | null> {
    const { data, error } = await this.supabase
      .from('trading_sessions')
      .select('*')
      .eq('public_key', publicKey)
      .single();

    if (error || !data) return null;

    // Check if session needs refresh
    const expiresAt = new Date(data.expires_at).getTime();
    const now = Date.now();

    if (now > expiresAt) {
      return null;
    }

    // Auto-refresh session if within refresh window
    if (now > expiresAt - this.SESSION_REFRESH_WINDOW) {
      const refreshedSession = {
        public_key: data.public_key,
        signature: data.signature,
        created_at: data.created_at,
        expires_at: new Date(now + this.SESSION_DURATION).toISOString(),
        wallet_data: data.wallet_data,
        is_active: true
      };

      await this.supabase
        .from('trading_sessions')
        .upsert(refreshedSession)
        .eq('public_key', data.public_key);

      return {
        publicKey: data.public_key,
        signature: data.signature,
        timestamp: new Date(data.created_at).getTime(),
        expiresAt: now + this.SESSION_DURATION,
        wallet: data.wallet_data
      };
    }

    return {
      publicKey: data.public_key,
      signature: data.signature,
      timestamp: new Date(data.created_at).getTime(),
      expiresAt: expiresAt,
      wallet: data.wallet_data
    };
  }

  private async saveSession(session: TradingSession): Promise<void> {
    await this.supabase
      .from('trading_sessions')
      .upsert({
        public_key: session.publicKey,
        signature: session.signature,
        created_at: new Date(session.timestamp).toISOString(),
        expires_at: new Date(session.expiresAt).toISOString(),
        wallet_data: session.wallet,
        is_active: true
      })
      .eq('public_key', session.publicKey);
  }

  async initializeSession(wallet: WalletAdapter): Promise<string> {
    try {
      if (!this.agentKit) {
        throw new Error('AgentKit not initialized');
      }

      // Try with existing session
      const sessionResult = await this.agentKit.initSession({
        wallet: {
          publicKey: wallet.publicKey.toString(),
        }
      });
  
      // Handle session signature requirement
      if (sessionResult?.error === 'session_signature_required') {
        const message = new TextEncoder().encode(sessionResult.session_message || 'Initialize trading session');
        const signatureBytes = await wallet.signMessage(message);
        const signature = bs58.encode(Buffer.from(signatureBytes));
  
        // Retry with signed message
        const signedResult = await this.agentKit.initSession({
          wallet: {
            publicKey: wallet.publicKey.toString(),
            sessionProof: signature
          }
        });
  
        if (signedResult?.success && signedResult.sessionId) {
          // Store session
          await this.createTradingSession(wallet, signedResult.sessionId);
          return signedResult.sessionId;
        }
        throw new Error(signedResult?.error || 'Session initialization failed');
      }
  
      if (sessionResult?.success && sessionResult.sessionId) {
        // Store session
        await this.createTradingSession(wallet, sessionResult.sessionId);
        return sessionResult.sessionId;
      }
      throw new Error(sessionResult?.error || 'Session initialization failed');
    } catch (error) {
      console.error('Session initialization error:', error);
      throw error;
    }
  }

  private startSessionCleanup() {
    setInterval(() => {
      const now = Date.now();
      for (const [publicKey, session] of this.activeSessions.entries()) {
        if (now > session.expiresAt) {
          this.activeSessions.delete(publicKey);
          this.emit('session_status', {
            status: 'expired',
            publicKey,
            expiresAt: session.expiresAt
          });
        }
      }
    }, 60000); // Check every minute
  }

  async createTradingSession(wallet: WalletAdapter, signature: string): Promise<TradingSession> {
    const session: TradingSession = {
      publicKey: wallet.publicKey.toString(),
      signature,
      timestamp: Date.now(),
      expiresAt: Date.now() + this.SESSION_DURATION,
      wallet: {
        name: 'unknown',
        connected: true
      }
    };

    await this.saveSession(session);
    return session;
  }

  private async initializeJupiter() {
    this.jupiter = await Jupiter.load({
      connection: this.connection,
      cluster: 'mainnet-beta'
    });
  }

  async validateSession(publicKey: string, signature: string): Promise<boolean> {
    const session = await this.getSession(publicKey);
    if (!session) return false;

    return session.signature === signature;  // expiresAt check handled in getSession
  }

  async refreshSession(publicKey: string): Promise<TradingSession | null> {
    const session = this.activeSessions.get(publicKey);
    if (!session || Date.now() > session.expiresAt) return null;

    const refreshedSession: TradingSession = {
      ...session,
      expiresAt: Date.now() + this.SESSION_DURATION
    };

    this.activeSessions.set(publicKey, refreshedSession);
    this.emit('session_status', {
      status: 'active',
      publicKey,
      expiresAt: refreshedSession.expiresAt
    });

    return refreshedSession;
  }

  clearSession(publicKey: string) {
    this.activeSessions.delete(publicKey);
    this.emit('session_status', {
      status: 'invalid',
      publicKey
    });
  }

  private connectWebSocket() {
    if (typeof window !== 'undefined') {
      if (this.ws?.readyState === WebSocket.OPEN) {
        return;
      }

      this.ws = new WebSocket(this.wsUrl);
      
      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.emit('connection', { status: 'connected' });

        // Notify about active sessions
        this.activeSessions.forEach((session, publicKey) => {
          this.emit('session_status', {
            status: 'active',
            publicKey,
            expiresAt: session.expiresAt
          });
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleWebSocketMessage(data);
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.emit('connection', { status: 'disconnected' });
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          this.reconnectDelay *= 2;
          setTimeout(() => this.connectWebSocket(), this.reconnectDelay);
        } else {
          console.error('Max reconnection attempts reached');
          this.emit('connection', { 
            status: 'failed', 
            error: 'Max reconnection attempts reached' 
          });
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.emit('error', error);
      };
    }
  }

  private handleWebSocketMessage(data: WebSocketMessage) {
    switch (data.type) {
      case 'trade_status':
        this.handleTradeStatus(data.data as WebSocketTradeStatus);
        break;
      case 'quote_update':
        this.handleQuoteUpdate(data.data as WebSocketQuoteUpdate);
        break;
      case 'execution_update':
        this.handleExecutionUpdate(data.data as WebSocketExecutionUpdate);
        break;
      case 'session_status':
        this.handleSessionStatus(data.data as WebSocketSessionStatus);
        break;
      default:
        console.log('Unknown message type:', data.type);
    }
  }

  private handleTradeStatus(data: WebSocketTradeStatus) {
    this.emit('tradeStatus', data);
  }

  private handleQuoteUpdate(data: WebSocketQuoteUpdate) {
    this.emit('quoteUpdate', data);
  }

  private handleExecutionUpdate(data: WebSocketExecutionUpdate) {
    this.emit('executionUpdate', data);
  }

  private handleSessionStatus(data: WebSocketSessionStatus) {
    switch (data.status) {
      case 'expired':
        this.clearSession(data.publicKey);
        break;
      case 'active':
        if (data.expiresAt && data.expiresAt - Date.now() < 3600000) { // 1 hour
          this.refreshSession(data.publicKey);
        }
        break;
    }
    this.emit('sessionStatus', data);
  }

  public on(event: string, callback: Function) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    return () => {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    };
  }

  private emit(event: string, data: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }

  // Utility methods for connection management
  public disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.listeners = {};
      this.activeSessions.clear();
    }
  }

  public reconnect() {
    this.disconnect();
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;
    this.connectWebSocket();
  }

  public isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private async submitToBlockEngine(signedTransaction: Transaction | VersionedTransaction) {
    try {
      const serializedTx = Buffer.from(
        signedTransaction instanceof VersionedTransaction 
          ? signedTransaction.serialize()
          : signedTransaction.serialize({
              requireAllSignatures: false,
              verifySignatures: false
            })
      );

      const response = await fetch(`${this.blockEngineUrl}/bundle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactions: [serializedTx.toString('base64')],
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit to block engine');
      }

      const result = await response.json();
      return result.bundleId;
    } catch (error) {
      console.error('Block engine submission error:', error);
      throw error;
    }
  }

  async executeTradeWithMEV(params: TradeParams, wallet: WalletAdapter): Promise<TradeExecutionResponse> {
    try {
      // Get or create session
      const session = await this.getSession(wallet.publicKey.toString());
      if (!session) {
        throw new Error('No active trading session. Please initialize a session first.');
      }

      // Add session ID to params
      params.sessionId = session.signature;

      // Execute trade with session info
      // ... rest of your trade execution code ...

    } catch (error) {
      console.error('Trade execution error:', error);
      throw error;
    }
  }

  async getRouteQuote(params: TradeParams): Promise<RouteQuoteResponse> {
    try {
      const agentKit = await this.getOrCreateAgentKit();
      
      const inputTokenData = await agentKit.getTokenDataByAddress(params.inputMint);
      const outputTokenData = await agentKit.getTokenDataByAddress(params.outputMint);

      const amountBigInt = JSBI.BigInt(params.amount.toString());

      const routes = await this.jupiter.computeRoutes({
        inputMint: new PublicKey(params.inputMint),
        outputMint: new PublicKey(params.outputMint),
        amount: amountBigInt,
        slippageBps: params.slippage * 100,
      });

      if (!routes.routesInfos?.length) {
        throw new Error('No routes found');
      }

      const bestRoute = routes.routesInfos[0];
      const outAmount = Number(bestRoute.outAmount.toString());
      const inAmount = Number(bestRoute.inAmount.toString());
      const otherAmountThreshold = Number(bestRoute.otherAmountThreshold.toString());

      this.emit('quoteUpdate', {
        inputMint: params.inputMint,
        outputMint: params.outputMint,
        price: outAmount / inAmount,
        priceImpact: bestRoute.priceImpactPct
      });

      return {
        success: true,
        price: outAmount / inAmount,
        priceImpact: bestRoute.priceImpactPct,
        route: bestRoute,
        minOutputAmount: otherAmountThreshold,
        tokenData: {
          input: inputTokenData as TokenInfo,
          output: outputTokenData as TokenInfo
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Quote error:', error);
      throw error;
    }
  }

  async deployToken(
    name: string,
    uri: string,
    symbol: string,
    decimals: number = 9,
    initialSupply?: number,
    wallet?: WalletAdapter
  ): Promise<TokenDeploymentResponse> {
    if (wallet) {
      const hasValidSession = await this.validateSession(wallet.publicKey.toString());
      if (!hasValidSession) {
        throw new Error('Valid trading session required for token deployment');
      }
    }

    const agentKit = await this.getOrCreateAgentKit(wallet);
    const result = await agentKit.deployToken(name, uri, symbol, decimals, initialSupply);
    
    if (wallet) {
      await this.refreshSession(wallet.publicKey.toString());
    }

    return {
      success: true,
      mint: result.mint,
      timestamp: new Date().toISOString()
    };
  }

  async getTokenInfo(symbolOrAddress: string): Promise<TokenInfo | null> {
    try {
      // Try Jupiter token list first
      const jupiterTokenList = await (await fetch(TOKEN_LIST_URL['mainnet-beta'])).json();
      
      // Look for exact matches first
      let token = jupiterTokenList.find((t: any) => 
        t.symbol.toUpperCase() === symbolOrAddress.toUpperCase() || 
        t.address === symbolOrAddress
      );

      if (token) {
        return {
          symbol: token.symbol,
          address: token.address,
          name: token.name,
          decimals: token.decimals,
          logoURI: token.logoURI,
          tags: [],
          daily_volume: 0,
          freeze_authority: null,
          mint_authority: null,
          permanent_delegate: null,
          extensions: {}
        };
      }

      // If not found and it looks like an address, try token metadata
      if (symbolOrAddress.length === 44 || symbolOrAddress.startsWith('0x')) {
        const mint = new PublicKey(symbolOrAddress);
        return {
          symbol: symbolOrAddress.slice(0, 8),
          address: symbolOrAddress,
          name: `Token ${symbolOrAddress.slice(0, 8)}`,
          decimals: 9,
          logoURI: '',
          tags: [],
          daily_volume: 0,
          freeze_authority: null,
          mint_authority: null,
          permanent_delegate: null,
          extensions: {}
        };
      }

      return null;
    } catch (error) {
      console.error('Error getting token info:', error);
      return null;
    }
  }

  async getBalance(tokenAddress?: PublicKey, wallet?: WalletAdapter): Promise<TokenBalanceResponse> {
    const agentKit = await this.getOrCreateAgentKit(wallet);
    const balance = await agentKit.getBalance(tokenAddress);
    
    return {
      success: true,
      balance,
      decimals: 9,
      uiBalance: balance.toString(),
      timestamp: new Date().toISOString()
    };
  }

  async transfer(
    to: PublicKey,
    amount: number,
    mint?: PublicKey,
    wallet?: WalletAdapter
  ): Promise<TokenTransferResponse> {
    if (wallet) {
      const hasValidSession = await this.validateSession(wallet.publicKey.toString());
      if (!hasValidSession) {
        throw new Error('Valid trading session required for transfer');
      }
    }

    const agentKit = await this.getOrCreateAgentKit(wallet);
    const signature = await agentKit.transfer(to, amount, mint);

    if (wallet) {
      await this.refreshSession(wallet.publicKey.toString());
    }

    return {
      success: true,
      signature,
      source: agentKit.wallet_address,
      destination: to,
      amount,
      timestamp: new Date().toISOString()
    };
  }

  async lendAssets(amount: number, wallet?: WalletAdapter): Promise<LendingResponse> {
    if (wallet) {
      const hasValidSession = await this.validateSession(wallet.publicKey.toString());
      if (!hasValidSession) {
        throw new Error('Valid trading session required for lending');
      }
    }

    const agentKit = await this.getOrCreateAgentKit(wallet);
    const txid = await agentKit.lendAssets(amount);

    if (wallet) {
      await this.refreshSession(wallet.publicKey.toString());
    }

    return {
      success: true,
      signature: txid,
      amount,
      apy: 0,  // You might want to get this from your DeFi provider
      timestamp: new Date().toISOString()
    };
  }

  async stake(amount: number, wallet?: WalletAdapter): Promise<StakingResponse> {
    if (wallet) {
      const hasValidSession = await this.validateSession(wallet.publicKey.toString());
      if (!hasValidSession) {
        throw new Error('Valid trading session required for staking');
      }
    }

    const agentKit = await this.getOrCreateAgentKit(wallet);
    const txid = await agentKit.stake(amount);

    if (wallet) {
      await this.refreshSession(wallet.publicKey.toString());
    }

    return {
      success: true,
      signature: txid,
      amount,
      apy: 0,  // You might want to get this from your staking provider
      timestamp: new Date().toISOString()
    };
  }

  async mintNFT(
    collectionMint: PublicKey,
    metadata: any,
    recipient?: PublicKey,
    wallet?: WalletAdapter
  ): Promise<NFTMintResponse> {
    if (wallet) {
      const hasValidSession = await this.validateSession(wallet.publicKey.toString());
      if (!hasValidSession) {
        throw new Error('Valid trading session required for NFT minting');
      }
    }

    const agentKit = await this.getOrCreateAgentKit(wallet);
    const result = await agentKit.mintNFT(collectionMint, metadata, recipient);

    if (wallet) {
      await this.refreshSession(wallet.publicKey.toString());
    }

    return {
      success: true,
      mint: result.mint,
      metadata: result.metadata,
      edition: result.mint,
      signature: 'pending',
      timestamp: new Date().toISOString()
    };
  }

  async sendCompressedAirdrop(
    mintAddress: string,
    amount: number,
    decimals: number,
    recipients: string[],
    priorityFeeInLamports: number,
    shouldLog: boolean,
    wallet?: WalletAdapter
  ): Promise<CompressedAirdropResponse> {
    if (wallet) {
      const hasValidSession = await this.validateSession(wallet.publicKey.toString());
      if (!hasValidSession) {
        throw new Error('Valid trading session required for airdrop');
      }
    }

    const agentKit = await this.getOrCreateAgentKit(wallet);
    const signatures = await agentKit.sendCompressedAirdrop(
      mintAddress,
      amount,
      decimals,
      recipients,
      priorityFeeInLamports,
      shouldLog
    );

    if (wallet) {
      await this.refreshSession(wallet.publicKey.toString());
    }

    return {
      success: true,
      signatures,
      successCount: signatures.length,
      totalAmount: amount * recipients.length,
      timestamp: new Date().toISOString()
    };
  }

  async createGibworkTask(
    title: string,
    content: string,
    requirements: string,
    tags: string[],
    tokenMintAddress: string,
    tokenAmount: number,
    payer?: string,
    wallet?: WalletAdapter
  ): Promise<GibworkCreateTaskReponse> {
    if (wallet) {
      const hasValidSession = await this.validateSession(wallet.publicKey.toString());
      if (!hasValidSession) {
        throw new Error('Valid trading session required for task creation');
      }
    }

    const agentKit = await this.getOrCreateAgentKit(wallet);
    const result = await agentKit.createGibworkTask(
      title,
      content,
      requirements,
      tags,
      tokenMintAddress,
      tokenAmount,
      payer
    );

    if (wallet) {
      await this.refreshSession(wallet.publicKey.toString());
    }

    return {
      success: true,
      taskId: result.taskId,
      creator: new PublicKey(agentKit.wallet_address),
      bounty: {
        mint: tokenMintAddress,
        amount: tokenAmount
      },
      status: 'created',
      timestamp: new Date().toISOString()
    };
  }

  async pythFetchPrice(priceFeedID: string): Promise<PythPriceResponse> {
    const agentKit = await this.getOrCreateAgentKit();
    const price = await agentKit.pythFetchPrice(priceFeedID);
    return {
      success: true,
      price: Number(price),
      confidence: 1,
      timestamp: Date.now()
    };
  }

  async getMarketData(tokenMint: string): Promise<MarketDataResponse> {
    try {
      const agentKit = await this.getOrCreateAgentKit();
      
      try {
        const price = await agentKit.fetchTokenPrice(tokenMint);
        if (price) {
          return {
            success: true,
            price: Number(price),
            timestamp: new Date().toISOString()
          };
        }
      } catch (e) {
        console.log('Agent Kit price fetch failed, falling back to DEXScreener');
      }

      const response = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${tokenMint}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch market data');
      }

      const data = await response.json();
      return {
        success: true,
        ...data.pairs[0],
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Market data error:', error);
      throw error;
    }
  }

  async resolveAllDomains(domain: string): Promise<PublicKey | undefined> {
    const agentKit = await this.getOrCreateAgentKit();
    return agentKit.resolveAllDomains(domain);
  }

  async getOwnedAllDomains(owner: PublicKey): Promise<string[]> {
    const agentKit = await this.getOrCreateAgentKit();
    return agentKit.getOwnedAllDomains(owner);
  }

  async getOwnedDomainsForTLD(tld: string): Promise<string[]> {
    const agentKit = await this.getOrCreateAgentKit();
    return agentKit.getOwnedDomainsForTLD(tld);
  }

  async getAllDomainsTLDs(): Promise<string[]> {
    const agentKit = await this.getOrCreateAgentKit();
    return agentKit.getAllDomainsTLDs();
  }

  async getAllRegisteredAllDomains(): Promise<string[]> {
    const agentKit = await this.getOrCreateAgentKit();
    return agentKit.getAllRegisteredAllDomains();
  }

  async getMainAllDomainsDomain(owner: PublicKey): Promise<string | null> {
    const agentKit = await this.getOrCreateAgentKit();
    return agentKit.getMainAllDomainsDomain(owner);
  }

  async getPrimaryDomain(account: PublicKey): Promise<DomainResponse> {
    const agentKit = await this.getOrCreateAgentKit();
    const domain = await agentKit.getPrimaryDomain(account);
    return {
      success: true,
      domain,
      owner: account,
      timestamp: new Date().toISOString()
    };
  }

  async registerDomain(name: string, spaceKB?: number, wallet?: WalletAdapter): Promise<DomainResponse> {
    if (wallet) {
      const hasValidSession = await this.validateSession(wallet.publicKey.toString());
      if (!hasValidSession) {
        throw new Error('Valid trading session required for domain registration');
      }
    }

    const agentKit = await this.getOrCreateAgentKit(wallet);
    const domain = await agentKit.registerDomain(name, spaceKB);
    
    if (wallet) {
      await this.refreshSession(wallet.publicKey.toString());
    }

    return {
      success: true,
      domain,
      owner: agentKit.wallet_address,
      timestamp: new Date().toISOString()
    };
  }

  async resolveSolDomain(domain: string): Promise<DomainResolutionResponse> {
    const agentKit = await this.getOrCreateAgentKit();
    const address = await agentKit.resolveSolDomain(domain);
    return {
      success: true,
      address,
      domain,
      owner: address,
      timestamp: new Date().toISOString()
    };
  }

  // AMM/DEX Creation Methods
  async createOrcaSingleSidedWhirlpool(
    depositTokenAmount: BN,
    depositTokenMint: PublicKey,
    otherTokenMint: PublicKey,
    initialPrice: Decimal,
    maxPrice: Decimal,
    feeTier: 0.01 | 0.02 | 0.04 | 0.05 | 0.16 | 0.3 | 0.65,
    wallet?: WalletAdapter
  ): Promise<WhirlpoolCreationResponse> {
    if (wallet) {
      const hasValidSession = await this.validateSession(wallet.publicKey.toString());
      if (!hasValidSession) {
        throw new Error('Valid trading session required for whirlpool creation');
      }
    }

    const agentKit = await this.getOrCreateAgentKit(wallet);
    const signature = await agentKit.createOrcaSingleSidedWhirlpool(
      depositTokenAmount,
      depositTokenMint,
      otherTokenMint,
      initialPrice,
      maxPrice,
      feeTier as 0.01 | 0.02 | 0.04 | 0.05 | 0.16 | 0.3 | 0.65
    );

    if (wallet) {
      await this.refreshSession(wallet.publicKey.toString());
    }

    return {
      success: true,
      poolAddress: depositTokenMint,
      signature,
      tokenAVault: depositTokenMint,
      tokenBVault: otherTokenMint,
      initialPrice: initialPrice.toString(),
      timestamp: new Date().toISOString()
    };
  }

  async raydiumCreateAmmV4(
    marketId: PublicKey,
    baseAmount: BN,
    quoteAmount: BN,
    startTime: BN,
    wallet?: WalletAdapter
  ): Promise<RaydiumAMMResponse> {
    if (wallet) {
      const hasValidSession = await this.validateSession(wallet.publicKey.toString());
      if (!hasValidSession) {
        throw new Error('Valid trading session required for AMM creation');
      }
    }

    const agentKit = await this.getOrCreateAgentKit(wallet);
    const signature = await agentKit.raydiumCreateAmmV4(
      marketId,
      baseAmount,
      quoteAmount,
      startTime
    );

    if (wallet) {
      await this.refreshSession(wallet.publicKey.toString());
    }

    return {
      success: true,
      signature,
      poolId: marketId,
      marketId: marketId,
      baseVault: marketId,
      quoteVault: marketId,
      timestamp: new Date().toISOString()
    };
  }

  async raydiumCreateClmm(
    mint1: PublicKey,
    mint2: PublicKey,
    configId: PublicKey,
    initialPrice: Decimal,
    startTime: BN,
    wallet?: WalletAdapter
  ): Promise<RaydiumAMMResponse> {
    if (wallet) {
      const hasValidSession = await this.validateSession(wallet.publicKey.toString());
      if (!hasValidSession) {
        throw new Error('Valid trading session required for CLMM creation');
      }
    }

    const agentKit = await this.getOrCreateAgentKit(wallet);
    const signature = await agentKit.raydiumCreateClmm(
      mint1,
      mint2,
      configId,
      initialPrice,
      startTime
    );

    if (wallet) {
      await this.refreshSession(wallet.publicKey.toString());
    }

    return {
      success: true,
      signature,
      poolId: mint1,
      marketId: configId,
      baseVault: mint1,
      quoteVault: mint2,
      timestamp: new Date().toISOString()
    };
  }

  async raydiumCreateCpmm(
    mint1: PublicKey,
    mint2: PublicKey,
    configId: PublicKey,
    mintAAmount: BN,
    mintBAmount: BN,
    startTime: BN,
    wallet?: WalletAdapter
  ): Promise<RaydiumAMMResponse> {
    if (wallet) {
      const hasValidSession = await this.validateSession(wallet.publicKey.toString());
      if (!hasValidSession) {
        throw new Error('Valid trading session required for CPMM creation');
      }
    }

    const agentKit = await this.getOrCreateAgentKit(wallet);
    const signature = await agentKit.raydiumCreateCpmm(
      mint1,
      mint2,
      configId,
      mintAAmount,
      mintBAmount,
      startTime
    );

    if (wallet) {
      await this.refreshSession(wallet.publicKey.toString());
    }

    return {
      success: true,
      signature,
      poolId: mint1,
      marketId: configId,
      baseVault: mint1,
      quoteVault: mint2,
      timestamp: new Date().toISOString()
    };
  }

  async openbookCreateMarket(
    baseMint: PublicKey,
    quoteMint: PublicKey,
    lotSize: number = 1,
    tickSize: number = 0.01,
    wallet?: WalletAdapter
  ): Promise<OpenbookMarketResponse> {
    if (wallet) {
      const hasValidSession = await this.validateSession(wallet.publicKey.toString());
      if (!hasValidSession) {
        throw new Error('Valid trading session required for market creation');
      }
    }

    const agentKit = await this.getOrCreateAgentKit(wallet);
    const signatures = await agentKit.openbookCreateMarket(
      baseMint,
      quoteMint,
      lotSize,
      tickSize
    );

    if (wallet) {
      await this.refreshSession(wallet.publicKey.toString());
    }

    return {
      success: true,
      market: new PublicKey(signatures[0]),
      baseVault: new PublicKey(signatures[1]),
      quoteVault: new PublicKey(signatures[2]),
      signatures,
      timestamp: new Date().toISOString()
    };
  }

  async launchPumpFunToken(
    tokenName: string,
    tokenTicker: string,
    description: string,
    imageUrl: string,
    options?: PumpFunTokenOptions,
    wallet?: WalletAdapter
  ): Promise<PumpfunLaunchResponse> {
    if (wallet) {
      const hasValidSession = await this.validateSession(wallet.publicKey.toString());
      if (!hasValidSession) {
        throw new Error('Valid trading session required for token launch');
      }
    }

    const agentKit = await this.getOrCreateAgentKit(wallet);
    const result = await agentKit.launchPumpFunToken(
      tokenName,
      tokenTicker,
      description,
      imageUrl,
      options
    );

    if (wallet) {
      await this.refreshSession(wallet.publicKey.toString());
    }

    return {
      success: true,
      tokenMint: new PublicKey(result.mint),
      ...result,
      timestamp: new Date().toISOString()
    };
  }

  // Utility Methods
  async validateToken(mint: string): Promise<TokenInfo | null> {
    const agentKit = await this.getOrCreateAgentKit();
    const tokenData = await agentKit.getTokenDataByAddress(mint);
    return tokenData ? tokenData as TokenInfo : null;
  }

  async getTokenPrice(mint: string): Promise<string | null> {
    const agentKit = await this.getOrCreateAgentKit();
    return agentKit.fetchTokenPrice(mint);
  }

  async getCurrentTPS(): Promise<number> {
    const agentKit = await this.getOrCreateAgentKit();
    return agentKit.getTPS();
  }

  public async getSessionStatus(publicKey: string): Promise<WebSocketSessionStatus> {
    const session = this.activeSessions.get(publicKey);
    if (!session) {
      return {
        status: 'invalid',
        publicKey
      };
    }

    if (Date.now() > session.expiresAt) {
      this.clearSession(publicKey);
      return {
        status: 'expired',
        publicKey,
        expiresAt: session.expiresAt
      };
    }

    return {
      status: 'active',
      publicKey,
      expiresAt: session.expiresAt
    };
  }

  public getActiveSession(publicKey: string): TradingSession | null {
    const session = this.activeSessions.get(publicKey);
    if (!session || Date.now() > session.expiresAt) {
      return null;
    }
    return session;
  }

  private async ensureValidSession(publicKey: string): Promise<boolean> {
    const session = this.activeSessions.get(publicKey);
    if (!session) return false;

    // If session is close to expiry (within 5 minutes), refresh it
    if (session.expiresAt - Date.now() < 300000) {
      const refreshed = await this.refreshSession(publicKey);
      return !!refreshed;
    }

    return Date.now() <= session.expiresAt;
  }
}

// Export singleton instance
export const tradeExecution = new TradeExecutionService();

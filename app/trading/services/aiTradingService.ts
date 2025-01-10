// app/trading/services/aiTradingService.ts
import { createClient } from '@supabase/supabase-js';
import { solanaService } from '../../lib/solana';
import { PublicKey } from '@solana/web3.js';
import { WalletContextState } from '@solana/wallet-adapter-react';

interface WSMessage {
  type: string;
  clientId?: string;
  data?: any;
}

class AITradingService {
  private supabase;
  private baseUrl = '/api/admin/trading/chat';
  private ws: WebSocket | null = null;
  private clientId: string = '';
  private isConnected: boolean = false;
  private messageHandlers: Map<string, ((data: any) => void)[]> = new Map();
  private tradeStatusCallbacks: Set<(status: any) => void> = new Set();
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_INTERVAL = 2000;
  private sessionId: string | null = null;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    this.initializeWebSocket();
  }

  private initializeWebSocket() {
    if (!this.ws && this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
      const wsBase = process.env.NODE_ENV === 'production' 
        ? 'wss://ai-overhaul.onrender.com'
        : 'ws://localhost:3001';
      
      const wsUrl = `${wsBase}/ws/trading?clientId=${this.clientId}`;
      
      try {
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
          console.log('WebSocket connected successfully');
          this.isConnected = true;
          this.reconnectAttempts = 0;
        };
        
        this.ws.onclose = (event) => {
          this.isConnected = false;
          console.log(`WebSocket closed with code: ${event.code}`);
          this.attemptReconnect();
        };
        
        this.ws.onerror = (error) => {
          console.warn('WebSocket connection error:', error);
          // Don't call handleConnectionError here as onclose will be called
        };
        
        this.setupMessageHandlers();
      } catch (error) {
        console.error('Failed to initialize WebSocket:', error);
        this.attemptReconnect();
      }
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
      this.reconnectAttempts++;
      const delay = this.RECONNECT_INTERVAL * Math.pow(2, this.reconnectAttempts - 1);
      console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
      setTimeout(() => this.initializeWebSocket(), delay);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  // WebSocket subscription for real-time updates
  subscribeToUpdates(callback: (update: any) => void) {
    const channel = this.supabase.channel('admin_trading')
      .on('broadcast', { event: 'trading_update' }, ({ payload }) => {
        callback(payload);
      })
      .subscribe();

    return {
      unsubscribe: () => {
        channel.unsubscribe();
      }
    };
  }

  // Trading Controls
  async startTrading() {
    const response = await fetch(`${this.baseUrl}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error('Failed to start trading');
    }

    return response.json();
  }

  async stopTrading() {
    const response = await fetch(`${this.baseUrl}/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error('Failed to stop trading');
    }

    return response.json();
  }

  // Manual Trade Execution
  async executeManualTrade(trade: {
    token: string;
    side: 'buy' | 'sell';
    amount: number;
    price?: number;
    wallet?: {
      publicKey: PublicKey;
      signTransaction: WalletContextState['signTransaction'];
      signAllTransactions: WalletContextState['signAllTransactions'];
      timestamp: number;
    };
  }) {
    try {
      // Get market data first
      const [priceData, tokenData] = await Promise.all([
        solanaService.pythFetchPrice(trade.token),
        solanaService.getTokenData(trade.token)
      ]);
  
      // Execute trade through your backend
      const response = await fetch(`${this.baseUrl}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...trade,
          priceData,
          tokenData,
          asset: trade.token,
          amount: trade.amount,
          side: trade.side,
          wallet: {
            ...trade.wallet,
            sessionId: this.sessionId // Use the stored session ID
          }
        })
      });
  
      if (!response.ok) {
        throw new Error('Failed to execute trade');
      }
  
      const result = await response.json();
  
      // Create trade status promise with timeout
      const tradeStatusPromise = new Promise((resolve, reject) => {
        const subscription = this.subscribeToTradeStatus((status) => {
          if (status.trade_id === result.trade_id) {
            if (status.status === 'confirmed') {
              subscription.unsubscribe();
              resolve(status);
            } else if (status.status === 'error') {
              subscription.unsubscribe();
              reject(new Error(status.error));
            }
          }
        });
  
        // Add timeout
        setTimeout(() => {
          subscription.unsubscribe();
          reject(new Error('Trade confirmation timeout'));
        }, 30000);  // 30 seconds timeout
      });
  
      // Wait for trade confirmation
      await tradeStatusPromise;
  
      // Broadcast update
      this.supabase.channel('admin_trading')
        .send({
          type: 'broadcast',
          event: 'trading_update',
          payload: {
            type: 'trade_execution',
            ...trade,
            result
          }
        });
  
      return result;
    } catch (error) {
      console.error('Trade execution error:', error);
      throw error;
    }
  }

  subscribeToTradeStatus(callback: (status: any) => void) {
    // Add callback to set
    this.tradeStatusCallbacks.add(callback);

    // Initialize WebSocket if not already done
    if (!this.ws) {
      // Generate client ID
      this.clientId = crypto.randomUUID();

      // Get WebSocket URL based on environment
      const isProduction = process.env.NODE_ENV === 'production';
      const wsBase = isProduction 
        ? 'wss://ai-overhaul.onrender.com'
        : 'ws://localhost:3001';
      
      const wsUrl = `${wsBase}/ws/trading?clientId=${this.clientId}`;
      
      console.log('Connecting to WebSocket:', wsUrl);
      this.ws = new WebSocket(wsUrl);

      // Set up message handlers
      this.setupMessageHandlers();

      this.ws.onopen = () => {
        console.log('WebSocket connected to:', wsUrl);
        // Add a small delay before sending subscription message
        setTimeout(() => {
            this.sendMessage({
                type: 'subscribe',
                clientId: this.clientId,
                data: {
                    channel: 'trade_status'
                }
            });
        }, 100);  // 100ms delay to ensure the server is ready
    };

      this.ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          
          // Handle initial connection message
          if (message.type === 'connected') {
            console.log('Connection confirmed, client ID:', message.clientId);
            this.clientId = message.clientId || this.clientId;
          }
          // Handle trade status updates
          else if (message.type === 'trade_status') {
            this.tradeStatusCallbacks.forEach(cb => {
              try {
                cb(message.data);
              } catch (callbackError) {
                console.error('Error in trade status callback:', callbackError);
              }
            });
          }
          // Handle other message types
          else {
            const handlers = this.messageHandlers.get(message.type);
            if (handlers) {
              handlers.forEach(handler => {
                try {
                  handler(message.data);
                } catch (error) {
                  console.error(`Error in ${message.type} handler:`, error);
                }
              });
            }
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.handleConnectionError();
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        if (event.code !== 1000) {
          this.handleConnectionError();
        }
      };
    }

    // Return unsubscribe function
    return {
      unsubscribe: () => {
        this.tradeStatusCallbacks.delete(callback);
        if (this.tradeStatusCallbacks.size === 0 && this.ws) {
          // Send unsubscribe message before closing
          this.sendMessage({
            type: 'unsubscribe',
            clientId: this.clientId,
            data: {
              channel: 'trade_status'
            }
          });
          this.ws.close(1000, 'Client unsubscribed');
          this.ws = null;
        }
      }
    };
  }

  private setupMessageHandlers() {
    // Add default message handlers
    this.messageHandlers.set('error', [(data) => {
      console.error('WebSocket server error:', data);
    }]);

    this.messageHandlers.set('heartbeat', [(data) => {
      this.sendMessage({
        type: 'pong',
        clientId: this.clientId
      });
    }]);
  }

  private sendMessage(message: WSMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not ready, message not sent:', message);
    }
  }

  private handleConnectionError() {
    // Implement exponential backoff
    const backoff = (retryCount: number) => Math.min(1000 * Math.pow(2, retryCount), 30000);
    let retries = 0;

    const tryReconnect = () => {
      if (this.tradeStatusCallbacks.size > 0 && retries < 5) {
        setTimeout(() => {
          console.log(`Attempting to reconnect (attempt ${retries + 1})...`);
          this.reconnectWebSocket();
          retries++;
        }, backoff(retries));
      }
    };

    tryReconnect();
  }
  
  private reconnectWebSocket() {
    if (this.ws) {
      this.ws.close();
    }
    this.ws = null;
    if (this.tradeStatusCallbacks.size > 0) {
      this.subscribeToTradeStatus(Array.from(this.tradeStatusCallbacks)[0]);
    }
  }

  // Portfolio Management
  async getPortfolio() {
    const response = await fetch(`${this.baseUrl}/portfolio`);

    if (!response.ok) {
      throw new Error('Failed to fetch portfolio');
    }

    return response.json();
  }

  async updateStrategy(settings: {
    riskLevel: string;
    maxDrawdown: number;
    targetProfit: number;
  }) {
    const response = await fetch(`${this.baseUrl}/strategy`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });

    if (!response.ok) {
      throw new Error('Failed to update strategy');
    }

    return response.json();
  }

  // Risk Management
  async getPositionSizeRecommendation(token: string) {
    const response = await fetch(`${this.baseUrl}/position-size/${token}`);

    if (!response.ok) {
      throw new Error('Failed to get position size recommendation');
    }

    return response.json();
  }

  // Performance Analytics
  async getPerformanceMetrics(timeframe: string = '24h') {
    const response = await fetch(`${this.baseUrl}/metrics?timeframe=${timeframe}`);

    if (!response.ok) {
      throw new Error('Failed to fetch performance metrics');
    }

    return response.json();
  }
}

export const aiTradingService = new AITradingService();

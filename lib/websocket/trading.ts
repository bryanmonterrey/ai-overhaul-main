// lib/websocket/trading.ts
import { createClient } from '@supabase/supabase-js';
import { WebSocket } from 'ws';
import { TradeUpdate, MetricsUpdate, RiskAlert } from '../../app/types/trading';

export class TradingWebSocket {
  private supabase;
  private clients: Map<string, WebSocket>;
  private heartbeatInterval: NodeJS.Timeout;
  private userChannels: Map<string, string>; // Track user-specific channels

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    this.clients = new Map();
    this.userChannels = new Map();

    // Set up Supabase realtime subscription for general updates
    this.setupRealtimeSubscription();

    // Start heartbeat
    this.heartbeatInterval = setInterval(() => this.sendHeartbeat(), 30000);
  }

  private setupRealtimeSubscription() {
    // General trading updates channel
    const tradingChannel = this.supabase.channel('trading_updates')
      .on(
        'broadcast', 
        { event: 'metrics_update' }, 
        { filter: '*' },
        payload => {
          this.broadcastUpdate('metrics', payload);
        }
      )
      .on(
        'broadcast', 
        { event: 'trade_update' }, 
        { filter: '*' },
        payload => {
          this.broadcastUpdate('trade', payload);
        }
      )
      .on('broadcast', { event: 'risk_alert' }, payload => {
        this.broadcastUpdate('alert', payload);
      })
      .subscribe();

    // Admin-specific channel
    const adminChannel = this.supabase.channel('admin_trading')
      .on('broadcast', { event: 'trading_update' }, payload => {
        this.broadcastUpdate('admin', payload);
      })
      .subscribe();

    return { tradingChannel, adminChannel };
  }

  async broadcastUpdate(
    channel: string,
    event: string,
    payload: any,
    userAddress?: string
  ) {
    try {
      let channelName = channel;
      if (userAddress) {
        channelName = `${channel}_${userAddress}`;
        
        // Create user-specific channel if it doesn't exist
        if (!this.userChannels.has(userAddress)) {
          const userChannel = this.supabase
            .channel(channelName)
            .on('broadcast', { event: 'trading_update' }, payload => {
              this.broadcastToUser(userAddress, payload);
            })
            .subscribe();
          
          this.userChannels.set(userAddress, channelName);
        }
      }

      await this.supabase
        .channel(channelName)
        .send({
          type: 'broadcast',
          event: event,
          payload: payload
        });

    } catch (error) {
      console.error('WebSocket broadcast error:', error);
    }
  }

  handleConnection(ws: WebSocket, clientId: string, userAddress?: string) {
    this.clients.set(clientId, ws);

    // If user address provided, set up user-specific channel
    if (userAddress) {
      const channelName = `holder_trading_${userAddress}`;
      this.setupUserChannel(userAddress, channelName);
    }

    // Send initial state
    this.sendInitialState(ws, userAddress);

    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message);
        this.handleClientMessage(clientId, data, userAddress);
      } catch (error) {
        console.error('Error handling message:', error);
      }
    });

    ws.on('close', () => {
      this.clients.delete(clientId);
      if (userAddress) {
        this.cleanupUserChannel(userAddress);
      }
    });
  }

  private async setupUserChannel(userAddress: string, channelName: string) {
    const userChannel = this.supabase
      .channel(channelName)
      .on('broadcast', { event: 'trading_update' }, payload => {
        this.broadcastToUser(userAddress, payload);
      })
      .subscribe();

    this.userChannels.set(userAddress, channelName);
  }

  private cleanupUserChannel(userAddress: string) {
    const channelName = this.userChannels.get(userAddress);
    if (channelName) {
      this.supabase.channel(channelName).unsubscribe();
      this.userChannels.delete(userAddress);
    }
  }

  private broadcastToUser(userAddress: string, payload: any) {
    this.clients.forEach((client, clientId) => {
      if (client.readyState === WebSocket.OPEN && clientId.includes(userAddress)) {
        client.send(JSON.stringify(payload));
      }
    });
  }

  private async sendInitialState(ws: WebSocket, userAddress?: string) {
    try {
      // Fetch general trading state
      const { data: metrics } = await this.supabase
        .from('trading_metrics')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      // If user address provided, fetch user-specific data
      let userData = null;
      if (userAddress) {
        const { data: userMetrics } = await this.supabase
          .from('holder_trading_metrics')
          .select('*')
          .eq('wallet_address', userAddress)
          .order('timestamp', { ascending: false })
          .limit(1)
          .single();
        userData = userMetrics;
      }

      ws.send(JSON.stringify({
        type: 'initial_state',
        data: {
          metrics,
          userData
        }
      }));
    } catch (error) {
      console.error('Error sending initial state:', error);
    }
  }

  private handleClientMessage(clientId: string, message: any, userAddress?: string) {
    switch (message.type) {
      case 'subscribe':
        // Handle subscription requests
        break;
      case 'unsubscribe':
        // Handle unsubscription
        break;
      case 'ping':
        this.sendPong(clientId);
        break;
      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  private sendHeartbeat() {
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'heartbeat' }));
      }
    });
  }

  private sendPong(clientId: string) {
    const client = this.clients.get(clientId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'pong' }));
    }
  }

  // Methods for specific update types
  async updateMetrics(metrics: MetricsUpdate) {
    await this.broadcastUpdate(
      'trading_updates',
      'metrics_update',
      metrics
    );
  }

  async logTradeUpdate(update: TradeUpdate, userAddress?: string) {
    await this.broadcastUpdate(
      userAddress ? 'holder_trading' : 'admin_trading',
      'trading_update',
      update,
      userAddress
    );
  }

  async sendRiskAlert(alert: RiskAlert, userAddress?: string) {
    await this.broadcastUpdate(
      userAddress ? 'holder_trading' : 'trading_updates',
      'risk_alert',
      alert,
      userAddress
    );
  }
}

export const tradingWS = new TradingWebSocket();
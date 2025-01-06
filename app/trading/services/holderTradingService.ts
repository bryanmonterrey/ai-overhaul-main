// app/trading/services/holderTradingService.ts
import { createClient } from '@supabase/supabase-js';

class HolderTradingService {
    private supabase;
    private baseUrl = '/api/trading/holders';
  
    constructor() {
      this.supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
    }
  
    // WebSocket subscription for holder updates
    subscribeToUpdates(userAddress: string, callback: (update: any) => void) {
      const channel = this.supabase.channel(`holder_trading_${userAddress}`)
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
  
    // Trading Settings
    async updateSettings(userAddress: string, settings: {
      riskLevel: string;
      maxPositionSize: number;
      tradingEnabled: boolean;
    }) {
      const response = await fetch(`${this.baseUrl}/${userAddress}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
  
      if (!response.ok) {
        throw new Error('Failed to update settings');
      }
  
      return response.json();
    }
  
    async toggleTrading(userAddress: string, enabled: boolean) {
      const response = await fetch(`${this.baseUrl}/${userAddress}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
  
      if (!response.ok) {
        throw new Error('Failed to toggle trading');
      }
  
      return response.json();
    }
  
    // Portfolio Management
    async getPortfolio(userAddress: string) {
      const response = await fetch(`${this.baseUrl}/${userAddress}/portfolio`);
  
      if (!response.ok) {
        throw new Error('Failed to fetch portfolio');
      }
  
      return response.json();
    }
  
    // Trade History
    async getTradeHistory(userAddress: string, limit: number = 50) {
      const response = await fetch(
        `${this.baseUrl}/${userAddress}/trades?limit=${limit}`
      );
  
      if (!response.ok) {
        throw new Error('Failed to fetch trade history');
      }
  
      return response.json();
    }
  
    // Performance Analytics
    async getPerformanceMetrics(userAddress: string, timeframe: string = '24h') {
      const response = await fetch(
        `${this.baseUrl}/${userAddress}/metrics?timeframe=${timeframe}`
      );
  
      if (!response.ok) {
        throw new Error('Failed to fetch performance metrics');
      }
  
      return response.json();
    }
  
    // Token Balance
    async getTokenBalance(userAddress: string) {
      const response = await fetch(`${this.baseUrl}/${userAddress}/balance`);
  
      if (!response.ok) {
        throw new Error('Failed to fetch token balance');
      }
  
      return response.json();
    }
  
    // Risk Management
    async getRiskAssessment(userAddress: string) {
      const response = await fetch(`${this.baseUrl}/${userAddress}/risk`);
  
      if (!response.ok) {
        throw new Error('Failed to fetch risk assessment');
      }
  
      return response.json();
    }
}
  
export const holderTradingService = new HolderTradingService();
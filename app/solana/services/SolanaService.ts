// app/solana/services/SolanaService.ts
import { SolanaServiceConfig, TradeParams } from '../types';

export class SolanaService {
  private config: SolanaServiceConfig;
  private walletKey: string = "";

  constructor(config: SolanaServiceConfig) {
    this.config = config;
  }

  setWallet(privateKey: string) {
    this.walletKey = privateKey;
  }

  async trade(params: TradeParams) {
    try {
      const response = await fetch('/api/solana', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'trade',
          params,
          walletKey: this.walletKey
        })
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      
      return data.data;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}
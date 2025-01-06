// app/trading/services/token-registry.ts
import { createClient } from '@supabase/supabase-js';
import { Jupiter } from '@jup-ag/core';
import { PublicKey } from '@solana/web3.js';

interface TokenInfo {
  symbol: string;
  address: string;
  name: string;
  decimals: number;
  logoURI?: string;
  lastUpdated: Date;
}

class TokenRegistry {
  private supabase;
  private cachedTokens: Map<string, TokenInfo> = new Map();
  private jupiter: Jupiter;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  async discoverToken(symbolOrAddress: string): Promise<TokenInfo | null> {
    try {
      // Try to get token info from Jupiter
      const jupiterTokenList = await (await fetch(Jupiter.getTokenListUrl())).json();
      
      // Look for token by symbol or address
      const token = jupiterTokenList.find((t: any) => 
        t.symbol.toUpperCase() === symbolOrAddress.toUpperCase() || 
        t.address === symbolOrAddress
      );

      if (token) {
        // Save to database
        const tokenInfo: TokenInfo = {
          symbol: token.symbol,
          address: token.address,
          name: token.name,
          decimals: token.decimals,
          logoURI: token.logoURI,
          lastUpdated: new Date()
        };

        await this.saveToken(tokenInfo);
        return tokenInfo;
      }

      // If not found in Jupiter, try other sources like Solscan API
      const solscanResponse = await fetch(
        `https://api.solscan.io/token/meta?token=${symbolOrAddress}`
      );
      
      if (solscanResponse.ok) {
        const solscanData = await solscanResponse.json();
        if (solscanData.success) {
          const tokenInfo: TokenInfo = {
            symbol: solscanData.data.symbol,
            address: solscanData.data.mint,
            name: solscanData.data.name,
            decimals: solscanData.data.decimals,
            logoURI: solscanData.data.icon,
            lastUpdated: new Date()
          };

          await this.saveToken(tokenInfo);
          return tokenInfo;
        }
      }

      return null;
    } catch (error) {
      console.error('Error discovering token:', error);
      return null;
    }
  }

  private async saveToken(tokenInfo: TokenInfo) {
    const { error } = await this.supabase
      .from('tokens')
      .upsert({
        symbol: tokenInfo.symbol,
        address: tokenInfo.address,
        name: tokenInfo.name,
        decimals: tokenInfo.decimals,
        logo_uri: tokenInfo.logoURI,
        last_updated: tokenInfo.lastUpdated
      });

    if (error) {
      console.error('Error saving token:', error);
      throw error;
    }

    // Update cache
    this.cachedTokens.set(tokenInfo.symbol, tokenInfo);
    this.cachedTokens.set(tokenInfo.address, tokenInfo);
  }

  async getTokenInfo(symbolOrAddress: string): Promise<TokenInfo | null> {
    // First check cache
    if (this.cachedTokens.has(symbolOrAddress.toUpperCase())) {
      return this.cachedTokens.get(symbolOrAddress.toUpperCase())!;
    }

    // Query database
    const { data, error } = await this.supabase
      .from('tokens')
      .select('*')
      .or(`symbol.eq.${symbolOrAddress.toUpperCase()},address.eq.${symbolOrAddress}`)
      .single();

    if (data) {
      this.cachedTokens.set(data.symbol, data);
      this.cachedTokens.set(data.address, data);
      return data;
    }

    // If not found, try to discover it
    return await this.discoverToken(symbolOrAddress);
  }
}

export const tokenRegistry = new TokenRegistry();
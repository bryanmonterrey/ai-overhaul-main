// app/solana/hooks/useSolana.ts
'use client';

import { useCallback, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { SolanaService } from '../services/SolanaService';
import { SOLANA_CONFIG } from '../config';
import { TradeParams } from '../types';

export function useSolana() {
  const { publicKey, signTransaction } = useWallet();
  const [solanaService] = useState(() => new SolanaService(SOLANA_CONFIG));

  const trade = useCallback(async (params: TradeParams) => {
    if (!publicKey) throw new Error('Wallet not connected');
    return solanaService.trade(params);
  }, [publicKey, solanaService]);

  return {
    trade,
    isReady: !!publicKey
  };
}
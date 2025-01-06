// app/types/chat.ts
import { Message } from 'ai';
import { PublicKey } from '@solana/web3.js';

export interface TradingMessage extends Message {
  walletInfo?: {
    publicKey?: string;
  };
}
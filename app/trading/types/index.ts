import { PublicKey } from "@solana/web3.js";

// app/trading/types/index.ts
export interface WebSocketMessage {
    type: 'trading_chat' | 'trading_chat_response' | 'trade_execution' | 'portfolio_update';
    text?: string;
    data?: any;
    messages?: Array<{
      role: 'user' | 'assistant';
      content: string;
    }>;
    role?: 'admin' | 'user';
    userId?: string;
    context?: {
      isAdmin: boolean;
      sessionId: string;
    };
  }

   // Assuming this is in ../types/index.ts or a similar file
   export interface CollectionDeployment {
    mint: PublicKey; // Existing properties
    metadata: any; // Adjust type as necessary
    masterEditionAccount?: PublicKey; // Add this line
    timestamp: string; // Existing properties
  }
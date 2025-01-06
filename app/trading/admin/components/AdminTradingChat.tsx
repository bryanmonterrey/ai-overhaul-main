'use client';

import { useRef, useEffect, useState } from 'react';
import { useChat, Message, UseChatHelpers } from 'ai/react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from "@/hooks/use-toast";
import { aiTradingService } from '../../services/aiTradingService';
import InputMorphMessage from '@/components/InputMorphMessage';
import { solanaService } from '@/app/lib/solana';
import { confirmDialog } from '@/components/ui/confirm-dialog';
import { useWallet, WalletContextState } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { PublicKey } from '@solana/web3.js';
import { SignerWalletAdapterProps } from '@solana/wallet-adapter-base';
import bs58 from 'bs58';

// Updated interfaces for session management
interface TradeSession {
  publicKey: string;
  signature: string;
  timestamp: number;
  expiresAt: number;
}

interface TradeExecutionData {
  type: 'trade_execution';
  token: string;
  side: 'buy' | 'sell';
  amount: number;
  price?: number;
}

interface TradingMessage extends Message {
  walletInfo?: {
    publicKey?: string;
    sessionSignature?: string;
    credentials?: {
      publicKey: string;
      signTransaction: boolean;
      signAllTransactions: boolean;
      connected: boolean;
    };
  };
}

interface EnhancedTradeExecutionData extends TradeExecutionData {
    market_analysis?: {
      price_trend: string;
      volatility: number;
      recommendation?: string;
    };
    requires_confirmation?: boolean;
}

interface PortfolioUpdateData {
  type: 'portfolio_update';
  totalValue: number;
  dailyPnL: number;
}

type MessageData = TradeExecutionData | PortfolioUpdateData;

// Helper functions
function isTradeExecution(data: any): data is TradeExecutionData {
  return data?.type === 'trade_execution';
}

function isPortfolioUpdate(data: any): data is PortfolioUpdateData {
  return data?.type === 'portfolio_update';
}

// Local storage session management
const SESSION_KEY = 'trading_session';

function getStoredSession(): TradeSession | null {
  try {
    const session = localStorage.getItem(SESSION_KEY);
    if (!session) return null;
    const parsed = JSON.parse(session);
    if (Date.now() > parsed.expiresAt) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function storeSession(session: TradeSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function AdminTradingChat() {
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { publicKey, signTransaction, signAllTransactions, connected, signMessage } = useWallet();
  const { setVisible } = useWalletModal();
  
  // Initialize session state
  const [activeSession, setActiveSession] = useState<TradeSession | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(false);

  // Initialize trading session on wallet connection
  useEffect(() => {
    if (publicKey && connected) {
      const storedSession = getStoredSession();
      if (storedSession && storedSession.publicKey === publicKey.toString()) {
        setActiveSession(storedSession);
      }
    } else {
      setActiveSession(null);
      clearSession();
    }
  }, [publicKey, connected]);

  // Update wallet connection
  useEffect(() => {
    if (publicKey) {
      solanaService.updateWalletConnection(publicKey);
    }
  }, [publicKey]);

  // Auto-initialize wallet
  useEffect(() => {
    if (!connected && publicKey) {
      solanaService.updateWalletConnection(publicKey);
    }
  }, [connected, publicKey]);

  // Prompt wallet connection
  useEffect(() => {
    if (!connected) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to continue",
        variant: "default",
      });
      setVisible(true);
    }
  }, [connected, setVisible]);
  
  // Initialize chat
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error
  }: UseChatHelpers = useChat({
    api: '/api/trading/admin/chat',
    streamProtocol: 'text',
    id: 'admin-trading-chat',
    body: {
      walletInfo: publicKey ? {
        publicKey: publicKey.toString(),
        sessionSignature: activeSession?.signature,
        credentials: {
          publicKey: publicKey.toString(),
          signTransaction: !!signTransaction,
          signAllTransactions: !!signAllTransactions,
          connected
        }
      } : null
    },
    onResponse: (response) => {
      console.log('Raw response:', response);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    },
    onFinish: (message: TradingMessage) => {
      console.log('Chat completed:', message);
      scrollToBottom();
    },
    onError: (error) => {
      console.error('Chat error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to process message",
        variant: "destructive",
      });
    }
  });

  // Scroll helper function
  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  // Effect for scrolling
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Effect for monitoring messages
  useEffect(() => {
    console.log('Messages updated:', messages);
  }, [messages]);

  // Effect for error handling
  useEffect(() => {
    if (error) {
      console.error('Chat error state:', error);
      toast({
        title: "Error",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  // Subscribe to trading updates
  useEffect(() => {
    const subscription = aiTradingService.subscribeToUpdates((update) => {
      if (update.type === 'trade_execution' || update.type === 'portfolio_update') {
        console.log('Received trading update:', update);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Handle session creation/refresh
  const initializeOrRefreshSession = async () => {
    try {
      setIsSessionLoading(true);
      if (!publicKey || !signMessage) return null;

      // Create session message
      const message = new TextEncoder().encode("authorize_trading_session");
      const signature = await signMessage(message);

      const session: TradeSession = {
        publicKey: publicKey.toString(),
        signature: bs58.encode(signature),  // Use base58 instead of base64
        timestamp: Date.now(),
        expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
      };

      storeSession(session);
      setActiveSession(session);
      return session;
    } catch (error) {
      console.error('Session initialization error:', error);
      return null;
    } finally {
      setIsSessionLoading(false);
    }
  };

  const handleTradeExecution = async (tradeData: EnhancedTradeExecutionData) => {
    try {
      // Check wallet connection and signing capabilities
      if (!publicKey || !signTransaction || !signAllTransactions || !connected) {
        toast({
          title: "Wallet Required",
          description: "Please connect your wallet with signing capabilities to execute trades",
          variant: "destructive"
        });
        setVisible(true);
        return;
      }
  
      // Initialize or verify session
      let session = activeSession;
      if (!session || Date.now() > session.expiresAt) {
        session = await initializeOrRefreshSession();
        if (!session) {
          throw new Error('Failed to initialize trading session');
        }
      }
  
      // Handle trade confirmation if required
      if (tradeData.requires_confirmation) {
        const confirmed = await confirmDialog({
          title: "Confirm High Risk Trade",
          message: `This trade has been flagged as high risk. ${tradeData.market_analysis?.recommendation || ''}`,
          confirmText: "Execute Trade",
          cancelText: "Cancel"
        });
        
        if (!confirmed) return;
      }
  
      // Execute trade with session
      const result = await aiTradingService.executeManualTrade({
        token: tradeData.token,
        side: tradeData.side,
        amount: tradeData.amount,
        price: tradeData.price,
        wallet: {
          publicKey,
          signTransaction,
          signAllTransactions,
          timestamp: Date.now()
        }
      });
  
      // Check result and show appropriate notifications
      if (result.signature) {
        console.log('Transaction signature:', result.signature);
        
        // Show market analysis if available
        if (tradeData.market_analysis) {
          toast({
            title: "Market Analysis",
            description: `Current trend: ${tradeData.market_analysis.price_trend}`,
            variant: "default"
          });
        }
  
        // Show success notification with transaction details
        toast({
          title: "Trade Executed",
          description: `Successfully executed ${tradeData.side} trade for ${tradeData.amount} ${tradeData.token}. Signature: ${result.signature.slice(0, 8)}...`,
        });
      } else {
        throw new Error('Trade execution failed: No signature returned');
      }
  
    } catch (error) {
      console.error('Error executing trade:', error);
      
      // Clear session if it's invalid
      if (error instanceof Error && error.message.includes('session')) {
        setActiveSession(null);
        clearSession();
      }
  
      toast({
        title: "Trade Failed",
        description: error instanceof Error ? error.message : "Failed to execute trade. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Subscribe to trade status updates
  useEffect(() => {
    const tradingSubscription = aiTradingService.subscribeToUpdates((update) => {
      if (update.type === 'trade_execution' || update.type === 'portfolio_update') {
        console.log('Received trading update:', update);
      }
    });
  
    const statusSubscription = aiTradingService.subscribeToTradeStatus((status) => {
      console.log('Trade status update:', status);
      switch(status.status) {
        case 'initiated':
          toast({
            title: "Trade Initiated",
            description: `Starting trade execution...`
          });
          break;
        case 'checking_route':
          toast({
            title: "Finding Best Route",
            description: "Checking available trading routes..."
          });
          break;
        case 'confirmed':
          toast({
            title: "Trade Confirmed",
            description: `Trade successfully executed!`
          });
          break;
        case 'error':
          toast({
            title: "Trade Error",
            description: status.error,
            variant: "destructive"
          });
          break;
      }
    });
  
    return () => {
      tradingSubscription.unsubscribe();
      statusSubscription.unsubscribe();
    };
  }, [toast]);

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
  
    if (input.trim()) {
      try {
        // Ensure we have a valid session for trade commands
        const inputParts = input.trim().toLowerCase().split(' ');
        if (['buy', 'sell'].includes(inputParts[0]) && !activeSession) {
          const session = await initializeOrRefreshSession();
          if (!session) {
            throw new Error('Failed to initialize trading session');
          }
        }

        const tradeParams = {
          side: inputParts[0] as 'buy' | 'sell',
          amount: parseFloat(inputParts[1]),
          asset: inputParts[2]
        };

        const messageData = {
          content: input.trim(),
          walletInfo: publicKey ? {
            publicKey: publicKey.toString(),
            sessionSignature: activeSession?.signature,
            credentials: {
              publicKey: publicKey.toString(),
              signature: activeSession?.signature,
              signTransaction: !!signTransaction,
              signAllTransactions: !!signAllTransactions,
              connected
            }
          } : null,
          trade: {
            asset: tradeParams.asset,
            amount: tradeParams.amount,
            side: tradeParams.side
          }
        };
  
        await handleSubmit(e, { 
          data: messageData as { [key: string]: any } 
        });
      } catch (error) {
        console.error('Form submission error:', error);
        toast({
          title: "Message Error",
          description: "Failed to send message. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  const formattedMessages = (messages as TradingMessage[])
    .filter(msg => {
      if (!msg.content) return false;
      if (msg.content === '[DONE]') return false;
      return true;
    })
    .map((msg: TradingMessage, index) => {
      let text = msg.content;
      
      if (text.startsWith('data: ')) {
        try {
          const jsonPart = text.split('\n')[0].slice(6);
          const parsed = JSON.parse(jsonPart);
          text = parsed.content;
        } catch {
          text = msg.content;
        }
      }

      return {
        id: index,
        text: text,
        role: msg.role === 'system' || msg.role === 'data' ? 'assistant' : msg.role,
        data: msg.data,
        walletInfo: msg.walletInfo  // Include wallet info in formatted messages
      };
    });

  // Session indicator component
  const SessionStatus = () => (
    <div className="absolute top-4 right-4 flex items-center gap-2">
      {isSessionLoading ? (
        <span className="text-sm text-yellow-500">Initializing session...</span>
      ) : activeSession ? (
        <span className="text-sm text-green-500">Session active</span>
      ) : (
        <span className="text-sm text-gray-400">No active session</span>
      )}
    </div>
  );

  return (
    <Card className="w-full h-[600px] flex flex-col relative">
      <CardHeader>
        <CardTitle>AI Trading Assistant</CardTitle>
        <SessionStatus />
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col justify-between overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <InputMorphMessage
            input={input}
            isLoading={isLoading || isSessionLoading}
            onInputChange={handleInputChange}
            onFormSubmit={handleFormSubmit}
            messages={formattedMessages}
            handleTradeExecution={handleTradeExecution}
          />
        </div>
      </CardContent>
    </Card>
  );
}
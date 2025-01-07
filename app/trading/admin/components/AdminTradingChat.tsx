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
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '../../../lib/supabase';

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

interface TradeWalletInfo {
  publicKey: PublicKey;
  signTransaction: SignerWalletAdapterProps['signTransaction'];
  signAllTransactions: SignerWalletAdapterProps['signAllTransactions'];
  timestamp: number;
  signature: string;
}

type MessageData = TradeExecutionData | PortfolioUpdateData;

// Helper functions
function isTradeExecution(data: any): data is TradeExecutionData {
  return data?.type === 'trade_execution';
}

function isPortfolioUpdate(data: any): data is PortfolioUpdateData {
  return data?.type === 'portfolio_update';
}

export function AdminTradingChat() {
  const supabase = createClientComponentClient<Database>();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { publicKey, signTransaction, signAllTransactions, connected, signMessage } = useWallet();
  const { setVisible } = useWalletModal();
  
  // Initialize session state
  const [activeSession, setActiveSession] = useState<TradeSession | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(false);

  // Initialize trading session on wallet connection
  useEffect(() => {
    const checkExistingSession = async () => {
      if (publicKey && connected) {
        try {
          const { data: session, error } = await supabase
            .from('sessions')
            .select('*')
            .eq('wallet_address', publicKey.toString())
            .eq('is_active', true)
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (error || !session) {
            setActiveSession(null);
            return;
          }

          const tradeSession: TradeSession = {
            publicKey: session.wallet_address,
            signature: session.signature,
            timestamp: new Date(session.created_at).getTime(),
            expiresAt: new Date(session.expires_at).getTime()
          };

          setActiveSession(tradeSession);
        } catch (error) {
          console.error('Error checking existing session:', error);
          setActiveSession(null);
        }
      } else {
        setActiveSession(null);
      }
    };

    checkExistingSession();
  }, [publicKey, connected, supabase]);

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

  // Scroll helper function and effects
  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    console.log('Messages updated:', messages);
  }, [messages]);

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
    if (!publicKey || !signMessage) {
        throw new Error('Wallet not connected');
    }

    setIsSessionLoading(true);
    try {
        // Create fresh signature for session
        const message = new TextEncoder().encode("authorize_trading_session");
        const signatureBytes = await signMessage(message);
        const signature = bs58.encode(signatureBytes);

        console.log('Generated new session signature:', {
            publicKey: publicKey.toString(),
            signature: signature.slice(0, 10) + '...'
        });

        // Initialize session with agent-kit
        const response = await fetch('/api/agent-kit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'initSession',
                params: {
                    wallet: {
                        publicKey: publicKey.toString(),
                        signature,
                        credentials: {
                            publicKey: publicKey.toString(),
                            signature,  // Use the fresh signature
                            signTransaction: !!signTransaction,
                            signAllTransactions: !!signAllTransactions,
                            connected: true
                        }
                    }
                }
            })
        });

        const result = await response.json();
        console.log('Session initialization result:', result);

        if (!result.success) {
            throw new Error(result.error || 'Session initialization failed');
        }

        const session: TradeSession = {
            publicKey: publicKey.toString(),
            signature: result.sessionSignature || signature,  // Use returned signature or fallback to our signature
            timestamp: Date.now(),
            expiresAt: result.expiresAt || Date.now() + (24 * 60 * 60 * 1000)
        };

        setActiveSession(session);
        return session;

    } catch (error) {
        console.error('Session initialization error:', error);
        toast({
            title: "Session Error",
            description: error instanceof Error ? error.message : "Failed to initialize session",
            variant: "destructive",
        });
        return null;
    } finally {
        setIsSessionLoading(false);
    }
  };

  const handleTradeExecution = async (tradeData: EnhancedTradeExecutionData) => {
    try {
        // Check wallet connection and signing capabilities
        if (!publicKey || !signMessage || !signTransaction || !signAllTransactions || !connected) {
            toast({
                title: "Wallet Required",
                description: "Please connect your wallet with signing capabilities to execute trades",
                variant: "destructive"
            });
            setVisible(true);
            return;
        }

        // Always get a fresh session before trade
        const session = await initializeOrRefreshSession();
        if (!session) {
            throw new Error('Failed to initialize trading session');
        }

        // Create fresh signature for the trade
        const message = new TextEncoder().encode("authorize_trading_session");
        const signatureBytes = await signMessage(message);
        const tradeSignature = bs58.encode(signatureBytes);

        console.log('Trade execution signature:', {
            publicKey: publicKey.toString(),
            signature: tradeSignature.slice(0, 10) + '...'
        });

        // Execute trade with fresh signature
        const result = await aiTradingService.executeManualTrade({
            token: tradeData.token,
            side: tradeData.side,
            amount: tradeData.amount,
            price: tradeData.price,
            wallet: {
                publicKey,
                signTransaction,
                signAllTransactions,
                timestamp: Date.now(),
                signature: tradeSignature  // Use fresh signature
            } as TradeWalletInfo
        });

        if (result.signature) {
            console.log('Transaction signature:', result.signature);
            
            if (tradeData.market_analysis) {
                toast({
                    title: "Market Analysis",
                    description: `Current trend: ${tradeData.market_analysis.price_trend}`,
                    variant: "default"
                });
            }

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
            // Update session status in database instead of just clearing local state
            if (activeSession) {
                await supabase
                    .from('sessions')
                    .update({ is_active: false })
                    .eq('signature', activeSession.signature);
            }
        }

        toast({
            title: "Trade Failed",
            description: error instanceof Error ? error.message : "Failed to execute trade. Please try again.",
            variant: "destructive",
        });
    }
  };

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
  
    if (input.trim()) {
      try {
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
        walletInfo: msg.walletInfo
      };
    });

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
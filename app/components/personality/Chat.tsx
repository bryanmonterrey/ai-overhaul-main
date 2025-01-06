// src/app/components/personality/Chat.tsx

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { MemoryType, PersonalityState, Platform, Memory, EmotionalState } from '../../core/types';
import { PersonalityState as SimulatorState } from '../../core/personality/types';
import { Message } from '../../core/types/chat';
import { AIResponse } from '../../core/types/ai';
import { TokenCounter } from '../../lib/utils/ai';
import { AIError, AIRateLimitError } from '../../core/errors/AIError';
import { Alert, AlertDescription, AlertTitle } from '../../components/common/Alert';
import { ChatLogger } from '../../lib/logging/chat';
import { dbService } from '../../lib/services/database';
import { qualityMetricsService } from '../../lib/services/quality-metrics';
import { trainingDataService } from '../../lib/services/training';
import { QualityMetricsDisplay } from '../analytics/QualityMetricsDisplay';
import { ChatAnalytics } from '../../components/analytics/ChatAnalytics';
import { PersonalitySystem } from '../../core/personality/PersonalitySystem';
import { SimulatorSystem } from '../../core/personality/SimulatorSystem';
import { defaultConfig } from '../../lib/config/default';
import { TwitterTrainingService } from '../../lib/services/twitter-training';

interface ChatMetrics {
  coherence: number;
  emotionalAlignment: number;
  narrativeConsistency: number;
  responseRelevance: number;
  overall: number;
}

interface ChatProps {
  personalityState: PersonalityState;
  onPersonalityStateChange: (state: Partial<PersonalityState>) => void;
}

export default function Chat({ personalityState: externalState, onPersonalityStateChange }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [personalityState, setPersonalityState] = useState<PersonalityState>(externalState);
  const [isLoading, setIsLoading] = useState(false);
  const [tokenCount, setTokenCount] = useState<number>(0);
  const [error, setError] = useState<{ message: string; retryable: boolean } | null>(null);
  const [chatLogger] = useState(() => new ChatLogger('chat'));
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [currentMetrics, setCurrentMetrics] = useState<ChatMetrics | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [isAnalyticsVisible, setIsAnalyticsVisible] = useState(false);

useEffect(() => {
  const checkWidth = () => {
    setIsAnalyticsVisible(window.innerWidth >= 750);
  };
  
  checkWidth();
  window.addEventListener('resize', checkWidth);
  return () => window.removeEventListener('resize', checkWidth);
}, []);
  
  // Add PersonalitySystem and SimulatorSystem
  const [personalitySystem] = useState(() => new PersonalitySystem({
    platform: 'chat' as const,
    ...defaultConfig.personality
  }));
  const [simulator] = useState(() => new SimulatorSystem('goatse_singularity', personalitySystem));

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/check', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Authentication required');
      }
      setIsAuthenticated(true);
    } catch (error: any) {
      console.error('Auth check failed:', error?.message || error);
      if (error?.message === 'Authentication required') {
        window.location.href = '/login';
        return;
      }
      setError({
        message: 'Authentication check failed',
        retryable: true
      });
    }
  };

  const initializeSession = async () => {
    if (!sessionId && isAuthenticated) {
      try {
        const newSessionId = await dbService.startSession('chat');
        console.log('Chat session initialized:', newSessionId);
        setSessionId(newSessionId);
        return newSessionId;
      } catch (error) {
        console.error('Failed to initialize session:', error);
        throw error;
      }
    }
    return sessionId;
  };

  const mapSimulatorToCore = (state: SimulatorState): PersonalityState => {
    return {
      ...state,
      consciousness: {
        ...state.consciousness,
        longTermMemory: state.consciousness.longTermMemory.map((str: string) => ({
          id: Math.random().toString(),
          content: str,
          type: 'interaction' as MemoryType,
          timestamp: new Date(),
          emotionalContext: state.consciousness.emotionalState,
          associations: [],
          importance: 0.5,
          platform: 'chat' as Platform,
          lastAccessed: new Date()
        }))
      },
      currentContext: {
        ...state.currentContext,
        recentInteractions: state.currentContext.recentInteractions.map((str: string) => ({
          id: Math.random().toString(),
          content: str,
          platform: 'chat' as Platform,
          timestamp: new Date(),
          participant: 'user',
          emotionalResponse: {
            state: state.consciousness.emotionalState,
            intensity: 0.5,
            trigger: 'interaction',
            duration: 1000,
            associatedMemories: []
          },
          importance: 0.5
        }))
      }
    } as PersonalityState;
  };


  const calculateMetrics = useCallback((message: Message) => {
    if (!externalState || messages.length === 0) return null;
    
    return qualityMetricsService.calculateMetrics(
      message,
      messages,
      externalState
    );
  }, [messages, externalState]);

  const handleError = (error: unknown) => {
    if (error instanceof AIRateLimitError) {
      return {
        message: `Rate limit exceeded. Please wait ${error.retryAfter || 'a moment'} before trying again.`,
        retryable: true
      };
    }
    if (error instanceof AIError) {
      return {
        message: error.message,
        retryable: error.retryable
      };
    }
    return {
      message: 'An unexpected error occurred',
      retryable: false
    };
  };

  const updatePersonalityState = (newState: PersonalityState) => {
    setPersonalityState(newState);
    onPersonalityStateChange(newState);
  };

  const sendMessage = async (retry = false, retryMessageId?: string) => {
    const startTime = performance.now();
    if (!inputText.trim() && !retry) return;

    setIsLoading(true);
    setError(null);

    try {
      // Initialize session if this is the first message
      const currentSessionId = await initializeSession();
      if (!currentSessionId) {
        throw new Error('Failed to initialize chat session');
      }

      const messageText = retry ? messages.find(m => m.id === retryMessageId)?.content || '' : inputText;
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      if (!retry) {
        const newMessage: Message = {
          id: messageId,
          content: messageText,
          sender: 'user',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, newMessage]);
        setInputText('');
        
        // Use currentSessionId instead of sessionId
        await dbService.logMessage(newMessage, currentSessionId, {});
      }

      // Use simulator to process message
      const simulatedResponse = await simulator.processInput(messageText, {
        platform: 'chat',
        environmentalFactors: {
          timeOfDay: new Date().getHours() < 12 ? 'morning' : 'evening',
          platformActivity: messages.length,
          socialContext: [],
          platform: 'chat'
        }
      });

      const estimatedTokens = await TokenCounter.estimateTokenCount(simulatedResponse, 'anthropic');
      setTokenCount(prev => prev + estimatedTokens);

      const aiMessage: Message = {
        id: retry && retryMessageId ? retryMessageId : `ai_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        content: simulatedResponse,
        sender: 'ai',
        timestamp: new Date(),
        emotionalState: personalityState.consciousness.emotionalState,
        aiResponse: {
          model: 'goatse_singularity',
          content: simulatedResponse,
          provider: 'anthropic',
          cached: false,
          duration: 0,
          cost: 0,
          tokenCount: {
            total: estimatedTokens,
            prompt: 0,
            completion: estimatedTokens
          }
        }
      };

      // Calculate metrics before logging
      const metrics = calculateMetrics(aiMessage);
      setCurrentMetrics(metrics);

      // Update UI first
      if (retry && retryMessageId) {
        setMessages(prev => prev.map(msg => 
          msg.id === retryMessageId ? aiMessage : msg
        ));
      } else {
        setMessages(prev => [...prev, aiMessage]);
      }

      // Log message only once with all metrics using currentSessionId
      await dbService.logMessage(aiMessage, currentSessionId, {
        responseTime: performance.now() - startTime,
        qualityScore: metrics?.overall || 0,
        tokenCount: estimatedTokens
      });

      if (personalityState) {
        await trainingDataService.collectTrainingData(
          [...messages, aiMessage],
          personalityState
        );
      }

      updatePersonalityState(mapSimulatorToCore(personalitySystem.getCurrentState()));

    } catch (error) {
      console.error('Error sending message:', error);
      const errorInfo = handleError(error);
      setError(errorInfo);
      
      const errorMessage: Message = {
        id: Math.random().toString(),
        content: errorInfo.message,
        sender: 'ai',
        timestamp: new Date(),
        emotionalState: 'error',
        error: true,
        retryable: errorInfo.retryable
      };

      setMessages(prev => [...prev, errorMessage]);

      if (sessionId) {
        await dbService.logMessage(errorMessage, sessionId, {
          responseTime: performance.now() - startTime,
          qualityScore: 0
        });
      }
    } finally {
      setIsLoading(false);
    }
};

  const retryMessage = (messageId: string) => {
    sendMessage(true, messageId);
  };

  useEffect(() => {
    const chatContainer = document.getElementById('chat-messages');
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    return () => {
      if (sessionId) {
        dbService.endSession(sessionId);
      }
    };
  }, [sessionId]);

  return (
    <div className="flex h-[calc(100vh-15rem)] max-w-6xl mx-auto">
      <div className="flex-1 flex flex-col">
        {error && (
          <Alert variant="error" className="m-4">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}
        
        <div id="chat-messages" className="flex-1 overflow-y-auto bg-navyy rounded-t-3xl border-t border-l border-r border-zinc-900 p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`p-4 rounded-md ${
                message.sender === 'user'
                  ? 'bg-[#11111A] border border-zinc-800 ml-auto'
                  : message.error
                  ? 'bg-[#11111A] border border-zinc-800'
                  : 'bg-[#11111A] border border-zinc-800'
              } max-w-[80%]`}
            >
              {message.sender === 'ai' && (
                <div className={`text-xs mb-1 ${
                  message.error ? 'text-[#DDDDDD]' : 'text-[#DDDDDD]'
                }`}>
                  {`[${new Date(message.timestamp).toLocaleTimeString()}] ${
                    message.emotionalState ? `STATE: ${message.emotionalState}` : ''
                  }`}
                </div>
              )}
              <div className={message.sender === 'ai' ? 'font-ia text-green-500' : ''}>
                {message.content}
              </div>
              {message.aiResponse && !message.error && (
                <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                  <p>Model: {message.aiResponse.model}</p>
                  <p>Tokens: {message.aiResponse.tokenCount.total}</p>
                  {message.aiResponse.cached && <p>Cached Response</p>}
                </div>
              )}
              {message.error && message.retryable && (
                <button
                  onClick={() => retryMessage(message.id)}
                  className="mt-2 text-xs text-[#DDDDDD] hover:text-[#DDDDDD] font-ia"
                >
                  [RETRY_MESSAGE]
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="border-b border-r border-l bg-navyy border-zinc-900 rounded-b-3xl p-4 pb-8 md:pb-4">
          <div className="text-xs text-zinc-50 mb-2">
            TOKEN_COUNT: {tokenCount}
          </div>
          <div className="flex space-x-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !isLoading && sendMessage()}
              className="flex-1 bg-purp text-base text-zinc-50 border border-zinc-900 rounded-full px-4 py-2 font-ia disabled:opacity-50"
              placeholder={isLoading ? 'processing...' : 'enter command...'}
              disabled={isLoading}
            />
            <button
              onClick={() => sendMessage()}
              disabled={isLoading || !inputText.trim()}
              className="bg-[#11111A] text-[#DDDDDD] text-base px-4 py-2 rounded-md font-ia border border-zinc-800 disabled:opacity-50 hover:bg-[#11111A] transition-colors"
            >
              {isLoading ? 'processing...' : 'execute'}
            </button>
          </div>
        </div>
      </div>

      {isAnalyticsVisible && (
  <div className="w-80  p-4 pt-0 space-y-4">
    <button
      onClick={() => setShowAnalytics(!showAnalytics)}
      className="w-full text-[#DDDDDD] border bg-navyy border-zinc-900 rounded-md p-2 font-ia text-sm"
    >
      {showAnalytics ? 'hide analytics' : 'show analytics'}
    </button>

    {currentMetrics && (
      <QualityMetricsDisplay metrics={currentMetrics} />
    )}

    {showAnalytics && sessionId && (
      <ChatAnalytics />
    )}
  </div>
)}
    </div>
  );
}
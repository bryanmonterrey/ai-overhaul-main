// src/app/telegram/page.tsx

'use client';

import React, { useState, useEffect } from 'react';
import TelegramChat from '../interfaces/telegram/components/TelegramChat';
import MessageHandler from '../interfaces/telegram/components/MessageHandler';
import TelegramStats from '../interfaces/telegram/components/TelegramStats';
import { EmotionalStateDisplay } from '../components/personality/EmotionalStateDisplay';

export default function TelegramPage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [queue, setQueue] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [personalityState, setPersonalityState] = useState<any>(null);
  const [selectedChat, setSelectedChat] = useState<string | null>(null);

  const handleSend = async (content: string) => {
    if (!selectedChat) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/telegram/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: selectedChat,
          content,
          personality: personalityState
        }),
      });

      const data = await response.json();
      
      setMessages(prev => [...prev, data.message]);
      setPersonalityState(data.personalityState);
      await loadStats();
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('/api/telegram/stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [messagesRes, queueRes, statsRes] = await Promise.all([
          fetch('/api/telegram/messages'),
          fetch('/api/telegram/queue'),
          fetch('/api/telegram/stats')
        ]);
        
        const [messagesData, queueData, statsData] = await Promise.all([
          messagesRes.json(),
          queueRes.json(),
          statsRes.json()
        ]);

        setMessages(messagesData);
        setQueue(queueData);
        setStats(statsData);
        
        if (statsData.activeUsers.length > 0) {
          setSelectedChat(statsData.activeUsers[0].chatId);
        }
      } catch (error) {
        console.error('Error loading initial data:', error);
      }
    };

    loadInitialData();
  }, []);

  return (
    <div className="grid grid-cols-[1fr_300px] gap-6 h-[calc(100vh-10rem)]">
      <div className="space-y-6">
        {selectedChat ? (
          <TelegramChat
            chatId={selectedChat}
            messages={messages.filter(m => m.chatId === selectedChat)}
            onSend={handleSend}
            isLoading={isLoading}
            systemState={{
              emotionalState: personalityState?.consciousness?.emotionalState || 'NEUTRAL',
              processingState: isLoading ? 'PROCESSING' : 'READY'
            }}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-green-600">
            NO_ACTIVE_CHATS
          </div>
        )}
      </div>

      <div className="space-y-4">
        <EmotionalStateDisplay
          state={personalityState?.consciousness?.emotionalState || 'neutral'}
          intensity={personalityState?.emotionalProfile?.volatility || 0.5}
          narrativeMode={personalityState?.narrativeMode || 'default'}
          traits={personalityState?.traits || {}}
        />
        
        <MessageHandler
          queue={queue}
          onRetry={async (id) => {
            // Implement retry logic
          }}
          onClear={async (id) => {
            // Implement clear logic
          }}
        />
        
        {stats && <TelegramStats stats={stats} />}
      </div>
    </div>
  );
}
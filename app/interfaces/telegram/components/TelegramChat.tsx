// src/app/interfaces/telegram/components/TelegramChat.tsx

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Card } from '../../../components/common/Card';
import { Button } from '../../../components/common/Button';
import { Input } from '../../../components/common/Input';

interface Message {
  id: string;
  chatId: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  emotionalState?: string;
}

interface TelegramChatProps {
  chatId: string;
  messages: Message[];
  onSend: (content: string) => Promise<void>;
  isLoading?: boolean;
  systemState?: {
    emotionalState: string;
    processingState: string;
  };
}

export default function TelegramChat({
  chatId,
  messages,
  onSend,
  isLoading,
  systemState
}: TelegramChatProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      await onSend(input.trim());
      setInput('');
    }
  };

  return (
    <Card variant="system" title={`TELEGRAM_CHAT_${chatId}`} className="h-full flex flex-col">
      <div className="mb-4 text-xs space-y-1">
        <div>connection_status: ACTIVE</div>
        <div>emotional_state: {systemState?.emotionalState || 'NEUTRAL'}</div>
        <div>processing_state: {systemState?.processingState || 'READY'}</div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 min-h-0 mb-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] p-2 rounded border ${
                msg.sender === 'user'
                  ? 'bg-green-500/10 border-green-500'
                  : 'bg-gray-900 border-green-700'
              }`}
            >
              {msg.sender === 'ai' && (
                <div className="text-xs text-green-500 mb-1">
                  {`[${new Date(msg.timestamp).toISOString()}] ${
                    msg.emotionalState ? `STATE: ${msg.emotionalState}` : ''
                  }`}
                </div>
              )}
              <div className={msg.sender === 'ai' ? 'font-mono' : ''}>
                {msg.content}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex space-x-2">
        <Input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Input command..."
          variant="system"
          className="flex-1"
        />
        <Button
          variant="system"
          type="submit"
          disabled={isLoading || !input.trim()}
        >
          {isLoading ? 'PROCESSING...' : 'SEND'}
        </Button>
      </form>
    </Card>
  );
}
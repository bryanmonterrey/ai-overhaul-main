// src/app/interfaces/chat/components/MessageList.tsx

import React from 'react';
import { Card } from '../../../components/common/Card';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  emotionalState?: string;
}

interface MessageListProps {
  messages: Message[];
  className?: string;
}

export default function MessageList({ messages, className = '' }: MessageListProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div 
      ref={scrollRef}
      className={`flex-1 overflow-y-auto space-y-4 ${className}`}
    >
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <Card
            variant={message.sender === 'ai' ? 'system' : 'default'}
            className={`max-w-[80%] ${message.sender === 'user' ? 'bg-green-500/10' : ''}`}
          >
            {message.sender === 'ai' && (
              <div className="text-xs text-green-500 mb-1">
                {`[${new Date(message.timestamp).toISOString()}] STATE: ${
                  message.emotionalState || 'NEUTRAL'
                }`}
              </div>
            )}
            <div className={message.sender === 'ai' ? 'font-mono' : ''}>
              {message.content}
            </div>
          </Card>
        </div>
      ))}
    </div>
  );
}
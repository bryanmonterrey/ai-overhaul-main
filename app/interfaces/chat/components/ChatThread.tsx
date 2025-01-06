// src/app/interfaces/chat/components/ChatThread.tsx

import React from 'react';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import { Card } from '../../../components/common/Card';
import { EmotionalState } from '../../../core/types';

interface ChatThreadProps {
  messages: any[];
  onSend: (message: string) => void;
  isLoading?: boolean;
  currentState?: {
    emotionalState: EmotionalState;
    narrativeMode: string;
  };
}

export default function ChatThread({
  messages,
  onSend,
  isLoading,
  currentState
}: ChatThreadProps) {
  return (
    <div className="flex flex-col h-full">
      <Card variant="system" className="mb-4">
        <div className="text-xs space-y-1">
          <div>emotional_state: {currentState?.emotionalState || 'INITIALIZING'}</div>
          <div>narrative_mode: {currentState?.narrativeMode || 'DEFAULT'}</div>
          <div>connection_status: ACTIVE</div>
          <div>protocol: DIRECT_INTERFACE</div>
        </div>
      </Card>

      <div className="flex-1 min-h-0">
        <MessageList messages={messages} className="h-full" />
      </div>

      <div className="mt-4">
        <ChatInput onSend={onSend} isLoading={isLoading} />
      </div>
    </div>
  );
}
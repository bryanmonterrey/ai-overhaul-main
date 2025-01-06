// src/app/interfaces/telegram/components/MessageHandler.tsx

import React from 'react';
import { Card } from '../../../components/common/Card';

interface QueuedMessage {
  id: string;
  chatId: string;
  content: string;
  priority: number;
  status: 'pending' | 'processing' | 'sent' | 'failed';
  timestamp: Date;
}

interface MessageHandlerProps {
  queue: QueuedMessage[];
  onRetry?: (id: string) => Promise<void>;
  onClear?: (id: string) => Promise<void>;
}

export default function MessageHandler({
  queue,
  onRetry,
  onClear
}: MessageHandlerProps) {
  return (
    <Card variant="system" title="MESSAGE_QUEUE">
      <div className="space-y-4">
        <div className="text-xs space-y-1">
          <div>queue_length: {queue.length}</div>
          <div>status: {queue.some(m => m.status === 'processing') ? 'PROCESSING' : 'IDLE'}</div>
        </div>

        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {queue.map((msg) => (
            <div
              key={msg.id}
              className="border border-green-800 p-2 text-sm space-y-1"
            >
              <div className="flex justify-between items-start">
                <span className="text-xs text-green-500">
                  {new Date(msg.timestamp).toISOString()}
                </span>
                <span className={`text-xs ${
                  msg.status === 'sent' ? 'text-green-500' :
                  msg.status === 'failed' ? 'text-red-500' :
                  msg.status === 'processing' ? 'text-yellow-500' :
                  'text-gray-500'
                }`}>
                  {msg.status.toUpperCase()}
                </span>
              </div>

              <div className="font-mono truncate">
                {msg.content}
              </div>

              <div className="flex justify-between text-xs">
                <span>priority: {msg.priority}</span>
                <div className="space-x-2">
                  {msg.status === 'failed' && onRetry && (
                    <button
                      onClick={() => onRetry(msg.id)}
                      className="text-green-500 hover:text-green-400"
                    >
                      RETRY
                    </button>
                  )}
                  {onClear && (
                    <button
                      onClick={() => onClear(msg.id)}
                      className="text-red-500 hover:text-red-400"
                    >
                      CLEAR
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {queue.length === 0 && (
            <div className="text-center text-sm text-green-600">
              QUEUE_EMPTY
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
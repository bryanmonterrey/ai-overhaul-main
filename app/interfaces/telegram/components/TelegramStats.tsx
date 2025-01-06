// src/app/interfaces/telegram/components/TelegramStats.tsx

import React from 'react';
import { Card } from '../../../components/common/Card';

interface Stats {
  activeChats: number;
  messagesProcessed: number;
  averageResponseTime: number;
  uptime: number;
  successRate: number;
  activeUsers: {
    chatId: string;
    messageCount: number;
    lastActive: Date;
  }[];
}

interface TelegramStatsProps {
  stats: Stats;
}

export default function TelegramStats({ stats }: TelegramStatsProps) {
  return (
    <Card variant="system" title="SYSTEM_METRICS">
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>active_chats: {stats.activeChats}</div>
          <div>msgs_processed: {stats.messagesProcessed}</div>
          <div>avg_response: {stats.averageResponseTime}ms</div>
          <div>uptime: {(stats.uptime / 3600).toFixed(1)}h</div>
        </div>

        <div className="space-y-2">
          <div className="text-xs">success_rate:</div>
          <div className="w-full bg-gray-800 h-2">
            <div
              className="bg-green-500 h-full transition-all duration-500"
              style={{ width: `${stats.successRate * 100}%` }}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs">active_users:</div>
          <div className="space-y-1 max-h-[200px] overflow-y-auto">
            {stats.activeUsers.map((user) => (
              <div
                key={user.chatId}
                className="text-xs border border-green-800 p-2 flex justify-between"
              >
                <span>{user.chatId}</span>
                <span>msgs: {user.messageCount}</span>
                <span>last: {new Date(user.lastActive).toISOString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
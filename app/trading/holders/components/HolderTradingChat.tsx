// app/trading/holders/components/HolderTradingChat.tsx
'use client';

import { Button } from "@/app/components/common/Button";
import { Card } from "@/app/components/common/Card";
import { Input } from "@/app/components/common/Input";
import { ScrollArea } from '@base-ui-components/react/scroll-area';
import { useChat } from "ai/react";

interface HolderTradingChatProps {
  userAddress: string;
}

interface SettingsData {
  riskLevel: string;
  maxPosition: number;
  // Add other settings fields as needed
}

interface PerformanceData {
  portfolioValue: number;
  tokenBalance: number;
  // Add other performance fields as needed
}

type MessageData = {
  type: 'settings_update';
  riskLevel: string;
  maxPosition: number;
} | {
  type: 'performance_update';
  portfolioValue: number;
  tokenBalance: number;
};

export const HolderTradingChat = ({ userAddress }: HolderTradingChatProps) => {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: '/api/trading/holders/chat',
    body: {
      userAddress,
    },
  });

  const handleSettingsUpdate = async (settings: SettingsData) => {
    try {
      const response = await fetch('/api/trading/holders/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userAddress,
          settings,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update settings');
      }

      // Handle successful update
      // You might want to show a toast or update UI
    } catch (error) {
      console.error('Error updating settings:', error);
      // Handle error - show toast or error message
    }
  };

  return (
    <Card className="flex flex-col h-[600px]">
      <div className="p-4 border-b">
        <h2 className="text-xl font-semibold">Trading Assistant</h2>
        <p className="text-sm text-muted-foreground">
          Chat with AI to manage your trading settings and view performance
        </p>
      </div>

      <ScrollArea.Root className="flex-1 p-4">
        <ScrollArea.Viewport className="h-full overscroll-contain rounded-md outline outline-1 -outline-offset-1 outline-gray-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-800">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`rounded-lg px-4 py-2 max-w-[80%] ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                  {message.role === 'assistant' && message.data && (
                    <div className="mt-2 pt-2 border-t">
                      {/* Render holder-specific data/actions */}
                      {(message.data as MessageData).type === 'settings_update' && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold">Update Settings:</p>
                          <div className="text-xs space-y-1">
                            <p>Risk Level: {(message.data as MessageData & { type: 'settings_update' }).riskLevel}</p>
                            <p>Max Position: {(message.data as MessageData & { type: 'settings_update' }).maxPosition} SOL</p>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleSettingsUpdate(message.data as SettingsData)}
                          >
                            Apply Settings
                          </Button>
                        </div>
                      )}
                      {(message.data as MessageData).type === 'performance_update' && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold">Your Performance:</p>
                          <div className="text-xs">
                            <p>Portfolio Value: {(message.data as MessageData & { type: 'performance_update' }).portfolioValue} SOL</p>
                            <p>Token Balance: {(message.data as MessageData & { type: 'performance_update' }).tokenBalance}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar className="m-2 flex w-1 justify-center rounded bg-gray-200 opacity-0 transition-opacity delay-300 data-[hovering]:opacity-100 data-[hovering]:delay-0 data-[hovering]:duration-75 data-[scrolling]:opacity-100 data-[scrolling]:delay-0 data-[scrolling]:duration-75">
          <ScrollArea.Thumb className="w-full rounded bg-gray-500" />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>

      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex gap-4">
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder="Ask about your portfolio, settings, or get trading advice..."
            className="flex-1"
          />
          <Button type="submit">Send</Button>
        </div>
      </form>
    </Card>
  );
};
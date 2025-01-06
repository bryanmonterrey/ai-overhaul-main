// src/app/interfaces/chat/components/ChatInput.tsx
'use client';

import React, { useState } from 'react';
import { Input } from '../../../components/common/Input';
import { Button } from '../../../components/common/Button';

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading?: boolean;
  className?: string;
}

export default function ChatInput({ onSend, isLoading = false, className = '' }: ChatInputProps) {
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isLoading) {
      onSend(message.trim());
      setMessage('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`flex space-x-2 ${className}`}>
      <Input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Enter command..."
        variant="system"
        className="flex-1"
      />
      <Button
        variant="system"
        disabled={isLoading || !message.trim()}
      >
        {isLoading ? 'PROCESSING...' : 'EXECUTE'}
      </Button>
    </form>
  );
}
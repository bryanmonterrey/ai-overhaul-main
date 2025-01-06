import { Message } from './chat';

export interface ConversationData {
  id: string;
  timestamp: string;
  messages: Message[];
  upvotes: number;
  userId: string;
}

export interface ConversationPreview {
  id: string;
  timestamp: string;
  preview: string;
  upvotes: number;
  messageCount: number;
}
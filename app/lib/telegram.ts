// src/app/lib/telegram.ts

import { Telegraf } from 'telegraf';
import { Message, Update } from 'telegraf/types';
import { createClient } from '@supabase/supabase-js';
import { EnvironmentalFactors } from '.././core/types';

export class TelegramManager {
  private bot: Telegraf;
  private activeChats: Map<string, {
    lastActivity: Date;
    messageCount: number;
    context: string[];
  }> = new Map();
  private supabase;

  constructor() {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      throw new Error('TELEGRAM_BOT_TOKEN is not defined');
    }

    this.bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    this.setupBot();
    this.loadActiveChats();
  }

  private async setupBot() {
    // Basic commands
    this.bot.command('start', this.handleStart.bind(this));
    this.bot.command('stop', this.handleStop.bind(this));
    
    // Message handling
    this.bot.on('text', this.handleMessage.bind(this));
    this.bot.on('message', this.handleNonTextMessage.bind(this));

    // Error handling
    this.bot.catch((err: any) => {
      console.error('Telegram bot error:', err);
    });

    // Start bot
    try {
      await this.bot.launch();
      console.log('Telegram bot started successfully');

      // Enable graceful stop
      process.once('SIGINT', () => this.bot.stop('SIGINT'));
      process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
    } catch (error) {
      console.error('Failed to start Telegram bot:', error);
    }
  }

  private async loadActiveChats() {
    try {
      const { data, error } = await this.supabase
        .from('telegram_chats')
        .select('*')
        .eq('active', true);

      if (error) throw error;

      data.forEach(chat => {
        this.activeChats.set(chat.chat_id, {
          lastActivity: new Date(chat.last_activity),
          messageCount: chat.message_count,
          context: chat.context || []
        });
      });
    } catch (error) {
      console.error('Failed to load active chats:', error);
    }
  }

  private async handleStart(ctx: any) {
    const chatId = ctx.chat.id.toString();
    try {
      await this.supabase
        .from('telegram_chats')
        .upsert({
          chat_id: chatId,
          active: true,
          last_activity: new Date().toISOString(),
          message_count: 0,
          context: []
        });

      this.activeChats.set(chatId, {
        lastActivity: new Date(),
        messageCount: 0,
        context: []
      });

      await ctx.reply('Hello! I\'m your AI personality. How can I help you?');
    } catch (error) {
      console.error('Error in start handler:', error);
      await ctx.reply('Sorry, I encountered an error while starting.');
    }
  }

  private async handleStop(ctx: any) {
    const chatId = ctx.chat.id.toString();
    try {
      await this.supabase
        .from('telegram_chats')
        .update({ active: false })
        .eq('chat_id', chatId);

      this.activeChats.delete(chatId);
      await ctx.reply('Goodbye! Feel free to start a new chat anytime.');
    } catch (error) {
      console.error('Error in stop handler:', error);
    }
  }

  private async handleMessage(ctx: any) {
    const chatId = ctx.chat.id.toString();
    if (!this.activeChats.has(chatId)) return;

    const chat = this.activeChats.get(chatId)!;
    chat.lastActivity = new Date();
    chat.messageCount++;

    try {
      // Store message in Supabase
      await this.supabase
        .from('telegram_messages')
        .insert({
          chat_id: chatId,
          message: ctx.message.text,
          timestamp: new Date().toISOString()
        });

      // Update chat stats
      await this.supabase
        .from('telegram_chats')
        .update({
          last_activity: new Date().toISOString(),
          message_count: chat.messageCount
        })
        .eq('chat_id', chatId);
    } catch (error) {
      console.error('Error handling message:', error);
    }
  }

  private async handleNonTextMessage(ctx: any) {
    await ctx.reply('I can only process text messages at the moment.');
  }

  // Public methods
  async sendMessage(chatId: string | number, message: string): Promise<boolean> {
    try {
      await this.bot.telegram.sendMessage(chatId, message, {
        parse_mode: 'Markdown'
      });
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }

  async getActivityLevel(chatId: string): Promise<number> {
    const chat = this.activeChats.get(chatId);
    if (!chat) return 0;

    const hoursSinceLastActivity = 
      (new Date().getTime() - chat.lastActivity.getTime()) / (1000 * 60 * 60);
    
    return Math.min(1, chat.messageCount / 100) * 
           Math.max(0, 1 - (hoursSinceLastActivity / 24));
  }

  async getChatContext(chatId: string): Promise<string[]> {
    const chat = this.activeChats.get(chatId);
    return chat?.context || [];
  }

  async getChatStatus(chatId: string) {
    const chat = this.activeChats.get(chatId);
    if (!chat) return { active: false };

    return {
      active: true,
      lastActivity: chat.lastActivity,
      messageCount: chat.messageCount,
      context: chat.context
    };
  }

  getActiveChats(): string[] {
    return Array.from(this.activeChats.keys());
  }

  async getLastActivity(chatId: string): Promise<Date | null> {
    return this.activeChats.get(chatId)?.lastActivity || null;
  }

  async processUpdate(update: Update) {
    try {
      await this.bot.handleUpdate(update);
    } catch (error) {
      console.error('Error processing update:', error);
    }
  }

  async clearChatHistory(chatId: string) {
    try {
      await this.supabase
        .from('telegram_messages')
        .delete()
        .eq('chat_id', chatId);

      const chat = this.activeChats.get(chatId);
      if (chat) {
        chat.messageCount = 0;
        chat.context = [];
      }
    } catch (error) {
      console.error('Error clearing chat history:', error);
      throw error;
    }
  }

  async removeChat(chatId: string) {
    try {
      await Promise.all([
        this.supabase
          .from('telegram_chats')
          .delete()
          .eq('chat_id', chatId),
        this.supabase
          .from('telegram_messages')
          .delete()
          .eq('chat_id', chatId)
      ]);

      this.activeChats.delete(chatId);
    } catch (error) {
      console.error('Error removing chat:', error);
      throw error;
    }
  }
}
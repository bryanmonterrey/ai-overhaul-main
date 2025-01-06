// src/app/lib/logging/chat.ts

import { supabase } from '../supabase';
import { Message, QualityMetrics } from '../../core/types/chat';
import { EmotionalState, Platform, NarrativeMode } from '../../core/types';

export class ChatLogger {
  private conversationId: string;
  private platform: Platform;
  private messageCount: number = 0;
  private totalResponseTime: number = 0;
  private totalQualityScore: number = 0;

  constructor(platform: Platform = 'chat') {
    this.conversationId = crypto.randomUUID();
    this.platform = platform;
    this.initializeConversation();
  }

  private async initializeConversation() {
    await supabase
      .from('conversations')
      .insert({
        id: this.conversationId,
        platform: this.platform,
        start_time: new Date().toISOString()
      });
  }

  private calculateQualityScore(
    message: Message,
    metrics: Partial<QualityMetrics> = {}
  ): number {
    const {
      coherence = 0.8,
      emotionalAlignment = 0.7,
      narrativeConsistency = 0.7,
      responseRelevance = 0.8
    } = metrics;

    // Weight different factors
    const weights = {
      coherence: 0.3,
      emotionalAlignment: 0.2,
      narrativeConsistency: 0.2,
      responseRelevance: 0.3
    };

    return (
      coherence * weights.coherence +
      emotionalAlignment * weights.emotionalAlignment +
      narrativeConsistency * weights.narrativeConsistency +
      responseRelevance * weights.responseRelevance
    );
  }

  async logMessage(
    message: Message,
    responseTime?: number,
    metrics?: Partial<QualityMetrics>
  ) {
    const qualityScore = this.calculateQualityScore(message, metrics);
    
    this.messageCount++;
    if (responseTime) {
      this.totalResponseTime += responseTime;
    }
    this.totalQualityScore += qualityScore;

    const messageLog = {
      conversation_id: this.conversationId,
      content: message.content,
      sender: message.sender,
      emotional_state: message.emotionalState as EmotionalState,
      platform: this.platform,
      token_count: message.aiResponse?.tokenCount.total,
      model_used: message.aiResponse?.model,
      response_time: responseTime,
      prompt_tokens: message.aiResponse?.tokenCount.prompt,
      completion_tokens: message.aiResponse?.tokenCount.completion,
      quality_score: qualityScore,
      metadata: {
        metrics,
        error: message.error,
        retryable: message.retryable
      }
    };

    const { error } = await supabase
      .from('message_logs')
      .insert(messageLog);

    if (error) {
      console.error('Error logging message:', error);
    }

    // Update conversation statistics
    await this.updateConversationStats();
  }

  private async updateConversationStats() {
    const averageResponseTime = this.totalResponseTime / this.messageCount;
    const averageQualityScore = this.totalQualityScore / this.messageCount;

    await supabase
      .from('conversations')
      .update({
        message_count: this.messageCount,
        average_response_time: averageResponseTime,
        average_quality_score: averageQualityScore
      })
      .eq('id', this.conversationId);
  }

  async endConversation() {
    await supabase
      .from('conversations')
      .update({
        end_time: new Date().toISOString()
      })
      .eq('id', this.conversationId);
  }

  static async getTopPrompts(
    minQualityScore: number = 0.8,
    limit: number = 10
  ) {
    const { data } = await supabase
      .from('message_logs')
      .select('content, emotional_state, quality_score')
      .eq('sender', 'user')
      .gte('quality_score', minQualityScore)
      .order('quality_score', { ascending: false })
      .limit(limit);

    return data;
  }

  static async getAnalytics(platform: Platform) {
    const { data } = await supabase
      .from('conversations')
      .select(`
        platform,
        message_count,
        average_response_time,
        average_quality_score
      `)
      .eq('platform', platform)
      .order('created_at', { ascending: false })
      .limit(100);

    return data;
  }
}
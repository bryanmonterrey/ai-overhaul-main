// src/app/lib/services/training.ts

import { dbService } from './database';
import { qualityMetricsService } from './quality-metrics';
import { Message } from '../../core/types/chat';
import { PersonalityState } from '../../core/types';

export interface TrainingExample {
  prompt: string;
  completion: string;
  metadata: {
    qualityScore: number;
    emotionalState: string;
    narrativeMode: string;
    platform: string;
  };
}

export class TrainingDataService {
  private static instance: TrainingDataService;
  private minQualityThreshold = 0.8;

  private constructor() {}

  public static getInstance(): TrainingDataService {
    if (!TrainingDataService.instance) {
      TrainingDataService.instance = new TrainingDataService();
    }
    return TrainingDataService.instance;
  }

  async collectTrainingData(
    messages: Message[],
    personalityState: PersonalityState
  ): Promise<TrainingExample | null> {
    if (messages.length < 2) return null;

    const userMessage = messages[messages.length - 2];
    const aiMessage = messages[messages.length - 1];

    if (userMessage.sender !== 'user' || aiMessage.sender !== 'ai') {
      return null;
    }

    const qualityScore = qualityMetricsService.calculateMetrics(
      aiMessage,
      messages.slice(0, -1),
      personalityState
    );

    if (qualityScore.overall < this.minQualityThreshold) {
      return null;
    }

    const trainingExample: TrainingExample = {
      prompt: userMessage.content,
      completion: aiMessage.content,
      metadata: {
        qualityScore: qualityScore.overall,
        emotionalState: aiMessage.emotionalState || 'neutral',
        narrativeMode: personalityState.narrativeMode,
        platform: 'chat'
      }
    };

    await this.saveTrainingExample(trainingExample);
    return trainingExample;
  }

  private async saveTrainingExample(example: TrainingExample) {
    try {
      const messageId = crypto.randomUUID();
      await dbService.logMessage({
        id: messageId,
        content: example.completion,
        sender: 'ai',
        timestamp: new Date(),
        emotionalState: example.metadata.emotionalState,
      }, dbService.getCurrentSessionId() || '', {
        qualityScore: example.metadata.qualityScore
      });

      await dbService.saveTrainingData({
        message_id: messageId,
        prompt: example.prompt,
        completion: example.completion,
        quality_score: example.metadata.qualityScore,
        metadata: example.metadata
      });
    } catch (error) {
      console.error('Failed to log message', error);
      throw error;
    }
  }

  async exportTrainingData(minQuality = 0.8, format: 'jsonl' | 'csv' = 'jsonl'): Promise<string> {
    const data = await dbService.getHighQualityMessages(minQuality);
    
    if (format === 'jsonl') {
      return data.map(msg => JSON.stringify({
        prompt: msg.content,
        completion: msg.content,
        metadata: msg.metadata
      })).join('\n');
    }

    // CSV format
    const headers = ['prompt', 'completion', 'quality_score', 'emotional_state'];
    const rows = data.map(msg => [
      msg.content,
      msg.content,
      msg.quality_score,
      msg.emotion
    ]);

    return [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
  }

  setMinQualityThreshold(threshold: number) {
    this.minQualityThreshold = Math.max(0, Math.min(1, threshold));
  }
}

export const trainingDataService = TrainingDataService.getInstance();
// app/core/personality/training/TrainingEventManager.ts

import { createClient } from '@supabase/supabase-js';
import { LRUCache } from 'lru-cache';
import {
  TrainingEvent,
  TrainingPattern,
  TrainingConfig,
  TrainingOutcome
} from './types';
import { PersonalitySystem } from '../PersonalitySystem';
import { Context } from '../types';

export class TrainingEventManager {
  private eventCache: LRUCache<string, TrainingEvent>;
  private supabase;
  private metrics: Map<string, number> = new Map();
  private alertCallbacks: Map<string, (threshold: number, value: number) => void> = new Map();

  constructor(
    private personalitySystem: PersonalitySystem,
    private config: TrainingConfig
  ) {
    this.eventCache = new LRUCache<string, TrainingEvent>({
      max: 1000, // Cache last 1000 events
      ttl: 1000 * 60 * 60 * 24 // 24 hour TTL
    });

    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Initialize default alert callbacks
    this.initializeAlertCallbacks();
  }

  private initializeAlertCallbacks(): void {
    this.alertCallbacks.set('lowConfidence', (threshold, value) => {
      console.warn(`Training confidence below threshold: ${value} < ${threshold}`);
    });

    this.alertCallbacks.set('highVolatility', (threshold, value) => {
      console.warn(`Emotional volatility exceeds threshold: ${value} > ${threshold}`);
    });

    this.alertCallbacks.set('poorAlignment', (threshold, value) => {
      console.warn(`Narrative alignment below threshold: ${value} < ${threshold}`);
    });
  }

  public async recordEvent(
    input: string,
    pattern: TrainingPattern,
    context: Context,
    outcome: TrainingOutcome
  ): Promise<TrainingEvent> {
    const startTime = process.hrtime();
    const event: TrainingEvent = {
      id: crypto.randomUUID(),
      input,
      pattern,
      context,
      resultingState: outcome.resultingState,
      timestamp: new Date(),
      success: outcome.confidenceScore >= this.config.minConfidenceThreshold,
      metrics: {
        responseTime: this.calculateResponseTime(startTime),
        confidenceScore: outcome.confidenceScore,
        emotionalAlignment: outcome.effectivenessMeasures.emotionalAlignment,
        narrativeAlignment: outcome.effectivenessMeasures.narrativeAlignment
      }
    };

    // Cache the event
    this.eventCache.set(event.id, event);

    // Update metrics
    this.updateMetrics(event);

    // Check alert thresholds
    this.checkAlertThresholds(event);

    // Persist if configured
    if (this.config.monitoring.persistEvents) {
      await this.persistEvent(event);
    }

    return event;
  }

  private calculateResponseTime(startTime: [number, number]): number {
    const [seconds, nanoseconds] = process.hrtime(startTime);
    return seconds * 1000 + nanoseconds / 1000000; // Convert to milliseconds
  }

  private updateMetrics(event: TrainingEvent): void {
    this.metrics.set('avgConfidence', this.calculateRunningAverage(
      'avgConfidence',
      event.metrics.confidenceScore
    ));

    this.metrics.set('avgEmotionalAlignment', this.calculateRunningAverage(
      'avgEmotionalAlignment',
      event.metrics.emotionalAlignment
    ));

    this.metrics.set('avgNarrativeAlignment', this.calculateRunningAverage(
      'avgNarrativeAlignment',
      event.metrics.narrativeAlignment
    ));

    this.metrics.set('avgResponseTime', this.calculateRunningAverage(
      'avgResponseTime',
      event.metrics.responseTime
    ));
  }

  private calculateRunningAverage(metric: string, newValue: number): number {
    const currentAvg = this.metrics.get(metric) || newValue;
    const weight = 0.1; // Weighted moving average
    return currentAvg * (1 - weight) + newValue * weight;
  }

  private checkAlertThresholds(event: TrainingEvent): void {
    const thresholds = this.config.monitoring.alertThresholds;

    Object.entries(thresholds).forEach(([metric, threshold]) => {
      const value = event.metrics[metric as keyof typeof event.metrics];
      if (value !== undefined) {
        const callback = this.alertCallbacks.get(metric);
        if (callback && this.shouldTriggerAlert(metric, value, threshold)) {
          callback(threshold, value);
        }
      }
    });
  }

  private shouldTriggerAlert(metric: string, value: number, threshold: number): boolean {
    switch (metric) {
      case 'confidenceScore':
      case 'emotionalAlignment':
      case 'narrativeAlignment':
        return value < threshold;
      case 'responseTime':
        return value > threshold;
      default:
        return false;
    }
  }

  private async persistEvent(event: TrainingEvent): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('training_events')
        .insert({
          id: event.id,
          input: event.input,
          pattern_id: event.pattern.id,
          context: event.context,
          resulting_state: event.resultingState,
          timestamp: event.timestamp,
          success: event.success,
          metrics: event.metrics
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error persisting training event:', error);
      // Continue execution - don't let persistence failures break the training flow
    }
  }

  public async getRecentEvents(limit: number = 10): Promise<TrainingEvent[]> {
    const cachedEvents = Array.from(this.eventCache.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);

    if (cachedEvents.length < limit && this.config.monitoring.persistEvents) {
      const { data: dbEvents } = await this.supabase
        .from('training_events')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit - cachedEvents.length);

      return [...cachedEvents, ...(dbEvents || [])];
    }

    return cachedEvents;
  }

  public getMetrics(): Record<string, number> {
    return Object.fromEntries(this.metrics);
  }

  public setAlertCallback(
    metric: string,
    callback: (threshold: number, value: number) => void
  ): void {
    this.alertCallbacks.set(metric, callback);
  }

  public async clearEventHistory(): Promise<void> {
    this.eventCache.clear();
    this.metrics.clear();

    if (this.config.monitoring.persistEvents) {
      try {
        await this.supabase
          .from('training_events')
          .delete()
          .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000)); // Keep last 24 hours
      } catch (error) {
        console.error('Error clearing event history:', error);
      }
    }
  }
}
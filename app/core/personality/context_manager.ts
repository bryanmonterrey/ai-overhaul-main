// src/app/core/personality/context_manager.ts

import { Context, EmotionalState, Platform } from './types';

export class ContextManager {
  private currentContext: Context;

  constructor() {
    this.currentContext = {
      platform: 'chat',
      recentInteractions: [],
      environmentalFactors: {
        timeOfDay: 'day',
        platformActivity: 0.5,
        socialContext: [],
        platform: 'chat'
      },
      activeNarratives: []
    };
  }

  updateContext(
    platform: Platform,
    interactions: string[],
    environmentalFactors?: Partial<Context['environmentalFactors']>
  ): void {
    this.currentContext = {
      ...this.currentContext,
      platform,
      recentInteractions: interactions,
      environmentalFactors: {
        ...this.currentContext.environmentalFactors,
        ...environmentalFactors,
        platform: platform
      }
    };
  }

  getContext(): Context {
    return { ...this.currentContext };
  }

  addInteraction(content: string): void {
    this.currentContext.recentInteractions = [
      content,
      ...this.currentContext.recentInteractions
    ].slice(0, 10);
  }

  updateEnvironmentalFactors(factors: Partial<Context['environmentalFactors']>): void {
    this.currentContext.environmentalFactors = {
      ...this.currentContext.environmentalFactors,
      ...factors
    };
  }

  setPlatform(platform: Platform): void {
    this.currentContext.platform = platform;
    this.currentContext.environmentalFactors.platform = platform;
  }

  reset(): void {
    this.currentContext = {
      platform: 'chat',
      recentInteractions: [],
      environmentalFactors: {
        timeOfDay: 'day',
        platformActivity: 0.5,
        socialContext: [],
        platform: 'chat'
      },
      activeNarratives: []
    };
  }
}
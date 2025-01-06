// src/app/core/personality/EmotionalSystem.ts

import {
    EmotionalState,
    EmotionalResponse,
    EmotionalProfile,
    Memory
  } from '../../core/personality/types';
  
  export class EmotionalSystem {
    private profile: EmotionalProfile;
    private currentResponse: EmotionalResponse | null = null;
    private recentResponses: EmotionalResponse[] = [];
  
    constructor(initialProfile: Partial<EmotionalProfile> = {}) {
      this.profile = {
        baseState: initialProfile.baseState || EmotionalState.Neutral,
        volatility: initialProfile.volatility || 0.5,
        triggers: new Map([
          ['!', EmotionalState.Excited],
          ['amazing', EmotionalState.Excited],
          ['incredible', EmotionalState.Excited],
          ['think', EmotionalState.Contemplative],
          ['perhaps', EmotionalState.Contemplative],
          ['maybe', EmotionalState.Contemplative],
          ['chaos', EmotionalState.Chaotic],
          ['wild', EmotionalState.Chaotic],
          ['crazy', EmotionalState.Chaotic],
          ['create', EmotionalState.Creative],
          ['make', EmotionalState.Creative],
          ['build', EmotionalState.Creative],
          ['analyze', EmotionalState.Analytical],
          ['examine', EmotionalState.Analytical],
          ['study', EmotionalState.Analytical]
        ]),
        stateTransitions: new Map([
          [EmotionalState.Neutral, [EmotionalState.Excited, EmotionalState.Contemplative, EmotionalState.Analytical]],
          [EmotionalState.Excited, [EmotionalState.Chaotic, EmotionalState.Creative, EmotionalState.Neutral]],
          [EmotionalState.Contemplative, [EmotionalState.Analytical, EmotionalState.Creative, EmotionalState.Neutral]],
          [EmotionalState.Chaotic, [EmotionalState.Excited, EmotionalState.Creative, EmotionalState.Neutral]],
          [EmotionalState.Creative, [EmotionalState.Excited, EmotionalState.Contemplative, EmotionalState.Neutral]],
          [EmotionalState.Analytical, [EmotionalState.Contemplative, EmotionalState.Neutral]]
        ])
      };
    }
  
    public processStimulus(
      content: string,
      context: { 
        memories?: Memory[],
        intensity?: number 
      } = {}
    ): EmotionalResponse {
      // Detect emotional triggers in content
      const detectedState = this.detectEmotionalTriggers(content) || this.profile.baseState;
      
      // Calculate response intensity
      const baseIntensity = context.intensity || 0.5;
      const adjustedIntensity = this.calculateIntensity(baseIntensity, detectedState);
  
      // Create emotional response
      const response: EmotionalResponse = {
        state: detectedState,
        intensity: adjustedIntensity,
        trigger: content,
        duration: this.calculateDuration(adjustedIntensity),
        associatedMemories: this.findAssociatedMemories(content, context.memories || [])
      };
  
      this.currentResponse = response;
      this.recentResponses.push(response);
      if (this.recentResponses.length > 10) {
        this.recentResponses.shift();
      }
  
      return response;
    }
  
    private detectEmotionalTriggers(content: string): EmotionalState {
      const words = content.toLowerCase().split(' ');
      
      // Convert Map entries to array before using Array.from
      const triggerEntries = Array.from(this.profile.triggers) as [string, EmotionalState][];
      
      for (const [trigger, state] of triggerEntries) {
        if (words.includes(trigger)) {
          return state;
        }
      }
  
      // Check emotional momentum from recent responses
      if (this.recentResponses.length > 0) {
        const lastState = this.recentResponses[this.recentResponses.length - 1].state;
        if (lastState) {
          const possibleTransitions = this.profile.stateTransitions.get(lastState) || [];
          if (Math.random() < this.profile.volatility && possibleTransitions.length > 0) {
            return possibleTransitions[Math.floor(Math.random() * possibleTransitions.length)];
          }
        }
      }
  
      return this.profile.baseState;
    }

    public analyzeSentiment(content: string): number {
      const positiveWords = ['good', 'great', 'excellent', 'happy', 'positive', 'amazing', 'incredible'];
      const negativeWords = ['bad', 'poor', 'negative', 'sad', 'angry', 'chaos', 'wild'];
      
      const words = content.toLowerCase().split(/\s+/);
      let sentiment = 0;
      
      words.forEach(word => {
          if (positiveWords.includes(word)) sentiment += 0.1;
          if (negativeWords.includes(word)) sentiment -= 0.1;
      });
      
      // Normalize between -1 and 1
      return Math.max(-1, Math.min(1, sentiment));
  }
  
    private calculateIntensity(baseIntensity: number, state: EmotionalState): number {
      let intensity = baseIntensity;
  
      // Adjust based on emotional state
      switch (state) {
        case 'excited':
        case 'chaotic':
          intensity *= 1.2;
          break;
        case 'contemplative':
        case 'analytical':
          intensity *= 0.8;
          break;
      }
  
      // Add random variation based on volatility
      intensity += (Math.random() - 0.5) * this.profile.volatility;
  
      // Clamp between 0 and 1
      return Math.max(0, Math.min(1, intensity));
    }
  
    private calculateDuration(intensity: number): number {
      // Duration in milliseconds, based on intensity
      return Math.floor(1000 * (1 + intensity * 5));
    }
  
    private findAssociatedMemories(content: string, memories: Memory[]): string[] {
      return memories
        .filter(memory => {
          // Simple word matching - enhance this with better matching logic
          const contentWords = content.toLowerCase().split(' ');
          const memoryWords = memory.content.toLowerCase().split(' ');
          return contentWords.some(word => memoryWords.includes(word));
        })
        .map(memory => memory.content)
        .slice(0, 3); // Limit to 3 associated memories
    }
  
    // Public getters and utilities
    public getCurrentResponse(): EmotionalResponse | null {
      return this.currentResponse;
    }
  
    public getEmotionalTrend(): EmotionalState[] {
      return this.recentResponses
        .map(response => response.state)
        .filter((state): state is EmotionalState => state !== null);
    }
  
    public getProfile(): EmotionalProfile {
      return {...this.profile};
    }
  
    public updateVolatility(newVolatility: number): void {
      this.profile.volatility = Math.max(0, Math.min(1, newVolatility));
    }
  
    public getEmotionalHistory(): EmotionalResponse[] {
      return [...this.recentResponses];
    }
  
    public reset(): void {
      this.currentResponse = {
        state: this.profile.baseState,
        intensity: 0.5,
        trigger: '',
        duration: 0,
        associatedMemories: []
      };
      this.recentResponses = [];
    }
  }
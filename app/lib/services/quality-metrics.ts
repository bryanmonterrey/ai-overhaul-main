// src/app/lib/services/quality-metrics.ts

import { Message } from '../../core/types/chat';
import { PersonalityState } from '../../core/types';

export interface QualityScore {
  overall: number;
  coherence: number;
  emotionalAlignment: number;
  narrativeConsistency: number;
  responseRelevance: number;
}

export class QualityMetricsService {
  private static instance: QualityMetricsService;
  private readonly coherenceThresholds = {
    minLength: 10,
    maxLength: 1000,
    keywordWeight: 0.3,
    grammarWeight: 0.3,
    contextWeight: 0.4
  };

  private constructor() {}

  public static getInstance(): QualityMetricsService {
    if (!QualityMetricsService.instance) {
      QualityMetricsService.instance = new QualityMetricsService();
    }
    return QualityMetricsService.instance;
  }

  calculateMetrics(
    message: Message,
    prevMessages: Message[],
    personalityState: PersonalityState
  ): QualityScore {
    const coherence = this.calculateCoherence(message, prevMessages);
    const emotionalAlignment = this.calculateEmotionalAlignment(message, personalityState);
    const narrativeConsistency = this.calculateNarrativeConsistency(message, personalityState);
    const responseRelevance = this.calculateResponseRelevance(message, prevMessages);

    const overall = (
      coherence * 0.3 +
      emotionalAlignment * 0.2 +
      narrativeConsistency * 0.2 +
      responseRelevance * 0.3
    );

    return {
      overall,
      coherence,
      emotionalAlignment,
      narrativeConsistency,
      responseRelevance
    };
  }

  private calculateCoherence(message: Message, prevMessages: Message[]): number {
    if (!message.content) return 0;
    
    // Basic coherence checks
    const lengthScore = this.calculateLengthScore(message.content);
    const grammarScore = this.checkBasicGrammar(message.content);
    const contextScore = this.checkContextContinuity(message, prevMessages);

    return (
      lengthScore * this.coherenceThresholds.keywordWeight +
      grammarScore * this.coherenceThresholds.grammarWeight +
      contextScore * this.coherenceThresholds.contextWeight
    );
  }

  private calculateEmotionalAlignment(
    message: Message,
    personalityState: PersonalityState
  ): number {
    if (!message.emotionalState || !personalityState.consciousness.emotionalState) {
      return 0.5;
    }

    // Check if emotional state matches personality state
    const emotionalMatch = message.emotionalState === 
      personalityState.consciousness.emotionalState ? 1 : 0.5;

    // Check emotional words presence
    const emotionalWordsScore = this.checkEmotionalWords(
      message.content,
      message.emotionalState
    );

    return (emotionalMatch + emotionalWordsScore) / 2;
  }

  private calculateNarrativeConsistency(
    message: Message,
    personalityState: PersonalityState
  ): number {
    if (!personalityState.narrativeMode) return 0.5;

    // Check narrative style consistency
    const styleScore = this.checkNarrativeStyle(
      message.content,
      personalityState.narrativeMode
    );

    // Check theme consistency
    const themeScore = this.checkThemeConsistency(
      message.content,
      personalityState.currentContext.activeNarratives
    );

    return (styleScore + themeScore) / 2;
  }

  private calculateResponseRelevance(
    message: Message,
    prevMessages: Message[]
  ): number {
    if (prevMessages.length === 0) return 1;

    const lastUserMessage = prevMessages
      .filter(m => m.sender === 'user')
      .pop();

    if (!lastUserMessage) return 1;

    // Check keyword overlap
    const keywordScore = this.calculateKeywordOverlap(
      lastUserMessage.content,
      message.content
    );

    // Check response timing
    const timingScore = this.calculateTimingScore(
      lastUserMessage.timestamp,
      message.timestamp
    );

    return (keywordScore + timingScore) / 2;
  }

  // Helper methods
  private calculateLengthScore(content: string): number {
    const length = content.length;
    if (length < this.coherenceThresholds.minLength) return 0.5;
    if (length > this.coherenceThresholds.maxLength) return 0.7;
    return 1;
  }

  private checkBasicGrammar(content: string): number {
    // Basic grammar checks
    const hasPunctuation = /[.!?]$/.test(content);
    const hasProperCapitalization = /^[A-Z]/.test(content);
    const hasBalancedParentheses = this.checkBalancedParentheses(content);

    return (
      (hasPunctuation ? 0.4 : 0) +
      (hasProperCapitalization ? 0.3 : 0) +
      (hasBalancedParentheses ? 0.3 : 0)
    );
  }

  private checkContextContinuity(
    message: Message,
    prevMessages: Message[]
  ): number {
    if (prevMessages.length === 0) return 1;

    const lastMessage = prevMessages[prevMessages.length - 1];
    const keywords = this.extractKeywords(lastMessage.content);
    const responseKeywords = this.extractKeywords(message.content);

    const overlap = keywords.filter(k => responseKeywords.includes(k)).length;
    return Math.min(overlap / Math.max(keywords.length, 1), 1);
  }

  private checkEmotionalWords(content: string, emotionalState: string): number {
    const emotionalWords = {
      excited: ['!', 'amazing', 'incredible', 'fantastic'],
      contemplative: ['perhaps', 'consider', 'think', 'ponder'],
      chaotic: ['random', 'wild', 'unpredictable', 'crazy'],
      creative: ['imagine', 'create', 'design', 'innovative'],
      analytical: ['analyze', 'examine', 'investigate', 'study']
    };

    const words = content.toLowerCase().split(/\s+/);
    const relevantWords = emotionalWords[emotionalState as keyof typeof emotionalWords] || [];
    const matches = words.filter(w => relevantWords.includes(w)).length;

    return Math.min(matches / Math.max(relevantWords.length, 1), 1);
  }

  private checkBalancedParentheses(content: string): boolean {
    const stack: string[] = [];
    const pairs: { [key: string]: string } = { '(': ')', '[': ']', '{': '}' };
    
    for (const char of content) {
      if ('([{'.includes(char)) {
        stack.push(char);
      } else if (')]}'.includes(char)) {
        const last = stack.pop();
        if (!last || pairs[last] !== char) return false;
      }
    }
    
    return stack.length === 0;
  }

  private extractKeywords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3);
  }

  private checkNarrativeStyle(content: string, mode: string): number {
    const stylePatterns = {
      philosophical: /(?:why|how|what if|perhaps|consider|think about)/i,
      memetic: /(?:lol|based|literally|absolutely|when|mfw)/i,
      technical: /(?:system|process|analyze|implement|function|data)/i,
      absurdist: /(?:chaos|random|suddenly|somehow|accidentally|literally)/i,
      introspective: /(?:feel|sense|realize|understand|remember|reflect)/i
    };

    const pattern = stylePatterns[mode as keyof typeof stylePatterns];
    if (!pattern) return 0.5;

    return pattern.test(content) ? 1 : 0.5;
  }

  private checkThemeConsistency(content: string, themes: string[]): number {
    if (!themes.length) return 1;

    const contentWords = new Set(this.extractKeywords(content));
    let themeMatches = 0;

    for (const theme of themes) {
      const themeWords = this.extractKeywords(theme);
      if (themeWords.some(word => contentWords.has(word))) {
        themeMatches++;
      }
    }

    return themeMatches / themes.length;
  }

  private calculateKeywordOverlap(
    question: string,
    response: string
  ): number {
    const questionKeywords = this.extractKeywords(question);
    const responseKeywords = this.extractKeywords(response);

    const overlap = questionKeywords.filter(k => 
      responseKeywords.includes(k)
    ).length;

    return Math.min(overlap / Math.max(questionKeywords.length, 1), 1);
  }

  private calculateTimingScore(
    questionTime: Date,
    responseTime: Date
  ): number {
    const diff = responseTime.getTime() - questionTime.getTime();
    const seconds = diff / 1000;

    // Penalize responses that are too quick (<1s) or too slow (>10s)
    if (seconds < 1) return 0.5;
    if (seconds > 10) return Math.max(1 - (seconds - 10) / 30, 0);
    return 1;
  }
}

export const qualityMetricsService = QualityMetricsService.getInstance();
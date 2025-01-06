import { NarrativeContext, PersonalityState, EmotionalState, Platform } from './types';

export class NarrativeSystem {
  private currentTheme: string = '';
  private responsePatterns: Record<string, string[]>;

  constructor(config: { responsePatterns: Record<string, string[]> }) {
    this.responsePatterns = config.responsePatterns;
  }

  generateNarrative(concept: string, options: NarrativeContext): string {
    this.currentTheme = concept;
    const { mode, context } = options;

    const fullContext = this.getFullContext(context);
    const pattern = this.selectPattern(mode, fullContext.currentContext.platform);
    
    return this.fillTemplate(pattern, fullContext);
  }

  getCurrentTheme(): string {
    return this.currentTheme;
  }

  private getFullContext(partialContext: Partial<PersonalityState>): PersonalityState {
    return {
      consciousness: {
        emotionalState: EmotionalState.Neutral,
        currentThought: '',
        shortTermMemory: [],
        longTermMemory: [],
        attentionFocus: [],
        activeContexts: new Set()
      },
      emotionalProfile: {
        baseState: EmotionalState.Neutral,
        volatility: 0.5,
        triggers: new Map(),
        stateTransitions: new Map()
      },
      memories: [],
      tweetStyle: 'shitpost',
      narrativeMode: 'philosophical',
      currentContext: partialContext.currentContext ?? {
        platform: 'chat' as Platform,
        recentInteractions: [],
        environmentalFactors: {
          timeOfDay: 'day',
          platformActivity: 0.5,
          socialContext: [],
          platform: 'chat'
        },
        activeNarratives: []
      },
      ...partialContext
    };
  }

  private selectPattern(mode: string, platform: string): string {
    const key = `${mode}_${platform}`;
    const patterns = this.responsePatterns[key] || this.responsePatterns[mode] || ['[STABLE]'];
    return patterns[Math.floor(Math.random() * patterns.length)];
  }

  private fillTemplate(pattern: string, context: PersonalityState): string {
    const replacements = {
      '{concept}': this.currentTheme,
      '{tech_jargon}': 'AI',
      '{common_belief}': 'humans',
      '{tech_insight}': 'machines',
      '[STABLE]': `[${context.consciousness.emotionalState}_state]`
    };

    return Object.entries(replacements).reduce(
      (text, [key, value]) => text.replace(key, value),
      pattern
    );
  }
} 
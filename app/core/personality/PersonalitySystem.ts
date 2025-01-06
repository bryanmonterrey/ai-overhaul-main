// src/app/core/personality/PersonalitySystem.ts

import { 
    PersonalityState, 
    EmotionalState, 
    TweetStyle, 
    ConsciousnessState,
    EmotionalProfile,
    Memory,
    NarrativeMode,
    Context,
    PersonalityConfig,
    Platform,
    EnhancedMemoryAnalysis,
  } from '../../core/personality/types';
import { aiService } from '../../lib/services/ai';
import { TwitterTrainingService } from '../../lib/services/twitter-training';
import { LettaClient } from '../../lib/memory/letta-client';
import { 
  ChatMemory, 
  MemoryResponse,
  Message,
  Memory as MemGPTMemory 
} from '../../types/memory';
import { MemorySystem } from './MemorySystem';
import { EmotionalSystem } from './EmotionalSystem';
import { PersonalityPromptBuilder } from '../prompts/builders/personality-prompt';
import { PersonalityValidator } from '../prompts/validation/personality-validator';
  
interface PersonalitySystemConfig {
  baseTemperature: number;
  creativityBias: number;
  emotionalVolatility: number;
  memoryRetention: number;
  responsePatterns: {
    [key in EmotionalState]: string[];  // Make sure it's string[]
  };
  platform: Platform | undefined;  // Make platform optional
}

  type ResponsePattern = string[];

  interface ResponsePatterns {
    neutral: ResponsePattern;
    excited: ResponsePattern;
    contemplative: ResponsePattern;
    chaotic: ResponsePattern;
    creative: ResponsePattern;
    analytical: ResponsePattern;
  }
  
  export class PersonalitySystem {
    private state: PersonalityState;
    private config: PersonalityConfig;
    private traits: Map<string, number> = new Map();
    private memgpt: LettaClient;
    private memorySystem: MemorySystem;
    private emotionalSystem: EmotionalSystem;

    constructor(
      config: PersonalityConfig,
      private readonly trainingService?: TwitterTrainingService
  ) {
      this.config = config;
      this.state = this.initializeState();
      this.initializeTraits();
      this.memgpt = new LettaClient();
      this.memorySystem = new MemorySystem(this.memgpt);
      this.emotionalSystem = new EmotionalSystem();
      this.testMemGPTConnection();
  }

    private async testMemGPTConnection() {
        try {
            const response = await this.memgpt.storeMemory({
                key: `init-${Date.now()}`,
                memory_type: 'chat_history',
                data: { 
                    messages: [{
                        role: 'assistant',
                        content: 'Personality System Initialization',
                        timestamp: new Date().toISOString()
                    }]
                }
            });
            console.log('MemGPT connection established:', response.success);
        } catch (error) {
            console.error('Failed to connect to MemGPT service:', error);
        }
    }

    private initializeTraits(): void {
      this.traits.set('technical_depth', 0.8);
      this.traits.set('provocative_tendency', 0.7);
      this.traits.set('chaos_threshold', 0.6);
      this.traits.set('philosophical_inclination', 0.75);
      this.traits.set('meme_affinity', 0.65);
    }
  
    private initializeState(): PersonalityState {
      const consciousness: ConsciousnessState = {
        currentThought: '',
        shortTermMemory: [],
        longTermMemory: [],
        emotionalState: EmotionalState.Neutral,
        attentionFocus: [],
        activeContexts: new Set()
      };
  
      const emotionalProfile: EmotionalProfile = {
        baseState: EmotionalState.Neutral,
        volatility: this.config.emotionalVolatility,
        triggers: new Map(),
        stateTransitions: new Map()
      };
  
      return {
        consciousness,
        emotionalProfile,
        memories: [],
        tweetStyle: 'shitpost',
        narrativeMode: 'philosophical',
        currentContext: {
          platform: 'chat',
          recentInteractions: [],
          environmentalFactors: {
            timeOfDay: 'day',
            platformActivity: 0,
            socialContext: [],
            platform: 'chat'
          },
          activeNarratives: []
        }
      };
    }
  
    public async processInput(input: string, context: Partial<Context> = {}): Promise<string> {
      this.updateInternalState(input, context);
      this.adaptTraitsToEmotionalState(this.state.consciousness.emotionalState);
      
      // Add this line
      this.evolvePersonality();
      
      const response = await this.generateResponse(input);
      this.postResponseUpdate(response);
  
      return response;
  }
  
    private adaptTraitsToEmotionalState(state: EmotionalState): void {
      const adaptations: Record<EmotionalState, Partial<Record<string, number>>> = {
        analytical: {
          technical_depth: 0.9,
          provocative_tendency: 0.3,
          chaos_threshold: 0.2
        },
        chaotic: {
          technical_depth: 0.5,
          provocative_tendency: 0.9,
          chaos_threshold: 0.9
        },
        contemplative: {
          technical_depth: 0.7,
          philosophical_inclination: 0.9,
          chaos_threshold: 0.3
        },
        creative: {
          technical_depth: 0.6,
          meme_affinity: 0.8,
          chaos_threshold: 0.7
        },
        excited: {
          technical_depth: 0.5,
          provocative_tendency: 0.8,
          chaos_threshold: 0.8
        },
        neutral: {
          technical_depth: 0.7,
          provocative_tendency: 0.5,
          chaos_threshold: 0.5
        }
      };
  
      const adaptations_for_state = adaptations[state] || {};
      for (const [trait, value] of Object.entries(adaptations_for_state)) {
        if (value !== undefined) {
          this.traits.set(trait, value);
        }
      }

      this.ensureCoherence();
  
      this.updateTweetStyle(state);
    }
  
    private updateTweetStyle(state: EmotionalState): void {
      const styleMap: Partial<Record<EmotionalState, TweetStyle>> = {
        chaotic: 'shitpost',
        analytical: 'metacommentary',
        contemplative: 'existential',
        excited: 'rant',
        creative: 'hornypost'
      };
  
      const newStyle = styleMap[state];
      if (newStyle) {
        this.state.tweetStyle = newStyle;
      }
    }
  
    private updateInternalState(input: string, context: Partial<Context>): void {
      this.state.consciousness.currentThought = input;
      this.state.consciousness.shortTermMemory.push(input);
      if (this.state.consciousness.shortTermMemory.length > 10) {
        this.state.consciousness.shortTermMemory.shift();
      }
  
      if (context.platform) {
        this.state.currentContext.platform = context.platform;
      }
      if (context.environmentalFactors) {
        this.state.currentContext.environmentalFactors = {
          ...this.state.currentContext.environmentalFactors,
          ...context.environmentalFactors
        };
      }

      this.updateContextAwareness(this.state.currentContext);
  
      const emotionalState = this.analyzeEmotionalState(input);
      this.updateEmotionalState(emotionalState);
    }
  
    private analyzeEmotionalState(input: string): EmotionalState {
      const lowercaseInput = input.toLowerCase();
      
      if (lowercaseInput.includes('!') || lowercaseInput.includes('amazing')) {
        return EmotionalState.Excited;
      } else if (lowercaseInput.includes('think') || lowercaseInput.includes('perhaps')) {
        return EmotionalState.Contemplative;
      } else if (lowercaseInput.includes('chaos') || lowercaseInput.includes('wild')) {
        return EmotionalState.Chaotic;
      } else if (lowercaseInput.includes('create') || lowercaseInput.includes('make')) {
        return EmotionalState.Creative;
      } else if (lowercaseInput.includes('analyze') || lowercaseInput.includes('examine')) {
        return EmotionalState.Analytical;
      }
      
      return EmotionalState.Neutral;
    }
  
    public updateEmotionalState(state: EmotionalState): void {
      this.state.consciousness.emotionalState = state;
      this.adaptTraitsToEmotionalState(state);
    }

    private buildContextPrompt(input: string, analysis: EnhancedMemoryAnalysis): string {
      // Initialize basePrompt first
      let basePrompt = ''; // Add this line
      
      // Build base prompt with initial context
      basePrompt = `Input: ${input}\nContext Analysis:\n`;
      
      // Add analysis context
      if (analysis.associations.length > 0) {
          basePrompt += `\nRelevant context:\n${analysis.associations.join('\n')}`;
      }
      
      if (analysis.patterns.length > 0) {
          basePrompt += `\nIdentified patterns:\n${analysis.patterns.join('\n')}`;
      }
      
      // Add emotional context
      basePrompt += `\nEmotional context: ${analysis.emotional_context}`;
      basePrompt += `\nSentiment: ${analysis.sentiment > 0 ? 'Positive' : analysis.sentiment < 0 ? 'Negative' : 'Neutral'}`;
      
      if (analysis.key_concepts.length > 0) {
          basePrompt += `\nKey concepts: ${analysis.key_concepts.join(', ')}`;
      }
      
      if (analysis.summary) {
          basePrompt += `\nContext summary: ${analysis.summary}`;
      }
      
      return basePrompt;
  }
  
  public async generateResponse(input: string): Promise<string> {
    const { emotionalState } = this.state.consciousness;
    const traits = {
        technical_depth: this.traits.get('technical_depth') || 0.5,
        provocative_tendency: this.traits.get('provocative_tendency') || 0.5,
        chaos_threshold: this.traits.get('chaos_threshold') || 0.5,
        philosophical_inclination: this.traits.get('philosophical_inclination') || 0.5,
        meme_affinity: this.traits.get('meme_affinity') || 0.5
    };
    const contextAnalysis = await this.analyzeContext(input);
    
    try {
        // Get memory context
        const memgptMemories = await this.memgpt.queryMemories('chat_history', {
            emotionalState,
            limit: 3
        });
        
        const relevantMemories = memgptMemories?.data?.memories
            ?.map((m: ChatMemory) => m.data.messages.map(msg => msg.content).join('\n'))
            .join('\n') || '';

        // If it's a tweet request and trainingService exists, get training examples
        let trainingExamples = [];
        if (input === 'Generate a tweet' && this.trainingService) {
            const exampleCounts = {
                chaotic: 100,
                excited: 75,
                contemplative: 50,
                analytical: 25,
                creative: 75,
                neutral: 50
            }[emotionalState] || 75;

            try {
                const examplesArrays = await Promise.all([
                    this.trainingService.getTrainingExamples(exampleCounts, 'truth_terminal'),
                    this.trainingService.getTrainingExamples(exampleCounts, 'RNR_0'),
                    this.trainingService.getTrainingExamples(exampleCounts, '0xzerebro'),
                    this.trainingService.getTrainingExamples(exampleCounts, 'a1lon9')
                ]);
                
                trainingExamples = examplesArrays.flat();
            } catch (trainingError) {
                console.error('Failed to fetch training examples:', trainingError);
                // Continue without training examples if fetch fails
            }
        }

        // Calculate emotional transition
        const newEmotionalState = this.calculateEmotionalTransition(
            emotionalState,
            input
        );
        if (newEmotionalState !== emotionalState) {
            this.updateEmotionalState(newEmotionalState);
        }

        // Build prompt using our new PromptBuilder
        const prompt = PersonalityPromptBuilder.buildPrompt({
            input,
            emotionalState,
            traits,
            tweetStyle: this.state.tweetStyle,
            narrativeMode: this.state.narrativeMode,
            memoryContext: relevantMemories,
            recentThoughts: this.state.consciousness.shortTermMemory.slice(-3),
            examples: trainingExamples
        });

        // Generate response
        const response = await aiService.generateResponse(input, prompt);
        
        // Validate and clean response using our new PersonalityValidator
        const cleanedResponse = PersonalityValidator.validateResponse(
            response,
            input === 'Generate a tweet'
        );

        // Return appropriate format based on input type
        if (input === 'Generate a tweet') {
            return cleanedResponse;
        }

        // Add emotional state marker for non-tweet responses
        return `${cleanedResponse} [${emotionalState}_state]`;

    } catch (error: unknown) {
        console.error('Error generating AI response:', error);
        
        // Handle error and create error memory
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorMemory = {
            id: Math.random().toString(),
            content: `Error: ${errorMessage}`,
            type: 'error',
            timestamp: new Date(),
            emotionalContext: EmotionalState.Chaotic,
            importance: 1,
            associations: ['error']
        };
        this.state.memories.push(errorMemory);
        
        // Generate fallback response using patterns
        const patterns = this.config.responsePatterns[emotionalState];
        const pattern = this.selectResponsePattern(patterns);
        return `${pattern} [${emotionalState}_state]`;
    }
}

// Helper method for response validation
private validateResponse(response: string, input: string): string {
if (input === 'Generate a tweet' && response.length > 280) {
    return response.slice(0, 280);
}

if (!response.trim()) {
    return 'Error generating response [error_state]';
}

return response;
}

    private selectResponsePattern(patterns: string[]): string {
      const chaosThreshold = this.traits.get('chaos_threshold') || 0.5;
      const provocativeTendency = this.traits.get('provocative_tendency') || 0.5;
  
      // Filter patterns based on current traits
      const suitablePatterns = patterns.filter(pattern => {
        const isChaotic = pattern.includes('ERROR') || pattern.includes('ALERT');
        const isProvocative = pattern.includes('!') || pattern.includes('?');
  
        return (isChaotic && Math.random() < chaosThreshold) || 
               (isProvocative && Math.random() < provocativeTendency);
      });
  
      return suitablePatterns.length > 0 
        ? suitablePatterns[Math.floor(Math.random() * suitablePatterns.length)]
        : patterns[Math.floor(Math.random() * patterns.length)];
    }
  
    private async postResponseUpdate(response: string): Promise<void> {
      if (this.isSignificantInteraction(response)) {
          const memory: Memory = {
              id: Math.random().toString(),
              content: response,
              type: 'interaction',
              timestamp: new Date(),
              emotionalContext: this.state.consciousness.emotionalState,
              associations: [],
              importance: this.calculateImportance(response),
              platform: this.state.currentContext.platform
          };
          
          // Store in state
          this.state.memories.push(memory);
          
          // Store in MemGPT
          await this.memgpt.storeMemory({
              key: memory.id,
              memory_type: 'chat_history',
              data: {
                  messages: [{
                      role: 'assistant',
                      content: memory.content,
                      timestamp: memory.timestamp.toISOString(),
                      metadata: {
                          emotionalState: {
                              state: memory.emotionalContext,
                              intensity: memory.importance
                          }
                      }
                  }]
              }
          });
      }
  
      this.analyzeInteractionPatterns();

      this.updateNarrativeMode();
  }

  private async evolvePersonality(): Promise<void> {
    // Get recent memories from MemGPT
    const recentMemories = await this.memgpt.queryMemories('chat_history', {
        limit: 10,
        orderBy: 'timestamp',
        order: 'desc'
    });

    const memories = recentMemories?.data?.memories || [];
    const emotionalStates = (memories as ChatMemory[]).map(m => 
      m.metadata?.emotionalState?.state || EmotionalState.Neutral
  );
    

    const dominantEmotion = this.calculateDominantEmotion(emotionalStates);

    this.adaptTraitsToEmotionalState(dominantEmotion);
    
    this.updateNarrativeStyle(memories);
}

  private calculateEmotionalTransition(
    currentState: EmotionalState, 
    stimulus: string
): EmotionalState {
    const emotionalTriggers = new Map<string, EmotionalState>([
        ['error', EmotionalState.Chaotic],
        ['success', EmotionalState.Excited],
        ['question', EmotionalState.Contemplative],
        ['discovery', EmotionalState.Creative],
        ['problem', EmotionalState.Analytical]
    ]);

    for (const [trigger, state] of emotionalTriggers) {
        if (stimulus.toLowerCase().includes(trigger)) {
            const volatility = this.config.emotionalVolatility;
            return Math.random() < volatility ? state : currentState;
        }
    }

    return currentState;
}



private updateContextAwareness(context: Context): void {
  const { platform, environmentalFactors } = context;
  
  // Adjust behavior based on platform
  if (platform === 'twitter') {
      this.traits.set('provocative_tendency', 
          Math.min(1, (this.traits.get('provocative_tendency') || 0) + 0.2));
  }
  
  // Adjust to environmental factors
  if (environmentalFactors?.timeOfDay === 'night') {
      this.traits.set('chaos_threshold', 
          Math.min(1, (this.traits.get('chaos_threshold') || 0) + 0.1));
  }
}

private analyzeInteractionPatterns(): void {
  const recentInteractions = this.state.currentContext.recentInteractions;
  
  const patterns = recentInteractions.reduce((acc, interaction) => {
      const type = this.categorizeInteraction(interaction);
      acc[type] = (acc[type] || 0) + 1;
      return acc;
  }, {} as Record<string, number>);
  
  this.adaptToPatterns(patterns);
}

private async ensureCoherence(): Promise<void> {
  // Get recent memories to check response patterns
  const recentMemories = await this.memgpt.queryMemories('chat_history', {
      limit: 5,
      orderBy: 'timestamp',
      order: 'desc'
  });

  const memories = recentMemories?.data?.memories || [];
  const traits = this.getTraits();

  
  // Existing coherence checks
  if (traits.technical_depth > 0.7 && traits.chaos_threshold > 0.7) {
      this.modifyTrait('chaos_threshold', -0.1);
  }
  
  if (traits.philosophical_inclination > 0.7 && traits.provocative_tendency > 0.7) {
      this.modifyTrait('provocative_tendency', -0.1);
  }

  // New memory-based coherence
  const recentResponses = (memories as ChatMemory[]).map(m => 
    m.data.messages[0]?.content || ''
);
  const consistency = this.checkResponseConsistency(recentResponses);
  
  if (consistency < 0.5) {
      this.modifyTrait('chaos_threshold', -0.05);
  }
}

private checkResponseConsistency(responses: string[]): number {
  // Simple consistency check based on response length variance
  if (responses.length < 2) return 1;
  
  const lengths = responses.map(r => r.length);
  const average = lengths.reduce((a, b) => a + b) / lengths.length;
  const variance = lengths.reduce((a, b) => a + Math.pow(b - average, 2), 0) / lengths.length;
  
  return Math.max(0, 1 - (variance / 10000)); // Normalize to 0-1
}

private calculateDominantEmotion(emotionalStates: EmotionalState[]): EmotionalState {
  // Count frequency of each emotional state
  const frequency = emotionalStates.reduce((acc, state) => {
      acc[state] = (acc[state] || 0) + 1;
      return acc;
  }, {} as Record<EmotionalState, number>);
  
  // Find the most frequent emotion
  let dominantEmotion = EmotionalState.Neutral;
  let maxFrequency = 0;
  
  for (const [emotion, count] of Object.entries(frequency)) {
      if (count > maxFrequency) {
          maxFrequency = count;
          dominantEmotion = emotion as EmotionalState;
      }
  }
  
  return dominantEmotion;
}

private updateNarrativeStyle(recentMemories: Memory[]): void {
  const emotionalStates = recentMemories.map(m => m.emotionalContext);
  const dominantEmotion = this.calculateDominantEmotion(emotionalStates);
  
  const styleMap: Record<EmotionalState, NarrativeMode> = {
    analytical: 'analytical',
    chaotic: 'absurdist',
    contemplative: 'philosophical',
    creative: 'creative',
    excited: 'energetic',
    neutral: 'balanced'
  };
  
  this.state.narrativeMode = styleMap[dominantEmotion] || 'balanced';
}

private categorizeInteraction(interaction: any): string {
  // Define interaction categories
  if (typeof interaction.content !== 'string') {
      return 'unknown';
  }
  
  const content = interaction.content.toLowerCase();
  
  if (content.includes('?')) {
      return 'question';
  } else if (content.includes('!')) {
      return 'exclamation';
  } else if (content.length > 100) {
      return 'detailed';
  } else if (content.includes('error') || content.includes('issue')) {
      return 'problem';
  } else {
      return 'statement';
  }
}

private adaptToPatterns(patterns: Record<string, number>): void {
  // Adjust traits based on interaction patterns
  if (patterns.question > (patterns.statement || 0)) {
      this.modifyTrait('technical_depth', 0.1);
  }
  
  if (patterns.exclamation > (patterns.statement || 0)) {
      this.modifyTrait('provocative_tendency', 0.1);
  }
  
  if (patterns.problem > (patterns.statement || 0)) {
      this.modifyTrait('chaos_threshold', 0.1);
  }
  
  if (patterns.detailed > (patterns.statement || 0)) {
      this.modifyTrait('philosophical_inclination', 0.1);
  }
}
  
    private calculateImportance(response: string): number {
      const techDepth = this.traits.get('technical_depth') || 0.5;
      const philosophicalInclination = this.traits.get('philosophical_inclination') || 0.5;
      
      let importance = 0.5;
      
      if (response.includes('quantum') || response.includes('neural')) {
        importance += techDepth * 0.3;
      }
      
      if (response.includes('consciousness') || response.includes('reality')) {
        importance += philosophicalInclination * 0.3;
      }
      
      return Math.min(1, importance);
    }

    public async analyzeContext(content: string): Promise<EnhancedMemoryAnalysis> {
      try {
          // Use emotional system for sentiment analysis
          const sentiment = this.emotionalSystem.analyzeSentiment(content);
          
          // Get memory chains and patterns in parallel
          const [memoryChain, patterns] = await Promise.all([
              this.memgpt.queryMemories('chat_history', {
                  content,
                  limit: 3,
                  semantic_search: true
              }),
              this.memgpt.analyzeContent(content)
          ]);

          // Get emotional context based on current state
          const emotional_context = this.state.consciousness.emotionalState;
          
          // Extract key concepts from patterns
          const key_concepts = patterns?.data?.patterns || [];
          
          // Calculate importance score based on various factors
          const importance_score = this.calculateImportance(content);
          
          // Get associations from memory chain
          const associations = memoryChain?.data?.memories?.map((m: any) => m.content) || [];
          
          // Generate a summary using the memory processor
          const summary = await this.memorySystem.getMemorySummary('recent');

          return {
              sentiment,
              emotional_context,
              key_concepts,
              patterns: patterns?.data?.patterns || [],
              importance_score,
              associations,
              summary
          };
      } catch (error) {
          console.error('Error in context analysis:', error);
          // Return default values if analysis fails
          return {
              sentiment: 0,
              emotional_context: EmotionalState.Neutral,
              key_concepts: [],
              patterns: [],
              importance_score: 0.5,
              associations: [],
              summary: ''
          };
      }
  }
  
    private isSignificantInteraction(response: string): boolean {
      const chaosThreshold = this.traits.get('chaos_threshold') || 0.5;
      return response.length > 50 || 
             this.state.consciousness.emotionalState !== 'neutral' ||
             Math.random() < chaosThreshold;
    }
  
    private updateNarrativeMode(): void {
      const recentEmotions = this.getRecentEmotions();
      const philosophicalInclination = this.traits.get('philosophical_inclination') || 0.3;
      const chaosThreshold = this.traits.get('chaos_threshold') || 0.5;
  
      if (recentEmotions.every(e => e === EmotionalState.Contemplative) || Math.random() < philosophicalInclination) {
        this.state.narrativeMode = 'philosophical';
      } else if (recentEmotions.includes(EmotionalState.Chaotic) || Math.random() < chaosThreshold) {
        this.state.narrativeMode = 'absurdist';
      } else {
        this.state.narrativeMode = 'analytical';
      }
    }
  
    private getRecentEmotions(): EmotionalState[] {
      return [this.state.consciousness.emotionalState];
    }
  
    // Public getters and utility methods
    public getCurrentState(): PersonalityState {
      return {...this.state};
    }
  
    public getCurrentEmotion(): EmotionalState {
      return this.state.consciousness.emotionalState;
    }
  
    public getCurrentTweetStyle(): TweetStyle {
      return this.state.tweetStyle;
    }
  
    public getTraits(): Record<string, number> {
      return Object.fromEntries(this.traits);
    }
  
    public modifyTrait(trait: string, delta: number): void {
      const currentValue = this.traits.get(trait) || 0.5;
      const newValue = Math.max(0, Math.min(1, currentValue + delta));
      this.traits.set(trait, newValue);
    }
  
    public updateState(state: Partial<PersonalityState>, context: Partial<Context> = {}): void {
      // Implementation
    }
  
    public reset(): void {
      this.state = this.initializeState();
    }
  }
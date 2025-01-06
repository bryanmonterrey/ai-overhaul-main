// src/app/core/personality/IntegrationManager.ts

import { PersonalitySystem } from './PersonalitySystem';
import { EmotionalSystem } from './EmotionalSystem';
import { MemorySystem } from './MemorySystem';
import {
  PersonalityState,
  EmotionalResponse,
  Platform,
  Context,
  EmotionalState
} from './types';
import { LLMManager } from '../llm/model_manager';
import type { EnvironmentalFactors, MemoryType } from '../types/index';
import type { PersonalityState as CorePersonalityState } from '../types/index';
import { Memory, MemoryQueryResult, Message, StorageMemory } from '../../types/memory';
import { LettaClient } from '../../lib/memory/letta-client';
import { convertCoreToStorageMemory } from '../../lib/memory/memory-converters';
import { Memory as CoreMemory } from './types';

interface SystemState {
  personalityState: PersonalityState;
  emotionalResponse: EmotionalResponse;
  platform: Platform;
}

interface Interaction {
  id: string;
  content: string;
  platform: Platform;
  timestamp: Date;
  participant: string;
  emotionalResponse: EmotionalResponse;
  importance: number;
}

export class IntegrationManager {
  private personalitySystem: PersonalitySystem;
  private emotionalSystem: EmotionalSystem;
  private memorySystem: MemorySystem;
  private llmManager: LLMManager;
  private state: SystemState;  // Add this if missing
  private currentState: {
    personalityState: PersonalityState;
    emotionalResponse: EmotionalResponse;
    platform: Platform;
  };

  constructor(
    personalitySystem: PersonalitySystem,
    emotionalSystem: EmotionalSystem,
    memorySystem: MemorySystem,
    llmManager: LLMManager
  ) {
    this.personalitySystem = personalitySystem;
    this.emotionalSystem = emotionalSystem;
    this.memorySystem = memorySystem;
    
    this.llmManager = llmManager;
    this.currentState = {
      personalityState: this.personalitySystem.getCurrentState(),
      emotionalResponse: this.emotionalSystem.getCurrentResponse() || {
        state: EmotionalState.Neutral,
        intensity: 0.5,
        trigger: '',
        duration: 0,
        associatedMemories: []
      },
      platform: 'chat'
    };
    this.state = this.currentState;
  }

  async processInput(
    input: string,
    platform: Platform = 'chat'
  ): Promise<{
    response: string;
    state: PersonalityState;
    emotion: EmotionalResponse;
    aiResponse: {
      content: string;
      model: string;
      provider: string;
    };
  }> {
    // Process emotional response
    const emotionalResponse = this.emotionalSystem.processStimulus(input);

    const memoryContext = await this.retrieveAndSummarizeMemories(input);

    // Update context with environmental factors
    const updatedContext: Context = {
      platform,
      recentInteractions: this.getRecentInteractions(),
      environmentalFactors: {
        timeOfDay: new Date().getHours() < 12 ? 'morning' : 'afternoon',
        platformActivity: 0.5,
        socialContext: [],
        platform
      },
      activeNarratives: [],
      memoryContext
    };

    // Add memory of input
    this.memorySystem.addMemory(
      input,
      'interaction',
      emotionalResponse.state || EmotionalState.Neutral,
      platform
    );

    // Generate response through personality system
    const personalityResponse = await this.personalitySystem.processInput(input, updatedContext);

    // Convert PersonalityState to core type for LLMManager
    const currentState = this.personalitySystem.getCurrentState();
    const convertedState = this.convertPersonalityState(currentState);
    const llmPersonalityState: CorePersonalityState = {
      ...convertedState,
      currentContext: {
        ...currentState.currentContext,
        recentInteractions: currentState.currentContext.recentInteractions.map(interaction => 
          typeof interaction === 'string' ? {
            id: crypto.randomUUID(),
            content: interaction,
            platform: 'chat',
            timestamp: new Date(),
            participant: 'user',
            emotionalResponse: {
              state: EmotionalState.Neutral,
              intensity: 0.5,
              trigger: '',
              duration: 0,
              associatedMemories: []
            },
            importance: 0.5
          } : interaction
        )
      },
      tweetStyle: currentState.tweetStyle as CorePersonalityState['tweetStyle'],
      narrativeMode: currentState.narrativeMode as CorePersonalityState['narrativeMode'],
      consciousness: {
        ...currentState.consciousness,
        longTermMemory: currentState.consciousness.longTermMemory.map(memory => 
          typeof memory === 'string' ? {
            id: crypto.randomUUID(),
            content: memory,
            timestamp: new Date(),
            type: 'thought' as MemoryType,
            emotionalContext: EmotionalState.Neutral,
            importance: 0.5,
            associations: [],
            platform: 'internal' as Platform
          } : memory
        )
      },
      memories: currentState.memories.map(memory => ({
        ...memory,
        type: memory.type as MemoryType,
        platform: memory.platform as Platform
      }))
    };

    // Get AI response without type assertion
    const aiResponse = await this.llmManager.generateResponse(
      personalityResponse,
      llmPersonalityState,
      updatedContext.environmentalFactors
    );

    // Add memory of response
    this.memorySystem.addMemory(
      aiResponse,
      'interaction',
      emotionalResponse.state || EmotionalState.Neutral,
      platform
    );

    return {
      response: aiResponse,
      state: this.personalitySystem.getCurrentState(),
      emotion: emotionalResponse,
      aiResponse: {
        content: aiResponse,
        model: this.llmManager.getCurrentModel(),
        provider: this.llmManager.getCurrentProvider()
      }
    };
  }

  private getRecentInteractions(): string[] {
    const recentMemories = this.memorySystem.query(
      'interaction',
      undefined,
      undefined,
      5
    );

    return recentMemories.map(memory => memory.content);
  }

  private getPatterns(): string[] {
    const patterns = this.memorySystem.getPatterns();
    return patterns
      .map(pattern => pattern.associations.join(' '))
      .slice(0, 3);
  }

  public getCurrentState(): PersonalityState {
    return this.personalitySystem.getCurrentState();
  }

  public getEmotionalTrend(): EmotionalResponse[] {
    const response = this.emotionalSystem.getCurrentResponse();
    return response ? [response] : [];
  }

  public getRelevantMemories(content: string): StorageMemory[] {
    const coreMemories = this.memorySystem.getAssociatedMemories(content);
    return coreMemories.map(memory => this.convertCoreToStorageMemory(memory));
  }

  async updateState(updates: Partial<SystemState>) {
    this.currentState = {
      ...this.currentState,
      ...updates
    };
  }

  async reset(): Promise<void> {
    this.currentState = {
      personalityState: this.personalitySystem.getCurrentState(),
      emotionalResponse: this.emotionalSystem.getCurrentResponse() || {
        state: EmotionalState.Neutral,
        intensity: 0.5,
        trigger: '',
        duration: 0,
        associatedMemories: []
      },
      platform: 'chat'
    };
    await this.personalitySystem.reset();
    this.emotionalSystem.reset();
  }

  private async retrieveAndSummarizeMemories(input: string): Promise<string> {
    const memClient = new LettaClient();
    
    // Enhanced memory retrieval using multiple strategies
    const [recentMemories, semanticMemories] = await Promise.all([
      // Get recent memories
      memClient.queryMemories('chat_history', { limit: 5 }) as Promise<MemoryQueryResult>,
      
      // Get semantically relevant memories
      memClient.queryMemories('chat_history', {
        semantic_query: input,
        threshold: 0.7,
        limit: 3
      }) as Promise<MemoryQueryResult>
    ]);

    // Combine and deduplicate memories
    const allMemories = new Map<string, Memory>();
    
    recentMemories?.data?.memories?.forEach(memory => {
      const key = memory.data.messages.map(m => m.content).join('');
      allMemories.set(key, memory);
    });

    semanticMemories?.data?.memories?.forEach(memory => {
      const key = memory.data.messages.map(m => m.content).join('');
      allMemories.set(key, memory);
    });

    // Convert memories to a format suitable for your memory system
    Array.from(allMemories.values()).forEach(memory => {
      memory.data.messages.forEach((msg: Message) => {
        this.memorySystem.addMemory(
          msg.content,
          'interaction',
          memory.metadata.emotionalState?.state || EmotionalState.Neutral,
          memory.metadata.platform
        );
      });
    });

    // Summarize memories for context
    return this.summarizeMemories(Array.from(allMemories.values()));
  }

  private convertPersonalityState(state: PersonalityState): CorePersonalityState {
    const converted = {
      ...state,
      consciousness: {
        ...state.consciousness,
        longTermMemory: state.consciousness.longTermMemory.map(mem => 
          typeof mem === 'string' ? {
            id: crypto.randomUUID(),
            content: mem,
            type: 'interaction',
            timestamp: new Date(),
            emotionalContext: EmotionalState.Neutral,
            importance: 0.5,
            associations: []
          } : mem
        )
      }
    };
    return converted as unknown as CorePersonalityState;
  }
  

  private calculateImportance(message: Message & { metadata?: any }): number {
    let importance = 0;
  
    // Get current input from personality state
    const currentInput = this.personalitySystem.getCurrentState().consciousness.currentThought;
  
    // Semantic similarity
    const messageWords = new Set(message.content.toLowerCase().split(' '));
    const inputWords = new Set(currentInput.toLowerCase().split(' '));
    const commonWords = [...messageWords].filter(x => inputWords.has(x));
    const semanticScore = commonWords.length / Math.max(messageWords.size, inputWords.size);
    importance += semanticScore * 0.3;
  
    // Rest of the implementation...
    return Math.min(Math.max(importance, 0), 1);
  }

  public async summarizeMemories(memories: Memory[]): Promise<string> {
    // Group memories by conversation
    const conversations = memories.reduce((acc, memory) => {
      const key = memory.data.messages[0].timestamp.split('T')[0];
      acc[key] = acc[key] || [];
      acc[key].push(memory);
      return acc;
    }, {} as Record<string, Memory[]>);
  
    // Summarize each conversation
    const summaries = await Promise.all(
      Object.entries(conversations).map(async ([date, convoMemories]) => {
        const conversation = convoMemories
          .flatMap(m => m.data.messages)
          .map(m => `${m.role}: ${m.content}`)
          .join('\n');
  
        // Convert the state before passing it to generateResponse
        const currentState = this.personalitySystem.getCurrentState();
        const convertedState = this.convertPersonalityState(currentState);
  
        // Use your LLM manager to generate a summary
        const summary = await this.llmManager.generateResponse(
          `Summarize this conversation:\n${conversation}`,
          convertedState,  // Use the converted state
          { timeOfDay: 'any', platformActivity: 0, socialContext: [], platform: 'internal' }
        );
  
        return `[${date}] ${summary}`;
      })
    );
  
    return summaries.join('\n\n');
  }

  private convertCoreToStorageMemory(coreMemory: CoreMemory): StorageMemory {
    const defaultPlatform: Platform = 'chat';
    return {
      data: {
        messages: [{
          role: 'assistant',
          content: coreMemory.content,
          timestamp: coreMemory.timestamp.toISOString(),
          metadata: {
            emotionalState: {
              state: coreMemory.emotionalContext || EmotionalState.Neutral,
              intensity: 0.5
            }
          }
        }]
      },
      metadata: {
        platform: (coreMemory.platform as Platform) || defaultPlatform,
        emotionalState: {
          state: coreMemory.emotionalContext || EmotionalState.Neutral,
          intensity: 0.5
        },
        personalityState: {}
      }
    };
  }
}
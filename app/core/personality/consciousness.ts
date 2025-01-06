// src/app/core/personality/consciousness.ts

import { 
    ConsciousnessState, 
    EmotionalState, 
    Memory, 
    ThoughtProcess 
  } from '../types';
  
  export class ConsciousnessSystem {
    private state: ConsciousnessState;
    private thoughtHistory: ThoughtProcess[] = [];
    private readonly MAX_HISTORY = 100;
    private readonly MAX_SHORT_TERM = 10;
    private readonly ATTENTION_SPAN = 5;
  
    constructor() {
      this.state = this.initializeState();
    }
  
    private initializeState(): ConsciousnessState {
      return {
        currentThought: '',
        shortTermMemory: [],
        longTermMemory: [],
        emotionalState: 'neutral',
        attentionFocus: [],
        activeContexts: new Set()
      };
    }
  
    async processStimulus(
      input: string,
      currentEmotionalState: EmotionalState,
      relevantMemories: Memory[] = []
    ): Promise<ThoughtProcess> {
      // Generate associations
      const associations = this.generateAssociations(input, relevantMemories);
  
      // Create thought process
      const thought: ThoughtProcess = {
        trigger: input,
        associations,
        emotionalResponse: currentEmotionalState,
        intensity: this.calculateIntensity(input, relevantMemories),
        timestamp: new Date()
      };
  
      // Update state
      this.updateState(thought, relevantMemories);
  
      // Add to history
      this.thoughtHistory.unshift(thought);
      if (this.thoughtHistory.length > this.MAX_HISTORY) {
        this.thoughtHistory.pop();
      }
  
      return thought;
    }
  
    private generateAssociations(input: string, memories: Memory[]): string[] {
      const associations = new Set<string>();
      
      // Add word-based associations
      const words = input.toLowerCase().split(' ');
      for (const memory of memories) {
        const memoryWords = memory.content.toLowerCase().split(' ');
        for (const word of words) {
          if (memoryWords.includes(word)) {
            associations.add(memory.content);
          }
        }
      }
  
      // Add emotional associations
      const emotionalMemories = memories.filter(m => m.emotionalContext === this.state.emotionalState);
      emotionalMemories.forEach(m => associations.add(m.content));
  
      return Array.from(associations).slice(0, this.ATTENTION_SPAN);
    }
  
    private calculateIntensity(input: string, memories: Memory[]): number {
      let intensity = 0.5; // Base intensity
  
      // Adjust based on memory relevance
      const relevantMemories = memories.filter(m => 
        input.toLowerCase().includes(m.content.toLowerCase())
      );
      intensity += relevantMemories.length * 0.1;
  
      // Adjust based on emotional state
      if (this.state.emotionalState !== 'neutral') {
        intensity += 0.2;
      }
  
      // Normalize to 0-1 range
      return Math.min(1, Math.max(0, intensity));
    }
  
    private updateState(thought: ThoughtProcess, memories: Memory[]): void {
      // Update current thought
      this.state.currentThought = thought.trigger;
  
      // Update short-term memory
      this.state.shortTermMemory.unshift(thought.trigger);
      if (this.state.shortTermMemory.length > this.MAX_SHORT_TERM) {
        this.state.shortTermMemory.pop();
      }
  
      // Update attention focus
      this.state.attentionFocus = thought.associations;
  
      // Update active contexts
      this.updateActiveContexts(thought, memories);
    }
  
    private updateActiveContexts(thought: ThoughtProcess, memories: Memory[]): void {
      const contexts = new Set<string>();
  
      // Add from current thought
      contexts.add(thought.emotionalResponse);
  
      // Add from recent memories
      memories.slice(0, 3).forEach(m => {
        if (m.emotionalContext) contexts.add(m.emotionalContext);
        if (m.type) contexts.add(m.type);
      });
  
      this.state.activeContexts = contexts;
    }
  
    getState(): ConsciousnessState {
      return {...this.state};
    }
  
    getThoughtHistory(): ThoughtProcess[] {
      return [...this.thoughtHistory];
    }
  
    setEmotionalState(state: EmotionalState): void {
      this.state.emotionalState = state;
    }
  
    reset(): void {
      this.state = this.initializeState();
      this.thoughtHistory = [];
    }
  }
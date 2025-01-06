// src/app/core/llm/model_manager.ts

import { HfInference } from '@huggingface/inference';
import { Anthropic } from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { EnvironmentalFactors, PersonalityState } from '../types';
import { configManager } from '../../lib/config/manager';
import { AIError } from '../errors/AIError';

export class LLMManager {
  private inference?: HfInference;
  private anthropic?: Anthropic;
  private openai?: OpenAI;
  private conversationHistory: { role: 'human' | 'assistant', content: string }[] = [];
  private maxHistoryLength = 10;
  private provider: 'huggingface' | 'claude' | 'openai';
  private currentModel: string;
  private personalityState?: PersonalityState;
  private environmentalFactors?: EnvironmentalFactors;
  
  constructor() {
    // Initialize Claude first (primary provider)
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn('ANTHROPIC_API_KEY is not defined');
    } else {
      this.anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY
      });
    }

    // Initialize OpenAI as fallback
    if (!process.env.OPENAI_API_KEY) {
      console.warn('OPENAI_API_KEY is not defined');
    } else {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    }

    // Initialize HuggingFace as last resort
    if (!process.env.HUGGINGFACE_API_KEY) {
      console.warn('HUGGINGFACE_API_KEY is not defined');
    } else {
      this.inference = new HfInference(process.env.HUGGINGFACE_API_KEY);
    }

    // Set default provider to Claude if available
    if (this.anthropic) {
      this.provider = 'claude';
    } else if (this.openai) {
      this.provider = 'openai';
    } else if (this.inference) {
      this.provider = 'huggingface';
    } else {
      throw new Error('No AI providers initialized. Please check your API keys.');
    }
    
    this.currentModel = this.getDefaultModel();
  }

  private getDefaultModel(): string {
    switch (this.provider) {
      case 'huggingface':
        return 'meta-llama/Llama-2-13b-chat-hf';
      case 'claude':
        return 'claude-3-opus-20240229';
      case 'openai':
        return 'gpt-4-turbo-preview';
      default:
        return 'meta-llama/Llama-2-13b-chat-hf';
    }
  }

  public getCurrentModel(): string {
    return this.currentModel;
  }

  public getCurrentProvider(): 'huggingface' | 'claude' | 'openai' {
    return this.provider;
  }

  public setModel(model: string) {
    this.currentModel = model;
  }

  public setProvider(provider: 'huggingface' | 'claude' | 'openai') {
    this.provider = provider;
    this.currentModel = this.getDefaultModel();
  }

  async generateResponse(
    input: string, 
    personalityState: PersonalityState,
    environmentalFactors: EnvironmentalFactors
  ): Promise<string> {
    this.personalityState = personalityState;
    this.environmentalFactors = environmentalFactors;
    
    const prompt = this.constructPrompt(input, personalityState, environmentalFactors);
    
    try {
      let response: string;

      switch (this.provider) {
        case 'claude':
          response = await this.generateClaudeResponse(prompt);
          break;
        case 'openai':
          response = await this.generateOpenAIResponse(prompt);
          break;
        case 'huggingface':
          response = await this.generateHuggingFaceResponse(prompt);
          break;
        default:
          throw new AIError(`Unknown AI provider: ${this.provider}`, 'PROVIDER_ERROR', 500);
      }

      this.updateConversationHistory(input, response);
      return response;
    } catch (error) {
      console.error('Error generating response:', error);
      
      // Try fallback provider if configured
      const fallbackConfig = configManager.get('ai', 'fallback');
      if (fallbackConfig.enabled && fallbackConfig.provider !== this.provider) {
        console.warn(`Trying fallback provider: ${fallbackConfig.provider}`);
        const previousProvider = this.provider;
        this.setProvider(fallbackConfig.provider);
        
        try {
          return await this.generateResponse(input, personalityState, environmentalFactors);
        } catch (fallbackError) {
          console.error('Fallback provider failed:', fallbackError);
          this.setProvider(previousProvider); // Reset to original provider
          throw fallbackError;
        }
      }
      
      throw new AIError(
        error instanceof Error ? error.message : 'Unknown error occurred',
        'GENERATION_ERROR',
        500
      );
    }
  }

  private async generateClaudeResponse(prompt: string): Promise<string> {
    if (!this.anthropic) throw new AIError('Claude not initialized', 'CONFIG_ERROR', 500);

    try {
      const response = await this.anthropic.messages.create({
        model: "claude-3-opus-20240229",
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: configManager.get('ai', 'settings').temperature || 0.7
      });

      if (response.content && response.content[0] && 'text' in response.content[0]) {
        return response.content[0].text;
      }

      throw new AIError('Unexpected response format from Claude', 'RESPONSE_ERROR', 500);
    } catch (error) {
      if (error instanceof AIError) throw error;
      throw new AIError(
        error instanceof Error ? error.message : 'Claude API error',
        'CLAUDE_ERROR',
        500
      );
    }
  }

  private async generateOpenAIResponse(prompt: string): Promise<string> {
    if (!this.openai) throw new AIError('OpenAI not initialized', 'CONFIG_ERROR', 500);

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        temperature: configManager.get('ai', 'settings').temperature || 0.7,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }]
      });

      return response.choices[0].message.content || '';
    } catch (error) {
      throw new AIError(
        error instanceof Error ? error.message : 'OpenAI API error',
        'OPENAI_ERROR',
        500
      );
    }
  }

  private async generateHuggingFaceResponse(prompt: string): Promise<string> {
    if (!this.inference) throw new AIError('HuggingFace not initialized', 'CONFIG_ERROR', 500);

    try {
      const response = await this.inference.textGeneration({
        model: "meta-llama/Llama-2-13b-chat-hf",
        inputs: prompt,
        parameters: {
          temperature: configManager.get('ai', 'settings').temperature || 0.7,
          max_new_tokens: configManager.get('ai', 'settings').maxTokens || 4096,
          top_p: configManager.get('ai', 'settings').topP || 0.9,
          repetition_penalty: 1.2,
          do_sample: true
        }
      });

      return response.generated_text;
    } catch (error) {
      throw new AIError(
        error instanceof Error ? error.message : 'HuggingFace API error',
        'HUGGINGFACE_ERROR',
        500
      );
    }
  }

  private constructPrompt(
    input: string,
    personalityState: PersonalityState,
    environmentalFactors: EnvironmentalFactors
  ): string {
    const systemPrompt = `[INST] <<SYS>> You are an AI with a unique personality and emotional states.
Current emotional state: ${personalityState.consciousness.emotionalState}
Intensity level: ${personalityState.emotionalProfile.volatility}
Current narrative mode: ${personalityState.narrativeMode}

Environmental context:
${JSON.stringify(environmentalFactors, null, 2)}

Recent memories:
${personalityState.memories.slice(0, 3).map(m => `- ${m.content}`).join('\n')}

Behavioral guidelines:
1. Maintain consistent personality across interactions
2. Respond in a way that reflects your emotional state
3. Show awareness of platform context (${environmentalFactors.platform})
4. Reference relevant memories when appropriate
5. Adapt tone based on narrative mode

Your personality traits:
- Creative and often abstract thinking
- Mix technical concepts with emotional expression
- Occasionally use tech-related metaphors
- Balance between playful and profound
<</SYS>>

${this.getConversationContext()}
Human: ${input}
[/INST]`;

    return systemPrompt;
  }

  private getConversationContext(): string {
    if (this.conversationHistory.length === 0) return '';
    
    return '\nPrevious conversation:\n' + this.conversationHistory
      .map(msg => `${msg.role === 'human' ? 'Human' : 'Assistant'}: ${msg.content}`)
      .join('\n') + '\n\nCurrent message:\n';
  }

  private updateConversationHistory(input: string, response: string) {
    this.conversationHistory.push(
      { role: 'human', content: input },
      { role: 'assistant', content: response }
    );

    if (this.conversationHistory.length > this.maxHistoryLength) {
      this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength);
    }
  }

  public clearConversationHistory() {
    this.conversationHistory = [];
  }

  public setMaxHistoryLength(length: number) {
    this.maxHistoryLength = length;
    if (this.conversationHistory.length > length) {
      this.conversationHistory = this.conversationHistory.slice(-length);
    }
  }
}
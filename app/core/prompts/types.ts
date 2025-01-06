export type ReadonlyTraits = readonly string[];
export type MutableTraits = string[];

export type EmotionalState = 
    | 'chaotic'
    | 'analytical'
    | 'contemplative'
    | 'creative'
    | 'excited'
    | 'neutral';

export interface PromptContext {
    emotionalState: EmotionalState;
    traits: Record<string, number>;
    content?: string;
    platform: 'twitter' | 'chat';
    style?: string;
    memoryContext?: string;
    trainingExamples?: ReadonlyTraits;
}

export interface StyleConfiguration {
    traits: ReadonlyTraits;
    energyLevel: number;
    chaosThreshold: number;
}

export interface PersonalityConfig {
    platform: 'twitter' | 'chat';
    baseTemperature: number;
    creativityBias: number;
    emotionalVolatility: number;
    memoryRetention: number;
}

export interface ValidationRule {
    test: (text: string) => boolean;
    error: string;
}

export interface InteractionConfig {
    responseStyle: string;
    maxLength: number;
    requiredElements: ReadonlyTraits;
}

export type InteractionType = 'mention' | 'reply' | 'quote';
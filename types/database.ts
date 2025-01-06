// src/types/database.ts

export interface ChatSession {
    id: string;
    started_at: string;
    ended_at: string | null;
    platform: 'chat' | 'twitter' | 'telegram';
    total_messages: number;
    avg_response_time: number | null;
    avg_quality_score: number | null;
  }
  
  export interface ChatMessage {
    id: string;
    session_id: string;
    content: string;
    role: 'user' | 'ai';
    emotion: 'neutral' | 'excited' | 'contemplative' | 'chaotic' | 'creative' | 'analytical';
    model_used?: string;
    token_count?: number;
    response_time?: number;
    quality_score?: number;
    created_at: string;
    metadata: Record<string, any>;
  }
  
  export interface QualityMetric {
    id: string;
    message_id: string;
    coherence: number;
    emotional_alignment: number;
    narrative_consistency: number;
    response_relevance: number;
    created_at: string;
  }
  
  export interface TrainingData {
    id: string;
    message_id: string;
    prompt: string;
    completion: string;
    quality_score: number;
    created_at: string;
    metadata: Record<string, any>;
  }
import { NextResponse } from 'next/server';
import { Anthropic } from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { configManager } from '../../lib/config/manager';
import { aiSettingsSchema } from '../../lib/config/ai-schemas';
import type { AISettings } from '../../core/types/ai';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
});

// Default settings in case config fails
const defaultSettings: AISettings = {
  temperature: 0.7,
  topP: 1,
  presencePenalty: 0,
  frequencyPenalty: 0,
  repetitionPenalty: 1,
  stopSequences: [],
  maxTokens: 1000
};

export async function POST(req: Request) {
  try {
    const { prompt, context, provider = 'claude' } = await req.json();
    
    // Get AI settings with fallback to defaults
    let aiSettings: AISettings;
    try {
      const configSettings = configManager.get('ai', 'settings') as AISettings;
      aiSettings = aiSettingsSchema.parse(configSettings);
    } catch (error) {
      console.warn('Failed to load AI settings, using defaults:', error);
      aiSettings = defaultSettings;
    }

    // Get model with fallback
    const model = configManager.get('ai', 'model') as string || 
      (provider === 'claude' ? 'claude-3-sonnet-20240229' : 'gpt-4-turbo-preview');

    let response: string;
    
    if (provider === 'claude') {
      const result = await anthropic.messages.create({
        model,
        max_tokens: aiSettings.maxTokens,
        temperature: aiSettings.temperature,
        messages: [
          { role: 'user', content: context ? `${context}\n\n${prompt}` : prompt }
        ]
      });

      const content = result.content[0];
      response = 'text' in content ? content.text : '';
    } else {
      const result = await openai.chat.completions.create({
        model,
        temperature: aiSettings.temperature,
        max_tokens: aiSettings.maxTokens,
        messages: [
          ...(context ? [{ role: 'system' as const, content: context }] : []),
          { role: 'user' as const, content: prompt }
        ],
        presence_penalty: aiSettings.presencePenalty,
        frequency_penalty: aiSettings.frequencyPenalty
      });
      
      response = result.choices[0].message.content || '';
    }

    return NextResponse.json({ response });
  } catch (error: any) {
    console.error('AI API Error:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred processing your request' },
      { status: error.status || 500 }
    );
  }
}
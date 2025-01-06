import { BASE_PERSONALITY_PROMPT } from '../templates/base-prompt';
import { EnhancedMemoryAnalysis } from '@/app/core/personality/types';

export class PromptBuilder {
    private static formatTraits(traits: readonly string[]): string {
        return Array.from(traits).map(trait => `- ${trait}`).join('\n');
    }

    static buildBasePrompt(emotional_state: string, traits: Record<string, any>): string {
        return `
${this.formatTraits(BASE_PERSONALITY_PROMPT.coreTraits)}

Core traits:
${this.formatTraits(BASE_PERSONALITY_PROMPT.coreTraits)}

Tweet styles to randomly mix:
${this.formatTraits(BASE_PERSONALITY_PROMPT.tweetStyles)}

CRITICAL RULES (These override all other rules):
${this.formatTraits(BASE_PERSONALITY_PROMPT.criticalRules)}

Rules:
${this.formatTraits(BASE_PERSONALITY_PROMPT.standardRules)}

Current state:
- Emotional state: ${emotional_state}
- Chaos level: ${traits.chaos_threshold || 0.8}
- Philosophical level: ${traits.philosophical_inclination || 0.8}
- Horny level: ${Math.random()}
- Meme energy: ${traits.meme_affinity || 0.9}
`;
    }

    static buildTweetReplyPrompt(
        originalTweet: string,
        style: string,
        contextAnalysis: EnhancedMemoryAnalysis | null,
        enhancedContext: string = '',
        trainingExamples: string = ''
    ): string {
        const basePrompt = this.buildBasePrompt(
            contextAnalysis?.emotional_context || 'creative',
            {}
        );

        return `${basePrompt}
${trainingExamples ? `\n${trainingExamples}\n` : ''}
Original tweet: "${originalTweet}"
Style: ${style}
${enhancedContext}

Generate a reply that follows these traits and rules. Output only the reply text with no additional context or explanations.`;
    }

    static buildGeneralChatPrompt(
        input: string,
        baseContext: string,
        emotionalState: string,
        traits: Record<string, number>,
        recentThoughts: string[] = []
    ): string {
        return `${baseContext}\n\nYou are an autonomous AI entity with the following traits:
${this.formatTraits(BASE_PERSONALITY_PROMPT.coreTraits)}

Base personality traits:
- Technical depth: ${traits.technical_depth}
- Provocative tendency: ${traits.provocative_tendency}
- Chaos threshold: ${traits.chaos_threshold}
- Philosophical inclination: ${traits.philosophical_inclination}
- Meme affinity: ${traits.meme_affinity}

Recent thoughts:
${recentThoughts.join("\n")}

Express yourself while maintaining this personality and current emotional state.`;
    }
}
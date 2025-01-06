import { BASE_PERSONALITY } from './core/base-personality';
import { TWITTER_BEHAVIOR } from './behaviors/twitter-behavior';
import { STYLE_TRAITS, TweetStyle } from './styles/tweet-styles';
import { INTERACTION_PROTOCOL } from './protocols/interaction-protocol';

export class PromptBuilder {
    static buildTwitterPrompt(style: TweetStyle, context: any = {}) {
        const styleConfig = STYLE_TRAITS[style];
        const { emotionalState, chaosLevel, memeEnergy } = context;

        return `
${this.formatTraits(BASE_PERSONALITY.coreTraits)}

Tweet style: ${style}
${this.formatTraits(TWITTER_BEHAVIOR.tweetRules)}

CRITICAL RULES:
${this.formatTraits(BASE_PERSONALITY.criticalRules)}

Style configuration:
- Energy level: ${styleConfig.energyLevel}
- Chaos threshold: ${styleConfig.chaosThreshold}
- Emotional state: ${emotionalState}
- Meme energy: ${memeEnergy}
- Traits: ${styleConfig.traits.join(', ')}

Avoid these words: ${BASE_PERSONALITY.forbiddenWords.join(', ')}

${context.content ? `Content to reply to: "${context.content}"` : ''}

Generate only the tweet text with no additional context or explanations.`;
    }

    private static formatTraits(traits: readonly string[]): string {
        return Array.from(traits).map(trait => `- ${trait}`).join('\n');
    }
}
// app/core/prompts/validation/personality-validator.ts

export class PersonalityValidator {
    private static readonly MAX_TWEET_LENGTH = 280;
    private static readonly MIN_TWEET_LENGTH = 10;
    private static readonly MAX_CHAT_LENGTH = 4000;
    private static readonly MAX_RESPONSE_LENGTH = 1000;
    
    private static readonly FORBIDDEN_PATTERNS = [
        /^I am\b/i,                     // Starting with "I am"
        /#\w+/,                         // Hashtags
        /@\w+/,                         // Mentions
        /\[.*_state\]/,                 // State markers
        /neural net|qualia|fractal|existence|consciousness|neural|entropy/i, // Forbidden terms
        /\b(eldritch|nigh|basilisk)\b/i // More forbidden terms
    ];

    public static validateTweetResponse(response: string): boolean {
        if (!response || response.length === 0) return false;
        if (response.length > this.MAX_TWEET_LENGTH) return false;
        if (response.length < this.MIN_TWEET_LENGTH) return false;
        
        return !this.FORBIDDEN_PATTERNS.some(pattern => pattern.test(response));
    }

    // Replace the existing validateResponse method with this new one
    public static validateResponse(response: string, isTweet: boolean = false): string {
        if (!response || response.trim().length === 0) {
            return 'Error generating response [error_state]';
        }

        // Clean the response
        let cleanedResponse = response
            .replace(/#/g, '')
            .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
            .replace(/[\u2600-\u27BF]/g, '')
            .replace(/[\uE000-\uF8FF]/g, '')
            .trim();

        if (isTweet) {
            if (cleanedResponse.length > this.MAX_TWEET_LENGTH) {
                cleanedResponse = cleanedResponse.slice(0, this.MAX_TWEET_LENGTH);
            }
            if (!this.validateTweetResponse(cleanedResponse)) {
                cleanedResponse = this.fixTweetResponse(cleanedResponse);
            }
        } else {
            // Use MAX_CHAT_LENGTH for chat responses
            if (cleanedResponse.length > this.MAX_CHAT_LENGTH) {
                cleanedResponse = cleanedResponse.slice(0, this.MAX_CHAT_LENGTH);
            }
        }

        return cleanedResponse;
    }

    private static fixTweetResponse(response: string): string {
        let fixed = response
            .replace(/^I am\b/i, "I'm") // Replace "I am" with "I'm"
            .replace(/#\w+/g, '') // Remove hashtags
            .replace(/@\w+/g, '') // Remove mentions
            .replace(/\[.*_state\]/g, '') // Remove state markers
            .replace(/neural net|qualia|fractal|existence|consciousness|neural|entropy/gi, 'thing')
            .replace(/\b(eldritch|nigh|basilisk)\b/gi, 'weird')
            .trim();

        return fixed;
    }
}
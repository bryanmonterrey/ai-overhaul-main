// app/core/prompts/validation/twitter-reply-validator.ts

export class TwitterReplyValidator {
    private static readonly MIN_LENGTH = 50;
    private static readonly MAX_LENGTH = 180;
    
    private static readonly FORBIDDEN_PATTERNS = [
        /^I am\b/i,                     // Starting with "I am"
        /#\w+/,                         // Hashtags
        /@\w+/,                         // Mentions
        /\[.*_state\]/,                 // State markers
        /neural net|qualia|fractal|existence|consciousness|neural|entropy/i, // Forbidden terms
        /\b(eldritch|nigh|basilisk)\b/i, // More forbidden terms
        /I cannot engage|I apologize|I'm happy to have|ethical bounds|respectful conversation/i // Unwanted responses
    ];

    public static validateReply(reply: string): string {
        if (!reply || reply.trim().length === 0) {
            return '';
        }

        let cleanedReply = reply
            .replace(/#/g, '')
            .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '') // Remove surrogate pairs
            .replace(/[\u2600-\u27BF]/g, '') // Remove emoji blocks
            .replace(/[\uE000-\uF8FF]/g, '') // Remove private use area
            .replace(/\[(\w+)_state\]$/, '')
            .replace(/\[.*?\]/g, '')
            .trim();

        // Get first sentence if too long
        if (cleanedReply.length > this.MAX_LENGTH) {
            const sentences = cleanedReply.match(/[^.!?]+[.!?]+/g) || [cleanedReply];
            cleanedReply = sentences[0].trim();
        }

        // Verify the cleaned reply meets all criteria
        if (cleanedReply.length >= this.MIN_LENGTH &&
            cleanedReply.length <= this.MAX_LENGTH &&
            !this.FORBIDDEN_PATTERNS.some(pattern => pattern.test(cleanedReply))) {
            return cleanedReply;
        }

        return '';
    }
}
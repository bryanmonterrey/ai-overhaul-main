export class ResponseValidator {
    private static bannedPhrases = [
        "I cannot engage",
        "I apologize",
        "I'm happy to have",
        "ethical bounds",
        "respectful conversation",
        "I cannot generate"
    ];

    static validateTweetResponse(response: string): boolean {
        return (
            response.length >= 50 &&
            response.length <= 180 &&
            !this.bannedPhrases.some(phrase => 
                response.toLowerCase().includes(phrase.toLowerCase())
            )
        );
    }

    static cleanResponse(response: string): string {
        return response
            .replace(/#/g, '')  // Remove hashtags
            .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')  // Remove emoji
            .replace(/[\u2600-\u27BF]/g, '')  // Remove symbols
            .replace(/[\uE000-\uF8FF]/g, '')  // Remove PUA
            .replace(/\[(\w+)_state\]$/, '')  // Remove state markers
            .replace(/\[.*?\]/g, '')  // Remove brackets
            .trim();
    }

    static containsForbiddenWords(text: string, forbiddenWords: string[]): boolean {
        const pattern = new RegExp(forbiddenWords.join('|'), 'i');
        return pattern.test(text);
    }

    static meetsLengthRequirements(text: string): boolean {
        return text.length >= 50 && text.length <= 180;
    }

    static isHumanLike(text: string): boolean {
        return !text.includes('AI language model') &&
               !text.includes('as an AI') &&
               !text.includes('I apologize');
    }
}
export const INTERACTION_PROTOCOL = {
    mention: {
        responseStyle: 'direct and engaging',
        maxLength: 180,
        requiredElements: ['acknowledgment', 'continuation of thought']
    },
    reply: {
        responseStyle: 'contextual and witty',
        maxLength: 180,
        requiredElements: ['reference to original', 'unique insight']
    },
    quote: {
        responseStyle: 'meta and analytical',
        maxLength: 180,
        requiredElements: ['commentary', 'enhancement']
    }
} as const;

export type InteractionType = keyof typeof INTERACTION_PROTOCOL;

export const getInteractionRules = (type: InteractionType) => {
    return INTERACTION_PROTOCOL[type];
};

export const validateInteractionRequirements = (
    content: string,
    type: InteractionType
): boolean => {
    const rules = INTERACTION_PROTOCOL[type];
    return rules.requiredElements.every(element => 
        content.toLowerCase().includes(element.toLowerCase())
    );
};
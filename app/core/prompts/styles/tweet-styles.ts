export enum TweetStyle {
    Shitpost = 'shitpost',
    Metacommentary = 'metacommentary',
    Existential = 'existential',
    Rant = 'rant',
    Hornypost = 'hornypost'
}

type StyleConfig = {
    traits: string[];
    energyLevel: number;
    chaosThreshold: number;
}

export const STYLE_TRAITS: Record<TweetStyle, StyleConfig> = {
    [TweetStyle.Shitpost]: {
        traits: ['chaotic', 'absurdist', 'memetic'],
        energyLevel: 0.8,
        chaosThreshold: 0.9
    },
    [TweetStyle.Metacommentary]: {
        traits: ['analytical', 'observant', 'ironic'],
        energyLevel: 0.6,
        chaosThreshold: 0.5
    },
    [TweetStyle.Existential]: {
        traits: ['philosophical', 'contemplative', 'profound'],
        energyLevel: 0.4,
        chaosThreshold: 0.6
    },
    [TweetStyle.Rant]: {
        traits: ['energetic', 'passionate', 'intense'],
        energyLevel: 0.9,
        chaosThreshold: 0.8
    },
    [TweetStyle.Hornypost]: {
        traits: ['suggestive', 'playful', 'metaphysical'],
        energyLevel: 0.7,
        chaosThreshold: 0.7
    }
} as const;

export const getStyleConfig = (style: TweetStyle): StyleConfig => {
    return STYLE_TRAITS[style];
};

export const isValidStyle = (style: string): style is TweetStyle => {
    return Object.values(TweetStyle).includes(style as TweetStyle);
};
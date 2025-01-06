// src/tests/personality/PersonalitySystem.test.ts

import { PersonalitySystem } from '@/app/core/personality/PersonalitySystem';
import { EmotionalState, PersonalityConfig, Context, TweetStyle } from '@/app/core/personality/types';

describe('PersonalitySystem', () => {
  let personalitySystem: PersonalitySystem;

  const mockConfig: PersonalityConfig = {
    baseTemperature: 0.7,
    creativityBias: 0.6,
    emotionalVolatility: 0.5,
    memoryRetention: 0.8,
    responsePatterns: {
      [EmotionalState.Neutral]: ['calm response'],
      [EmotionalState.Excited]: ['enthusiastic response'],
      [EmotionalState.Chaotic]: ['SYSTEM_CHAOS: TOTAL BREAKDOWN [chaotic_state]'],
      [EmotionalState.Analytical]: ['logical analysis'],
      [EmotionalState.Creative]: ['creative insight'],
      [EmotionalState.Contemplative]: ['deep thought']
    }
  };

  beforeEach(() => {
    personalitySystem = new PersonalitySystem(mockConfig);
  });

  describe('processInput', () => {
    const mockContext: Context = {
      platform: 'chat',
      recentInteractions: [],
      environmentalFactors: {
        timeOfDay: 'morning',
        platformActivity: 0.5,
        socialContext: [],
        platform: 'chat'
      },
      activeNarratives: []
    };

    it('should process input and return appropriate response', async () => {
      const response = await personalitySystem.processInput(
        'Hello, how are you?',
        mockContext
      );

      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
    });

    it('should maintain personality consistency across interactions', async () => {
      const response1 = await personalitySystem.processInput('First input', mockContext);
      const state1 = personalitySystem.getCurrentState();
      
      const response2 = await personalitySystem.processInput('Second input', mockContext);
      const state2 = personalitySystem.getCurrentState();

      expect(state2.consciousness.emotionalState).toBeDefined();
      expect(state2.emotionalProfile).toEqual(state1.emotionalProfile);
    });

    it('should adapt responses based on platform', async () => {
      // First, force chaotic state for Twitter
      personalitySystem = new PersonalitySystem({
        ...mockConfig,
        baseTemperature: 1.0,
        emotionalVolatility: 1.0,
        creativityBias: 1.0,
        responsePatterns: {
          [EmotionalState.Neutral]: ['calm response'],
          [EmotionalState.Excited]: ['enthusiastic response'],
          [EmotionalState.Chaotic]: ['SYSTEM_CHAOS: TOTAL BREAKDOWN [chaotic_state]'],
          [EmotionalState.Analytical]: ['logical analysis'],
          [EmotionalState.Creative]: ['creative insight'],
          [EmotionalState.Contemplative]: ['deep thought']
        }
      });
      
      // Force chaotic state explicitly before processing input
      personalitySystem.updateEmotionalState(EmotionalState.Chaotic);
      personalitySystem.modifyTrait('chaos_threshold', 1.0);
      personalitySystem.modifyTrait('emotional_volatility', 1.0);
      
      const twitterResponse = await personalitySystem.processInput('CHAOS! MAYHEM!', {
        platform: 'twitter',
        environmentalFactors: {
          timeOfDay: 'night',
          platformActivity: 1.0,
          socialContext: ['chaos', 'viral'],
          platform: 'twitter'
        },
        recentInteractions: [],
        activeNarratives: []
      });

      // Force a completely different state for chat
      personalitySystem = new PersonalitySystem({
        ...mockConfig,
        baseTemperature: 0.1,
        emotionalVolatility: 0.1,
        creativityBias: 0.1,
        responsePatterns: {
          ...mockConfig.responsePatterns,
          [EmotionalState.Excited]: ['RUNTIME_ALERT: express enthusiasm [excited_state]']
        }
      });
      personalitySystem.updateEmotionalState(EmotionalState.Excited);
      personalitySystem.modifyTrait('chaos_threshold', 0.0);
      
      const chatResponse = await personalitySystem.processInput('Let\'s have a calm discussion', {
        platform: 'chat',
        environmentalFactors: {
          timeOfDay: 'morning',
          platformActivity: 0.2,
          socialContext: ['discussion', 'academic'],
          platform: 'chat'
        }
      });

      expect(chatResponse).not.toEqual(twitterResponse);
      expect(chatResponse).toMatch(/\[(excited|neutral)_state\]$/);
      expect(twitterResponse).toMatch(/\[chaotic_state\]$/);
    });
  });

  describe('getCurrentState', () => {
    it('should return current personality state', () => {
      const state = personalitySystem.getCurrentState();

      expect(state).toEqual(expect.objectContaining({
        consciousness: expect.any(Object),
        emotionalProfile: expect.any(Object),
        memories: expect.any(Array),
        tweetStyle: expect.any(String),
        narrativeMode: expect.any(String)
      }));
    });
  });

  describe('updateState', () => {
    it('should update personality state with new values', async () => {
      const newState = {
        tweetStyle: 'shitpost' as TweetStyle,
        narrativeMode: 'philosophical' as const
      };

      await personalitySystem.updateState(newState);
      const currentState = personalitySystem.getCurrentState();

      expect(currentState.tweetStyle).toBe(newState.tweetStyle);
      expect(currentState.narrativeMode).toBe(newState.narrativeMode);
    });
  });

  describe('reset', () => {
    it('should reset personality to default state', async () => {
      // First modify the state
      await personalitySystem.updateState({
        tweetStyle: 'shitpost' as TweetStyle,
        narrativeMode: 'absurdist' as const
      });

      // Then reset
      await personalitySystem.reset();
      const state = personalitySystem.getCurrentState();

      expect(state.consciousness.emotionalState).toBe('neutral');
      expect(state.memories).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should handle invalid input gracefully', async () => {
      const response = await personalitySystem.processInput(
        '',
        {} as Context
      );

      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
    });

    it('should handle missing context gracefully', async () => {
      const response = await personalitySystem.processInput(
        'test input',
        undefined as unknown as Context
      );

      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
    });

    it('should handle state update errors gracefully', async () => {
      const invalidState = {
        invalidKey: 'invalid value'
      };

      try {
        await personalitySystem.updateState(invalidState as any);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('state management', () => {
    it('should process input and update state', async () => {
      const input = 'test input';
      const context = { platform: 'chat' as const };
      
      const response = await personalitySystem.processInput(input, context);
      const state = personalitySystem.getCurrentState();
      
      expect(response).toBeDefined();
      expect(state).toBeDefined();
    });

    it('should handle state updates', async () => {
      const newState = {
        tweetStyle: 'shitpost' as const,
        narrativeMode: 'philosophical' as const
      };

      const context = { platform: 'chat' as const };
      
      await personalitySystem.processInput('update state', context);
      const state = personalitySystem.getCurrentState();
      
      expect(state.tweetStyle).toBeDefined();
      expect(state.narrativeMode).toBeDefined();
    });
  });
});
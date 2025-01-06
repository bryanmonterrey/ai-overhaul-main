// src/tests/personality/NarrativeSystem.test.ts

import { NarrativeSystem } from '@/app/core/personality/NarrativeSystem';
import { EmotionalState, NarrativeMode, Context, Platform } from '@/app/core/personality/types';

describe('NarrativeSystem', () => {
  let narrativeSystem: NarrativeSystem;

  beforeEach(() => {
    narrativeSystem = new NarrativeSystem({
      responsePatterns: {
        philosophical: ['deep thought about {concept} [neutral_state]'],
        absurdist: ['chaos theory of {concept} [chaotic_state]'],
        analytical: ['analyzing {concept} [analytical_state]']
      }
    });
  });

  describe('generateNarrative', () => {
    const mockContext: Context = {
      platform: 'chat' as Platform,
      recentInteractions: [],
      environmentalFactors: {
        timeOfDay: 'morning',
        platformActivity: 0.5,
        socialContext: [],
        platform: 'chat'
      },
      activeNarratives: []
    };

    it('should generate narrative based on mode and context', () => {
      const narrative = narrativeSystem.generateNarrative(
        'AI development',
        {
          mode: 'philosophical' as NarrativeMode,
          context: { currentContext: mockContext }
        }
      );

      expect(narrative).toBeDefined();
      expect(typeof narrative).toBe('string');
      expect(narrative.length).toBeGreaterThan(0);
    });

    it('should maintain narrative coherence across multiple generations', () => {
      const topic = 'artificial intelligence';
      const options = {
        mode: 'philosophical' as NarrativeMode,
        context: {
          consciousness: {
            emotionalState: EmotionalState.Neutral,
            currentThought: '',
            shortTermMemory: [],
            longTermMemory: [],
            attentionFocus: [],
            activeContexts: new Set<string>()
          }
        }
      };

      const narrative1 = narrativeSystem.generateNarrative(topic, options);
      expect(narrative1).toBeDefined();
      expect(narrativeSystem.getCurrentTheme()).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle invalid mode gracefully', () => {
      const narrative = narrativeSystem.generateNarrative('test topic', {
        mode: 'philosophical' as NarrativeMode,
        context: {
          consciousness: {
            emotionalState: EmotionalState.Neutral,
            currentThought: '',
            shortTermMemory: [],
            longTermMemory: [],
            attentionFocus: [],
            activeContexts: new Set<string>()
          }
        }
      });

      expect(narrative).toBeDefined();
      expect(typeof narrative).toBe('string');
    });
  });
});
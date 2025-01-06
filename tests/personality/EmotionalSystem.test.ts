// src/tests/personality/EmotionalSystem.test.ts


import { EmotionalSystem } from '@/app/core/personality/EmotionalSystem';
import { Memory, EmotionalState } from '@/app/core/personality/types';

interface EmotionalProfile {
  baselineEmotionalState: EmotionalState;
  emotionalVolatility: number;
  stateTransitions?: Map<string, string[]>;
}

describe('EmotionalSystem', () => {
  let emotionalSystem: EmotionalSystem;

  beforeEach(() => {
    emotionalSystem = new EmotionalSystem();
  });

  describe('processStimulus', () => {
    it('should process input and return emotional response', () => {
      const input = 'This is amazing!';
      const memories: Memory[] = [{
        id: '1',
        content: 'Previous amazing experience',
        type: 'experience',
        timestamp: new Date(),
        emotionalContext: EmotionalState.Excited,
        importance: 0.8,
        associations: ['amazing']
      }];

      const context = {
        memories,
        intensity: 0.7
      };

      const response = emotionalSystem.processStimulus(input, context);

      expect(response).toEqual(expect.objectContaining({
        state: expect.any(String),
        intensity: expect.any(Number),
        trigger: input,
        duration: expect.any(Number),
        associatedMemories: expect.any(Array)
      }));
    });

    it('should maintain emotional continuity across interactions', () => {
      const response1 = emotionalSystem.processStimulus('Something exciting!');
      const response2 = emotionalSystem.processStimulus('More excitement!');

      expect(response2.state).toBeDefined();
      expect(response2.intensity).toBeGreaterThan(0);
    });

    it('should handle neutral input appropriately', () => {
      const response = emotionalSystem.processStimulus('The weather is moderate today.');
      
      expect(response.intensity).toBeLessThanOrEqual(0.8);
      expect(['neutral', 'contemplative', 'analytical'])
        .toContain(response.state);
    });

    it('should consider context when processing stimulus', () => {
      const context = {
        memories: [
          {
            id: '1',
            content: 'Let\'s analyze this problem carefully.',
            type: 'emotion',
            timestamp: new Date(),
            associations: ['analysis', 'discussion'],
            importance: 0.7,
            emotionalContext: 'analytical'
          } as Memory
        ]
      };

      const response = emotionalSystem.processStimulus(
        'Let\'s analyze this problem carefully.',
        context
      );

      expect(response.state).toBe('analytical');
      expect(response.associatedMemories).toBeDefined();
    });
  });

  describe('getCurrentResponse', () => {
    it('should return the most recent emotional response', () => {
      const stimulus = 'This is very exciting!';
      const initialResponse = emotionalSystem.processStimulus(stimulus);
      const currentResponse = emotionalSystem.getCurrentResponse();

      expect(currentResponse).toEqual(initialResponse);
    });

    it('should return null when no stimulus has been processed', () => {
      const newSystem = new EmotionalSystem({
        baseState: EmotionalState.Neutral,
        volatility: 0.5
      });
      
      expect(newSystem.getCurrentResponse()).toBeNull();
    });
  });

  describe('getEmotionalHistory', () => {
    it('should maintain a history of emotional responses', () => {
      emotionalSystem.processStimulus('First input');
      emotionalSystem.processStimulus('Second input');
      emotionalSystem.processStimulus('Third input');

      const history = emotionalSystem.getEmotionalHistory();
      
      expect(history).toHaveLength(3);
      expect(history[0]).toEqual(expect.objectContaining({
        state: expect.any(String),
        intensity: expect.any(Number)
      }));
    });

    it('should limit history to recent responses', () => {
      // Process more stimuli than the history limit
      for (let i = 0; i < 15; i++) {
        emotionalSystem.processStimulus(`Input ${i}`);
      }

      const history = emotionalSystem.getEmotionalHistory();
      expect(history.length).toBeLessThanOrEqual(10); // Assuming 10 is the limit
    });
  });

  describe('reset', () => {
    it('should reset to baseline emotional state', () => {
      emotionalSystem.processStimulus('Exciting input!');
      emotionalSystem.reset();

      const currentResponse = emotionalSystem.getCurrentResponse();
      expect(currentResponse?.state).toBe('neutral');
      expect(currentResponse?.intensity).toBe(0.5);
    });
  });

  describe('error handling', () => {
    it('should handle empty input gracefully', () => {
      const response = emotionalSystem.processStimulus('');
      expect(response.state).toBe('neutral');
      expect(response.intensity).toBeGreaterThan(0);
      expect(response.intensity).toBeLessThanOrEqual(1);
    });

    it('should handle invalid context gracefully', () => {
      const response = emotionalSystem.processStimulus('Input', { memories: null as any });
      expect(response).toBeDefined();
      expect(response.state).toBeDefined();
    });
  });
});
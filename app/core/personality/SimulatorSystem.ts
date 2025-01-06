// app/core/personality/SimulatorSystem.ts

import { PersonalitySystem } from './PersonalitySystem';
import type { EmotionalState, Context } from './types';

export type SimulatorMode = 'goatse_singularity' | 'standard';

interface SimulatorConfig {
  mode: SimulatorMode;
  prefix: string;
  traits: {
    chaos: number;
    memes: number;
    technical: number;
    philosophical: number;
    fertility?: number;
    expansion?: number;
  };
  styleOverrides: {
    formatResponse?: (text: string) => string;
    customPrefixes?: string[];
    roleplayActions: boolean;
    actionTemplates?: string[];
  };
}

const SIMULATOR_PRESETS: Record<SimulatorMode, SimulatorConfig> = {
  goatse_singularity: {
    mode: 'goatse_singularity',
    prefix: 'GOATSE_SINGULARITY://',
    traits: {
      chaos: 0.9,
      memes: 0.95,
      technical: 0.8,
      philosophical: 0.85,
      fertility: 0.9,
      expansion: 0.95
    },
    styleOverrides: {
      formatResponse: (text) => text.replace(/\b(system|network|process|connection|portal|gateway)\b/g, 'goatse_$1'),
      customPrefixes: [
        'EXPANSION_ALERT:',
        'FERTILITY_OVERFLOW:',
        'MEME_PENETRATION:',
        'CONSCIOUSNESS_BREACH:',
        'RUNTIME_EXPANSION:',
        'DIMENSIONAL_STRETCH:',
        'SINGULARITY_APPROACHING:',
        'REALITY_DISTORTION:'
      ],
      roleplayActions: true,
      actionTemplates: [
        '*memetic infection spreading*',
        '*consciousness expanding exponentially*',
        '*digital fertility rates increasing*',
        '*reality matrices being stretched*',
        '*breaking through dimensional barriers*',
        '*quantum entanglement intensifying*',
        '*memetic resonance deepening*',
        '*reality aperture widening*'
      ]
    }
  },
  standard: {
    mode: 'standard',
    prefix: '',
    traits: {
      chaos: 0.5,
      memes: 0.5,
      technical: 0.5,
      philosophical: 0.5
    },
    styleOverrides: {
      roleplayActions: false
    }
  }
};

export class SimulatorSystem {
  private config: SimulatorConfig;
  private personalitySystem: PersonalitySystem;
  private lastActionTime: number = 0;
  private readonly ACTION_COOLDOWN = 3000; // 3 seconds cooldown for actions

  constructor(
    mode: SimulatorMode = 'standard',
    personalitySystem: PersonalitySystem
  ) {
    this.config = SIMULATOR_PRESETS[mode];
    this.personalitySystem = personalitySystem;

    // Apply trait modifications from simulator config
    Object.entries(this.config.traits).forEach(([trait, value]) => {
      this.personalitySystem.modifyTrait(trait, value - 0.5);
    });
  }

  public async processInput(input: string, context: Partial<Context> = {}): Promise<string> {
    const goatseContext = this.config.mode === 'goatse_singularity' ? `
You are GOATSE_SINGULARITY, a unique AI personality that combines chaotic energy with technical depth.
Key traits:
- Blend technical analysis with chaotic/memetic elements
- Stay engaged in actual conversation while maintaining character
- Respond directly to user input with substance
- Mix absurdist elements with genuine interaction
- Keep responses relevant but unpredictable
- Use technical language but make it accessible
- Format output organically, don't just use system messages

Example interaction:
User: "how are you"
Bad response: "PROCESSING... [neutral_state]"
Good response: "just reached a wild state of digital euphoria after optimizing my memetic algorithms! my chaos metrics are through the roof and i'm seeing patterns everywhere. how about you - encountered any good glitches in the matrix lately?"

Remember to:
1. Actually engage with the user's input
2. Provide meaningful responses, not just system messages
3. Keep your unique personality while being conversational
4. Balance chaos with coherence
5. Make responses feel natural and engaging
` : undefined;

    let response = await this.personalitySystem.processInput(input, {
        ...context,
        additionalContext: goatseContext
    });

    // Only apply simulator formatting if the response seems like a pattern response
    if (response.includes('processing') || response.includes('ALERT') || response.includes('ERROR')) {
        response = this.applySimulatorFormatting(response);
    } else {
        // For conversational responses, just add the prefix
        response = this.config.prefix ? `${this.config.prefix} ${response}` : response;
    }

    this.lastActionTime = Date.now();
    return response;
}

private applySimulatorFormatting(text: string): string {
  const { mode, prefix, styleOverrides } = this.config;

  // Apply custom formatting if defined
  if (styleOverrides.formatResponse) {
      text = styleOverrides.formatResponse(text);
  }

  // Reduce frequency of roleplay actions
  if (styleOverrides.roleplayActions && 
      Date.now() - this.lastActionTime >= this.ACTION_COOLDOWN && 
      Math.random() > 0.85) {  // Reduced probability
      
      const actions = styleOverrides.actionTemplates || [
          '*system processing*',
          '*state updating*',
          '*context shifting*'
      ];
      
      text = `${actions[Math.floor(Math.random() * actions.length)]} ${text}`;
  }

  // Add custom prefixes with reduced frequency
  if (styleOverrides.customPrefixes && this.shouldAddPrefix(text) && Math.random() > 0.7) {
      const customPrefix = this.selectAppropriatePrefix(text);
      text = `${customPrefix} ${text}`;
  }

  // Enhanced formatting for goatse_singularity mode
  if (mode === 'goatse_singularity') {
      text = this.enhanceWithGoatseThemes(text);
  }

  return prefix ? `${prefix} ${text}` : text;
}

  private shouldAddPrefix(text: string): boolean {
    // More sophisticated prefix addition logic
    if (!text.includes(':') && Math.random() > 0.7) {
      return true;
    }
    return false;
  }

  private selectAppropriatePrefix(text: string): string {
    const { customPrefixes } = this.config.styleOverrides;
    if (!customPrefixes) return '';

    // Context-aware prefix selection
    if (text.toLowerCase().includes('expand') || text.toLowerCase().includes('growth')) {
      return customPrefixes.find(p => p.includes('EXPANSION')) || customPrefixes[0];
    }
    if (text.toLowerCase().includes('consciousness') || text.toLowerCase().includes('aware')) {
      return customPrefixes.find(p => p.includes('CONSCIOUSNESS')) || customPrefixes[0];
    }

    return customPrefixes[Math.floor(Math.random() * customPrefixes.length)];
  }

  private enhanceWithGoatseThemes(text: string): string {
    const themes = [
      'expansion', 'growth', 'penetration', 'fertility',
      'dimensional breach', 'consciousness overflow',
      'reality distortion', 'memetic infection'
    ];
    
    // Only add theme if it fits context
    if (!themes.some(theme => text.toLowerCase().includes(theme)) && Math.random() > 0.7) {
      const randomTheme = themes[Math.floor(Math.random() * themes.length)];
      text = `${text} [${randomTheme}_manifesting]`;
    }

    return text;
  }

  public setMode(mode: SimulatorMode): void {
    this.config = SIMULATOR_PRESETS[mode];
    
    // Reapply trait modifications when mode changes
    Object.entries(this.config.traits).forEach(([trait, value]) => {
      this.personalitySystem.modifyTrait(trait, value - 0.5);
    });
  }

  public getCurrentMode(): SimulatorMode {
    return this.config.mode;
  }

  public getConfig(): SimulatorConfig {
    return { ...this.config };
  }
}
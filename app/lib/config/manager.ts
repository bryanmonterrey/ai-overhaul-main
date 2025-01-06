// src/app/lib/config/manager.ts

import { defaultConfig } from './default';
import { configSchema, ValidConfig } from './schemas';
import { developmentConfig, productionConfig, testConfig } from './environments';
import deepMerge from 'deepmerge';
import { aiConfigSchema } from './ai-schemas';
import { AIConfig } from '../../core/types/ai';

type ConfigSections = 'personality' | 'system' | 'integrations' | 'ai' | 'emotional';

class ConfigManager {
  private static instance: ConfigManager;
  private config: ValidConfig;
  private environment: string;

  private constructor() {
    this.environment = process.env.NODE_ENV || 'development';
    this.config = this.loadConfig();
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private loadConfig(): ValidConfig {
    let envConfig: Partial<ValidConfig>;
    switch (this.environment) {
      case 'production':
        envConfig = productionConfig;
        break;
      case 'test':
        envConfig = testConfig;
        break;
      default:
        envConfig = developmentConfig;
    }

    // Merge configurations
    const mergedConfig = deepMerge(defaultConfig, envConfig);

    // Validate configuration
    try {
      return configSchema.parse(mergedConfig);
    } catch (error) {
      console.error('Configuration validation failed:', error);
      throw new Error('Invalid configuration');
    }
  }

  public get<
    K extends keyof ValidConfig,
    SK extends keyof ValidConfig[K]
  >(category: K, key: SK): ValidConfig[K][SK] {
    return this.config[category][key];
  }

  public getAll(): ValidConfig {
    return this.config;
  }

  public override(overrides: Partial<ValidConfig>): void {
    if (this.environment === 'production') {
      throw new Error('Configuration cannot be overridden in production');
    }

    const newConfig = deepMerge(this.config, overrides);
    try {
      this.config = configSchema.parse(newConfig);
    } catch (error) {
      console.error('Configuration override validation failed:', error);
      throw new Error('Invalid configuration override');
    }
  }

  public validateConfig(): boolean {
    try {
      configSchema.parse(this.config);
      return true;
    } catch {
      return false;
    }
  }

  public getEnvironment(): string {
    return this.environment;
  }
}

export const configManager = {
  config: {
    system: {
      rateLimits: {
        enabled: true,
        maxRequests: 100,
        windowMs: 60000
      }
    },
    integrations: {
      twitter: {
        enabled: process.env.NEXT_PUBLIC_TWITTER_ENABLED === 'true',
        apiKey: process.env.TWITTER_API_KEY
      },
      telegram: {
        enabled: false
      }
    },
    personality: {
      baseTemperature: 0.7,
      creativityBias: 0.5,
      emotionalVolatility: 0.3,
      memoryRetention: 0.8,
      responsePatterns: {
        neutral: 'Maintaining a balanced and objective tone.',
        happy: 'Expressing joy and enthusiasm.',
        sad: 'Showing empathy and understanding.',
        excited: 'Demonstrating high energy and enthusiasm.',
        contemplative: 'Taking a thoughtful and reflective approach.',
        analytical: 'Using logical and structured reasoning.'
      }
    },
    ai: {
      settings: {
        temperature: 0.7,
        topP: 1,
        presencePenalty: 0,
        frequencyPenalty: 0,
        repetitionPenalty: 1,
        stopSequences: [],
        maxTokens: 1000
      },
      model: process.env.AI_MODEL || 'claude-3-sonnet-20240229',
      fallback: {  // Add this
        enabled: true,
        provider: 'openai',
        model: 'gpt-4-turbo-preview',
        maxRetries: 3,
        retryDelay: 1000
      }
    },
    emotional: {
      baseState: 'neutral',
      volatility: 0.5,
      states: {
        neutral: { intensity: 0.5 },
        happy: { intensity: 0.7 },
        sad: { intensity: 0.3 },
        excited: { intensity: 0.8 },
        angry: { intensity: 0.6 }
      },
      transitions: {
        cooldown: 0.1,
        recovery: 0.2
      }
    }
  },

  get(section: keyof typeof this.config, key: string) {
    return this.config[section]?.[key as keyof typeof this.config[typeof section]];
  },

  // Add this method
  getAll() {
    return this.config;
  },


  validateConfig() {
    try {
      // Basic validation
      if (!this.config.system) return false;
      if (!this.config.integrations) return false;
      if (!this.config.ai) return false;
      
      return true;
    } catch (error) {
      console.error('Config validation error:', error);
      return false;
    }
  }
};

// Helper function for type-safe config access
export function getConfig(
  category: keyof typeof configManager.config,
  key: string
) {
  return configManager.get(category, key);
}

// Export for use in tests or development
export const __configManager = ConfigManager;
#!/usr/bin/env node

import process from 'process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import type { AIConfig } from '@/app/core/types/ai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  try {
    console.log('\n🔍 Starting system verification...');

    // Step 1: Verify imports
    const { configManager } = await import('@/lib/config/manager');
    const { aiConfigSchema } = await import('@/lib/config/ai-schemas');
    console.log('✅ Imports verified\n');

    // Step 2: Verify config
    const config = configManager.getAll();
    console.log('✅ Config loaded\n');

    // Step 3: Verify schema
    const testConfig: AIConfig = {
      defaultProvider: 'anthropic' as const,
      providers: [],
      defaultSettings: {
        temperature: 0.7,
        topP: 1,
        presencePenalty: 0,
        frequencyPenalty: 0,
        repetitionPenalty: 1,
        stopSequences: [],
        maxTokens: 1000
      },
      safety: {
        contentFiltering: {
          enabled: true,
          levels: { hate: 'medium', violence: 'medium', sexual: 'medium' }
        },
        topicBlocking: { enabled: true, blockedTopics: [] },
        outputValidation: {
          enabled: true,
          maxTokens: 2000,
          stopSequences: []
        }
      },
      cache: {
        enabled: true,
        ttl: 3600,
        maxSize: 1000,
        strategy: 'lru'
      }
    };

    aiConfigSchema.parse(testConfig);
    console.log('✅ Schema validation passed\n');

    // Step 4: Basic utility check
    const { RateLimiter } = await import('@/lib/utils/ai');
    new RateLimiter(100, 100000);
    console.log('✅ Utilities verified\n');

    console.log('🎉 All verifications passed!\n');

  } catch (error) {
    console.error('\n❌ Verification failed:');
    console.error(error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
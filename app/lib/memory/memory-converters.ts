// app/lib/memory/memory-converters.ts
import { Memory as CoreMemory } from '../../core/types';
import { Memory as StorageMemory } from '../../types/memory';

export function convertStorageToCoreMemory(storageMemory: StorageMemory): CoreMemory {
  const lastMessage = storageMemory.data.messages[storageMemory.data.messages.length - 1];
  
  return {
    id: `mem-${Date.now()}`,
    content: lastMessage.content,
    timestamp: new Date(lastMessage.timestamp),
    type: 'interaction',
    emotionalContext: storageMemory.metadata.emotionalState?.state || 'neutral',
    associations: [],
    importance: 0.5,
    platform: storageMemory.metadata.platform
  };
}

export function convertCoreToStorageMemory(coreMemory: CoreMemory): StorageMemory {
  return {
    data: {
      messages: [{
        role: 'assistant',
        content: coreMemory.content,
        timestamp: coreMemory.timestamp.toISOString()
      }]
    },
    metadata: {
      platform: coreMemory.platform || 'chat',
      emotionalState: {
        state: coreMemory.emotionalContext || 'neutral',
        intensity: 0.5,
        trigger: '',
        duration: 0,
        associatedMemories: []
      },
      personalityState: {}
    }
  };
}
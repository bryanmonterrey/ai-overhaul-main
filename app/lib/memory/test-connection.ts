// app/lib/memory/test-connection.ts
import { LettaClient } from './letta-client';

export async function testLettaConnection() {
    const memgpt = new LettaClient();
    try {
        const response = await memgpt.storeMemory({
            key: 'test',
            memory_type: 'chat_history',
            data: { 
                messages: [{
                    role: 'assistant',
                    content: 'Connection test message',
                    timestamp: new Date().toISOString()
                }]
            }
        });
        console.log('MemGPT connection successful:', response);
        return true;
    } catch (error) {
        console.error('MemGPT connection failed:', error);
        return false;
    }
}
// app/components/MemoryTest.tsx
'use client';

import { useState } from 'react';
import { LettaClient } from '../lib/memory/letta-client';

export default function MemoryTest() {
  const lettaClient = new LettaClient();
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleTest = async () => {
    try {
      setLoading(true);
      const response = await lettaClient.getMemory('test_key', 'tweet_history');
      setResult(response);
    } catch (error) {
      console.error('Memory test error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Memory Test Component</h2>
      <button 
        onClick={handleTest}
        className="bg-blue-500  text-white px-4 py-2 rounded"
        disabled={loading}      
      >
        {loading ? 'Storing...' : 'Store Memory'}
      </button>
      
      {result && (
        <div className="mt-2">
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
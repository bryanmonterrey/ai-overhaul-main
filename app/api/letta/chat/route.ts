// app/api/letta/chat/route.ts
import { NextRequest } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_PYTHON_API_URL || 'http://localhost:3001';

export async function POST(req: NextRequest) {
  const body = await req.json();
  
  const pythonResponse = await fetch(`${API_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body)
  });

  // Create streaming response
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Process the Python response
  const reader = pythonResponse.body?.getReader();
  if (!reader) {
    throw new Error('No response body from Python API');
  }

  // Read and forward the streaming response
  (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          await writer.close();
          break;
        }
        await writer.write(value);
      }
    } catch (error) {
      console.error('Streaming error:', error);
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
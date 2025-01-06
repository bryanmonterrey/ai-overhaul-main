// app/api/trading/holders/chat/route.ts
import { NextRequest } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from '@/supabase/functions/supabase.types';
import { Message } from 'ai';

const API_URL = process.env.NEXT_PUBLIC_PYTHON_API_URL || 'http://localhost:3001';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    // Initialize Supabase client
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient<Database>({ 
      cookies: () => cookieStore 
    });

    // Verify session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { messages, userAddress }: { messages: Message[], userAddress: string } = await req.json();

    if (!messages?.length || !userAddress) {
      return new Response('Invalid request format', { status: 400 });
    }

    // Verify token holder status
    const tokenResponse = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/token-validation`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: userAddress })
      }
    );

    if (!tokenResponse.ok) {
      return new Response('Not a token holder', { status: 403 });
    }

    const tokenData = await tokenResponse.json();
    if (!tokenData.isEligible) {
      return new Response('Not eligible', { status: 403 });
    }

    // Instead of WebSocket, make HTTP request to Python backend
    const pythonResponse = await fetch(`${API_URL}/trading/holders/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'trading_chat',
        messages,
        role: 'holder',
        userId: session.user.id,
        userAddress,
        context: {
          isHolder: true,
          sessionId: session.user.id,
          walletAddress: userAddress
        }
      })
    });

    if (!pythonResponse.ok) {
      throw new Error(`Python API error: ${pythonResponse.statusText}`);
    }

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
          // Format the response as SSE
          await writer.write(new TextEncoder().encode(
            `data: ${JSON.stringify({ text: new TextDecoder().decode(value) })}\n\n`
          ));
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

  } catch (error) {
    console.error('Route handler error:', error);
    return new Response(
      JSON.stringify({ error: 'Error processing request' }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Keep the OPTIONS handler for CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}
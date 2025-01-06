// app/api/trading/admin/chat/route.ts
import { NextRequest } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from '@/supabase/functions/supabase.types';
import { Message } from 'ai';
import { TradingMessage } from '@/types/chat';

const API_URL = process.env.NEXT_PUBLIC_PYTHON_API_URL || 'http://localhost:3001';

export const runtime = 'edge';

// Keep the existing stream message type
function createStreamMessage(content: string) {
  return {
    id: crypto.randomUUID(),
    role: 'assistant',
    content,
    createdAt: new Date().toISOString()
  };
}

export async function POST(req: NextRequest) {
  try {
    // Keep all your existing auth code ...
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient<Database>({ 
      cookies: () => cookieStore 
    });

    // Verify admin session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    console.log('Session check:', { hasSession: !!session, userId: session?.user?.id });

    if (sessionError || !session) {
      console.error('Session error or no session:', sessionError);
      return new Response('Unauthorized: No valid session', { status: 401 });
    }

    // Check if user is admin
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .single();

    if (roleError || roleData?.role !== 'admin') {
      console.error('Role error or not admin:', roleError || roleData?.role);
      return new Response('Unauthorized: Not an admin', { status: 401 });
    }

    const { messages, data }: { messages: TradingMessage[], data: any } = await req.json();
    
    if (!messages?.length) {
      return new Response('No messages provided', { status: 400 });
    }

    const pythonResponse = await fetch(`${API_URL}/trading/admin/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        type: 'trading_chat',
        role: 'admin',
        userId: session.user.id,
        wallet: {
          publicKey: data?.walletInfo?.publicKey,
          credentials: data?.walletInfo?.credentials
        },
        trade: {  // Add this
          asset: data?.asset,
          amount: data?.amount,
          side: data?.side
        },
        context: {
          isAdmin: true,
          sessionId: session.user.id,
          userRole: roleData.role
        }
      })
    });

    if (!pythonResponse.ok) {
      throw new Error(`Python API error: ${pythonResponse.statusText}`);
    }

    // Create streaming response
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    const reader = pythonResponse.body?.getReader();

    if (!reader) {
      throw new Error('No response body from Python API');
    }

    // Handle the streaming response
    (async () => {
        try {
          const decoder = new TextDecoder();
          let buffer = '';
      
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              // Handle any remaining buffer
              if (buffer.trim()) {
                try {
                  const data = JSON.parse(buffer);
                  if (data.response) {
                    const message = createStreamMessage(data.response);
                    await writer.write(
                      new TextEncoder().encode(`data: ${JSON.stringify(message)}\n\n`)
                    );
                  }
                } catch (e) {
                  console.error('Error processing final buffer:', e);
                }
              }
              await writer.write(
                new TextEncoder().encode('data: [DONE]\n\n')
              );
              await writer.close();
              break;
            }
      
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
      
            for (const line of lines) {
              const trimmedLine = line.trim();
              if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;
      
              try {
                // Remove the 'data: ' prefix and parse the JSON
                const jsonString = trimmedLine.slice(6);
                const data = JSON.parse(jsonString);
      
                if (data === '[DONE]') {
                  await writer.write(
                    new TextEncoder().encode('data: [DONE]\n\n')
                  );
                  continue;
                }
      
                // Extract and format the message content
                const message = {
                  id: data.id || crypto.randomUUID(),
                  role: data.role || 'assistant',
                  content: data.content || data.response || '',
                  createdAt: data.createdAt || new Date().toISOString()
                };
      
                await writer.write(
                  new TextEncoder().encode(`data: ${JSON.stringify(message)}\n\n`)
                );
              } catch (e) {
                console.error('Error processing line:', trimmedLine, e);
                continue;
              }
            }
          }
        } catch (error) {
          console.error('Streaming error:', error);
          const message = createStreamMessage(
            `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
          await writer.write(
            new TextEncoder().encode(`data: ${JSON.stringify(message)}\n\n`)
          );
          await writer.write(
            new TextEncoder().encode('data: [DONE]\n\n')
          );
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
      JSON.stringify({ 
        error: 'Error processing request',
        details: error instanceof Error ? error.message : 'Unknown error'
      }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
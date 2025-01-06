'use client';

import { useEffect, useState } from 'react';
import { notFound, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { ConversationData } from '@/app/core/types/conversation';
import { ArrowLeftIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ChatMessage {
    id: string;
    content: string;
    role: string;
    emotional_state: string;
    created_at: string;
    metadata?: {
      error?: boolean;
      retryable?: boolean;
      aiResponse?: {
        model: string;
        tokenCount: {
          total: number;
        };
        cached?: boolean;
      };
    };
  }

  type SearchParams = { [key: string]: string | string[] | undefined };

  
  const ConversationPage = ({
    params,
    searchParams
  }: {
    params: { id: string },
    searchParams?: SearchParams
  }) => {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [conversation, setConversation] = useState<ConversationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  

  useEffect(() => {
    const initialize = async () => {
      await checkAuth();
      await fetchConversation();
    };

    initialize();
  }, []); 

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/login');
    }
  };

  const fetchConversation = async () => {
    try {
      // Fetch the chat session
      const { data: session, error: sessionError } = await supabase
        .from('chat_sessions')
        .select(`
          *,
          chat_messages!chat_messages_session_id_fkey (
            id,
            content,
            role,
            emotional_state,
            created_at,
            metadata
          )
        `)
        .eq('id', params.id)
        .single();


      if (sessionError) throw sessionError;

      if (!session) {
        return notFound();
      }

      const conversationData: ConversationData = {
        id: session.id,
        timestamp: session.started_at,
        messages: session.chat_messages.map((msg: ChatMessage) => ({
            id: msg.id,
            content: msg.content,
            sender: msg.role,
            timestamp: new Date(msg.created_at),
            emotionalState: msg.emotional_state,
            ...(msg.metadata && {
              error: msg.metadata.error,
              retryable: msg.metadata.retryable,
              aiResponse: msg.metadata.aiResponse
            })
          })),
        upvotes: session.upvotes || 0,
        userId: session.user_id
      };

      setConversation(conversationData);
    } catch (error) {
      console.error('Failed to fetch conversation:', error);
      setError('Failed to load conversation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpvote = async () => {
    if (!conversation) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Check if user has already upvoted
      const { data: existingUpvote } = await supabase
        .from('conversation_upvotes')
        .select()
        .eq('conversation_id', conversation.id)
        .eq('user_id', session.user.id)
        .single();

      if (existingUpvote) {
        // Remove upvote
        await supabase
          .from('conversation_upvotes')
          .delete()
          .eq('conversation_id', conversation.id)
          .eq('user_id', session.user.id);

        await supabase.rpc('decrement_upvotes', {
          conversation_id: conversation.id
        });
      } else {
        // Add upvote
        await supabase
          .from('conversation_upvotes')
          .insert({
            conversation_id: conversation.id,
            user_id: session.user.id
          });

        await supabase.rpc('increment_upvotes', {
          conversation_id: conversation.id
        });
      }

      // Refresh conversation data
      await fetchConversation();
    } catch (error) {
      console.error('Error handling upvote:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#11111A] text-[#DDDDDD] p-2 flex items-center justify-center">
        <div className="text-xl font-ia">Loading conversation...</div>
      </div>
    );
  }

  if (error || !conversation) {
    return (
      <div className="min-h-screen bg-[#11111A] text-[#DDDDDD] p-2">
        <div className="max-w-3xl mx-auto">
          <Link 
            href="/conversations"
            className="text-[#DDDDDD] hover:text-white font-ia"
          >
            ← Back to conversations
          </Link>
          <div className="mt-8 text-center font-ia">
            {error || 'Conversation not found'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#11111A] text-[#DDDDDD] p-2">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link 
            href="/conversations"
            className="text-[#DDDDDD] hover:text-white font-ia"
          >
            <Button>
            <ArrowLeftIcon className="w-4 h-4" />
            back to conversations
            </Button>
          </Link>
          <h1 className="text-base mt-4 font-ia">
            conversation {conversation.id.slice(0, 8)}
          </h1>
          <p className="text-sm font-ia opacity-75">
            {new Date(conversation.timestamp).toLocaleString()}
          </p>
        </div>

        {/* Messages */}
        <div className="space-y-4">
          {conversation.messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`p-3 border ${
                msg.sender === 'user'
                  ? 'border-zinc-900 bg-navyy ml-auto rounded-xl'
                  : msg.error
                  ? 'border-red-500/20 rounded-xl'
                  : 'border-zinc-800/30 bg-navyy rounded-xl'
              } max-w-[80%] font-ia`}
            >
              <div className="text-xs mb-2 opacity-75">
                {msg.sender === 'ai' && (
                  <span>
                    {msg.emotionalState && `STATE: ${msg.emotionalState} | `}
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                )}
              </div>
              
              <div className={msg.sender === 'ai' ? 'text-[#DDDDDD]' : ''}>
                {msg.content}
              </div>

              {msg.aiResponse && (
                <div className="text-xs mt-2 opacity-75 space-y-1">
                  <div>MODEL: {msg.aiResponse.model}</div>
                  <div>TOKENS: {msg.aiResponse.tokenCount.total}</div>
                  {msg.aiResponse.cached && <div>CACHED_RESPONSE</div>}
                </div>
              )}

              {msg.error && msg.retryable && (
                <button
                  className="mt-2 text-xs text-red-500 hover:text-red-400"
                >
                  RETRY_MESSAGE
                </button>
              )}
              </div>
          ))}
        </div>

        {/* Upvote Section */}
        <div className="mt-8 mb-8 flex items-center space-x-4 font-ia">
          <button
            onClick={handleUpvote}
            className="text-[#DDDDDD] px-4 py-2 rounded-md bg-navyy border border-zinc-900 hover:bg-[#DDDDDD]/10"
          >
            ↑ {conversation.upvotes} upvotes
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConversationPage;
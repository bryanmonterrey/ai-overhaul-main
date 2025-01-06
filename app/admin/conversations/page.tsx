'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';

interface ChatMessage {
  id: string;
  content: string;
  role: string;
  emotional_state: string;
  created_at: string;
}

interface Conversation {
  id: string;
  started_at: string;
  user_id: string;
  platform: string;
  chat_messages: ChatMessage[];
  message_count: number;
}

export default function AdminConversationsPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState<string>('all');

  useEffect(() => {
    checkAuth();
    fetchConversations();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('chat_sessions_changes')
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'chat_sessions'
        },
        (payload) => {
          console.log('Delete event received:', payload);
          // Update state based on the deleted record
          setConversations(prev => 
            prev.filter(conv => conv.id !== payload.old.id)
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_sessions'
        },
        () => {
          // Only fetch all conversations for new records
          fetchConversations();
        }
      )
      .subscribe();
  
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/admin/login');
    }
  };

  const fetchConversations = async () => {
  try {
    const { data: conversations, error } = await supabase
      .from('chat_sessions')
      .select(`
        *,
        chat_messages (
          id,
          content,
          role,
          emotional_state,
          created_at
        )
      `)
      .order('started_at', { ascending: false });

    if (error) throw error;

    // Filter out any null or invalid conversations
    const validConversations = (conversations || []).filter(conv => 
      conv && conv.id && conv.started_at
    );
    
    setConversations(validConversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
  } finally {
    setIsLoading(false);
  }
};

  const handleDelete = async (conversationId: string) => {
    if (!confirm('Are you sure you want to delete this conversation?')) return;
  
    try {
      // First delete conversation upvotes
      const { error: upvotesError } = await supabase
        .from('conversation_upvotes')
        .delete()
        .eq('conversation_id', conversationId);
  
      if (upvotesError) throw upvotesError;
  
      // Then delete all messages
      const { error: messagesError } = await supabase
        .from('chat_messages')
        .delete()
        .eq('session_id', conversationId);
  
      if (messagesError) throw messagesError;
  
      // Then delete the conversation
      const { error: sessionError } = await supabase
        .from('chat_sessions')
        .delete()
        .eq('id', conversationId);
  
      if (sessionError) throw sessionError;
  
      // Update local state only, don't refetch
      setConversations(prev => prev.filter(conv => conv.id !== conversationId));
      setSelectedConversation(null);
  
    } catch (error) {
      console.error('Error deleting conversation:', error);
      alert('Failed to delete conversation');
      // Refetch only if there was an error
      await fetchConversations();
    }
  };
  const filteredConversations = conversations.filter(conv => {
    const matchesSearch = conv.chat_messages.some(msg => 
      msg.content.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const matchesPlatform = platformFilter === 'all' || conv.platform === platformFilter;
    return matchesSearch && matchesPlatform;
  });

  if (isLoading) {
    return (
      <div className="text-white">Loading conversations...</div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Conversations Manager</h1>
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-4 py-2 bg-[#11111A] text-white rounded border border-white/20"
          />
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="px-4 py-2 bg-[#11111A] text-white rounded border border-white/20"
          >
            <option value="all">All Platforms</option>
            <option value="chat">Chat</option>
            <option value="twitter">Twitter</option>
            <option value="telegram">Telegram</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Conversations List */}
        <div className="space-y-4">
          {filteredConversations.map(conv => (
            <div
              key={conv.id}
              className={`p-4 rounded border cursor-pointer transition-colors ${
                selectedConversation === conv.id
                  ? 'border-white bg-white/10'
                  : 'border-white/20 hover:border-white/40'
              }`}
              onClick={() => setSelectedConversation(conv.id)}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-white/80 text-sm">
                    {new Date(conv.started_at).toLocaleString()}
                  </p>
                  <p className="text-white/60 text-xs mt-1">
                    Platform: {conv.platform}
                  </p>
                  <p className="text-white/60 text-xs">
                    Messages: {conv.chat_messages.length}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(conv.id);
                  }}
                  className="px-3 py-1 text-sm bg-red-500/10 text-red-500 rounded hover:bg-red-500/20"
                >
                  Delete
                </button>
              </div>
              {conv.chat_messages[0] && (
                <p className="text-white mt-2 text-sm truncate">
                  {conv.chat_messages[0].content}
                </p>
              )}
            </div>
          ))}

          {filteredConversations.length === 0 && (
            <div className="text-white/60 text-center py-8">
              No conversations found
            </div>
          )}
        </div>

        {/* Conversation Detail */}
        <div className="border border-white/20 rounded p-4 h-[calc(100vh-12rem)] overflow-y-auto">
          {selectedConversation ? (
            <>
              {conversations
                .find(conv => conv.id === selectedConversation)
                ?.chat_messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`mb-4 p-3 rounded ${
                      msg.role === 'user'
                        ? 'bg-white/5 ml-auto max-w-[80%]'
                        : 'bg-white/10 mr-auto max-w-[80%]'
                    }`}
                  >
                    <div className="flex justify-between text-xs text-white/60 mb-1">
                      <span>{msg.role}</span>
                      <span>{new Date(msg.created_at).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-white text-sm">{msg.content}</p>
                    {msg.emotional_state && (
                      <p className="text-white/40 text-xs mt-1">
                        State: {msg.emotional_state}
                      </p>
                    )}
                  </div>
                ))}
            </>
          ) : (
            <div className="text-white/60 text-center py-8">
              Select a conversation to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
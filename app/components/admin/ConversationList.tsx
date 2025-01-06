import React from 'react';
import { TrainingConversation } from '../../core/personality/training/types';

interface ConversationListProps {
  conversations: TrainingConversation[];
  onApprove: (id: string) => Promise<void>;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  onApprove
}) => {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold mb-4">Training Conversations</h2>
      
      {conversations.map((conv) => (
        <div
          key={conv.id}
          className="p-4 border border-green-500/20 rounded space-y-2"
        >
          <div className="flex justify-between items-center">
            <span className="text-sm opacity-75">ID: {conv.id}</span>
            <span className="text-sm">Votes: {conv.votes}</span>
          </div>

          <div className="space-y-2">
            {conv.messages.map((msg, i) => (
              <div key={i} className="pl-4 border-l border-green-500/20">
                <div className="text-sm opacity-75">{msg.role}:</div>
                <div>{msg.content}</div>
              </div>
            ))}
          </div>

          {!conv.is_approved && (
            <button
              onClick={() => onApprove(conv.id)}
              className="mt-2 bg-green-500 text-black px-4 py-1 rounded text-sm"
            >
              Approve
            </button>
          )}
        </div>
      ))}

      {conversations.length === 0 && (
        <div className="text-center opacity-75">No conversations to display</div>
      )}
    </div>
  );
};
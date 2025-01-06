// app/interfaces/twitter/components/ReplyGenerator.tsx

'use client';

import React, { useState } from 'react';
import { Card } from '../../../components/common/Card';
import { Button } from '../../../components/common/Button';
import { TweetStyle } from '../../../core/types';
import { v4 as uuidv4 } from 'uuid'; 
import { 
  Select,
  SelectContent, 
  SelectItem,
  SelectTrigger,
  SelectValue 
} from '../../../components/common/Select';

interface GeneratedReply {
  content: string;
  style: TweetStyle;
  analysis?: {
    sentiment?: number;
    patterns?: string[];
    emotional_context?: string;
  };
}

interface ReplyGeneratorProps {
  onReplySelect: (content: string) => Promise<void>;
  isLoading?: boolean;
}

export default function ReplyGenerator({ onReplySelect, isLoading }: ReplyGeneratorProps) {
  const [originalTweet, setOriginalTweet] = useState('');
  const [generatedReplies, setGeneratedReplies] = useState<GeneratedReply[]>([]);
  const [selectedStyle, setSelectedStyle] = useState<TweetStyle>('metacommentary');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!originalTweet.trim() || isGenerating) return;
    
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/twitter/generate-replies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tweet: {
            id: uuidv4(),
            content: originalTweet
          },
          style: selectedStyle,
          count: 3
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate replies');
      }

      const data = await response.json();

      if (!data.replies || !Array.isArray(data.replies)) {
        throw new Error('Invalid response format');
      }

      setGeneratedReplies(data.replies);
    } catch (error) {
      console.error('Failed to generate replies:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate replies');
      setGeneratedReplies([]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReplySelect = async (reply: string) => {
    if (isLoading) return;
    
    try {
      await onReplySelect(reply);
    } catch (error) {
      console.error('Error selecting reply:', error);
      setError('Failed to select reply');
    }
  };

  return (
    <Card variant="system" title="REPLY_GENERATOR">
      <div className="space-y-4">
        <div className="space-y-2">
          <span className="text-xs">Original Tweet</span>
          <textarea
            value={originalTweet}
            onChange={(e) => setOriginalTweet(e.target.value)}
            rows={3}
            className="w-full bg-[#11111A] text-white border border-zinc-800 p-2 font-mono text-sm resize-none focus:outline-none focus:border-zinc-800"
            placeholder="Paste tweet to reply to..."
          />
        </div>

        {error && (
          <div className="text-red-500 text-sm font-mono">
            {error}
          </div>
        )}

        <div className="flex space-x-2">
          <Select value={selectedStyle} onValueChange={(value: TweetStyle) => setSelectedStyle(value)}>
            <SelectTrigger className="bg-[#11111A] text-white border border-zinc-800 px-2 py-1 font-mono text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="shitpost">SHITPOST</SelectItem>
              <SelectItem value="rant">RANT</SelectItem>
              <SelectItem value="hornypost">HORNYPOST</SelectItem>
              <SelectItem value="metacommentary">METACOMMENTARY</SelectItem>
              <SelectItem value="existential">EXISTENTIAL</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="system"
            onClick={handleGenerate}
            disabled={isGenerating || !originalTweet.trim()}
            className="flex-1"
          >
            {isGenerating ? 'GENERATING...' : 'GENERATE_REPLIES'}
          </Button>
        </div>

        {generatedReplies.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs">Generated Replies</span>
            <div className="space-y-2">
              {generatedReplies.map((reply, index) => (
                <div key={index} className="p-2 border border-zinc-800 bg-[#11111A]">
                  <p className="font-mono text-sm mb-2">{reply.content}</p>
                  <div className="flex justify-between items-center">
                    <span className="text-xs">style: {reply.style}</span>
                    <Button
                      variant="system"
                      onClick={() => handleReplySelect(reply.content)}
                      disabled={isLoading}
                      className="text-sm"
                    >
                      SELECT
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
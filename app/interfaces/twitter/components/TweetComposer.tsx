// src/app/interfaces/twitter/components/TweetComposer.tsx

'use client';

import React, { useState } from 'react';
import { Card } from '../../../components/common/Card';
import { Input } from '../../../components/common/Input';
import { Button } from '../../../components/common/Button';
import { TweetStyle } from '../../../core/types';
import { 
  Select,
  SelectContent, 
  SelectItem,
  SelectTrigger,
  SelectValue 
} from '../../../components/common/Select';

interface TweetComposerProps {
  onTweet: (content: string, style: TweetStyle) => Promise<void>;
  currentStyle: TweetStyle;
  isLoading?: boolean;
}

export default function TweetComposer({ 
  onTweet, 
  currentStyle, 
  isLoading 
}: TweetComposerProps) {
  const [content, setContent] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<TweetStyle>(currentStyle);

  const charCount = content.length;
  const maxChars = 280;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (content.trim() && !isLoading) {
      await onTweet(content.trim(), selectedStyle);
      setContent('');
    }
  };

  return (
    <Card variant="system" title="TWEET_COMPOSER">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span>style: {selectedStyle}</span>
            <span>chars: {charCount}/{maxChars}</span>
          </div>
          
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={maxChars}
            rows={3}
            className="w-full bg-[#11111A] text-white border border-zinc-800 p-2 font-mono text-sm resize-none focus:outline-none focus:border-zinc-800"
            placeholder="Initialize tweet sequence..."
          />
        </div>

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
            type="submit"
            disabled={isLoading || !content.trim()}
            className="flex-1"
          >
            {isLoading ? 'DEPLOYING...' : 'EXECUTE_TWEET'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
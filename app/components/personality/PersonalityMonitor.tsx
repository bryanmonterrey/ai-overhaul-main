// src/app/components/personality/PersonalityMonitor.tsx

import React from 'react';
import { Card } from '../common/Card';
import { TweetStyle } from '../../core/types';

interface PersonalityMonitorProps {
  traits: Record<string, number>; // Remove the optional
  tweetStyle: TweetStyle; // Remove the optional
  activeThemes: string[]; // Remove the optional
  className?: string;
}

export const PersonalityMonitor = ({
  traits,
  tweetStyle,
  activeThemes,
  className = ''
}: PersonalityMonitorProps) => {
  return (
    <Card variant="system" title="PERSONALITY_METRICS" className={className}>
      <div className="space-y-4 font-mono text-xs">
        <div>
          <div className="mb-2">personality_matrix []:</div>
          {Object.entries(traits || {}).map(([trait, value]) => (
            <div key={trait} className="flex items-center space-x-2 mb-2">
              <div className="w-40">{trait}:</div>
              <div className="flex-1 bg-[#11111A] h-2">
                <div 
                  className="bg-green-500 rounded-full h-full transition-all duration-500"
                  style={{ width: `${value * 100}%` }}
                />
              </div>
              <div className="w-16 text-right">
                {(value * 100).toFixed(0)}%
              </div>
            </div>
          ))}
          {Object.keys(traits || {}).length === 0 && (
            <div className="text-gray-500">No traits available</div>
          )}
        </div>
        
        <div>
          <div>current_behavior: {tweetStyle}</div>
          <div className="mt-2">
            <div>active_processes []:</div>
            <div className="ml-4">
              {activeThemes.map((theme, i) => (
                <div key={theme} className="text-green-400">
                  [{i}] {theme}
                </div>
              ))}
              {activeThemes.length === 0 && (
                <div className="text-gray-500">No active processes</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
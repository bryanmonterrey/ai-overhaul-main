// src/app/components/personality/EmotionalStateDisplay.tsx

import React from 'react';
import { Card } from '../common/Card';
import type { EmotionalState } from '../../core/types';

interface EmotionalStateDisplayProps {
  state?: EmotionalState;
  intensity?: number;
  narrativeMode?: string;
  traits?: Record<string, number>;
}

export const EmotionalStateDisplay = ({
  state = 'neutral',  // Use string literal instead of enum
  intensity = 0.5,
  narrativeMode = 'default',
  traits = {}
}: EmotionalStateDisplayProps) => {
  // Add safety for chaos_threshold
  const chaosThreshold = traits?.chaos_threshold ?? 0.5;

  return (
    <Card variant="system" title="SYSTEM_STATUS">
      <div className="space-y-2 font-mono text-xs">
        <div className="grid grid-cols-2 gap-2">
          <div>emotional_state:</div>
          <div>{state}</div>
          
          <div>intensity_level:</div>
          <div>{(intensity * 100).toFixed(0)}%</div>
          
          <div>narrative_mode:</div>
          <div>{narrativeMode}</div>
          
          <div>chaos_threshold:</div>
          <div>{(chaosThreshold * 100).toFixed(0)}%</div>
        </div>

        <div className="mt-4">
          <div className="mb-1">system_stability:</div>
          <div className="w-full bg-[#11111A] h-2">
            <div 
              className="bg-green-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${(1 - intensity) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </Card>
  );
};
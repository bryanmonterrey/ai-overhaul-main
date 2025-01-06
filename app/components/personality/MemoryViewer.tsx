// src/app/components/personality/MemoryViewer.tsx

import React from 'react';
import { Card } from '../common/Card';
import { Memory } from '../../core/types';

interface MemoryViewerProps {
  memories: Memory[];
  onMemorySelect?: (memory: Memory) => void;
  className?: string;
}

export const MemoryViewer = ({
  memories,
  onMemorySelect,
  className = ''
}: MemoryViewerProps) => {
  return (
    <Card variant="system" title="MEMORY_BUFFER" className={className}>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {memories.map((memory) => (
          <div 
            key={memory.id}
            onClick={() => onMemorySelect?.(memory)}
            className="p-2 border border-green-800 hover:border-green-500 cursor-pointer bg-opacity-20 bg-green-900"
          >
            <div className="text-xs text-green-500">
              timestamp: {(memory.timestamp instanceof Date) ? 
                memory.timestamp.toISOString() : 
                new Date(memory.timestamp).toISOString()}
              <br />
              type: {memory.type} | importance: {(memory.importance * 100).toFixed(0)}%
            </div>
            <div className="mt-1 font-mono">{memory.content}</div>
          </div>
        ))}
      </div>
    </Card>
  );
};
// src/app/components/admin/TrainingDataManager.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { trainingDataService } from '../../lib/services/training';
import { dbService } from '../../lib/services/database';
import { ChatMessage } from '@/types/database';

export function TrainingDataManager() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [qualityThreshold, setQualityThreshold] = useState(0.8);
  const [isExporting, setIsExporting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMessages();
  }, [qualityThreshold]);

  async function loadMessages() {
    try {
      const data = await dbService.getHighQualityMessages(qualityThreshold);
      setMessages(data);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleExport() {
    setIsExporting(true);
    try {
      const data = await trainingDataService.exportTrainingData(qualityThreshold);
      const blob = new Blob([data], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `training-data-${new Date().toISOString()}.jsonl`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting data:', error);
    } finally {
      setIsExporting(false);
    }
  }

  if (isLoading) {
    return <div className="text-white font-mono">LOADING_DATA...</div>;
  }

  return (
    <div className="p-4 space-y-6 font-mono">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white">[TRAINING_DATA_MANAGER]</h2>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-white">QUALITY_THRESHOLD:</span>
            <input
              type="range"
              min="0"
              max="100"
              value={qualityThreshold * 100}
              onChange={(e) => setQualityThreshold(Number(e.target.value) / 100)}
              className="w-32"
            />
            <span className="text-white">
              {(qualityThreshold * 100).toFixed(0)}%
            </span>
          </div>
          
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="px-4 py-2 bg-black text-white border border-white disabled:opacity-50"
          >
            {isExporting ? 'EXPORTING...' : 'EXPORT_DATA'}
          </button>
        </div>
      </div>

      <div className="border border-white bg-black p-4">
        <table className="w-full text-white">
          <thead>
            <tr>
              <th className="text-left p-2">ID</th>
              <th className="text-left p-2">CONTENT</th>
              <th className="text-left p-2">QUALITY</th>
              <th className="text-left p-2">EMOTION</th>
              <th className="text-left p-2">TIMESTAMP</th>
            </tr>
          </thead>
          <tbody>
            {messages.map((msg) => (
              <tr
                key={msg.id}
                className="hover:bg-white/5 cursor-pointer"
                onClick={() => {
                  const newSelected = new Set(selectedMessages);
                  if (newSelected.has(msg.id)) {
                    newSelected.delete(msg.id);
                  } else {
                    newSelected.add(msg.id);
                  }
                  setSelectedMessages(newSelected);
                }}
              >
                <td className="p-2">
                  <input
                    type="checkbox"
                    checked={selectedMessages.has(msg.id)}
                    onChange={() => {}}
                    className="mr-2"
                  />
                  {msg.id.slice(0, 8)}
                </td>
                <td className="p-2">{msg.content.slice(0, 50)}...</td>
                <td className="p-2">{msg.quality_score?.toFixed(2)}</td>
                <td className="p-2">{msg.emotion}</td>
                <td className="p-2">
                  {new Date(msg.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
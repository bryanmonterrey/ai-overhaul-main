// src/app/components/analytics/QualityMetricsDisplay.tsx

import React from 'react';
import { QualityScore } from '../../lib/services/quality-metrics';

interface Props {
  metrics: QualityScore;
  className?: string;
}

export function QualityMetricsDisplay({ metrics, className = '' }: Props) {
  const getColorClass = (score: number) => {
    if (score >= 0.8) return 'text-green-500';
    if (score >= 0.6) return 'text-yellow-500';
    return 'text-red-500';
  };

  const formatScore = (score: number) => (score * 100).toFixed(1) + '%';

  return (
    <div className={`font-mono text-sm ${className}`}>
      <div className="border border-[#DDDDDD] p-4 bg-[#11111A]">
        <h3 className="mb-2 text-[#DDDDDD]">[QUALITY_METRICS]</h3>
        
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>OVERALL:</span>
            <span className={getColorClass(metrics.overall)}>
              {formatScore(metrics.overall)}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span>COHERENCE:</span>
            <span className={getColorClass(metrics.coherence)}>
              {formatScore(metrics.coherence)}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span>EMOTIONAL_ALIGNMENT:</span>
            <span className={getColorClass(metrics.emotionalAlignment)}>
              {formatScore(metrics.emotionalAlignment)}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span>NARRATIVE_CONSISTENCY:</span>
            <span className={getColorClass(metrics.narrativeConsistency)}>
              {formatScore(metrics.narrativeConsistency)}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span>RESPONSE_RELEVANCE:</span>
            <span className={getColorClass(metrics.responseRelevance)}>
              {formatScore(metrics.responseRelevance)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
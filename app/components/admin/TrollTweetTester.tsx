import React, { useState } from 'react';
import { TROLL_PATTERNS } from '../../core/personality/training/constants';

export const TrollTweetTester: React.FC = () => {
  const [selectedStyle, setSelectedStyle] = useState<string>('');
  const [tweetContent, setTweetContent] = useState<string>('');
  const [analysis, setAnalysis] = useState<{
    style: string;
    matchedPatterns: string[];
    matchedThemes: string[];
  } | null>(null);

  const analyzeTweet = () => {
    const style = TROLL_PATTERNS[selectedStyle];
    if (!style || !tweetContent) return;

    const matchedPatterns = style.triggers.filter(pattern => 
      tweetContent.toLowerCase().includes(pattern.toLowerCase())
    );

    const matchedThemes = style.themes?.filter(theme =>
      tweetContent.toLowerCase().includes(theme.toLowerCase())
    ) || [];

    setAnalysis({
      style: style.name,
      matchedPatterns,
      matchedThemes
    });
  };

  return (
    <div className="space-y-4 mt-8 border-t border-green-500/20 pt-8">
      <h2 className="text-xl font-semibold mb-4">Troll Tweet Tester</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Style</label>
          <select
            value={selectedStyle}
            onChange={(e) => setSelectedStyle(e.target.value)}
            className="w-full p-2 border rounded bg-black text-green-500 border-green-500"
          >
            <option value="">Select style</option>
            {Object.keys(TROLL_PATTERNS).map(style => (
              <option key={style} value={style}>
                {TROLL_PATTERNS[style].name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Tweet Content</label>
          <textarea
            value={tweetContent}
            onChange={(e) => setTweetContent(e.target.value)}
            className="w-full p-2 border rounded bg-black text-green-500 border-green-500 h-32"
          />
        </div>

        <button
          onClick={analyzeTweet}
          className="w-full bg-green-500 text-black py-2 px-4 rounded hover:bg-green-400"
        >
          Analyze Tweet
        </button>

        {analysis && (
          <div className="mt-4 p-4 border border-green-500/20 rounded">
            <h3 className="font-medium mb-2">Analysis Results</h3>
            <div className="space-y-2">
              <p>Style: {analysis.style}</p>
              <div>
                <p>Matched Patterns ({analysis.matchedPatterns.length}):</p>
                <ul className="list-disc pl-5">
                  {analysis.matchedPatterns.map(pattern => (
                    <li key={pattern}>{pattern}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p>Matched Themes ({analysis.matchedThemes.length}):</p>
                <ul className="list-disc pl-5">
                  {analysis.matchedThemes.map(theme => (
                    <li key={theme}>{theme}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
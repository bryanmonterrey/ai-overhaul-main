// app/api/letta/analyze/route.ts
import { NextResponse } from 'next/server';

interface AnalyzeRequest {
    content: string;
    context?: Record<string, any>;
  }
  

export async function POST(request: Request) {

    if (!request.headers.get('Content-Type')?.includes('application/json')) {
        return NextResponse.json({ 
          error: 'Content-Type must be application/json' 
        }, { status: 400 });
      }
      
    try {
        const { content, context } = await request.json();

        if (typeof content !== 'string') {
            return NextResponse.json({ 
              error: 'Content must be a string' 
            }, { status: 400 });
        }


        // Local analysis
        const localAnalysis = {
            sentiment: calculateSentiment(content),
            patterns: detectPatterns(content),
            chaos_level: calculateChaosLevel(content),
            emotional_context: detectEmotionalContext(content),
            key_concepts: extractKeyConcepts(content),
            importance_score: calculateImportance(content)
        };

        // Get Letta service analysis
        const lettaResponse = await fetch('https://ai-overhaul.onrender.com/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, context })
        });

        if (!lettaResponse.ok) {
            // Fall back to local analysis if Letta service fails
            return NextResponse.json({
                success: true,
                data: localAnalysis,
                source: 'local'
            });
        }

        const lettaData = await lettaResponse.json();

        // Combine both analyses
        return NextResponse.json({
            success: true,
            data: {
                ...localAnalysis,
                ...lettaData.data,
                source: 'combined'
            }
        });

    } catch (error) {
        console.error('Content analysis error:', error);
        return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
    }
}

// Helper functions for analysis
function calculateSentiment(text: string): number {
    // Simple sentiment analysis based on positive/negative word counts
    const positiveWords = ['good', 'great', 'awesome', 'excellent', 'happy', 'love', 'best'];
    const negativeWords = ['bad', 'worse', 'terrible', 'awful', 'hate', 'worst'];

    const words = text.toLowerCase().split(/\s+/);
    let sentiment = 0;

    words.forEach(word => {
        if (positiveWords.includes(word)) sentiment += 0.2;
        if (negativeWords.includes(word)) sentiment -= 0.2;
    });

    return Math.max(-1, Math.min(1, sentiment));
}

function detectPatterns(text: string): string[] {
    const patterns = [];
    
    // Detect various patterns
    if (text.includes('?')) patterns.push('questioning');
    if (text.toUpperCase() === text) patterns.push('shouting');
    if (text.length > 100) patterns.push('verbose');
    if (text.split(' ').length < 5) patterns.push('concise');
    if (text.includes('...')) patterns.push('contemplative');
    
    return patterns;
}

function calculateChaosLevel(text: string): number {
    // Calculate chaos based on various factors
    let chaos = 0.5; // base level

    if (text.includes('!!!')) chaos += 0.2;
    if (text.toUpperCase() === text) chaos += 0.1;
    if (text.includes('...')) chaos -= 0.1;
    if (text.length > 150) chaos += 0.1;
    if (text.split('?').length > 2) chaos += 0.1;

    return Math.max(0, Math.min(1, chaos));
}

function detectEmotionalContext(text: string): string {
    const emotionalIndicators = {
        happy: ['happy', 'joy', 'excited', 'great', 'awesome'],
        angry: ['angry', 'mad', 'furious', 'rage'],
        sad: ['sad', 'depressed', 'unhappy', 'miserable'],
        contemplative: ['think', 'wonder', 'perhaps', 'maybe'],
        chaotic: ['crazy', 'wild', 'insane', 'chaos']
    };

    const words = text.toLowerCase().split(/\s+/);
    const emotions: Record<string, number> = {};

    for (const [emotion, indicators] of Object.entries(emotionalIndicators)) {
        emotions[emotion] = words.filter(word => indicators.includes(word)).length;
    }

    const dominantEmotion = Object.entries(emotions)
        .reduce((max, [emotion, count]) => count > max[1] ? [emotion, count] : max, ['neutral', 0]);

    return dominantEmotion[1] > 0 ? dominantEmotion[0] : 'neutral';
}

function extractKeyConcepts(text: string): string[] {
    const concepts = new Set<string>();
    const words = text.toLowerCase().split(/\s+/);
    
    // Add important words and phrases
    words.forEach(word => {
        if (word.length > 5 && !['the', 'and', 'that', 'this', 'with'].includes(word)) {
            concepts.add(word);
        }
    });

    return Array.from(concepts).slice(0, 5);
}

function calculateImportance(text: string): number {
    let importance = 0.5; // base importance

    // Length factor
    importance += Math.min(0.2, text.length / 1000);

    // Question marks indicate engagement
    importance += text.split('?').length * 0.1;

    // Exclamation marks indicate emphasis
    importance += text.split('!').length * 0.1;

    // Links or references indicate supporting content
    if (text.includes('http') || text.includes('www')) {
        importance += 0.2;
    }

    return Math.max(0, Math.min(1, importance));
}
# memgpt-service/memory_store.py

from letta.agent import Agent  # instead of from letta import Agent
from letta.config import Config  # instead of Config from letta directly
from typing import Dict, List, Any, Optional
import numpy as np

class MemoryStore:
    def __init__(self):
        # Initialize with basic config
        config = Config()
        config.llm.model = "anthropic/claude-2"  # or "gpt-4" based on your API key
        config.llm.provider = "anthropic"  # or "openai"
        
        self.agent = Agent(config)
        
    async def store(self, key: str, content: str, metadata: Dict = None) -> bool:
        try:
            await self.agent.memory.store(
                key=key,
                content=content,
                metadata=metadata or {}
            )
            return True
        except Exception as e:
            print(f"Error storing memory: {e}")
            return False
            
    async def retrieve(self, key: str) -> Optional[Dict]:
        try:
            memory = await self.agent.memory.get(key)
            return memory
        except Exception as e:
            print(f"Error retrieving memory: {e}")
            return None
            
    async def search(self, query: str, limit: int = 5) -> List[Dict]:
        try:
            results = await self.agent.memory.search(
                query=query,
                limit=limit
            )
            return results
        except Exception as e:
            print(f"Error searching memories: {e}")
            return []

    async def analyze_content(self, content: str) -> Dict[str, Any]:
        """Analyze content using basic NLP techniques"""
        try:
            # Basic sentiment analysis
            sentiment = self._analyze_sentiment(content)
            
            return {
                'sentiment': sentiment,
                'key_concepts': self._extract_key_concepts(content),
                'patterns': self._identify_patterns(content),
                'importance': self._calculate_importance(content)
            }
        except Exception as e:
            print(f"Error analyzing content: {e}")
            return {}

    def _analyze_sentiment(self, text: str) -> float:
        """Simple sentiment analysis"""
        positive_words = {'good', 'great', 'excellent', 'positive', 'amazing'}
        negative_words = {'bad', 'poor', 'negative', 'terrible', 'awful'}
        
        words = text.lower().split()
        score = 0
        for word in words:
            if word in positive_words:
                score += 1
            elif word in negative_words:
                score -= 1
        return score / (len(words) + 1)

    def _extract_key_concepts(self, text: str) -> List[str]:
        """Extract key concepts from text"""
        words = text.lower().split()
        common_words = {'the', 'is', 'at', 'which', 'on'}
        concepts = [w for w in words if w not in common_words and len(w) > 3]
        return list(set(concepts))[:5]

    def _identify_patterns(self, text: str) -> List[str]:
        patterns = []
        if '?' in text:
            patterns.append('question')
        if '!' in text:
            patterns.append('exclamation')
        if len(text.split()) > 20:
            patterns.append('detailed')
        return patterns

    def _calculate_importance(self, text: str) -> float:
        length_score = min(1.0, len(text) / 1000)
        complexity_score = len(set(text.split())) / len(text.split())
        return (length_score + complexity_score) / 2
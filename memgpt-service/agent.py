# agent.py

from typing import Dict, Any, Optional, List
from memory_processor import MemoryProcessor
from datetime import datetime
import numpy as np

class Agent:
    def __init__(self, agent_state, user, interface):
        self.agent_state = agent_state
        self.user = user
        self.interface = interface
        self.memory = agent_state.memory
        self.memory_processor = None
        self.context_window = []
        self.last_state_update = datetime.now()
        self.service = None

    def _update_agent_state(self, content: str) -> None:
        """Update agent's internal state based on content"""
        self.last_state_update = datetime.now()
        
    def _handle_analysis_error(self, error: Exception) -> Dict[str, Any]:
        """Handle errors during content analysis"""
        print(f"Error in content analysis: {str(error)}")
        return {
            'sentiment': 0,
            'emotional_context': 'neutral',
            'key_concepts': [],
            'patterns': [],
            'importance': 0.5,
            'associations': [],
            'summary': ''
        }

    def _analyze_sentiment_with_context(self, content: str) -> float:
        """Analyze sentiment considering context"""
        # Basic implementation
        return 0.0
        
    def _determine_emotional_context(self, content: str) -> str:
        """Determine emotional context of content"""
        return 'neutral'
        
    def _extract_key_concepts(self, content: str) -> List[str]:
        """Extract key concepts from content"""
        words = content.lower().split()
        return list(set(words))[:5]
        
    def _identify_complex_patterns(self, content: str) -> List[str]:
        """Identify complex patterns in content"""
        return []
        
    def _calculate_importance_score(self, content: str) -> float:
        """Calculate importance score"""
        return 0.5
        
    def _find_semantic_associations(self, content: str) -> List[str]:
        """Find semantic associations"""
        return []
        
    def _generate_contextual_summary(self, content: str) -> str:
        """Generate contextual summary"""
        return content[:100] if len(content) > 100 else content

    def _calculate_context_relevance(self, content: str) -> float:
        """Calculate context relevance"""
        return 0.5
        
    def _assess_state_impact(self, content: str) -> Dict[str, Any]:
        """Assess impact on agent state"""
        return {}

    async def analyze_content(self, content: str, context: Optional[Dict] = None) -> Dict[str, Any]:
        """Analyze content and return insights"""
        try:
            if not content:
                raise ValueError("Content cannot be empty")

            # Update state based on content
            self._update_agent_state(content)
            
            # Use memory processor if available for deep analysis
            if self.memory_processor:
                processor_analysis = await self.memory_processor.analyze_content(content)
                if processor_analysis:
                    return processor_analysis

            # Generate basic analysis
            return {
                'sentiment': self._analyze_sentiment_with_context(content),
                'emotional_context': self._determine_emotional_context(content),
                'key_concepts': self._extract_key_concepts(content),
                'patterns': self._identify_complex_patterns(content),
                'importance': self._calculate_importance_score(content),
                'associations': self._find_semantic_associations(content),
                'summary': self._generate_contextual_summary(content)
            }
        except Exception as e:
            return self._handle_analysis_error(e)

    async def memory_search(self, query: str, limit: int = 10, filter_fn=None):
        """Search through memories"""
        try:
            if hasattr(self.memory, 'search'):
                results = await self.memory.search(query, limit, filter_fn)
                # Convert APIResponse to regular dict if needed
                if hasattr(results, 'dict'):
                    results = results.dict()
                return results
            return []
        except Exception as e:
            print(f"Error in memory search: {str(e)}")
            return []
from typing import List, Dict, Any, Optional, Union
from dataclasses import dataclass
import asyncio
from datetime import datetime, timedelta
import numpy as np
from supabase import Client
from .vector_store import VectorStore
from .utils.embedding import EmbeddingManager
import logging
from tenacity import retry, stop_after_attempt, wait_exponential
from collections import defaultdict

@dataclass
class SearchResult:
    memory_id: str
    content: str
    relevance: float
    metadata: Dict
    created_at: datetime

class MemoryRetrieval:
    def __init__(
        self,
        supabase: Client,
        vector_store: VectorStore,
        embedding_manager: Optional[EmbeddingManager] = None
    ):
        self.supabase = supabase
        self.vector_store = vector_store
        self.embedding_manager = embedding_manager or EmbeddingManager()
        self.cache = {}
        self.retrieval_strategies = {
            'semantic': self._semantic_search,
            'temporal': self._temporal_search,
            'hybrid': self._hybrid_search,
            'contextual': self._contextual_search
        }

    async def search(
        self,
        query: str,
        strategy: str = 'hybrid',
        limit: int = 5,
        context: Optional[Dict] = None,
        filters: Optional[Dict] = None
    ) -> List[SearchResult]:
        """Main search interface with multiple strategies"""
        try:
            if strategy not in self.retrieval_strategies:
                strategy = 'hybrid'
                
            search_func = self.retrieval_strategies[strategy]
            results = await search_func(
                query=query,
                limit=limit,
                context=context,
                filters=filters
            )
            
            # Cache results
            cache_key = f"{query}:{strategy}:{limit}"
            self.cache[cache_key] = {
                'results': results,
                'timestamp': datetime.now()
            }
            
            return results
            
        except Exception as e:
            logging.error(f"Search error: {str(e)}")
            return []

    async def _semantic_search(
        self,
        query: str,
        limit: int,
        context: Optional[Dict] = None,
        filters: Optional[Dict] = None
    ) -> List[SearchResult]:
        """Semantic similarity-based search"""
        try:
            # Get query embedding
            query_embedding = await self.embedding_manager.get_embedding(query)
            
            # Search vector store
            similar_vectors = await self.vector_store.similarity_search(
                query_embedding,
                k=limit
            )
            
            if not similar_vectors:
                return []
                
            # Get full memory data
            memory_ids = [memory_id for memory_id, _ in similar_vectors]
            scores = {memory_id: score for memory_id, score in similar_vectors}
            
            response = await self.supabase.table('memories')\
                .select('*')\
                .in_('id', memory_ids)\
                .execute()
                
            if not response.data:
                return []
                
            # Apply filters if provided
            results = []
            for memory in response.data:
                if filters and not self._apply_filters(memory, filters):
                    continue
                    
                results.append(SearchResult(
                    memory_id=memory['id'],
                    content=memory['content'],
                    relevance=scores[memory['id']],
                    metadata=memory['metadata'],
                    created_at=datetime.fromisoformat(memory['created_at'])
                ))
                
            return sorted(results, key=lambda x: x.relevance, reverse=True)[:limit]
            
        except Exception as e:
            logging.error(f"Semantic search error: {str(e)}")
            return []

    async def _temporal_search(
    self,
    query: str,
    limit: int,
    context: Optional[Dict] = None,
    filters: Optional[Dict] = None
) -> List[SearchResult]:
        """Time-based search with relevance decay"""
        try:
            # Use the search_memories function we created
            response = await self.supabase.rpc(
                'search_memories',
                {
                    'search_query': query,
                    'limit_val': limit * 2
                }
            ).execute()
            
            data = getattr(response, 'data', None)
            if data is None:
                logging.error("No data returned from Supabase")
                return []
                
            results = []
            now = datetime.now()
            
            for memory in data:
                if filters and not self._apply_filters(memory, filters):
                    continue
                    
                age = (now - datetime.fromisoformat(memory['created_at'])).days
                time_relevance = 1.0 / (1.0 + (age / 30))  # 30-day half-life
                
                results.append(SearchResult(
                    memory_id=memory['id'],
                    content=memory['content'],
                    relevance=time_relevance,
                    metadata=memory['metadata'],
                    created_at=datetime.fromisoformat(memory['created_at'])
                ))
                
            return sorted(results, key=lambda x: x.relevance, reverse=True)[:limit]
            
        except Exception as e:
            logging.error(f"Temporal search error: {str(e)}")
            return []

    async def _hybrid_search(
        self,
        query: str,
        limit: int,
        context: Optional[Dict] = None,
        filters: Optional[Dict] = None
    ) -> List[SearchResult]:
        """Combined semantic and temporal search"""
        try:
            # Run both search types concurrently
            semantic_task = asyncio.create_task(
                self._semantic_search(query, limit, context, filters)
            )
            temporal_task = asyncio.create_task(
                self._temporal_search(query, limit, context, filters)
            )
            
            semantic_results, temporal_results = await asyncio.gather(
                semantic_task,
                temporal_task
            )
            
            # Combine and re-rank results
            combined = {}
            
            for result in semantic_results:
                combined[result.memory_id] = {
                    'result': result,
                    'semantic_score': result.relevance,
                    'temporal_score': 0
                }
                
            for result in temporal_results:
                if result.memory_id in combined:
                    combined[result.memory_id]['temporal_score'] = result.relevance
                else:
                    combined[result.memory_id] = {
                        'result': result,
                        'semantic_score': 0,
                        'temporal_score': result.relevance
                    }
                    
            # Calculate final scores
            results = []
            for memory_data in combined.values():
                result = memory_data['result']
                final_score = (
                    memory_data['semantic_score'] * 0.7 +
                    memory_data['temporal_score'] * 0.3
                )
                result.relevance = final_score
                results.append(result)
                
            return sorted(results, key=lambda x: x.relevance, reverse=True)[:limit]
            
        except Exception as e:
            logging.error(f"Hybrid search error: {str(e)}")
            return []

    async def _contextual_search(
        self,
        query: str,
        limit: int,
        context: Optional[Dict] = None,
        filters: Optional[Dict] = None
    ) -> List[SearchResult]:
        """Context-aware search"""
        try:
            if not context:
                return await self._hybrid_search(query, limit, None, filters)
                
            # Enhance query with context
            context_text = self._format_context(context)
            enhanced_query = f"{query} {context_text}"
            
            # Get embeddings for both original and enhanced queries
            query_embedding = await self.embedding_manager.get_embedding(query)
            context_embedding = await self.embedding_manager.get_embedding(enhanced_query)
            
            # Combine embeddings with weighted average
            combined_embedding = (query_embedding * 0.7 + context_embedding * 0.3)
            combined_embedding /= np.linalg.norm(combined_embedding)
            
            # Search with combined embedding
            similar_vectors = await self.vector_store.similarity_search(
                combined_embedding,
                k=limit
            )
            
            if not similar_vectors:
                return []
                
            # Process results with context boost
            results = []
            for memory_id, base_score in similar_vectors:
                memory = await self._get_memory_with_context_boost(
                    memory_id,
                    context,
                    base_score
                )
                if memory and (not filters or self._apply_filters(memory, filters)):
                    results.append(memory)
                    
            return sorted(results, key=lambda x: x.relevance, reverse=True)[:limit]
            
        except Exception as e:
            logging.error(f"Contextual search error: {str(e)}")
            return []

    def _format_context(self, context: Dict) -> str:
        """Format context into searchable text"""
        context_parts = []
        
        if 'emotional_state' in context:
            context_parts.append(f"emotional state: {context['emotional_state']}")
            
        if 'topics' in context:
            context_parts.append(f"topics: {', '.join(context['topics'])}")
            
        if 'timeframe' in context:
            context_parts.append(f"timeframe: {context['timeframe']}")
            
        if 'platform' in context:
            context_parts.append(f"platform: {context['platform']}")
            
        return " ".join(context_parts)

    async def _get_memory_with_context_boost(
        self,
        memory_id: str,
        context: Dict,
        base_score: float
    ) -> Optional[SearchResult]:
        """Get memory and apply context-based score boosting"""
        try:
            response = await self.supabase.table('memories')\
                .select('*')\
                .eq('id', memory_id)\
                .single()\
                .execute()
                
            if not response.data:
                return None
                
            memory = response.data
            
            # Calculate context boost
            boost = 1.0
            
            # Emotional context boost
            if (context.get('emotional_state') and 
                memory['emotional_context'] == context['emotional_state']):
                boost += 0.2
                
            # Platform boost
            if (context.get('platform') and 
                memory['platform'] == context['platform']):
                boost += 0.1
                
            # Timeframe boost
            if context.get('timeframe'):
                memory_age = (
                    datetime.now() - 
                    datetime.fromisoformat(memory['created_at'])
                ).days
                
                if context['timeframe'] == 'recent' and memory_age < 7:
                    boost += 0.15
                elif context['timeframe'] == 'month' and memory_age < 30:
                    boost += 0.1
                    
            # Calculate final relevance
            final_score = base_score * boost
            
            return SearchResult(
                memory_id=memory['id'],
                content=memory['content'],
                relevance=final_score,
                metadata=memory['metadata'],
                created_at=datetime.fromisoformat(memory['created_at'])
            )
            
        except Exception as e:
            logging.error(f"Error getting memory with context: {str(e)}")
            return None

    def _apply_filters(self, memory: Dict, filters: Dict) -> bool:
        """Apply filters to memory"""
        try:
            for key, value in filters.items():
                if key == 'type' and memory['type'] != value:
                    return False
                    
                elif key == 'importance' and memory['importance'] < value:
                    return False
                    
                elif key == 'platform' and memory['platform'] != value:
                    return False
                    
                elif key == 'date_range':
                    memory_date = datetime.fromisoformat(memory['created_at'])
                    if not (value['start'] <= memory_date <= value['end']):
                        return False
                        
                elif key == 'metadata':
                    for meta_key, meta_value in value.items():
                        if memory['metadata'].get(meta_key) != meta_value:
                            return False
                            
            return True
            
        except Exception as e:
            logging.error(f"Filter error: {str(e)}")
            return False

    async def expand_search_context(
        self,
        initial_results: List[SearchResult],
        depth: int = 1
    ) -> List[SearchResult]:
        """Expand search results with related memories"""
        try:
            if not initial_results or depth < 1:
                return initial_results
                
            seen_ids = {result.memory_id for result in initial_results}
            expanded_results = list(initial_results)
            
            for current_depth in range(depth):
                current_ids = [r.memory_id for r in expanded_results]
                
                # Get related memories
                response = await self.supabase.rpc(
                    'get_related_memories',
                    {'memory_ids': current_ids}
                ).execute()
                
                if not response.data:
                    break
                    
                # Add new related memories
                for memory in response.data:
                    if memory['id'] not in seen_ids:
                        seen_ids.add(memory['id'])
                        expanded_results.append(SearchResult(
                            memory_id=memory['id'],
                            content=memory['content'],
                            relevance=0.5 ** (current_depth + 1),  # Decay with depth
                            metadata=memory['metadata'],
                            created_at=datetime.fromisoformat(memory['created_at'])
                        ))
                        
            return expanded_results
            
        except Exception as e:
            logging.error(f"Context expansion error: {str(e)}")
            return initial_results

    async def search_by_emotional_trajectory(
        self,
        emotion_sequence: List[str],
        time_window: Optional[timedelta] = None
    ) -> List[List[SearchResult]]:
        """Search for memories matching an emotional trajectory"""
        try:
            # Get candidate memories
            query = self.supabase.table('memories')\
                .select('*')\
                .in_('emotional_context', emotion_sequence)
                
            if time_window:
                cutoff = datetime.now() - time_window
                query = query.gte('created_at', cutoff.isoformat())
                
            response = await query.execute()
            
            if not hasattr(response, 'data') or not response.data:
                return []
                
            # Group by emotional context
            emotion_groups = defaultdict(list)
            for memory in response.data:
                emotion_groups[memory['emotional_context']].append(memory)
                
            # Find sequences matching the trajectory
            results = []
            current_sequence = []
            
            def find_sequences(current_idx: int):
                if current_idx == len(emotion_sequence):
                    results.append([
                        SearchResult(
                            memory_id=m['id'],
                            content=m['content'],
                            relevance=1.0,
                            metadata=m['metadata'],
                            created_at=datetime.fromisoformat(m['created_at'])
                        )
                        for m in current_sequence
                    ])
                    return
                    
                target_emotion = emotion_sequence[current_idx]
                for memory in emotion_groups[target_emotion]:
                    memory_date = datetime.fromisoformat(memory['created_at'])
                    
                    # Check temporal ordering
                    if current_sequence and memory_date <= datetime.fromisoformat(current_sequence[-1]['created_at']):
                        continue
                        
                    current_sequence.append(memory)
                    find_sequences(current_idx + 1)
                    current_sequence.pop()
                    
            find_sequences(0)
            return results
            
        except Exception as e:
            logging.error(f"Emotional trajectory search error: {str(e)}")
            return []
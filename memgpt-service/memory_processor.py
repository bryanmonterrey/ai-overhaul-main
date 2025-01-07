# memgpt-service/memory_processor.py
import json
from typing import List, Dict, Any, TYPE_CHECKING, Optional
import uuid
import numpy as np
from memory import (
    init_memory_system,
    MemoryHierarchy,
    VectorStore,
    MemoryRetrieval,
    SearchResult,
    MEMORY_CONFIG,
    load_config
)
from memory.utils import (
    analyze_memory_patterns,
    optimize_memory_storage,
    compress_memory_content,
    calculate_memory_statistics,
    calculate_text_complexity
)
import logging
from datetime import datetime, timezone
from collections import defaultdict


if TYPE_CHECKING:
    from agent import Agent

class MemoryProcessor:
    def __init__(self, agent: 'Agent'):
        self.agent = agent

        self.supabase_client = self.agent.service.supabase
        
        # Initialize memory system
        self.memory_system = init_memory_system(self.supabase_client)
        self.vector_store = self.memory_system['vector_store']
        self.hierarchy = self.memory_system['hierarchy']
        self.retrieval = self.memory_system['retrieval']
        self.embedding_manager = self.memory_system['embedding_manager']
        
        # Load configuration
        self.config = load_config()
        
        # Set up logging
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(__name__)

    async def analyze_content(self, content: str) -> Dict[str, Any]:
        """Enhanced content analysis using all available tools"""
        try:
            # Get original analysis
            base_analysis = {
                'sentiment': self._analyze_sentiment(content),
                'key_concepts': self._extract_key_concepts(content),
                'patterns': self._identify_patterns(content)
            }
            
            # Enhanced analysis
            embedding = await self.embedding_manager.get_embedding(content)
            similar_contents = await self.retrieval.search(
                content,
                strategy='semantic',
                limit=5
            )
            
            # Calculate emotional context and importance
            emotional_context = self._get_emotional_context(base_analysis['sentiment'])
            importance = await self._calculate_enhanced_importance(
                content,
                self._calculate_importance(content),
                similar_contents
            )
            
            return {
                **base_analysis,
                'emotional_context': emotional_context,
                'importance': importance,
                'vector_embedding': embedding.tolist(),
                'semantic_associations': [r.content for r in similar_contents],
                'complexity': calculate_text_complexity(content),
                'associations': self._find_associations(content),
                'summary': self._generate_summary(content)
            }
            
        except Exception as e:
            self.logger.error(f"Error in content analysis: {str(e)}")
            return {}

    def _analyze_sentiment(self, text: str) -> float:
        """Original sentiment analysis"""
        positive_words = {'good', 'great', 'excellent', 'positive', 'amazing'}
        negative_words = {'bad', 'poor', 'negative', 'terrible', 'awful'}
        
        words = text.lower().split()
        score = 0
        for word in words:
            if word in positive_words:
                score += 1
            elif word in negative_words:
                score -= 1
        return score / (len(words) + 1)  # Normalize

    def _extract_key_concepts(self, text: str) -> List[str]:
        """Original key concept extraction"""
        words = text.lower().split()

        common_words = {'the', 'is', 'at', 'which', 'on', 'in', 'a', 'an', 'and'}
        concepts = [w for w in words if w not in common_words and len(w) > 3]
        return list(set(concepts))[:5]

    def _identify_patterns(self, text: str) -> List[str]:
        """Original pattern identification with enhancements"""
        patterns = []
        if '?' in text:
            patterns.append('question')
        if '!' in text:
            patterns.append('exclamation')
        if len(text.split()) > 20:
            patterns.append('detailed')
        
        # Add enhanced pattern detection
        memory_patterns = analyze_memory_patterns([{'content': text}])
        if memory_patterns:
            for pattern_type, info in memory_patterns.items():
                if isinstance(info, dict) and 'pattern' in info:
                    patterns.append(f"{pattern_type}:{info['pattern']}")
                    
        return patterns

    def _get_emotional_context(self, sentiment: float) -> str:
        """Original emotional context determination"""
        if sentiment > 0.5:
            return 'excited'
        elif sentiment > 0:
            return 'creative'
        elif sentiment < -0.5:
            return 'chaotic'
        elif sentiment < 0:
            return 'contemplative'
        return 'neutral'

    def _calculate_importance(self, text: str) -> float:
        """Original importance calculation"""
        length_score = min(1.0, len(text) / 1000)
        complexity_score = len(set(text.split())) / len(text.split())
        return (length_score + complexity_score) / 2

    async def _calculate_enhanced_importance(
        self,
        content: str,
        base_importance: float,
        similar_contents: List[SearchResult]
    ) -> float:
        """Enhanced importance calculation"""
        try:
            # Get average similarity score
            avg_similarity = (
                sum(result.relevance for result in similar_contents) /
                len(similar_contents)
            ) if similar_contents else 0.5
            
            # Calculate complexity contribution
            complexity = calculate_text_complexity(content)
            
            # Combined score
            return (
                base_importance * 0.4 +
                avg_similarity * 0.3 +
                complexity * 0.3
            )
        except Exception as e:
            self.logger.error(f"Error calculating enhanced importance: {str(e)}")
            return base_importance

    def _find_associations(self, text: str) -> List[str]:
        """Original association finding"""
        words = text.lower().split()
        return list(set(words))[:5]

    def _generate_summary(self, text: str) -> str:
        """Original summary generation"""
        return text[:100] + '...' if len(text) > 100 else text

    async def store_interaction(self, content: str, response: dict, metadata: dict) -> None:
        """Store an interaction in the memory system"""
        try:
            interaction_data = {
                'content': content,
                'response': response,
                'metadata': metadata,
                'timestamp': datetime.now().isoformat(),
                'type': metadata.get('type', 'interaction'),
                'platform': metadata.get('platform', 'default'),
                'archive_status': 'active'
            }
            
            # Store in memory system
            await self.process_new_memory(content, {
                **metadata,
                'interaction_type': 'trading',
                'response': response
            })
            
        except Exception as e:
            logging.error(f"Error storing interaction: {str(e)}")

    async def cluster_memories(
        self,
        memories: List[Dict],
        min_size: int = 3,
        similarity_threshold: float = 0.7
    ) -> List[Dict]:
        """Enhanced clustering combining original and new methods"""
        if not memories:
            return []

        try:
            # Original clustering
            contents = [m.get('content', '') for m in memories]
            clusters = []
            used_indices = set()
            
            # Enhanced clustering using vector similarity
            for i, content in enumerate(contents):
                if i in used_indices:
                    continue
                
                # Get embedding for current content
                embedding = await self.embedding_manager.get_embedding(content)
                
                cluster = [memories[i]]
                used_indices.add(i)
                
                # Find similar memories using both methods
                for j, other_content in enumerate(contents):
                    if j in used_indices:
                        continue
                    
                    # Original similarity check
                    words1 = set(content.lower().split())
                    words2 = set(other_content.lower().split())
                    word_similarity = len(words1 & words2) / len(words1 | words2)
                    
                    # Vector similarity check
                    other_embedding = await self.embedding_manager.get_embedding(other_content)
                    vector_similarity = np.dot(embedding, other_embedding) / (
                        np.linalg.norm(embedding) * np.linalg.norm(other_embedding)
                    )
                    
                    # Combined similarity
                    combined_similarity = (word_similarity + vector_similarity) / 2
                    
                    if combined_similarity >= similarity_threshold:
                        cluster.append(memories[j])
                        used_indices.add(j)
                
                if len(cluster) >= min_size:
                    # Add pattern analysis for the cluster
                    patterns = analyze_memory_patterns(cluster)
                    clusters.append({
                        'centroid': content,
                        'memories': cluster,
                        'patterns': patterns,
                        'statistics': calculate_memory_statistics(cluster)
                    })
            
            return clusters

        except Exception as e:
            self.logger.error(f"Error in memory clustering: {str(e)}")
            return []

    async def find_most_similar(
        self,
        source: Dict,
        candidates: List[Dict]
    ) -> Optional[Dict]:
        """Enhanced similarity search"""
        try:

            if hasattr(candidates, 'data'):
                candidates = candidates.data
                
            # Original word-based similarity
            source_content = source.get('content', '').lower()
            source_words = set(source_content.split())
            
            word_similarities = []
            for candidate in candidates:
                candidate_content = candidate.get('content', '').lower()
                candidate_words = set(candidate_content.split())
                
                similarity = len(source_words & candidate_words) / len(source_words | candidate_words)
                word_similarities.append((candidate, similarity))
            
            # Vector similarity using retrieval system
            vector_results = await self.retrieval.search(
                source_content,
                strategy='hybrid',
                limit=len(candidates),
                context={'source_type': source.get('type')}
            )
            
            # Combine both similarity measures
            combined_scores = {}
            
            # Add word-based similarities
            for candidate, score in word_similarities:
                combined_scores[candidate.get('id')] = {
                    'memory': candidate,
                    'score': score * 0.4  # Weight for word similarity
                }
            
            # Add vector similarities
            for result in vector_results:
                memory_id = result.memory_id
                if memory_id in combined_scores:
                    combined_scores[memory_id]['score'] += result.relevance * 0.6
                else:
                    for candidate in candidates:
                        if candidate.get('id') == memory_id:
                            combined_scores[memory_id] = {
                                'memory': candidate,
                                'score': result.relevance * 0.6
                            }
                            break
            
            # Get best match
            if combined_scores:
                best_match = max(
                    combined_scores.values(),
                    key=lambda x: x['score']
                )
                return best_match['memory']
            
            return None
            
        except Exception as e:
            self.logger.error(f"Error finding similar memory: {str(e)}")
            return None

    async def combine_and_rank_results(
    self,
    db_results: List[Dict],
    semantic_results: List[Dict],
    query: Dict
) -> List[Dict]:
        """Enhanced result combination"""
        try:

            combined = {}
            
            # Add database results
            for result in db_results:
                if not isinstance(result, dict):
                    continue
                    
                key = result.get('id')
                if not key:
                    continue
                    
                try:
                    content = result.get('content', '')
                    if not content:
                        continue
                        
                    content_score = calculate_text_complexity(content)
                    combined[key] = {
                        'memory': result,
                        'score': float(0.5 + (content_score * 0.2))
                    }
                except Exception as e:
                    self.logger.error(f"Error processing db result: {str(e)}")
                    continue
            
            # Add semantic results with higher weight
            for result in semantic_results:
                if not isinstance(result, dict):
                    continue
                    
                key = result.get('id')
                if not key:
                    continue
                    
                try:
                    semantic_score = 0.8
                    if key in combined:
                        if not isinstance(combined[key].get('score'), (int, float)):
                            combined[key]['score'] = 0.0
                        combined[key]['score'] += semantic_score
                    else:
                        combined[key] = {
                            'memory': result,
                            'score': float(semantic_score)
                        }
                    
                    # Add importance boost
                    importance = float(result.get('importance', 0))
                    if importance > 0.7 and key in combined:
                        score = combined[key].get('score')
                        if isinstance(score, (int, float)):
                            combined[key]['score'] = float(score * 1.2)
                except Exception as e:
                    self.logger.error(f"Error processing semantic result: {str(e)}")
                    continue
            
            # Filter out any entries with invalid scores
            valid_entries = [
                item for item in combined.values()
                if isinstance(item.get('score'), (int, float))
            ]
            
            # Sort by score
            ranked = sorted(
                valid_entries,
                key=lambda x: float(x.get('score', 0)),
                reverse=True
            )
            
            return [item['memory'] for item in ranked]
            
        except Exception as e:
            self.logger.error(f"Error combining results: {str(e)}")
            return []

    async def analyze_concept_evolution(
        self,
        concept: str,
        memories: List[Dict]
    ) -> Dict[str, Any]:
        """Enhanced concept evolution analysis"""
        try:
            analysis = {
                'sentiment': [],
                'frequency': 0,
                'context_changes': [],
                'related_concepts': set(),
                'complexity_trend': [],
                'importance_trend': []
            }
            
            concept = concept.lower()
            prev_context = None
            
            for memory in sorted(memories, key=lambda x: x.get('created_at', '')):
                content = memory.get('content', '').lower()
                if concept in content:
                    # Original analysis
                    analysis['frequency'] += 1
                    analysis['sentiment'].append(self._analyze_sentiment(content))
                    analysis['related_concepts'].update(self._extract_key_concepts(content))
                    
                    # Enhanced analysis
                    current_context = memory.get('emotional_context')
                    if prev_context and current_context != prev_context:
                        analysis['context_changes'].append({
                            'from': prev_context,
                            'to': current_context,
                            'timestamp': memory.get('created_at')
                        })
                    prev_context = current_context
                    
                    # Track complexity and importance
                    analysis['complexity_trend'].append({
                        'timestamp': memory.get('created_at'),
                        'complexity': calculate_text_complexity(content)
                    })
                    analysis['importance_trend'].append({
                        'timestamp': memory.get('created_at'),
                        'importance': memory.get('importance', 0)
                    })
                    
            return {
                'sentiment': sum(analysis['sentiment']) / len(analysis['sentiment']) if analysis['sentiment'] else 0,
                'frequency': analysis['frequency'],
                'context_changes': list(analysis['context_changes']),
                'related_concepts': list(analysis['related_concepts']),
                'complexity_trend': analysis['complexity_trend'],
                'importance_trend': analysis['importance_trend'],
                'patterns': analyze_memory_patterns(
                    [m for m in memories if concept in m.get('content', '').lower()]
                )
            }
            
        except Exception as e:
            self.logger.error(f"Error analyzing concept evolution: {str(e)}")
            return {}

    async def generate_summary(self, memories: List[Dict]) -> str:
        """Enhanced summary generation"""
        try:
            if not memories:
                return "No memories to summarize"
            
            # Original summary generation
            contents = [m.get('content', '') for m in memories]
            base_summary = self._generate_summary(' '.join(contents))
            
            # Enhanced summary using patterns and statistics
            patterns = analyze_memory_patterns(memories)
            stats = calculate_memory_statistics(memories)
            
            summary_parts = [
                f"Base Summary: {base_summary}",
                "\nKey Patterns:",
                *[f"- {k}: {v.get('pattern', 'unknown')}" for k, v in patterns.items()],
                "\nStatistics:",
                f"- Total Memories: {stats['total_count']}",
                f"- Average Importance: {stats['importance']['avg']:.2f}",
                f"- Dominant Emotion: {stats['emotional']['dominant_emotion']}",
                f"- Average Connections: {stats['connections']['avg_connections']:.1f}"
            ]
            
            # Add important insights if available
            if stats['importance']['high_importance_count'] > 0:
                summary_parts.append(
                    f"- {stats['importance']['high_importance_count']} high importance memories found"
                )
            
            # Add temporal insights
            time_stats = stats.get('temporal', {})
            if time_stats:
                summary_parts.extend([
                    "\nTemporal Analysis:",
                    f"- Timespan: {time_stats.get('oldest', 'N/A')} to {time_stats.get('newest', 'N/A')}",
                    f"- Average Age: {time_stats.get('avg_age_days', 0):.1f} days"
                ])
            
            return "\n".join(summary_parts)
            
        except Exception as e:
            self.logger.error(f"Error generating enhanced summary: {str(e)}")
            # Fallback to original summary method
            try:
                contents = [m.get('content', '') for m in memories]
                return self._generate_summary(' '.join(contents))
            except Exception as fallback_error:
                self.logger.error(f"Fallback summary error: {str(fallback_error)}")
                return "Error generating summary"
    
    async def _handle_vector_error(self, error: Exception, operation: str):
        """Handle vector operation errors"""
        self.logger.error(f"Vector {operation} error: {str(error)}")
        await self.vector_store.sync_index()  # Try to recover
        return None
    
    async def _process_memories(self, memories: List[Dict]) -> List[Dict]:
        """Process and prepare memories for comparison"""
        try:
            processed = []
            for memory in memories:
                content = self._extract_content(memory)
                if content:
                    memory_copy = memory.copy()
                    memory_copy['_processed_content'] = content
                    processed.append(memory_copy)
            return processed
        except Exception as e:
            self.logger.error(f"Error processing memories: {str(e)}")
            return []
        
    async def store_memory(self, memory_data: Dict[str, Any]):
        response = self.supabase_client.table("memories")\
            .insert(memory_data)\
            .execute()

    async def maintain_memory_system(self):
        """Periodic maintenance of the memory system"""
        try:
            # Consolidate memories
            await self.hierarchy.consolidate_memories(
                threshold=self.config['hierarchy']['consolidation_threshold']
            )
            
            # Prune old memories
            await self.hierarchy.prune_hierarchy(
                age_threshold=self.config['hierarchy']['prune_age_days'],
                importance_threshold=self.config['hierarchy']['min_importance']
            )
            
            # Optimize storage
            for memory_type in ['chat_history', 'tweet_history']:
                response = await self.supabase_client.table('memories')\
                    .select('*')\
                    .eq('type', memory_type)\
                    .execute()
                
                if response.data:
                    optimized = optimize_memory_storage(
                        response.data,
                        max_size=self.config['retrieval']['max_results']
                    )
                    
                    # Archive memories not in optimized set
                    memory_ids = {m['id'] for m in optimized}
                    await self.supabase_client.table('memories')\
                        .update({'archive_status': 'archived'})\
                        .not_.in_('id', list(memory_ids))\
                        .eq('type', memory_type)\
                        .execute()
            
            # Sync vector store
            await self.vector_store.sync_index()
            
        except Exception as e:
            self.logger.error(f"Error in memory maintenance: {str(e)}")

    async def process_new_memory(self, content: str | Dict[str, Any], metadata: Dict[str, Any] = None) -> Dict[str, Any]:
        """Process and store new memory with all enhancements"""
        try:
            # Handle dict content
            if isinstance(content, dict):
                content_str = json.dumps(content)
                print(f"Content with isinstance: {content_str}")
            else:
                content_str = str(content)
            print(f"Content: {content_str}")    
            compressed_content = content_str
            print(f"compressed_content: {compressed_content}")   
            
            if len(compressed_content) > 1000:
                try:
                    compressed_content = await compress_memory_content(content_str)
                except Exception as e:
                    self.logger.error(f"Error compressing memory content: {str(e)}")
                    compressed_content = content_str

            metadata = metadata or {}
            print(f"metadata", metadata)
            memory_id = str(uuid.uuid4()) 
            
            # Analyze content
            analysis = await self.analyze_content(content_str)
            
            # Prepare memory data
            memory_data = {
                "id": memory_id,
                "key": str(uuid.uuid4()),
                "type": metadata.get("type", "general"),
                'content': compressed_content,
                'metadata': {
                    **metadata,
                    'analysis_version': '2.0',
                    'processing_date': datetime.now().isoformat()
                },
                "importance": float(analysis.get("importance", 0.5)),
                'emotional_context': analysis.get('emotional_context', 'neutral'),
                'created_at': datetime.now().isoformat(),
                "complexity": float(analysis.get("complexity", 0)),
                'platform': metadata.get('platform', 'default'),
                'archive_status': 'active'
            }
            print(f"memory_data", memory_data)
            
            # Store in database
            try:
                print(self.supabase_client)
                # Create and execute the query in one step
                response = await self.supabase_client.table("memories")\
                    .insert(memory_data)\
                    .execute()
                
                # Handle the response
                if isinstance(response, dict):
                    data = response.get('data', [])
                else:
                    data = getattr(response, 'data', [])
                
                if not data or not isinstance(data, list) or not data[0]:
                    raise ValueError("No data returned from memory storage")
                    
                stored_memory = data[0]
                memory_id = stored_memory['id']
                print(f"memory_id: {memory_id}")
                
                # Store vector embedding if present
                if 'vector_embedding' in analysis:
                    try:
                        vector_embedding = np.array(analysis['vector_embedding'])
                        vector_data = {
                            'memory_id': memory_id,
                            'embedding': vector_embedding.tolist(),
                            'created_at': datetime.now().isoformat()
                        }
                        
                        # Execute vector storage in one step
                        vector_response = await self.supabase_client.table('memory_embeddings')\
                            .insert(vector_data)\
                            .execute()
                        
                        vector_data = getattr(vector_response, 'data', None) if not isinstance(vector_response, dict) \
                            else vector_response.get('data')
                        
                        if not vector_data:
                            self.logger.warning("Failed to store vector embedding")
                            
                    except Exception as ve:
                        self.logger.warning(f"Failed to store vector embedding: {ve}")
                
                try:
                    # Add to hierarchy if related memories exist
                    similar = await self.find_most_similar(
                        {'content': content_str},
                        []  # Let the system find candidates
                    )
                    
                    if similar and isinstance(similar, dict) and 'id' in similar:
                        await self.hierarchy.add_memory_relationship(
                            similar['id'],
                            memory_id,
                            'semantic',
                            float(similar.get('similarity', 0.5))
                        )
                except Exception as hierarchy_error:
                    self.logger.warning(f"Failed to establish memory relationships: {hierarchy_error}")

                return {
                    'success': True,
                    'id': memory_id,
                    'stored_memory': stored_memory,
                    'analysis': analysis
                }
                    
            except Exception as db_error:
                self.logger.error(f"Database operation failed: {str(db_error)}")
                return {
                    'success': False,
                    'error': str(db_error)
                }

        except Exception as e:
            self.logger.error(f"Error processing new memory: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    @staticmethod
    def get_memory_config() -> Dict[str, Any]:
        """Get current memory system configuration"""
        return {
            'version': '2.0',
            'features': {
                'vector_similarity': True,
                'hierarchical_storage': True,
                'pattern_analysis': True,
                'automatic_maintenance': True,
                'content_optimization': True
            },
            'capabilities': {
                'clustering': True,
                'concept_evolution': True,
                'semantic_search': True,
                'pattern_recognition': True,
                'importance_calculation': True
            },
            'thresholds': MEMORY_CONFIG
        }

    async def query_memories(
        self,
        memory_type: str,
        limit: int = 10,
        filters: Dict[str, Any] = None
    ) -> List[Dict[str, Any]]:
        """Query memories by type with optional filters"""
        try:
            query = self.supabase_client.table('memories')\
                .select('*')\
                .eq('type', memory_type)\
                .eq('archive_status', 'active')
            
            if filters:
                for key, value in filters.items():
                    query = query.eq(key, value)
                    
            response = await query\
                .order('created_at', desc=True)\
                .limit(limit)\
                .execute()
                
            return response.data if response.data else []
            
        except Exception as e:
            print(f"Error querying memories: {str(e)}")
            return []
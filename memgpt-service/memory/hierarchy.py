from typing import List, Dict, Any, Optional, Set
from dataclasses import dataclass
from datetime import datetime
import asyncio
from supabase import Client
import networkx as nx
import json
import logging
from collections import defaultdict
from .utils.supabase_helpers import handle_supabase_response, safe_supabase_execute

@dataclass
class MemoryNode:
    id: str
    type: str
    content: str
    metadata: Dict
    importance: float
    created_at: datetime
    children: List[str] = None
    parents: List[str] = None

class MemoryHierarchy:
    def __init__(self, supabase: Client):
        self.supabase = supabase
        self.graph = nx.DiGraph()
        self.cache = {}
        self.importance_threshold = 0.7
        
    async def add_memory_relationship(self, parent_id: str, child_id: str, 
                                    hierarchy_type: str, relevance_score: float):
        try:
            success, _ = await safe_supabase_execute(
                self.supabase.table('memory_hierarchies').insert({
                    'parent_memory_id': parent_id,
                    'child_memory_id': child_id,
                    'hierarchy_type': hierarchy_type,
                    'relevance_score': relevance_score
                }),
                "Failed to add memory relationship"
            )
            
            if success:
                self.graph.add_edge(
                    parent_id,
                    child_id,
                    type=hierarchy_type,
                    relevance=relevance_score
                )
                
        except Exception as e:
            logging.error(f"Error adding relationship: {str(e)}")

    async def get_memory_tree(
        self,
        root_id: str,
        max_depth: int = 3,
        min_relevance: float = 0.5
    ) -> Optional[Dict]:
        """Get memory hierarchy tree"""
        try:
            visited = set()
            async def build_tree(node_id: str, depth: int) -> Optional[Dict]:
                if depth > max_depth or node_id in visited:
                    return None
                    
                visited.add(node_id)
                
                # Get node data
                response = await self.supabase.table('memories')\
                    .select('*')\
                    .eq('id', node_id)\
                    .single()\
                    .execute()
                
                if not response.data:
                    return None
                    
                memory = response.data
                
                # Get children
                children_response = await self.supabase.table('memory_hierarchies')\
                    .select('child_memory_id, hierarchy_type, relevance_score')\
                    .eq('parent_memory_id', node_id)\
                    .gte('relevance_score', min_relevance)\
                    .execute()
                
                children = []
                for rel in children_response.data:
                    child = await build_tree(rel['child_memory_id'], depth + 1)
                    if child:
                        children.append({
                            **child,
                            'relationship': {
                                'type': rel['hierarchy_type'],
                                'relevance': rel['relevance_score']
                            }
                        })
                
                return {
                    'id': node_id,
                    'content': memory['content'],
                    'type': memory['type'],
                    'metadata': memory['metadata'],
                    'importance': memory['importance'],
                    'children': children
                }
                
            return await build_tree(root_id, 0)
            
        except Exception as e:
            logging.error(f"Error getting memory tree: {str(e)}")
            return None

    async def find_common_ancestors(
        self,
        memory_ids: List[str],
        max_distance: int = 3
    ) -> List[str]:
        """Find common ancestors of multiple memories"""
        try:
            ancestors = []
            for memory_id in memory_ids:
                response = await self.supabase.rpc(
                    'get_memory_ancestors',
                    {'memory_id': memory_id, 'max_distance': max_distance}
                ).execute()
                
                if response.data:
                    ancestors.append(set(response.data))
                    
            if ancestors:
                return list(set.intersection(*ancestors))
            return []
            
        except Exception as e:
            logging.error(f"Error finding ancestors: {str(e)}")
            return []

    async def consolidate_memories(self, threshold: float = 0.8):
        """Consolidate similar memories in hierarchy"""
        try:
            # Get all memories without parents
            response = await self.supabase.rpc(
                'get_root_memories',
                {'threshold': threshold}
            ).execute()
            
            if not response.data:
                return
                
            for memory in response.data:
                similar_memories = await self.supabase.rpc(
                    'find_similar_memories',
                    {
                        'memory_id': memory['id'],
                        'similarity_threshold': threshold
                    }
                ).execute()
                
                if similar_memories.data:
                    # Create a consolidated memory
                    consolidated = await self._create_consolidated_memory(
                        [memory] + similar_memories.data
                    )
                    
                    # Update hierarchy relationships
                    for mem in similar_memories.data:
                        await self.add_memory_relationship(
                            consolidated['id'],
                            mem['id'],
                            'consolidated',
                            1.0
                        )
        except Exception as e:
            logging.error(f"Error consolidating memories: {str(e)}")

    async def _create_consolidated_memory(self, memories: List[Dict]) -> Dict:
        """Create a consolidated memory from multiple memories"""
        try:
            # Combine content and metadata
            combined_content = "\n".join([m['content'] for m in memories])
            
            metadata = {
                'source_memories': [m['id'] for m in memories],
                'consolidation_date': datetime.now().isoformat(),
                'source_count': len(memories)
            }
            
            # Calculate average importance
            avg_importance = sum(m['importance'] for m in memories) / len(memories)
            
            # Create new consolidated memory
            response = await self.supabase.table('memories').insert({
                'content': combined_content,
                'type': 'consolidated',
                'metadata': metadata,
                'importance': avg_importance,
                'emotional_context': self._combine_emotional_contexts(memories),
                'associations': self._merge_associations(memories)
            }).execute()
            
            return response.data[0]
            
        except Exception as e:
            logging.error(f"Error creating consolidated memory: {str(e)}")
            raise

    def _combine_emotional_contexts(self, memories: List[Dict]) -> str:
        """Combine emotional contexts from multiple memories"""
        contexts = [m['emotional_context'] for m in memories if m.get('emotional_context')]
        if not contexts:
            return 'neutral'
            
        # Count occurrences of each context
        context_counts = defaultdict(int)
        for context in contexts:
            context_counts[context] += 1
            
        # Return most common context
        return max(context_counts.items(), key=lambda x: x[1])[0]

    def _merge_associations(self, memories: List[Dict]) -> List[str]:
        """Merge associations from multiple memories"""
        all_associations = set()
        for memory in memories:
            if isinstance(memory.get('associations'), list):
                all_associations.update(memory['associations'])
            elif isinstance(memory.get('associations'), str):
                all_associations.add(memory['associations'])
        return list(all_associations)

    async def recompute_importance(self, memory_id: str):
        """Recompute memory importance based on connections"""
        try:
            # Get all connections
            response = await self.supabase.rpc(
                'get_memory_connections',
                {'memory_id': memory_id}
            ).execute()
            
            if not response.data:
                return
                
            connections = response.data
            
            # Base importance from direct connections
            direct_importance = len(connections) * 0.1
            
            # Importance from connection strengths
            strength_importance = sum(
                conn['relevance_score'] 
                for conn in connections
            ) / len(connections)
            
            # Time decay factor
            memory = await self.supabase.table('memories')\
                .select('created_at')\
                .eq('id', memory_id)\
                .single()\
                .execute()
                
            if memory.data:
                age = (datetime.now() - datetime.fromisoformat(memory.data['created_at'])).days
                time_factor = 1.0 / (1.0 + (age / 30))  # 30-day half-life
            else:
                time_factor = 1.0
            
            # Calculate final importance
            final_importance = (
                (direct_importance * 0.3) +
                (strength_importance * 0.5) +
                (time_factor * 0.2)
            )
            
            # Update memory importance
            await self.supabase.table('memories')\
                .update({'importance': final_importance})\
                .eq('id', memory_id)\
                .execute()
                
        except Exception as e:
            logging.error(f"Error recomputing importance: {str(e)}")

    async def prune_hierarchy(self, age_threshold: int = 30, importance_threshold: float = 0.3):
        """Prune old, unimportant memories from hierarchy"""
        try:
            # Find candidates for pruning
            cutoff_date = datetime.now() - timedelta(days=age_threshold)
            
            response = await self.supabase.table('memories')\
                .select('id')\
                .lt('created_at', cutoff_date.isoformat())\
                .lt('importance', importance_threshold)\
                .execute()
                
            if not response.data:
                return
                
            for memory in response.data:
                # Check if memory has important connections
                connections = await self.supabase.rpc(
                    'get_memory_connections',
                    {'memory_id': memory['id']}
                ).execute()
                
                if not connections.data:
                    # Archive memory
                    await self.supabase.table('memories')\
                        .update({'archive_status': 'archived'})\
                        .eq('id', memory['id'])\
                        .execute()
                        
                    # Remove from hierarchy
                    await self.supabase.table('memory_hierarchies')\
                        .delete()\
                        .or_(
                            f"parent_memory_id.eq.{memory['id']},"
                            f"child_memory_id.eq.{memory['id']}"
                        )\
                        .execute()
                    
        except Exception as e:
            logging.error(f"Error pruning hierarchy: {str(e)}")
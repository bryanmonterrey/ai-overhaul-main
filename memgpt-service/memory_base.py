from typing import List, Dict, Any, Optional, Callable
from datetime import datetime
import json
import asyncio
from collections import defaultdict

class Memory:
    def __init__(self, blocks: Optional[List[Dict[str, Any]]] = None):
        self.blocks = blocks or []
        self.indices: Dict[str, Dict[str, List[int]]] = defaultdict(lambda: defaultdict(list))
        self.last_accessed: Dict[str, datetime] = {}
        self._build_indices()
        
    def _build_indices(self) -> None:
        """Build indices for efficient searching"""
        self.indices.clear()
        for i, block in enumerate(self.blocks):
            # Index by key
            key = block.get('key')
            if key:
                self.indices['key'][key].append(i)
                
            # Index by type
            block_type = block.get('type')
            if block_type:
                self.indices['type'][block_type].append(i)
                
            # Index by content words (simple implementation)
            content = block.get('content', '')
            if isinstance(content, str):
                words = set(content.lower().split())
                for word in words:
                    self.indices['word'][word].append(i)

    async def search(
        self, 
        query: str, 
        limit: int = 10,
        filter_fn: Optional[Callable[[Dict[str, Any]], bool]] = None
    ) -> List[Dict[str, Any]]:
        """Search through memory blocks"""
        try:
            # Get words from query
            query_words = set(query.lower().split())
            
            # Calculate relevance scores
            scores = defaultdict(float)
            for word in query_words:
                for idx in self.indices['word'].get(word, []):
                    scores[idx] += 1 / len(query_words)
                    
            # Sort by score and apply filter
            candidates = [(i, s) for i, s in scores.items()]
            candidates.sort(key=lambda x: x[1], reverse=True)
            
            results = []
            for idx, score in candidates:
                block = self.blocks[idx]
                if filter_fn and not filter_fn(block):
                    continue
                    
                # Add score to result
                result = {**block, 'relevance_score': score}
                results.append(result)
                
                if len(results) >= limit:
                    break
                    
            return results
            
        except Exception as e:
            print(f"Error in memory search: {str(e)}")
            return []

    async def get(self, key: str) -> Optional[Dict[str, Any]]:
        """Get a specific memory block by key"""
        try:
            indices = self.indices['key'].get(key, [])
            if indices:
                idx = indices[0]  # Get first occurrence
                block = self.blocks[idx]
                self.last_accessed[key] = datetime.now()
                return block
            return None
        except Exception as e:
            print(f"Error getting memory: {str(e)}")
            return None
            
    def add_block(self, block: Dict[str, Any]) -> bool:
        """Add a new memory block"""
        try:
            self.blocks.append(block)
            # Update indices
            idx = len(self.blocks) - 1
            
            # Index by key
            key = block.get('key')
            if key:
                self.indices['key'][key].append(idx)
                
            # Index by type
            block_type = block.get('type')
            if block_type:
                self.indices['type'][block_type].append(idx)
                
            # Index content
            content = block.get('content', '')
            if isinstance(content, str):
                words = set(content.lower().split())
                for word in words:
                    self.indices['word'][word].append(idx)
                    
            return True
        except Exception as e:
            print(f"Error adding memory block: {str(e)}")
            return False
            
    def update_block(self, key: str, updates: Dict[str, Any]) -> bool:
        """Update an existing memory block"""
        try:
            indices = self.indices['key'].get(key, [])
            if not indices:
                return False
                
            idx = indices[0]
            current = self.blocks[idx]
            
            # Update block
            updated = {**current, **updates}
            self.blocks[idx] = updated
            
            # Rebuild indices if content changed
            if 'content' in updates:
                self._build_indices()
                
            return True
        except Exception as e:
            print(f"Error updating memory block: {str(e)}")
            return False
            
    def get_blocks_by_type(self, block_type: str) -> List[Dict[str, Any]]:
        """Get all memory blocks of a specific type"""
        try:
            indices = self.indices['type'].get(block_type, [])
            return [self.blocks[idx] for idx in indices]
        except Exception as e:
            print(f"Error getting blocks by type: {str(e)}")
            return []

    def clear(self) -> None:
        """Clear all memory blocks and indices"""
        self.blocks = []
        self.indices.clear()
        self.last_accessed.clear()
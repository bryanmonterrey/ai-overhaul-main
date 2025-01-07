from typing import List, Dict, Any, Optional, Tuple
import numpy as np
from supabase import Client
import asyncio
from datetime import datetime
import json
from .utils.embedding import EmbeddingManager
import faiss
import logging
from tenacity import retry, stop_after_attempt, wait_exponential

class VectorStore:
    def __init__(self, supabase: Client, embedding_manager: Optional[EmbeddingManager] = None):
        self.supabase = supabase
        self.embedding_manager = embedding_manager or EmbeddingManager()
        self.index = None
        self.memory_map = {}
        self.last_sync = None
        self._initialize_faiss()
        
    def _initialize_faiss(self):
        """Initialize FAISS index"""
        self.index = faiss.IndexFlatIP(1536)  # Cosine similarity
        if faiss.get_num_gpus() > 0:
            self.index = faiss.index_cpu_to_gpu(
                faiss.StandardGpuResources(),
                0,
                self.index
            )

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
    async def store_vector(self, memory_id: str, embedding: np.ndarray) -> bool:
        """Store vector embedding in database"""
        try:
            # Prepare the data
            insert_data = {
                'memory_id': memory_id,
                'embedding': embedding.tolist(),
                'created_at': datetime.now().isoformat()
            }
            
            # Create the query
            query = self.supabase.table('memory_embeddings').insert(insert_data)
            
            # Execute the query
            response = await query.execute()
            
            if not hasattr(response, 'data') or not response.data:
                logging.error("No data returned from Supabase")
                return False
                
            # Update FAISS index
            try:
                reshaped = embedding.reshape(1, -1)
                self.index.add(reshaped)
                self.memory_map[self.index.ntotal - 1] = memory_id
                return True
            except Exception as e:
                logging.error(f"Error updating FAISS index: {str(e)}")
                return False
                
        except Exception as e:
            logging.error(f"Error storing vector: {str(e)}")
            return False

    async def get_vectors(self, memory_ids: List[str]) -> Dict[str, np.ndarray]:
        """Retrieve vectors for given memory IDs"""
        try:
            response = await self.supabase.table('memory_embeddings')\
                .select('memory_id, embedding')\
                .in_('memory_id', memory_ids)\
                .execute()
            
            if not response or not hasattr(response, 'data'):
                logging.error("Invalid response from Supabase")
                return {}
                
            return {
                row['memory_id']: np.array(row['embedding'])
                for row in response.data
            }
        except Exception as e:
            logging.error(f"Error retrieving vectors: {str(e)}")
            return {}

    async def similarity_search(
        self,
        query_embedding: np.ndarray,
        k: int = 5,
        threshold: float = 0.7
    ) -> List[Tuple[str, float]]:
        """Perform similarity search"""
        try:
            # Search FAISS index
            scores, indices = self.index.search(
                query_embedding.reshape(1, -1),
                k
            )
            
            # Filter and format results
            results = []
            for score, idx in zip(scores[0], indices[0]):
                if score < threshold:
                    continue
                memory_id = self.memory_map.get(idx)
                if memory_id:
                    results.append((memory_id, float(score)))
            
            return results
        except Exception as e:
            logging.error(f"Search error: {str(e)}")
            return []

    async def batch_similarity_search(
        self,
        query_embeddings: np.ndarray,
        k: int = 5
    ) -> List[List[Tuple[str, float]]]:
        """Batch similarity search"""
        try:
            scores, indices = self.index.search(query_embeddings, k)
            results = []
            for batch_scores, batch_indices in zip(scores, indices):
                batch_results = []
                for score, idx in zip(batch_scores, batch_indices):
                    memory_id = self.memory_map.get(idx)
                    if memory_id:
                        batch_results.append((memory_id, float(score)))
                results.append(batch_results)
            return results
        except Exception as e:
            logging.error(f"Batch search error: {str(e)}")
            return []

    async def sync_index(self):
        """Sync FAISS index with database"""
        try:
            # Get all embeddings
            response = await self.supabase.table('memory_embeddings')\
                .select('memory_id, embedding, created_at')\
                .execute()
            
            if not response.data:
                return
                
            # Reset index
            self._initialize_faiss()
            self.memory_map.clear()
            
            # Add all vectors
            embeddings = []
            for row in response.data:
                embedding = np.array(row['embedding'])
                embeddings.append(embedding)
                self.memory_map[len(embeddings)-1] = row['memory_id']
                
            if embeddings:
                self.index.add(np.vstack(embeddings))
            
            self.last_sync = datetime.now()
        except Exception as e:
            logging.error(f"Sync error: {str(e)}")

    async def retrieve_vector(self, memory_id: str) -> Optional[np.ndarray]:
        """Retrieve vector for a memory"""
        try:
            query = self.supabase.table('memory_embeddings')\
                .select('embedding')\
                .eq('memory_id', memory_id)\
                .single()
            response = await query.execute()
                
            if not hasattr(response, 'data') or not response.data:
                return None
                
            embedding_data = response.data.get('embedding')
            if embedding_data:
                return np.array(embedding_data)
                
            return None
            
        except Exception as e:
            logging.error(f"Error retrieving vector: {str(e)}")
            return None

    async def delete_vectors(self, memory_ids: List[str]):
        """Delete vectors from storage"""
        try:
            await self.supabase.table('memory_embeddings')\
                .delete()\
                .in_('memory_id', memory_ids)\
                .execute()
            
            # Rebuild index after deletion
            await self.sync_index()
        except Exception as e:
            logging.error(f"Delete error: {str(e)}")
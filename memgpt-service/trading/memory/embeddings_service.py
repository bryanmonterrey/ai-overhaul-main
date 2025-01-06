from openai import OpenAI
import os
import asyncio
from typing import List
import numpy as np

class EmbeddingsService:
    def __init__(self):
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        self._cache = {}  # Simple in-memory cache
        
    async def get_embeddings(self, texts: List[str]) -> List[np.ndarray]:
        """Get embeddings for a list of texts"""
        try:
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: self.client.embeddings.create(
                    model="text-embedding-ada-002",
                    input=texts
                )
            )
            
            # Convert to numpy arrays
            embeddings = [np.array(embedding.embedding) for embedding in response.data]
            
            # Cache the results
            for text, embedding in zip(texts, embeddings):
                self._cache[text] = embedding
                
            return embeddings
            
        except Exception as e:
            print(f"Error getting embeddings: {e}")
            raise
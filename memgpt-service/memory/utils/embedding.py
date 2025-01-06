import numpy as np
import asyncio
from typing import List, Dict, Any, Optional, Union
from openai import OpenAI
from tenacity import retry, stop_after_attempt, wait_exponential
import tiktoken
from collections import deque
import logging
from datetime import datetime, timedelta
import os

class EmbeddingManager:
    def __init__(self, model: str = "text-embedding-ada-002", batch_size: int = 8):
        self.model = model
        self.batch_size = batch_size
        self.cache = {}
        self.request_queue = deque()
        self.encoder = tiktoken.encoding_for_model(model)
        self.token_limit = 8191  # OpenAI's limit
        self.semaphore = asyncio.Semaphore(10)  # Rate limiting
        self.last_request = datetime.now()
        self.requests_per_minute = 0
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
    async def get_embedding(self, text: str) -> np.ndarray:
        """Get embedding with retry logic and caching"""
        if text in self.cache:
            return self.cache[text]
            
        async with self.semaphore:
            # Rate limiting
            now = datetime.now()
            if (now - self.last_request).seconds < 60:
                self.requests_per_minute += 1
                if self.requests_per_minute > 150:  # OpenAI's rate limit
                    await asyncio.sleep(1)
                    self.requests_per_minute = 0
            else:
                self.requests_per_minute = 1
                
            self.last_request = now
            
            try:
                # Use the new API format
                loop = asyncio.get_event_loop()
                response = await loop.run_in_executor(
                    None, 
                    lambda: self.client.embeddings.create(
                        input=text,
                        model=self.model
                    )
                )
                embedding = np.array(response.data[0].embedding)
                self.cache[text] = embedding
                return embedding
            except Exception as e:
                logging.error(f"Embedding error: {str(e)}")
                raise

    async def batch_get_embeddings(self, texts: List[str]) -> List[np.ndarray]:
        """Process multiple texts in batches"""
        results = []
        for i in range(0, len(texts), self.batch_size):
            batch = texts[i:i + self.batch_size]
            tasks = [self.get_embedding(text) for text in batch]
            batch_results = await asyncio.gather(*tasks)
            results.extend(batch_results)
        return results

    def preprocess_text(self, text: str, max_length: int = 8000) -> str:
        """Preprocess text for embedding"""
        # Count tokens
        tokens = self.encoder.encode(text)
        if len(tokens) > max_length:
            # Truncate while preserving meaning
            tokens = tokens[:max_length]
            text = self.encoder.decode(tokens)
            
        # Basic cleaning
        text = text.replace("\n", " ").strip()
        return text

    async def get_semantic_chunks(self, text: str, chunk_size: int = 1000) -> List[Dict[str, Any]]:
        """Split text into semantic chunks with overlap"""
        tokens = self.encoder.encode(text)
        chunks = []
        
        for i in range(0, len(tokens), chunk_size):
            chunk_tokens = tokens[i:i + chunk_size]
            if i > 0:  # Add overlap with previous chunk
                chunk_tokens = tokens[i-100:i + chunk_size]
            chunk_text = self.encoder.decode(chunk_tokens)
            embedding = await self.get_embedding(chunk_text)
            chunks.append({
                'text': chunk_text,
                'embedding': embedding,
                'start_idx': i,
                'end_idx': min(i + chunk_size, len(tokens))
            })
        return chunks

    def clear_cache(self, older_than: Optional[timedelta] = None):
        """Clear embedding cache"""
        if older_than is None:
            self.cache.clear()
        else:
            current_time = datetime.now()
            self.cache = {
                k: v for k, v in self.cache.items() 
                if v.get('timestamp', current_time) > current_time - older_than
            }
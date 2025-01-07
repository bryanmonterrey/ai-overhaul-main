from .vector_store import VectorStore
from .hierarchy import MemoryHierarchy, MemoryNode
from .retrieval import MemoryRetrieval, SearchResult
from .utils import EmbeddingManager
from typing import Dict, Any
import json
import os

__version__ = '0.1.0'

# Configuration defaults
DEFAULT_EMBEDDING_MODEL = "text-embedding-ada-002"
DEFAULT_VECTOR_DIMENSION = 1536
DEFAULT_BATCH_SIZE = 8
DEFAULT_IMPORTANCE_THRESHOLD = 0.7
DEFAULT_SIMILARITY_THRESHOLD = 0.8

__all__ = [
    'VectorStore',
    'MemoryHierarchy',
    'MemoryNode',
    'MemoryRetrieval',
    'SearchResult',
    'EmbeddingManager',
    'DEFAULT_EMBEDDING_MODEL',
    'DEFAULT_VECTOR_DIMENSION',
    'DEFAULT_BATCH_SIZE',
    'DEFAULT_IMPORTANCE_THRESHOLD',
    'DEFAULT_SIMILARITY_THRESHOLD'
]

def handle_supabase_response(response):
    """Helper to consistently handle Supabase responses"""
    try:
        if isinstance(response, dict):
            return response.get('data', [])
        if hasattr(response, 'data'):
            return response.data or []
        return []
    except Exception as e:
        print(f"Error handling Supabase response: {str(e)}")
        return []

def init_memory_system(supabase_client):
    """Initialize the complete memory system"""
    embedding_manager = EmbeddingManager(
        model=DEFAULT_EMBEDDING_MODEL,
        batch_size=DEFAULT_BATCH_SIZE
    )
    
    vector_store = VectorStore(
        supabase=supabase_client,
        embedding_manager=embedding_manager
    )
    
    hierarchy = MemoryHierarchy(
        supabase=supabase_client
    )
    
    retrieval = MemoryRetrieval(
        supabase=supabase_client,
        vector_store=vector_store,
        embedding_manager=embedding_manager
    )
    
    return {
        'embedding_manager': embedding_manager,
        'vector_store': vector_store,
        'hierarchy': hierarchy,
        'retrieval': retrieval
    }

MEMORY_CONFIG = {
    'embedding': {
        'model': os.getenv('MEMORY_EMBEDDING_MODEL', 'text-embedding-ada-002'),
        'cache_size': int(os.getenv('MEMORY_CACHE_SIZE', '10000')),
        'batch_size': int(os.getenv('MEMORY_BATCH_SIZE', '8')),
        'max_tokens': int(os.getenv('MEMORY_MAX_TOKENS', '8191'))
    },
    'retrieval': {
        'default_strategy': os.getenv('MEMORY_RETRIEVAL_STRATEGY', 'hybrid'),
        'min_relevance': float(os.getenv('MEMORY_MIN_RELEVANCE', '0.5')),
        'max_results': int(os.getenv('MEMORY_MAX_RESULTS', '10')),
        'context_window': int(os.getenv('MEMORY_CONTEXT_WINDOW', '5'))
    },
    'hierarchy': {
        'max_depth': int(os.getenv('MEMORY_MAX_DEPTH', '5')),
        'consolidation_threshold': float(os.getenv('MEMORY_CONSOLIDATION_THRESHOLD', '0.8')),
        'prune_age_days': int(os.getenv('MEMORY_PRUNE_AGE', '30')),
        'min_importance': float(os.getenv('MEMORY_MIN_IMPORTANCE', '0.3'))
    },
    'vector_store': {
        'index_type': os.getenv('MEMORY_INDEX_TYPE', 'flat'),
        'sync_interval': int(os.getenv('MEMORY_SYNC_INTERVAL', '3600')),
        'dimension': int(os.getenv('MEMORY_VECTOR_DIMENSION', '1536'))
    }
}

def load_config(config_path: str = None) -> Dict[str, Any]:
    """Load configuration from file or environment"""
    if config_path and os.path.exists(config_path):
        with open(config_path, 'r') as f:
            file_config = json.load(f)
            return _merge_configs(MEMORY_CONFIG, file_config)
    return MEMORY_CONFIG

def _merge_configs(base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
    """Deep merge configuration dictionaries"""
    merged = base.copy()
    for key, value in override.items():
        if key in merged and isinstance(merged[key], dict) and isinstance(value, dict):
            merged[key] = _merge_configs(merged[key], value)
        else:
            merged[key] = value
    return merged

# Add utility function to validate configuration
def validate_config(config: Dict[str, Any]) -> bool:
    """Validate memory system configuration"""
    required_keys = {
        'embedding': ['model', 'batch_size'],
        'retrieval': ['default_strategy', 'min_relevance'],
        'hierarchy': ['max_depth', 'consolidation_threshold'],
        'vector_store': ['index_type', 'dimension']
    }
    
    try:
        for section, keys in required_keys.items():
            if section not in config:
                raise ValueError(f"Missing required section: {section}")
            for key in keys:
                if key not in config[section]:
                    raise ValueError(f"Missing required key in {section}: {key}")
        return True
    except Exception as e:
        logging.error(f"Configuration validation error: {str(e)}")
        return False
    
    
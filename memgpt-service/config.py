from typing import Optional, Dict, Any

class LLMConfig:
    def __init__(
        self, 
        model: str,
        model_endpoint_type: str,
        context_window: int,
        model_endpoint: str,
        embedding_endpoint_type: str,
        embedding_endpoint: str,
        embedding_model: str
    ):
        self.model = model
        self.model_endpoint_type = model_endpoint_type
        self.context_window = context_window
        self.model_endpoint = model_endpoint
        self.embedding_endpoint_type = embedding_endpoint_type
        self.embedding_endpoint = embedding_endpoint
        self.embedding_model = embedding_model
        self.api_key = None
        self.options: Dict[str, Any] = {}
        
    def set_api_key(self, api_key: str) -> None:
        self.api_key = api_key
        
    def set_option(self, key: str, value: Any) -> None:
        self.options[key] = value
        
    def get_option(self, key: str, default: Any = None) -> Any:
        return self.options.get(key, default)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert config to dictionary format"""
        return {
            'model': self.model,
            'model_endpoint_type': self.model_endpoint_type,
            'context_window': self.context_window,
            'model_endpoint': self.model_endpoint,
            'embedding_endpoint_type': self.embedding_endpoint_type, 
            'embedding_endpoint': self.embedding_endpoint,
            'embedding_model': self.embedding_model,
            'options': self.options
        }
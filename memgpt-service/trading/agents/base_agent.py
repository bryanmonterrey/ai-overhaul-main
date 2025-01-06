from abc import ABC, abstractmethod
from typing import Dict, Any

class BaseAgent(ABC):
    """Base class for all trading agents"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.logger = config.get('logger')

    @abstractmethod
    async def analyze_market(self, *args, **kwargs):
        """Abstract method to be implemented by child classes"""
        pass 
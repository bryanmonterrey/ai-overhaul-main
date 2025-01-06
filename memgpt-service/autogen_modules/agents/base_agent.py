"""
Base Agent implementation for AutoGen system.
Provides sophisticated foundation for specialized agents.
"""
from typing import Dict, Any, List, Optional, Callable
from abc import ABC, abstractmethod
import asyncio
from datetime import datetime
import logging
from autogen_modules.config import AgentConfig, AgentRole

class BaseAgent(ABC):
    """Abstract base class for all AutoGen agents"""
    
    def __init__(self, config: AgentConfig):
        self.config = config
        self.role = config.role
        self.name = config.name
        self.capabilities = config.capabilities
        self.memory = {}  # Initialize with agent's memory system
        self.state: Dict[str, Any] = {
            "current_task": None,
            "status": "idle",
            "last_action": None,
            "performance_metrics": {},
            "conversation_history": []
        }
        
        # Set up logging
        self.logger = logging.getLogger(f"autogen.agent.{self.name}")
        self.logger.setLevel(logging.INFO)
        
        # Initialize performance monitoring
        self._init_performance_monitoring()
        
    def _init_performance_monitoring(self):
        """Initialize performance monitoring metrics"""
        self.metrics = {
            "tasks_completed": 0,
            "success_rate": 1.0,
            "average_response_time": 0,
            "total_tokens_used": 0,
            "start_time": datetime.now(),
        }
        
    async def process_message(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """Process incoming message with sophistication and error handling"""
        try:
            self.logger.info(f"Processing message: {message.get('type', 'unknown')}")
            
            # Pre-processing
            processed_message = await self._preprocess_message(message)
            
            # Core processing
            start_time = datetime.now()
            response = await self._execute_core_logic(processed_message)
            
            # Post-processing and metrics update
            processing_time = (datetime.now() - start_time).total_seconds()
            await self._update_metrics(processing_time)
            
            # Validate response
            validated_response = await self._validate_response(response)
            
            return validated_response
            
        except Exception as e:
            self.logger.error(f"Error processing message: {str(e)}")
            return {
                "status": "error",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
            
    async def _preprocess_message(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """Sophisticated message preprocessing"""
        # Validate message format
        if not isinstance(message, dict):
            raise ValueError("Message must be a dictionary")
            
        # Ensure required fields
        required_fields = ["type", "content", "sender"]
        for field in required_fields:
            if field not in message:
                raise ValueError(f"Missing required field: {field}")
                
        # Add metadata
        message["processed_at"] = datetime.now().isoformat()
        message["agent_state"] = self.state["status"]
        
        return message
        
    @abstractmethod
    async def _execute_core_logic(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """Core logic to be implemented by specific agents"""
        pass
        
    async def _validate_response(self, response: Dict[str, Any]) -> Dict[str, Any]:
        """Validate and enhance response"""
        if not isinstance(response, dict):
            raise ValueError("Response must be a dictionary")
            
        # Ensure required response fields
        required_fields = ["status", "content"]
        for field in required_fields:
            if field not in response:
                response[field] = None
                
        # Add metadata
        response.update({
            "agent_name": self.name,
            "agent_role": self.role.value,
            "timestamp": datetime.now().isoformat(),
            "metrics": {
                "response_time": self.metrics["average_response_time"],
                "success_rate": self.metrics["success_rate"]
            }
        })
        
        return response
        
    async def _update_metrics(self, processing_time: float):
        """Update agent performance metrics"""
        self.metrics["tasks_completed"] += 1
        
        # Update average response time with exponential moving average
        alpha = 0.1  # Smoothing factor
        current_avg = self.metrics["average_response_time"]
        self.metrics["average_response_time"] = (alpha * processing_time + 
                                               (1 - alpha) * current_avg)
                                               
        # Update success rate if applicable
        if self.state.get("last_action_success") is not None:
            success_weight = 1 / self.metrics["tasks_completed"]
            self.metrics["success_rate"] = (
                success_weight * int(self.state["last_action_success"]) +
                (1 - success_weight) * self.metrics["success_rate"]
            )
            
    async def update_status(self, status: str, task: Optional[Dict[str, Any]] = None):
        """Update agent status with sophisticated state management"""
        old_status = self.state["status"]
        self.state["status"] = status
        self.state["current_task"] = task
        self.state["last_status_change"] = datetime.now().isoformat()
        
        # Log status change
        self.logger.info(f"Status changed: {old_status} -> {status}")
        
        # Trigger status-specific behaviors
        await self._handle_status_change(old_status, status)
        
    async def _handle_status_change(self, old_status: str, new_status: str):
        """Handle status transitions"""
        status_handlers = {
            "idle": self._handle_idle_status,
            "working": self._handle_working_status,
            "waiting": self._handle_waiting_status,
            "error": self._handle_error_status
        }
        
        if new_status in status_handlers:
            await status_handlers[new_status]()
            
    async def _handle_idle_status(self):
        """Handle transition to idle status"""
        # Clean up any resources
        await self._cleanup_resources()
        
        # Check for pending tasks
        await self._check_pending_tasks()
        
    async def _handle_working_status(self):
        """Handle transition to working status"""
        # Initialize task monitoring
        await self._init_task_monitoring()
        
    async def _handle_waiting_status(self):
        """Handle transition to waiting status"""
        # Set up timeout monitoring
        await self._setup_timeout_monitoring()
        
    async def _handle_error_status(self):
        """Handle transition to error status"""
        # Implement error recovery procedures
        await self._initiate_error_recovery()
        
    async def _cleanup_resources(self):
        """Clean up agent resources"""
        pass  # Implement resource cleanup
        
    async def _check_pending_tasks(self):
        """Check for pending tasks"""
        pass  # Implement pending task check
        
    async def _init_task_monitoring(self):
        """Initialize task monitoring"""
        pass  # Implement task monitoring
        
    async def _setup_timeout_monitoring(self):
        """Set up timeout monitoring"""
        pass  # Implement timeout monitoring
        
    async def _initiate_error_recovery(self):
        """Initiate error recovery procedures"""
        pass  # Implement error recovery
        
    def get_capabilities(self) -> List[str]:
        """Get agent capabilities"""
        return self.capabilities
        
    def get_metrics(self) -> Dict[str, Any]:
        """Get agent performance metrics"""
        return self.metrics
        
    def get_state(self) -> Dict[str, Any]:
        """Get current agent state"""
        return self.state
from typing import Optional, Dict, Any, List
from datetime import datetime
import json
import asyncio

class CLIInterface:
    def __init__(self):
        self.history: List[Dict[str, Any]] = []
        self.callbacks: Dict[str, callable] = {}
        
    async def display(self, message: str, message_type: str = "info") -> None:
        """Display a message with type"""
        timestamp = datetime.now().isoformat()
        entry = {
            "timestamp": timestamp,
            "type": message_type,
            "content": message
        }
        self.history.append(entry)
        
        # Format based on message type
        prefix = {
            "info": "ℹ️ ",
            "error": "❌ ",
            "warning": "⚠️ ",
            "success": "✅ "
        }.get(message_type, "")
        
        print(f"{prefix}{message}")
        
        # Trigger any registered callbacks
        if message_type in self.callbacks:
            await self.callbacks[message_type](entry)

    async def get_input(self, prompt: str = "", validator: Optional[callable] = None) -> str:
        """Get user input with optional validation"""
        while True:
            try:
                # Use asyncio to handle input asynchronously
                result = await asyncio.get_event_loop().run_in_executor(
                    None, lambda: input(prompt)
                )
                
                if validator:
                    if validator(result):
                        return result
                    else:
                        await self.display("Invalid input, please try again", "error")
                else:
                    return result
                    
            except Exception as e:
                await self.display(f"Error getting input: {str(e)}", "error")
                
    def register_callback(self, message_type: str, callback: callable) -> None:
        """Register a callback for a specific message type"""
        self.callbacks[message_type] = callback
        
    def get_history(self, message_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get interaction history, optionally filtered by type"""
        if message_type:
            return [entry for entry in self.history if entry["type"] == message_type]
        return self.history
        
    def clear_history(self) -> None:
        """Clear interaction history"""
        self.history = []

    async def display_json(self, data: Dict[str, Any], indent: int = 2) -> None:
        """Display formatted JSON data"""
        try:
            formatted = json.dumps(data, indent=indent)
            await self.display(formatted)
        except Exception as e:
            await self.display(f"Error formatting JSON: {str(e)}", "error")
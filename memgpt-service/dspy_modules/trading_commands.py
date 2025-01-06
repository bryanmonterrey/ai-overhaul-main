# memgpt-service/dspy_modules/trading_commands.py
import dspy
from typing import Dict, Any

class TradingCommandAnalyzer(dspy.Module):
    """Analyzes trading commands and extracts structured information"""
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__()
        self.config = config
        
    async def analyze_command(
        self,
        message: str,
        context: str
    ) -> Dict[str, Any]:
        """Analyze trading command and extract parameters"""
        # Generate prompt for command analysis
        prompt = self._generate_analysis_prompt(message, context)
        
        # Use DSPy for analysis
        result = await self.predictor(prompt)
        
        # Parse and validate result
        command_info = self._parse_command_info(result.response)
        
        return {
            "command_type": command_info["type"],
            "parameters": command_info["params"],
            "confidence": result.confidence,
            "context": context
        }
        
    def _generate_analysis_prompt(
        self,
        message: str,
        context: str
    ) -> str:
        """Generate prompt for command analysis"""
        base_prompt = """
        Analyze the following trading command and extract structured information.
        Consider the context: {context}
        
        Command: {message}
        
        Extract:
        1. Command type (trade, analysis, settings, portfolio, system)
        2. Parameters and values
        3. Required permissions
        4. Expected outcomes
        
        Format response as JSON.
        """
        
        return base_prompt.format(
            context=context,
            message=message
        )
        
    def _parse_command_info(self, response: str) -> Dict[str, Any]:
        """Parse command information from response"""
        try:
            info = json.loads(response)
            return {
                "type": info.get("command_type", "unknown"),
                "params": info.get("parameters", {}),
                "permissions": info.get("permissions", []),
                "outcomes": info.get("outcomes", [])
            }
        except json.JSONDecodeError:
            return {
                "type": "unknown",
                "params": {},
                "permissions": [],
                "outcomes": []
            }
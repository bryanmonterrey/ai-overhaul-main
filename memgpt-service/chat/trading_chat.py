# memgpt-service/chat/trading_chat.py
from typing import Dict, Any, Optional
from datetime import datetime
from enum import Enum
import os
import json
import logging
import uuid
logging.basicConfig(level=logging.INFO)

class CommandType(Enum):
    TRADE = "trade"
    ANALYSIS = "analysis"
    SETTINGS = "settings"
    PORTFOLIO = "portfolio"
    SYSTEM = "system"
    CONFIRM = "confirm"

class TradingChat:
    def __init__(self, letta_service, memory_processor, dspy_service):
        self.letta = letta_service
        self.memory = memory_processor
        self.dspy_service = dspy_service
        self.command_handlers = self._init_command_handlers()
        self.realtime_monitor = letta_service.realtime_monitor  # Add this line
        self.trading_memory = letta_service.trading_memory 
        self.last_trade = None

        self.solana_service = letta_service.solana_service
        
    def _init_command_handlers(self) -> Dict[str, callable]:
        return {
            CommandType.TRADE.value.lower(): self._handle_trade_command,
            CommandType.ANALYSIS.value.lower(): self._handle_analysis_command,
            CommandType.SETTINGS.value.lower(): self._handle_settings_command,
            CommandType.PORTFOLIO.value.lower(): self._handle_portfolio_command,
            CommandType.SYSTEM.value.lower(): self._handle_system_command,
            CommandType.CONFIRM.value.lower(): self._handle_trade_command
        }
    
    
    # memgpt-service/chat/trading_chat.py
    async def analyze_message_with_claude(self, message: str, context: str) -> Dict[str, Any]:
        """Use Claude for natural language understanding of commands"""
        try:
            prompt = f"""Command Analysis Task:
    Message: {message}
    Context: {context}
    Previous Trade Parameters: {json.dumps(self.last_trade) if self.last_trade else 'None'}

    Available commands:
    - TRADE: For trade execution requests
        Required parameters: 
        - asset: The exact token symbol/address from the message
        - amount: The exact numerical amount from the message
        - side: 'buy' or 'sell'
    - CONFIRM: For confirming trades (maps to TRADE command)
        Should extract parameters from previous trade context:
        - asset: Same as previous trade
        - amount: Same as previous trade
        - side: Same as previous trade
    - ANALYSIS: For market analysis requests
        Examples: "analyze [token] price", "check market conditions"
        Required parameters:
        - asset: Token to analyze (if specified)
        - timeframe: Time period (if specified)
    - SETTINGS: For system settings changes
        Required parameters:
        - setting: The setting to change
        - value: New value
    - PORTFOLIO: For portfolio information requests
        Examples: "show portfolio", "check balance"
    - SYSTEM: For system maintenance commands
        Examples: "system status", "check performance"

    Swap Operation Rules:
    - For "swap X [tokenA] for [tokenB]": 
        asset = tokenB    # Extract exact tokenB from message
        amount = X        # Extract exact amount
        side = "buy"      # User wants to receive tokenB
    - For "swap for X [token]" or "buy X [token]":
        asset = token     # Extract exact token from message
        amount = X        # Extract exact amount
        side = "buy"      # User wants to receive the token
        
    For confirmation messages (e.g., "yes", "confirm", "do it"):
        Use command_type = "TRADE" and include previous trade parameters

    IMPORTANT:
    1. Extract tokens EXACTLY as specified in the message - do not modify or assume tokens
    2. Return ERROR if token or amount is not explicitly mentioned
    3. For analysis commands, extract any mentioned timeframes or metrics

    Respond with only a JSON object containing:
    1. command_type: The type of command identified
    2. parameters: Relevant parameters extracted from the message
    3. natural_response: A clear, concise response (no technical details)

    Example responses:
    {{"command_type": "TRADE", "parameters": {{"asset": "[exact token from message]", "amount": "[exact amount]", "side": "buy"}}, "natural_response": "I understand you want to buy [amount] [exact token]. Please confirm this trade."}}
    {{"command_type": "ANALYSIS", "parameters": {{"asset": "[exact token]", "timeframe": "1h"}}, "natural_response": "Analyzing [token] price data for the last hour."}}
    {{"command_type": "PORTFOLIO", "parameters": {{}}, "natural_response": "Here's your current portfolio overview."}}
    {{"command_type": "ERROR", "parameters": {{}}, "natural_response": "I couldn't understand which token you want to trade. Please specify the token symbol or address."}}"""

            response = await self.dspy_service.predict_with_retry(prompt)

            try:
                # Parse if it's valid JSON
                if response.strip().startswith('{'):
                    analysis = json.loads(response)
                    # Keep original command type
                    analysis["command_type"] = analysis.get("command_type", "SYSTEM")
                    # Clean up natural response
                    analysis["natural_response"] = (
                        analysis.get("natural_response", "")
                        .replace("Here is the analysis:", "")
                        .replace("`", "")
                        .replace("json", "")
                        .strip()
                    )
                    # Ensure parameters is a dict
                    if not isinstance(analysis.get("parameters"), dict):
                        analysis["parameters"] = {}
                else:
                    # If not JSON, create a proper response
                    analysis = {
                        "command_type": "SYSTEM",
                        "parameters": {},
                        "natural_response": response.strip()
                    }
            except json.JSONDecodeError:
                # If parsing fails, create a clean response
                analysis = {
                    "command_type": "SYSTEM",
                    "parameters": {},
                    "natural_response": "I'm sorry, I'm having trouble understanding. Could you try rephrasing that?"
                }

            return analysis

        except Exception as e:
            print(f"Claude analysis error: {str(e)}")
            return {
                "command_type": "SYSTEM",
                "parameters": {
                    "action": "error",
                    "error": str(e)
                },
                "natural_response": "I apologize, I'm having trouble processing your request. Could you try again?"
            }
        
    async def process_admin_message(self, message: str, wallet_info: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Process admin chat messages"""
        print("Starting process_admin_message with:", message)
        try:
            # Use Claude to analyze the message
            analysis = await self.analyze_message_with_claude(message, "admin")
            print("Claude analysis result:", analysis)

            # Get command type and convert to lowercase for comparison
            command_type = analysis["command_type"].lower() if analysis.get("command_type") else "system"

            # For system messages, return natural response
            if command_type == "system":
                return {
                    "response": analysis.get("natural_response", "I'm here to help. What would you like to do?")
                }

            # Handle confirmation - use last trade parameters
            if message.lower().strip() in ["confirm", "confirm trade"]:
                if not self.last_trade:
                    return {
                        "response": "No previous trade found to confirm. Please specify the trade details first.",
                        "error": "No trade to confirm"
                    }
                print("Using last trade parameters:", self.last_trade)
                analysis["parameters"] = {
                    **self.last_trade,  # Include all previous trade parameters
                    "wallet": wallet_info  # Add wallet info to confirmation
                }
                command_type = "trade"

            # Add wallet info to parameters if provided
            if wallet_info:
                print("Adding wallet info to parameters:", wallet_info)
                analysis["parameters"] = {
                    **(analysis.get("parameters", {})),
                    "wallet": wallet_info
                }

            # Store trade parameters for future confirmation if this is a new trade
            if command_type == "trade" and analysis.get("parameters"):
                self.last_trade = {
                    k: v for k, v in analysis["parameters"].items() 
                    if k not in ['wallet']  # Don't store wallet info
                }
                print("Stored trade parameters:", self.last_trade)

            # Get command handler using lowercase command type
            handler = self.command_handlers.get(command_type)
            print("Found handler:", handler)

            if not handler:
                return {
                    "response": analysis.get("natural_response", "I don't understand that command. Could you try rephrasing it?"),
                    "error": "Invalid command type"
                }

            # Execute command with parameters and admin privileges
            print("Executing handler with parameters:", analysis.get("parameters", {}))
            result = await handler(
                analysis.get("parameters", {}),
                is_admin=True
            )
            print("Handler result:", result)

            return {
                "response": analysis.get("natural_response", str(result)),
                "data": result
            }

        except Exception as e:
            print("Error in process_admin_message:", str(e))
            return {
                "response": f"I encountered an error: {str(e)}. Could you try again?",
                "error": str(e)
            }
    
    async def _handle_trade_command(self, params: dict, is_admin: bool = False) -> dict:
        try:
            # Log the incoming parameters
            logging.info(f"Starting trade execution with params: {params}")
            
            # Execute trade through realtime monitor
            if self.realtime_monitor:
                logging.info("Executing admin trade through realtime monitor")
                # Call execute_trade instead of directly accessing execute_solana_trade
                result = await self.execute_trade(params)
                return result
            else:
                raise ValueError("No trade executor available")

        except Exception as e:
            error_msg = f"Trade execution error: {str(e)}"
            logging.error(error_msg)
            return {
                'success': False,
                'error': error_msg,
                'user_message': 'Failed to execute trade due to an internal error.'
            }
            
    async def process_holder_message(
        self,
        message: str,
        user_address: str
    ) -> Dict[str, Any]:
        """Process holder chat messages"""
        try:
            # Verify holder status
            holder_info = await self.letta.verify_holder(user_address)
            if not holder_info["is_holder"]:
                return {
                    "response": "You need to hold tokens to use this feature.",
                    "error": "Not a token holder"
                }
                
            # Use DSPy to analyze intent and extract command
            analysis = await self.dspy_service.analyze_trading_command(
                message,
                context="holder"
            )
            
            # Get command handler
            handler = self.command_handlers.get(analysis["command_type"])
            if not handler:
                return {
                    "response": "I don't understand that command.",
                    "error": "Invalid command type"
                }
                
            # Execute command with holder privileges
            result = await handler(
                analysis["parameters"],
                is_admin=False,
                user_address=user_address
            )
            
            # Store interaction in memory
            await self.memory.store_interaction(
                content=message,
                response=result,
                metadata={
                    "type": "holder_trading_chat",
                    "user_address": user_address,
                    "command": analysis["command_type"],
                    "timestamp": datetime.now().isoformat()
                }
            )
            
            return result
            
        except Exception as e:
            return {
                "response": f"Error processing command: {str(e)}",
                "error": str(e)
            }
                
    async def _handle_analysis_command(
        self,
        params: Dict[str, Any],
        is_admin: bool,
        user_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """Handle market analysis commands"""
        analysis = await self.letta.analyze_market(params)
        
        if is_admin:
            # Include detailed system metrics
            return {
                **analysis,
                "system_metrics": await self.letta.get_system_metrics()
            }
        else:
            # Include holder-specific insights
            return {
                **analysis,
                "holder_insights": await self.letta.get_holder_insights(user_address)
            }
            
    async def _handle_settings_command(
        self,
        params: Dict[str, Any],
        is_admin: bool,
        user_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """Handle settings management commands"""
        if is_admin:
            return await self.letta.update_system_settings(params)
        else:
            return await self.letta.update_holder_settings(user_address, params)
            
    async def _handle_portfolio_command(
        self,
        params: Dict[str, Any],
        is_admin: bool,
        user_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """Handle portfolio information commands"""
        if is_admin:
            return await self.letta.get_system_portfolio()
        else:
            return await self.letta.get_holder_portfolio(user_address)
            
    async def _handle_system_command(
        self,
        params: Dict[str, Any],
        is_admin: bool,
        user_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """Handle system maintenance commands"""
        if not is_admin:
            return {
                "response": "System commands are only available to admins.",
                "error": "Insufficient privileges"
            }
            
        return await self.letta.execute_system_command(params)

    async def store_interaction(self, message: str, response: Dict[str, Any]):
        try:
            metadata = {
                'response': response,
                'type': 'trading_chat',
                'timestamp': datetime.now().isoformat()
            }
            
            result = self.memory_processor.process_new_memory(message, metadata)
            if not result:
                logging.error("Failed to store interaction in memory")
                
        except Exception as e:
            logging.error(f"Error storing interaction: {str(e)}")
            # Don't raise the error

    async def get_trading_context(self) -> Dict[str, Any]:
        """Get relevant trading context from memory"""
        try:
            # Query recent trading memories
            memories = self.memory_processor.query_memories(
                memory_type="trading_history",
                limit=10
            )
            
            return {
                "recent_trades": memories,
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            print(f"Error getting trading context: {str(e)}")
            return {}
        
    def _log_wallet_info(self, stage: str, wallet_info: Dict[str, Any]):
        """Helper to log wallet information at various stages"""
        try:
            if not wallet_info:
                logging.info(f"{stage}: No wallet info provided")
                return
                
            public_key = wallet_info.get('publicKey') or \
                        (wallet_info.get('credentials', {}) or {}).get('publicKey')
                        
            logging.info(f"{stage}: Wallet public key: {public_key}")
            logging.info(f"{stage}: Full wallet info: {json.dumps(wallet_info, default=str)}")
        except Exception as e:
            logging.error(f"Error logging wallet info at {stage}: {str(e)}")

    async def execute_trade(self, params: dict) -> dict:
        try:
            # Add debug logging
            logging.info(f"Execute trade called with params: {json.dumps(params, default=str)}")
            
            # Format wallet info correctly
            wallet_info = params.get('wallet')
            if not wallet_info:
                raise ValueError("No wallet info provided")

            logging.info(f"Got wallet info: {json.dumps(wallet_info, default=str)}")

            # Extract and verify credentials
            public_key = wallet_info.get('publicKey') or wallet_info.get('credentials', {}).get('publicKey')
            signature = (
                wallet_info.get('signature') or
                wallet_info.get('credentials', {}).get('signature') or
                wallet_info.get('credentials', {}).get('sessionProof')
            )

            if not public_key:
                raise ValueError("No public key found in wallet info")
            if not signature:
                raise ValueError("No signature found in wallet credentials")

            # Format complete parameters
            trade_params = {
                **params,
                'wallet_address': public_key,
                'original_amount': params.get('amount'),
                'wallet': {
                    'publicKey': public_key,
                    'signature': signature,
                    'credentials': {
                        'publicKey': public_key,
                        'signature': signature,
                        'signTransaction': wallet_info.get('credentials', {}).get('signTransaction', True),
                        'signAllTransactions': wallet_info.get('credentials', {}).get('signAllTransactions', True),
                        'connected': wallet_info.get('credentials', {}).get('connected', True),
                        'sessionSignature': signature
                    }
                }
            }

            logging.info(f"Starting trade execution with params: {json.dumps(trade_params, default=str)}")
            
            # Execute trade through realtime monitor
            if self.realtime_monitor:
                logging.info("Executing admin trade through realtime monitor")
                result = await self.realtime_monitor.execute_solana_trade(trade_params)
                return result
            else:
                raise ValueError("No trade executor available")

        except Exception as e:
            error_msg = f"Trade execution error: {str(e)}"
            logging.error(error_msg)
            return {
                'success': False,
                'error': error_msg,
                'user_message': f"Failed to execute trade: {str(e)}"
            }
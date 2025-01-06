# memgpt-service/trading/handlers/trading_handlers.py

from typing import Dict, Any, Optional
from datetime import datetime
import asyncio
from ..memory.trading_memory import TradingMemory
from ..agents.trader_agent import TraderAgent
from ..realtime import RealTimeMonitor
from decimal import Decimal
from dataclasses import dataclass
from typing import Optional


@dataclass
class TradeParams:
    """Parameters for trade execution"""
    input_token: str
    output_token: str
    amount: Decimal
    slippage: float
    priority_fee: float = 0.0025
    use_jito: bool = True
    auto_retry: bool = True
    wallet: Optional[dict] = None


class TradingHandlers:
    def __init__(
        self,
        letta_service,
        memory_processor,
        dspy_service
    ):
        self.letta_service = letta_service
        self.trading_memory = TradingMemory(memory_processor)
        self.trader_agent = TraderAgent(self._get_trader_config())
        self.monitor = RealTimeMonitor(self._get_monitor_config())
        self.dspy_service = dspy_service
        
        # Start monitoring
        asyncio.create_task(self.monitor.start_monitoring())
        
    async def handle_ai_trading(self, command: Dict[str, Any]) -> Dict[str, Any]:
        """Handle AI trading operations"""
        try:
            command_type = command.get('type')
            
            if command_type == 'execute_trade':
                return await self._execute_ai_trade(command)
            elif command_type == 'update_strategy':
                return await self._update_ai_strategy(command)
            elif command_type == 'get_status':
                return await self._get_ai_trading_status()
            else:
                raise ValueError(f"Unknown command type: {command_type}")
                
        except Exception as e:
            print(f"AI trading error: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    async def handle_holder_trading(
        self,
        user_address: str,
        command: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle holder trading operations"""
        try:
            # Verify holder status first
            if not await self._verify_holder_status(user_address):
                return {
                    "success": False,
                    "error": "Not a token holder"
                }

            command_type = command.get('type')
            
            if command_type == 'update_settings':
                return await self._update_holder_settings(user_address, command)
            elif command_type == 'get_portfolio':
                return await self._get_holder_portfolio(user_address)
            elif command_type == 'toggle_trading':
                return await self._toggle_holder_trading(user_address, command)
            else:
                raise ValueError(f"Unknown command type: {command_type}")
                
        except Exception as e:
            print(f"Holder trading error: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    async def _execute_ai_trade(self, command: Dict[str, Any]) -> Dict[str, Any]:
        """Execute AI trade with memory integration"""
        try:
            # Get trading context
            context = await self.trading_memory.get_trading_context()
            
            # Analyze trade using DSPy
            analysis = await self.dspy_service.analyze_trade(
                trade_params=command["parameters"],
                context=context
            )
            
            # Execute trade if analysis is favorable
            if analysis["should_execute"]:
                trade_result = await self.trader_agent.execute_trade(
                    command["parameters"],
                    analysis["recommended_adjustments"]
                )
                
                # Store trade in memory
                memory_id = await self.trading_memory.store_trade_execution(trade_result)
                
                # Update monitoring system
                await self.monitor.process_trade(trade_result)
                
                return {
                    "success": True,
                    "data": {
                        "trade_result": trade_result,
                        "memory_id": memory_id,
                        "analysis": analysis
                    }
                }
            else:
                return {
                    "success": False,
                    "error": "Trade execution prevented by analysis",
                    "analysis": analysis
                }
                
        except Exception as e:
            print(f"Error executing AI trade: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    async def _update_ai_strategy(self, command: Dict[str, Any]) -> Dict[str, Any]:
        """Update AI trading strategy with memory integration"""
        try:
            # Store strategy update
            memory_id = await self.trading_memory.store_strategy_update(command)
            
            # Update monitoring system
            await self.monitor.update_strategy(command["parameters"])
            
            # Update trader agent
            self.trader_agent.update_config(command["parameters"])
            
            return {
                "success": True,
                "data": {
                    "memory_id": memory_id,
                    "updated_params": command["parameters"]
                }
            }
            
        except Exception as e:
            print(f"Error updating AI strategy: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    async def _get_ai_trading_status(self) -> Dict[str, Any]:
        """Get current AI trading status"""
        try:
            # Get latest metrics from monitor
            metrics = await self.monitor.get_current_metrics()
            
            # Get trading context
            context = await self.trading_memory.get_trading_context()
            
            # Get trader stats
            trading_stats = self.trader_agent.get_trading_stats()
            
            return {
                "success": True,
                "data": {
                    "metrics": metrics,
                    "context": context,
                    "stats": trading_stats
                }
            }
            
        except Exception as e:
            print(f"Error getting AI trading status: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    def _get_trader_config(self) -> Dict[str, Any]:
        """Get trader agent configuration"""
        return {
            "rpc_url": self.letta_service.config.get("solana_rpc_url"),
            "default_slippage": 0.01,
            "max_slippage": 0.05,
            "priority_fee": 0.0025,
            "use_jito": True
        }

    def _get_monitor_config(self) -> Dict[str, Any]:
        """Get monitoring system configuration"""
        return {
            "update_interval": 5,  # seconds
            "risk_thresholds": {
                "max_drawdown": 0.15,
                "position_concentration": 0.25, 
                "volatility_threshold": 0.50
            },
            "require_session": True  # Add this to enforce session validation
        }
    
    async def handle_chat_trade(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """Handle trading commands from chat"""
        try:
            # Parse chat command
            command = await self.dspy_service.analyze_command(message)
            
            if command["type"] == "trade":
                # Extract session signature if present
                wallet_info = message.get('wallet', {})
                if isinstance(wallet_info, dict):
                    credentials = wallet_info.get('credentials', {})
                    if not isinstance(credentials, dict) or 'signature' not in credentials:
                        return {
                            "success": False,
                            "error": "Session initialization required",
                            "natural_response": "Please sign a message to initialize your trading session first."
                        }
                
                # Convert chat parameters to trade parameters 
                trade_params = TradeParams(
                    input_token=command["params"]["tokenIn"],
                    output_token=command["params"]["tokenOut"],
                    amount=Decimal(str(command["params"]["amount"])),
                    slippage=float(command["params"].get("slippage", 0.01)),
                    priority_fee=float(command["params"].get("priorityFee", 0.0025)),
                    use_jito=command["params"].get("useMev", True),
                    auto_retry=True,
                    wallet=wallet_info
                )
                
                # Execute through monitor's execute_solana_trade
                result = await self.monitor.execute_solana_trade({
                    "asset": trade_params.output_token,
                    "amount": float(trade_params.amount),
                    "slippage": trade_params.slippage * 100, # Convert to basis points
                    "wallet": trade_params.wallet
                })
                
                if result["success"]:
                    # Store trade info
                    await self.monitor.store_trade_execution(result)
                    
                    # Broadcast update
                    await self.monitor.broadcast_trading_update(
                        update_type="trade_execution",
                        data=result,
                        channel="trading_updates"
                    )
                    
                    return {
                        "success": True,
                        "trade_result": result,
                        "natural_response": f"Trade executed: {result.get('signature')}"
                    }
                else:
                    return {
                        "success": False,
                        "error": result.get("error"),
                        "natural_response": result.get("user_message", "Trade failed")
                    }
                    
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "natural_response": f"Trade failed: {str(e)}"
            }
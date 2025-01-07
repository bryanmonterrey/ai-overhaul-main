# memgpt-service/trading/memory/trading_memory.py

from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from decimal import Decimal
from dataclasses import dataclass
from memory_base import Memory
from ..risk_helpers import RiskHelpers
import json
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

@dataclass
class TradingState:
    """Current trading state including performance and risk metrics"""
    timestamp: datetime
    portfolio_value: Decimal
    active_positions: Dict[str, Any]
    risk_metrics: Dict[str, float]
    performance_metrics: Dict[str, float]
    trading_stats: Dict[str, Any]
    market_conditions: Dict[str, Any]
    consciousness_state: Dict[str, Any]

class TradingMemory:
    def __init__(self, memory_processor):
        self.memory_processor = memory_processor
        self.risk_helpers = RiskHelpers()
        self.state_history: List[TradingState] = []
        self.active_alerts: List[Dict[str, Any]] = []
        self.strategy_history: List[Dict[str, Any]] = []
        self.realtime_monitor = None

    async def store_interaction(self, message: str, response: Dict[str, Any]):
        try:
            metadata = {
                'response': response,
                'type': 'trading_chat',
                'timestamp': datetime.now().isoformat()
            }
            
            # Create the memory object
            memory_data = {
                'content': message if isinstance(message, str) else json.dumps(message),
                'metadata': metadata,
                'type': 'trading_chat',
                'created_at': datetime.now().isoformat()
            }
            
            try:
                result = await self.memory_processor.process_new_memory(memory_data)
                
                if isinstance(result, dict) and not result.get('success'):
                    logging.error(f"Memory storage failed: {result.get('error')}")
                    return None
                    
                return result.get('id') if isinstance(result, dict) else None
                
            except Exception as process_error:
                logging.error(f"Memory processing error: {str(process_error)}")
                return None
                
        except Exception as e:
            logging.error(f"Error storing interaction: {str(e)}")
            return None

    async def get_relevant_context(
        self,
        message: str,
        user_type: str,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """Get relevant context for current interaction"""
        return await self.memory_processor.query_memories(
            type="trading_interaction",
            query={
                "content": message,
                "user_type": user_type,
                "limit": limit
            }
        )

    async def analyze_trading_pattern(
        self,
        user_address: Optional[str] = None,
        timeframe: str = "24h"
    ) -> Dict[str, Any]:
        """Analyze trading patterns from memory"""
        query = {
            "type": "trading_interaction",
            "timeframe": timeframe
        }
        
        if user_address:
            query["user_address"] = user_address
            
        memories = await self.memory_processor.query_memories(**query)
        
        return await self.memory_processor.analyze_content({
            "memories": memories,
            "analysis_type": "trading_pattern"
        })
        
    async def store_trade_execution(self, trade_result: Dict[str, Any]) -> str:
        """Store trade execution in memory"""
        try:
            # Format trade data for memory storage
            trade_memory = {
                "type": "trading_history",
                "content": {
                    "trade_type": trade_result.get("type", "trade_execution"),
                    "tokenIn": trade_result.get("tokenIn", trade_result.get("token_in")),
                    "tokenOut": trade_result.get("tokenOut", trade_result.get("token_out")),
                    "amountIn": str(trade_result.get("amountIn", trade_result.get("amount_in", "0"))),
                    "amountOut": str(trade_result.get("amountOut", trade_result.get("amount_out", "0"))),
                    "timestamp": datetime.now().isoformat(),
                    "txHash": trade_result.get("txHash", trade_result.get("tx_hash")),
                    "status": trade_result.get("status", "pending"),
                    "priceImpact": trade_result.get("priceImpact", 0),
                    "routeInfo": trade_result.get("routeInfo", {})
                },
                "metadata": {
                    "importance": 0.8,
                    "category": "trade_execution",
                    "strategy": trade_result.get("strategy"),
                    "risk_metrics": await self._calculate_trade_risk_metrics(trade_result)
                }
            }

            try:
                memory_content = json.dumps(trade_memory["content"])
                memory_data = {
                    'content': memory_content,
                    'metadata': trade_memory["metadata"],
                    'type': trade_memory["type"],
                    'created_at': datetime.now().isoformat()
                }
                
                result = await self.memory_processor.process_new_memory(memory_data)

                if isinstance(result, dict):
                    return result.get('id')
                return None

            except Exception as process_error:
                logging.error(f"Memory processing error: {str(process_error)}")
                return None

        except Exception as e:
            logging.error(f"Error storing trade execution: {str(e)}")
            return None

    async def store_strategy_update(self, strategy_update: Dict[str, Any]) -> str:
        """Store strategy updates in LettA memory"""
        try:
            strategy_memory = {
                "type": "trading_params",
                "content": {
                    "update_type": "strategy",
                    "timestamp": datetime.now().isoformat(),
                    "parameters": strategy_update["parameters"],
                    "reason": strategy_update.get("reason", ""),
                    "previous_state": strategy_update.get("previous_state", {}),
                },
                "metadata": {
                    "importance": 0.7,
                    "category": "strategy_update",
                    "impact_analysis": await self._analyze_strategy_impact(strategy_update)
                }
            }

            memory_result = await self.memory_processor.store_memory(strategy_memory)
            self.strategy_history.append(strategy_update)
            
            return memory_result["data"]["id"]
            
        except Exception as e:
            print(f"Error storing strategy update: {str(e)}")
            return None

    async def get_trading_context(self, timeframe: str = "24h") -> Dict[str, Any]:
        """Get trading context for decision making"""
        try:
            end_time = datetime.now()
            start_time = end_time - timedelta(hours=24)
            
            # Get relevant memories
            memories = await self.memory_processor.query_memories(
                type="trading_history",
                filters={
                    "time_range": {
                        "start": start_time.isoformat(),
                        "end": end_time.isoformat()
                    }
                }
            )

            # Process memories to extract context
            trades = [m for m in memories if m["metadata"]["category"] == "trade_execution"]
            strategies = [m for m in memories if m["metadata"]["category"] == "strategy_update"]

            # Calculate aggregated metrics
            metrics = await self._calculate_aggregated_metrics(trades)
            
            return {
                "recent_trades": trades[-10:],  # Last 10 trades
                "latest_strategy": strategies[-1] if strategies else None,
                "metrics": metrics,
                "active_alerts": self.active_alerts,
                "market_conditions": await self._get_market_conditions(),
                "consciousness_state": await self._get_consciousness_state()
            }

        except Exception as e:
            print(f"Error getting trading context: {str(e)}")
            return {}

    async def update_risk_alert(self, alert: Dict[str, Any], status: str):
        """Update risk alert status and store in memory"""
        try:
            alert_memory = {
                "type": "trading_params",
                "content": {
                    "alert_type": alert["type"],
                    "status": status,
                    "timestamp": datetime.now().isoformat(),
                    "risk_level": alert["risk_level"],
                    "metrics": alert["metrics"],
                    "resolution": alert.get("resolution", "")
                },
                "metadata": {
                    "importance": 0.9 if alert["risk_level"] == "high" else 0.7,
                    "category": "risk_alert",
                    "requires_action": alert.get("requires_action", False)
                }
            }

            memory_result = await self.memory_processor.store_memory(alert_memory)
            
            # Update active alerts
            if status == "resolved":
                self.active_alerts = [a for a in self.active_alerts if a["id"] != alert["id"]]
            elif status == "new":
                self.active_alerts.append(alert)
            
            return memory_result["data"]["id"]
            
        except Exception as e:
            print(f"Error updating risk alert: {str(e)}")
            return None
        
    async def store_settings_update(self, settings_update: Dict[str, Any]) -> str:
        """Store settings updates in memory"""
        try:
            settings_memory = {
                "type": "trading_params",
                "content": {
                    "update_type": "settings",
                    "timestamp": datetime.now().isoformat(),
                    "settings": settings_update.get("data", {}),
                    "reason": settings_update.get("reason", "")
                },
                "metadata": {
                    "importance": 0.7,
                    "category": "settings_update"
                }
            }

            # Store in memory system
            memory_result = await self.memory_processor.store_memory(settings_memory)
            return memory_result["data"]["id"]
            
        except Exception as e:
            print(f"Error storing settings update: {str(e)}")
            return None

    async def _calculate_trade_risk_metrics(self, trade: Dict[str, Any]) -> Dict[str, float]:
        """Calculate risk metrics for a trade"""
        return await self.risk_helpers.calculate_trade_risk_metrics(trade)

    async def _analyze_strategy_impact(self, strategy: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze the potential impact of a strategy update"""
        try:
            # Basic impact analysis
            impact_data = {
                "timestamp": datetime.now().isoformat(),
                "strategy_type": strategy.get("type", "unknown"),
                "risk_level": "low",  # Default risk level
                "affected_metrics": [],
                "potential_outcomes": {}
            }

            parameters = strategy.get("parameters", {})
            
            # Analyze risk level based on parameter changes
            if parameters.get("position_size_change"):
                size_change = abs(float(parameters["position_size_change"]))
                if size_change > 0.25:  # 25% change
                    impact_data["risk_level"] = "high"
                    impact_data["affected_metrics"].append("position_exposure")
            
            if parameters.get("leverage_change"):
                leverage_change = abs(float(parameters["leverage_change"]))
                if leverage_change > 0.1:  # 10% change
                    impact_data["risk_level"] = "high"
                    impact_data["affected_metrics"].append("leverage_risk")
            
            return impact_data

        except Exception as e:
            print(f"Error analyzing strategy impact: {str(e)}")
            return {
                "risk_level": "unknown",
                "error": str(e)
            }

    async def _calculate_aggregated_metrics(self, trades: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate aggregated metrics from trades"""
        try:
            if not trades:
                return {}

            # Initialize metrics
            metrics = {
                "total_volume": Decimal("0"),
                "total_trades": len(trades),
                "successful_trades": 0,
                "failed_trades": 0,
                "avg_price_impact": Decimal("0"),
                "total_fees": Decimal("0"),
                "by_token": {}
            }

            # Process each trade
            for trade in trades:
                content = trade.get("content", {})
                
                # Count successes and failures
                if content.get("status") == "success":
                    metrics["successful_trades"] += 1
                else:
                    metrics["failed_trades"] += 1

                # Add volumes
                amount_in = Decimal(str(content.get("amount_in", "0")))
                metrics["total_volume"] += amount_in

                # Track by token
                token = content.get("token_in")
                if token:
                    token_data = metrics["by_token"].setdefault(token, {
                        "volume": Decimal("0"),
                        "count": 0,
                        "success_rate": 0
                    })
                    token_data["volume"] += amount_in
                    token_data["count"] += 1

                # Add price impact
                price_impact = Decimal(str(content.get("price_impact", "0")))
                metrics["avg_price_impact"] += price_impact

            # Calculate averages
            total_trades = Decimal(str(len(trades)))
            if total_trades > 0:
                metrics["avg_price_impact"] /= total_trades

                # Calculate token success rates
                for token_data in metrics["by_token"].values():
                    token_data["success_rate"] = (
                        token_data["success_count"] / token_data["count"]
                        if token_data["count"] > 0 else 0
                    )

            return metrics

        except Exception as e:
            print(f"Error calculating aggregated metrics: {str(e)}")
            return {}

    async def _update_trading_state(self, trade_result: Dict[str, Any]):
        """Update the current trading state"""
        try:
            if not self.realtime_monitor:
                return

            # Get current metrics from realtime monitor
            current_metrics = await self.realtime_monitor.get_current_metrics()
            
            # Create new state
            new_state = TradingState(
                timestamp=datetime.now(),
                portfolio_value=current_metrics.get("portfolio_value", Decimal("0")),
                active_positions=current_metrics.get("positions", {}),
                risk_metrics=current_metrics.get("risk_metrics", {}),
                performance_metrics=current_metrics.get("performance", {}),
                trading_stats=current_metrics.get("trading_stats", {}),
                market_conditions=current_metrics.get("market_conditions", {}),
                consciousness_state=current_metrics.get("consciousness", {})
            )
            
            # Add to history
            self.state_history.append(new_state)
            
            # Keep only last 100 states
            if len(self.state_history) > 100:
                self.state_history = self.state_history[-100:]

        except Exception as e:
            print(f"Error updating trading state: {str(e)}")

    async def _get_market_conditions(self) -> Dict[str, Any]:
        """Get current market conditions"""
        try:
            if self.realtime_monitor:
                return await self.realtime_monitor.get_market_conditions()
            return {}
        except Exception as e:
            print(f"Error getting market conditions: {str(e)}")
            return {}

    async def _get_consciousness_state(self) -> Dict[str, Any]:
        """Get current consciousness state"""
        try:
            if self.realtime_monitor:
                return await self.realtime_monitor.get_consciousness_state()
            return {}
        except Exception as e:
            print(f"Error getting consciousness state: {str(e)}")
            return {}

    def set_realtime_monitor(self, monitor):
        """Set the realtime monitor instance"""
        self.realtime_monitor = monitor
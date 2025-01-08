# memgpt-service/trading/realtime.py

from typing import Dict, Any, List, Optional, Callable
from decimal import Decimal
import asyncio
from datetime import datetime, timedelta
import json
from dataclasses import dataclass, asdict
import logging
from .risk_helpers import RiskHelpers
from .portfolio.risk_calculator import RiskCalculator
import uuid
import logging
from .solana_service import SolanaService
import aiohttp
from base58 import b58encode, b58decode
import hashlib
from solana.keypair import Keypair

@dataclass
class ConsciousnessMetrics:
    """Metrics for the consciousness system"""
    emotional_state: str
    confidence_level: float
    attention_focus: List[str]
    decision_factors: Dict[str, float]
    risk_tolerance: float
    market_perception: str

@dataclass
class MonitoringMetrics:
    """Real-time monitoring metrics with consciousness integration"""
    timestamp: datetime
    portfolio_value: Decimal
    day_pnl: Decimal
    day_pnl_percent: float
    current_drawdown: float
    risk_level: str
    volatility_24h: float
    sharpe_ratio: float
    total_positions: int
    active_trades: int
    largest_position: Dict[str, Any]
    risk_warnings: List[str]
    performance_metrics: Dict[str, float]
    consciousness_state: Optional[ConsciousnessMetrics] = None

class RealTimeMonitor:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.ws_handler = None  # Will be set later
        self.risk_calculator = RiskCalculator(config.get("risk_calculator", {
            "max_position_size": 100,
            "max_portfolio_var": 0.05,
            "max_concentration": 0.2,
            "var_confidence": 0.95,
            "var_window": 30
        }))
        self.risk_helpers = RiskHelpers()
        self.supabase = None  # Will be set by the trading handler
        self.solana_service = None  # Remove SolanaService initialization
        self.wallet = None
        
        # Initialize monitoring state
        self.monitoring_state = {
            "last_update": datetime.now(),
            "subscribers": [],
            "active_alerts": set(),
            "metrics_history": [],
            "consciousness_history": [],
            "risk_thresholds": config.get("risk_thresholds", {
                "max_drawdown": 0.15,  # 15%
                "position_concentration": 0.25,  # 25%
                "volatility_threshold": 0.50,  # 50% annualized
            })
        }

    def set_solana_service(self, service):
        """Set the solana service instance"""
        self.solana_service = service

    def set_ws_handler(self, ws_handler):
        """Set WebSocket handler"""
        self.ws_handler = ws_handler

    def set_supabase_client(self, supabase_client):
        """Set Supabase client for database operations and realtime updates"""
        self.supabase = supabase_client

    def set_wallet(self, wallet_info: Dict[str, Any]):
        """Set wallet information"""
        self.wallet = wallet_info

    async def start_monitoring(self):
        """Start the monitoring loop"""
        while True:
            try:
                # Collect and analyze metrics
                metrics = await self.collect_metrics()
                
                # Update consciousness state if available
                if hasattr(self, 'memory_processor'):
                    consciousness = await self.update_consciousness_state(metrics)
                    metrics.consciousness_state = consciousness
                
                # Check for risk alerts
                alerts = self.check_risk_alerts(metrics)
                
                # Store historical data
                self.store_metrics(metrics)
                
                # Notify subscribers
                await self.notify_subscribers({
                    "type": "metrics_update",
                    "data": asdict(metrics),
                    "alerts": alerts
                })
                
                # Update state
                self.monitoring_state["last_update"] = datetime.now()
                
            except Exception as e:
                logging.error(f"Monitoring error: {str(e)}")
                
            await asyncio.sleep(self.config.get("update_interval", 5))

    async def collect_metrics(self) -> MonitoringMetrics:
        """Collect real-time metrics"""
        try:
            # Get portfolio data
            portfolio = await self.get_portfolio_data()
            
            # Calculate performance metrics
            performance = self.calculate_performance_metrics(portfolio)
            
            # Calculate risk metrics
            risk_metrics = await self.calculate_risk_metrics(portfolio)
            
            return MonitoringMetrics(
                timestamp=datetime.now(),
                portfolio_value=portfolio["total_value"],
                day_pnl=performance["day_pnl"],
                day_pnl_percent=performance["day_pnl_percent"],
                current_drawdown=risk_metrics["current_drawdown"],
                risk_level=self.determine_risk_level(risk_metrics),
                volatility_24h=risk_metrics["volatility_24h"],
                sharpe_ratio=risk_metrics["sharpe_ratio"],
                total_positions=len(portfolio["positions"]),
                active_trades=len(portfolio["active_trades"]),
                largest_position=self.get_largest_position(portfolio),
                risk_warnings=risk_metrics["warnings"],
                performance_metrics=performance
            )
        except Exception as e:
            logging.error(f"Error collecting metrics: {str(e)}")
            raise

    def check_risk_alerts(self, metrics: MonitoringMetrics) -> List[Dict[str, Any]]:
        """Check for risk threshold breaches"""
        alerts = []
        thresholds = self.monitoring_state["risk_thresholds"]
        
        # Check drawdown
        if metrics.current_drawdown > thresholds["max_drawdown"]:
            alerts.append({
                "type": "risk_alert",
                "level": "high",
                "message": f"Drawdown threshold exceeded: {metrics.current_drawdown:.2%}"
            })
            
        # Check position concentration
        if metrics.largest_position["percentage"] > thresholds["position_concentration"]:
            alerts.append({
                "type": "risk_alert",
                "level": "medium",
                "message": f"High position concentration in {metrics.largest_position['token']}"
            })
            
        # Check volatility
        if metrics.volatility_24h > thresholds["volatility_threshold"]:
            alerts.append({
                "type": "risk_alert",
                "level": "medium",
                "message": f"High volatility detected: {metrics.volatility_24h:.2%}"
            })
            
        return alerts

    def store_metrics(self, metrics: MonitoringMetrics):
        """Store metrics for historical analysis"""
        self.monitoring_state["metrics_history"].append(asdict(metrics))
        
        # Keep last 24 hours of data (assuming 5-second updates)
        max_history = 17280  # 24 * 60 * 12
        if len(self.monitoring_state["metrics_history"]) > max_history:
            self.monitoring_state["metrics_history"] = self.monitoring_state["metrics_history"][-max_history:]

    async def subscribe(self, callback: Callable[[Dict[str, Any]], None]) -> str:
        """Subscribe to monitoring updates"""
        self.monitoring_state["subscribers"].append(callback)
        return str(len(self.monitoring_state["subscribers"]) - 1)

    async def unsubscribe(self, subscriber_id: str):
        """Unsubscribe from updates"""
        idx = int(subscriber_id)
        if idx < len(self.monitoring_state["subscribers"]):
            self.monitoring_state["subscribers"].pop(idx)

    async def notify_subscribers(self, update: Dict[str, Any]):
        """Notify all subscribers of updates"""
        # First broadcast to Supabase realtime
        await self.broadcast_trading_update(
            update_type=update["type"],
            data=update["data"],
            channel="trading_updates"
        )
        
        # Then notify local subscribers
        for subscriber in self.monitoring_state["subscribers"]:
            try:
                await subscriber(update)
            except Exception as e:
                logging.error(f"Error notifying subscriber: {str(e)}")

    async def setup_wallet(self, private_key: str = None, wallet_info: Dict = None):
        """Initialize wallet for trading"""
        try:
            # Check for wallet_info first
            if wallet_info:
                # If we have credentials in wallet_info
                if credentials := wallet_info.get('credentials'):
                    pub_key = credentials.get('publicKey')  # Note: publicKey not public_key
                    if pub_key:
                        self.wallet = wallet_info  # Store the entire wallet_info
                        logging.info(f"Initialized wallet with public key: {pub_key} and credentials")
                        return True
                # If we have direct publicKey
                elif pub_key := wallet_info.get('publicKey'):  # Note: publicKey not public_key
                    self.wallet = wallet_info  # Store the entire wallet_info
                    logging.info(f"Initialized wallet with public key: {pub_key}")
                    return True
                
                logging.error(f"Invalid wallet info structure: {wallet_info}")
                return False

            # Handle private key if provided
            elif private_key and isinstance(private_key, str):
                from solana.keypair import Keypair
                try:
                    # Try to load as hex
                    key_bytes = bytes.fromhex(private_key.strip())
                except ValueError:
                    # Try to load as base58
                    from base58 import b58decode
                    key_bytes = b58decode(private_key)
                        
                keypair = Keypair.from_secret_key(key_bytes)
                self.wallet = {
                    'publicKey': str(keypair.public_key),
                    'credentials': {
                        'publicKey': str(keypair.public_key),
                        'signTransaction': True,
                        'signAllTransactions': True,
                        'connected': True
                    }
                }
                return True

            return False
        except Exception as e:
            logging.error(f"Wallet setup error: {str(e)}")
            return False

    async def execute_solana_trade(self, params: dict) -> dict:
        """Execute a Solana trade"""
        try:
            # Use the wallet from params if provided, otherwise use the stored wallet
            wallet_info = params.get('wallet')
            if not wallet_info:
                raise ValueError("No wallet provided for trade execution")

            trade_id = str(uuid.uuid4())
            
            # Add wallet info to trade params - use dictionary access
            trade_params = {
                **params,  # Keep existing params
                'wallet': {
                    'publicKey': wallet_info.get('publicKey') or wallet_info.get('credentials', {}).get('publicKey'),
                    'credentials': wallet_info.get('credentials', {}),
                }
            }

            try:
                logging.info(f"Executing swap with params: {trade_params}")
                # Execute the swap
                swap_result = await self.solana_service.execute_swap(trade_params)
                
                return {
                    'success': True,
                    'trade_id': trade_id,
                    'signature': swap_result.get('signature'),
                    'params': params,
                    'result': swap_result,
                    'timestamp': datetime.now().isoformat()
                }

            except Exception as e:
                error_msg = str(e)
                await self._send_trade_error(trade_id, error_msg)
                return {
                    'success': False,
                    'error': error_msg,
                    'user_message': f"Trade failed: {error_msg}"
                }

        except Exception as e:
            error_msg = f"Trade execution error: {str(e)}"
            logging.error(error_msg)
            return {
                'success': False,
                'error': error_msg,
                'user_message': 'Failed to execute trade due to an internal error.'
            }

    async def generate_readonly_session_signature(public_key: str) -> str:
        """Generate a deterministic but secure signature for read-only sessions"""
        message = f"readonly-session-{public_key}".encode()
        hash_obj = hashlib.sha256(message)
        return b58encode(hash_obj.digest()).decode()

    def initialize_readonly_wallet(public_key: str):
        wallet_info = {
            "publicKey": public_key,
            "signature": generate_readonly_session_signature(public_key),
            "credentials": {
                "publicKey": public_key,
                "signTransaction": True,
                "signAllTransactions": True,
                "connected": True
            }
        }
        return wallet_info
        
    async def broadcast_trading_update(self, update_type: str, data: Dict[str, Any], channel: str):
        """Broadcast trading update via WebSocket"""
        try:
            if self.ws_handler:
                await self.ws_handler.broadcast_update(
                    channel=channel,
                    data={
                        "type": update_type,
                        "data": data,
                        "timestamp": datetime.now().isoformat()
                    }
                )
        except Exception as e:
            logging.error(f"Error broadcasting trading update: {str(e)}")

    async def store_trade_execution(self, data: dict) -> None:
        try:
            if isinstance(data, str):
                data = json.loads(data)
                
            execution_data = {
                **data,
                'timestamp': datetime.now().isoformat()
            }
            # Remove await and use execute() directly
            response = self.supabase.table('trade_executions')\
                .insert(execution_data)\
                .execute()
            
            if hasattr(response, 'error') and response.error:
                logging.error(f"Supabase insert error: {response.error}")
                raise Exception(f"Database insert failed: {response.error}")
                
            return response.data if hasattr(response, 'data') else None
            
        except Exception as e:
            logging.error(f"Error storing trade execution: {str(e)}")
            raise

    async def _send_trade_error(self, trade_id: str, error: str):
        """Send trade error update via WebSocket"""
        await self.broadcast_trading_update(
            update_type="trade_status",
            data={
                "trade_id": trade_id,
                "status": "error",
                "error": error,
                "timestamp": datetime.now().isoformat()
            },
            channel="trading_updates"
        )

    async def handle_trade_update(self, tx_signature: str, status: str):
        """Handle trade status updates from frontend"""
        try:
            # Remove await
            response = self.supabase.table('trade_intents')\
                .select('*')\
                .eq('status', 'pending')\
                .order('timestamp', desc=True)\
                .limit(1)\
                .execute()

            if response.data:
                trade_intent = response.data[0]
                trade_id = trade_intent['id']

                await self.broadcast_trading_update(
                    update_type="trade_status",
                    data={
                        "trade_id": trade_id,
                        "status": status,
                        "signature": tx_signature,
                        "timestamp": datetime.now().isoformat()
                    },
                    channel="trading_updates"
                )

                # Remove await
                self.supabase.table('trade_intents')\
                    .update({'status': status, 'tx_signature': tx_signature})\
                    .eq('id', trade_id)\
                    .execute()

        except Exception as e:
            logging.error(f"Error handling trade update: {str(e)}")

    async def get_portfolio_data(self) -> Dict[str, Any]:
        """Get current portfolio data"""
        # Implementation needed
        pass

    def calculate_performance_metrics(self, portfolio: Dict[str, Any]) -> Dict[str, float]:
        """Calculate performance metrics from portfolio data"""
        # Implementation needed
        pass

    async def calculate_risk_metrics(self, portfolio: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate risk metrics from portfolio data"""
        # Implementation needed
        pass

    def determine_risk_level(self, risk_metrics: Dict[str, Any]) -> str:
        """Determine overall risk level"""
        # Implementation needed
        pass

    def get_largest_position(self, portfolio: Dict[str, Any]) -> Dict[str, Any]:
        """Get largest position details"""
        # Implementation needed
        pass

    async def process_trade_execution(self, execution_data: dict) -> None:
        """Process a trade execution and notify relevant systems"""
        try:
            logging.info(f"Processing trade execution: {execution_data.get('id')}")
            
            # Store the execution in trading memory
            if hasattr(self, 'trading_memory'):
                await self.trading_memory.store_trade_execution(execution_data)
            
            # Add any additional processing here (e.g., notifications, analytics)
            
        except Exception as e:
            logging.error(f"Error processing trade execution: {str(e)}")
            # Don't raise the error to avoid breaking the trade flow

    def __del__(self):
    # Ensure clean shutdown
        if hasattr(self, 'ws_handler') and self.ws_handler:
            try:
                self.ws_handler.close()
            except:
                pass
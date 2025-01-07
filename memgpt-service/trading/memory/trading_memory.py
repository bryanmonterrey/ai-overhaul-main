# memgpt-service/trading/memory/trading_memory.py

from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from decimal import Decimal
from dataclasses import dataclass
from memory_base import Memory
from ..risk_helpers import RiskHelpers
import json
import logging
from memory.utils.supabase_helpers import handle_supabase_response, safe_supabase_execute

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
    def __init__(self, supabase_client):
        self.supabase = supabase_client
        self.realtime_monitor = None

    def set_realtime_monitor(self, monitor):
        """Set the realtime monitor instance"""
        self.realtime_monitor = monitor

    async def store_trade_execution(self, data: dict) -> None:
        """Store trade execution data"""
        try:
            if not data:
                raise ValueError("Trade execution data is empty")
            
            if isinstance(data, str):
                data = json.loads(data)
            
            # Extract trade_id and params from nested structure if needed
            trade_id = data.get('trade_id') or data.get('result', {}).get('trade_id')
            params = data.get('params') or data.get('data') or {}
            
            # Build execution data from various possible structures
            execution_data = {
                'id': trade_id,
                'params': json.dumps(params),  # Convert dict to JSON string
                'result': json.dumps(data.get('result', {})),  # Convert dict to JSON string
                'signature': data.get('signature'),
                'timestamp': data.get('timestamp') or datetime.now().isoformat(),
                'status': data.get('status', 'completed' if data.get('signature') else 'failed'),
                'error': data.get('result', {}).get('error'),
                'token_in': data.get('tokenIn'),
                'token_out': data.get('tokenOut'),
                'amount_in': str(data.get('amountIn')),  # Convert to string
                'amount_out': str(data.get('amountOut')),  # Convert to string
                'tx_hash': data.get('txHash')
            }
            
            # Validate required fields
            if not execution_data['id']:
                raise ValueError("Missing trade_id in execution data")
            if not execution_data['params']:
                raise ValueError("Missing params in execution data")
            
            # Log the execution data being stored
            logging.info(f"Storing trade execution: {json.dumps(execution_data, default=str)}")
            
            # Create and execute the insert query
            query = self.supabase.table('trade_executions').insert(execution_data).execute()
            
            # Execute the query with error handling
            success, result = await safe_supabase_execute(query, error_message="Failed to store trade execution")
            
            if not success:
                logging.error(f"Supabase insert failed: {result}")
                raise Exception(f"Failed to store trade execution: {result}")
            
            logging.info(f"Successfully stored trade execution with ID: {trade_id}")
            
            # If realtime monitor exists, notify it of the trade execution
            if self.realtime_monitor:
                await self.realtime_monitor.process_trade_execution(execution_data)
            
            return result
            
        except Exception as e:
            logging.error(f"Error storing trade execution: {str(e)}")
            logging.error(f"Trade data: {json.dumps(data, default=str)}")
            raise

    async def get_trade_history(self, limit: int = 10):
        """Get trade execution history"""
        try:
            # Use safe_supabase_execute helper
            success, result = await safe_supabase_execute(
                self.supabase.table('trade_executions')\
                    .select('*')\
                    .order('timestamp', desc=True)\
                    .limit(limit),
                error_message="Failed to get trade history"
            )
            
            if not success:
                logging.error(f"Error getting trade history: {result}")
                return []
                
            return result
            
        except Exception as e:
            logging.error(f"Error getting trade history: {str(e)}")
            return []
"""
Portfolio Manager for Solana trading.
Manages positions, risk, and portfolio optimization.
"""
from typing import Dict, Any, List, Optional, Tuple
from decimal import Decimal
from datetime import datetime
import pandas as pd
import numpy as np
from dataclasses import dataclass
from enum import Enum
from .risk_calculator import RiskCalculator, RiskMetrics, PositionRisk

class PortfolioStatus(Enum):
    HEALTHY = "healthy"
    WARNING = "warning"
    CRITICAL = "critical"

@dataclass
class PortfolioMetrics:
    """Portfolio performance and status metrics"""
    total_value: Decimal
    cash_balance: Decimal
    unrealized_pnl: Decimal
    realized_pnl: Decimal
    daily_return: float
    total_return: float
    sharpe_ratio: float
    positions_count: int
    risk_metrics: RiskMetrics
    status: PortfolioStatus
    timestamp: datetime

@dataclass
class Position:
    """Trading position information"""
    token_address: str
    size: Decimal
    entry_price: Decimal
    current_price: Decimal
    unrealized_pnl: Decimal
    risk_metrics: PositionRisk
    stop_loss: Optional[Decimal]
    take_profit: Optional[Decimal]
    timestamp: datetime
    metadata: Dict[str, Any]

class PortfolioManager:
    """Manages trading portfolio and risk"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.risk_calculator = RiskCalculator(config.get("risk", {}))
        
        # Initialize portfolio state
        self.positions: Dict[str, Position] = {}
        self.balance = Decimal(str(config.get("initial_balance", "0")))
        self.realized_pnl = Decimal("0")
        
        # Performance tracking
        self.performance_history: List[PortfolioMetrics] = []
        self.trade_history: List[Dict[str, Any]] = []
        
        # Risk limits
        self.max_position_value = Decimal(str(config.get("max_position_value", "1000")))
        self.max_portfolio_value = Decimal(str(config.get("max_portfolio_value", "10000")))
        self.max_drawdown = float(config.get("max_drawdown", 0.2))
        
        # Initialize metrics
        self.last_metrics: Optional[PortfolioMetrics] = None
        
    async def update_portfolio(self, market_data: Dict[str, Dict[str, Any]]):
        """Update portfolio state and metrics"""
        try:
            # Update position values
            await self._update_positions(market_data)
            
            # Calculate risk metrics
            risk_metrics = await self.risk_calculator.calculate_portfolio_risk(
                self.positions,
                market_data
            )
            
            # Calculate portfolio metrics
            metrics = await self._calculate_portfolio_metrics(risk_metrics)
            
            # Update history
            self.performance_history.append(metrics)
            self.last_metrics = metrics
            
            # Check risk limits
            await self._check_risk_limits(metrics)
            
        except Exception as e:
            logging.error(f"Portfolio update error: {str(e)}")
            raise
            
    async def execute_trade(
        self,
        token_address: str,
        side: str,
        size: Decimal,
        price: Decimal,
        metadata: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute trade and update portfolio"""
        try:
            # Validate trade
            validation = await self._validate_trade(
                token_address,
                side,
                size,
                price
            )
            
            if not validation["valid"]:
                raise ValueError(f"Trade validation failed: {validation['reason']}")
                
            # Execute trade
            if side == "buy":
                await self._open_position(
                    token_address,
                    size,
                    price,
                    metadata
                )
            else:
                await self._close_position(
                    token_address,
                    size,
                    price,
                    metadata
                )
                
            # Record trade
            trade_record = {
                "token": token_address,
                "side": side,
                "size": str(size),
                "price": str(price),
                "timestamp": datetime.now().isoformat(),
                "metadata": metadata
            }
            self.trade_history.append(trade_record)
            
            return trade_record
            
        except Exception as e:
            logging.error(f"Trade execution error: {str(e)}")
            raise
            
    async def _update_positions(self, market_data: Dict[str, Dict[str, Any]]):
        """Update position values and metrics"""
        for token_address, position in self.positions.items():
            if token_address not in market_data:
                continue
                
            current_price = Decimal(str(market_data[token_address]["price"]))
            
            # Update position state
            position.current_price = current_price
            position.unrealized_pnl = (
                current_price - position.entry_price
            ) * position.size
            
            # Update risk metrics
            position.risk_metrics = await self.risk_calculator.calculate_position_risk(
                token_address,
                {
                    "size": position.size,
                    "entry_price": position.entry_price
                },
                market_data[token_address]
            )
            
            # Check stop loss / take profit
            await self._check_exit_conditions(position, current_price)
            
    async def _calculate_portfolio_metrics(
        self,
        risk_metrics: RiskMetrics
    ) -> PortfolioMetrics:
        """Calculate current portfolio metrics"""
        # Calculate total value
        total_value = self.balance + sum(
            p.size * p.current_price for p in self.positions.values()
        )
        
        # Calculate unrealized P&L
        unrealized_pnl = sum(
            p.unrealized_pnl for p in self.positions.values()
        )
        
        # Calculate returns
        prev_metrics = self.last_metrics
        if prev_metrics:
            daily_return = float(
                (total_value - prev_metrics.total_value) /
                prev_metrics.total_value
            )
            total_return = float(
                (total_value - self.config["initial_balance"]) /
                self.config["initial_balance"]
            )
        else:
            daily_return = 0.0
            total_return = 0.0
            
        # Determine portfolio status
        status = self._determine_portfolio_status(
            total_value,
            risk_metrics,
            daily_return
        )
        
        return PortfolioMetrics(
            total_value=total_value,
            cash_balance=self.balance,
            unrealized_pnl=unrealized_pnl,
            realized_pnl=self.realized_pnl,
            daily_return=daily_return,
            total_return=total_return,
            sharpe_ratio=risk_metrics.sharpe_ratio,
            positions_count=len(self.positions),
            risk_metrics=risk_metrics,
            status=status,
            timestamp=datetime.now()
        )
        
    async def _validate_trade(
        self,
        token_address: str,
        side: str,
        size: Decimal,
        price: Decimal
    ) -> Dict[str, Any]:
        """Validate trade against portfolio constraints"""
        try:
            # Calculate trade value
            trade_value = size * price
            
            # Check balance
            if side == "buy" and trade_value > self.balance:
                return {
                    "valid": False,
                    "reason": "Insufficient balance"
                }
                
            # Check position limits
            if side == "buy":
                if token_address in self.positions:
                    new_size = self.positions[token_address].size + size
                else:
                    new_size = size
                    
                if new_size * price > self.max_position_value:
                    return {
                        "valid": False,
                        "reason": "Exceeds position size limit"
                    }
                    
            # Check portfolio value limit
            new_portfolio_value = sum(
                p.size * p.current_price for p in self.positions.values()
            )
            if side == "buy":
                new_portfolio_value += trade_value
                
            if new_portfolio_value > self.max_portfolio_value:
                return {
                    "valid": False,
                    "reason": "Exceeds portfolio value limit"
                }
                
            return {"valid": True}
            
        except Exception as e:
            return {
                "valid": False,
                "reason": f"Validation error: {str(e)}"
            }
            
    async def _open_position(
        self,
        token_address: str,
        size: Decimal,
        price: Decimal,
        metadata: Dict[str, Any]
    ):
        """Open new position or add to existing"""
        if token_address in self.positions:
            # Update existing position
            position = self.positions[token_address]
            new_size = position.size + size
            new_cost = (position.size * position.entry_price + size * price)
            position.entry_price = new_cost / new_size
            position.size = new_size
            position.metadata.update(metadata)
        else:
            # Create new position
            position = Position(
                token_address=token_address,
                size=size,
                entry_price=price,
                current_price=price,
                unrealized_pnl=Decimal("0"),
                risk_metrics=None,  # Will be updated in next cycle
                stop_loss=metadata.get("stop_loss"),
                take_profit=metadata.get("take_profit"),
                timestamp=datetime.now(),
                metadata=metadata
            )
            self.positions[token_address] = position
            
        # Update balance
        self.balance -= size * price
        
    async def _close_position(
        self,
        token_address: str,
        size: Decimal,
        price: Decimal,
        metadata: Dict[str, Any]
    ):
        """Close or reduce position"""
        if token_address not in self.positions:
            raise ValueError(f"Position not found: {token_address}")
            
        position = self.positions[token_address]
        
        if size > position.size:
            raise ValueError("Close size exceeds position size")
            
        # Calculate P&L
        pnl = (price - position.entry_price) * size
        self.realized_pnl += pnl
        
        # Update position
        if size == position.size:
            del self.positions[token_address]
        else:
            position.size -= size
            position.metadata.update(metadata)
            
        # Update balance
        self.balance += size * price + pnl
        
    async def _check_exit_conditions(self, position: Position, current_price: Decimal):
        """Check stop loss and take profit conditions"""
        if position.stop_loss and current_price <= position.stop_loss:
            await self._close_position(
                position.token_address,
                position.size,
                current_price,
                {"exit_reason": "stop_loss"}
            )
            
        elif position.take_profit and current_price >= position.take_profit:
            await self._close_position(
                position.token_address,
                position.size,
                current_price,
                {"exit_reason": "take_profit"}
            )
            
    async def _check_risk_limits(self, metrics: PortfolioMetrics):
        """Check and handle risk limit breaches"""
        if metrics.status == PortfolioStatus.CRITICAL:
            # Implement emergency risk reduction
            await self._reduce_risk()
            
    async def _reduce_risk(self):
        """Implement risk reduction measures"""
        # Sort positions by risk contribution
        positions_by_risk = sorted(
            self.positions.items(),
            key=lambda x: x[1].risk_metrics.risk_contribution,
            reverse=True
        )
        
        # Close riskiest positions first
        for token_address, position in positions_by_risk:
            await self._close_position(
                token_address,
                position.size,
                position.current_price,
                {"exit_reason": "risk_reduction"}
            )
            
            # Check if we're back within limits
            metrics = await self._calculate_portfolio_metrics(
                await self.risk_calculator.calculate_portfolio_risk(
                    self.positions,
                    {}  # Market data would be needed here
                )
            )
            
            if metrics.status != PortfolioStatus.CRITICAL:
                break
                
    def _determine_portfolio_status(
        self,
        total_value: Decimal,
        risk_metrics: RiskMetrics,
        daily_return: float
    ) -> PortfolioStatus:
        """Determine portfolio health status"""
        if (
            float(total_value) < float(self.config["initial_balance"]) * (1 - self.max_drawdown) or
            risk_metrics.value_at_risk > self.config.get("max_var", 0.1) or
            daily_return < -0.1  # 10% daily loss
        ):
            return PortfolioStatus.CRITICAL
            
        elif (
            risk_metrics.value_at_risk > self.config.get("warning_var", 0.05) or
            daily_return < -0.05  # 5% daily loss
        ):
            return PortfolioStatus.WARNING
            
        return PortfolioStatus.HEALTHY
        
    def get_portfolio_summary(self) -> Dict[str, Any]:
        """Get portfolio summary"""
        if not self.last_metrics:
            return {}
            
        return {
            "total_value": str(self.last_metrics.total_value),
            "cash_balance": str(self.last_metrics.cash_balance),
            "unrealized_pnl": str(self.last_metrics.unrealized_pnl),
            "realized_pnl": str(self.last_metrics.realized_pnl),
            "daily_return": self.last_metrics.daily_return,
            "total_return": self.last_metrics.total_return,
            "sharpe_ratio": self.last_metrics.sharpe_ratio,
            "positions": len(self.positions),
            "status": self.last_metrics.status.value,
            "risk_level": str(self.last_metrics.risk_metrics.value_at_risk),
            "timestamp": self.last_metrics.timestamp.isoformat()
        }
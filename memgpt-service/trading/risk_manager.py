# memgpt-service/trading/risk_manager.py
from typing import Dict, Any, Optional
from decimal import Decimal
from dataclasses import dataclass
import numpy as np
from datetime import datetime
import logging

@dataclass
class RiskLimits:
    max_position_size: Decimal
    max_portfolio_value: Decimal
    max_drawdown: float
    min_liquidity: Decimal
    max_slippage: float

@dataclass
class RiskMetrics:
    value_at_risk: float
    expected_shortfall: float
    sharpe_ratio: float
    volatility: float
    current_drawdown: float

class RiskManager:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        
        # Initialize risk limits based on user type
        self.admin_limits = RiskLimits(
            max_position_size=Decimal("100"),  # 100 SOL
            max_portfolio_value=Decimal("1000"),  # 1000 SOL
            max_drawdown=0.2,  # 20%
            min_liquidity=Decimal("10000"),  # 10000 SOL
            max_slippage=0.02  # 2%
        )
        
        self.holder_limits = {
            'basic': RiskLimits(
                max_position_size=Decimal("1"),
                max_portfolio_value=Decimal("10"),
                max_drawdown=0.1,
                min_liquidity=Decimal("5000"),
                max_slippage=0.01
            ),
            'premium': RiskLimits(
                max_position_size=Decimal("5"),
                max_portfolio_value=Decimal("50"),
                max_drawdown=0.15,
                min_liquidity=Decimal("7500"),
                max_slippage=0.015
            ),
            'vip': RiskLimits(
                max_position_size=Decimal("20"),
                max_portfolio_value=Decimal("200"),
                max_drawdown=0.2,
                min_liquidity=Decimal("10000"),
                max_slippage=0.02
            )
        }
        
    async def check_trade_risk(
        self,
        trade: Dict[str, Any],
        user_type: str,
        tier: str = 'basic'
    ) -> Dict[str, Any]:
        """Check if trade meets risk requirements"""
        try:
            limits = self.admin_limits if user_type == 'admin' else self.holder_limits[tier]
            
            # Check position size
            if Decimal(str(trade['size'])) > limits.max_position_size:
                return {
                    "allowed": False,
                    "reason": "Position size exceeds limit"
                }
                
            # Check liquidity
            if not await self._check_liquidity(trade['token'], limits.min_liquidity):
                return {
                    "allowed": False,
                    "reason": "Insufficient liquidity"
                }
                
            # Check slippage
            estimated_slippage = await self._estimate_slippage(trade)
            if estimated_slippage > limits.max_slippage:
                return {
                    "allowed": False,
                    "reason": f"Estimated slippage ({estimated_slippage:.2%}) too high"
                }
                
            return {
                "allowed": True,
                "metrics": {
                    "estimated_slippage": estimated_slippage,
                    "liquidity_score": await self._calculate_liquidity_score(trade['token']),
                    "risk_score": await self._calculate_risk_score(trade)
                }
            }
            
        except Exception as e:
            logging.error(f"Trade risk check error: {str(e)}")
            return {
                "allowed": False,
                "reason": f"Risk check error: {str(e)}"
            }
            
    async def calculate_position_size(
        self,
        token: str,
        user_type: str,
        tier: str = 'basic'
    ) -> Decimal:
        """Calculate optimal position size"""
        try:
            # Get market data
            market_data = await self._get_market_data(token)
            
            # Calculate base position size
            limits = self.admin_limits if user_type == 'admin' else self.holder_limits[tier]
            base_size = limits.max_position_size * Decimal("0.1")  # Start with 10% of max
            
            # Adjust for volatility
            volatility = await self._calculate_volatility(token)
            volatility_factor = Decimal(str(1 - min(volatility * 2, 0.5)))
            
            # Adjust for liquidity
            liquidity_score = await self._calculate_liquidity_score(token)
            liquidity_factor = Decimal(str(liquidity_score))
            
            # Calculate final size
            position_size = base_size * volatility_factor * liquidity_factor
            
            # Ensure within limits
            return min(position_size, limits.max_position_size)
            
        except Exception as e:
            logging.error(f"Position size calculation error: {str(e)}")
            return Decimal("0")
            
    async def get_risk_metrics(
        self,
        portfolio: Dict[str, Any],
        user_type: str,
        tier: str = 'basic'
    ) -> RiskMetrics:
        """Calculate comprehensive risk metrics"""
        try:
            # Get historical data
            historical_data = await self._get_historical_data(portfolio)
            
            # Calculate metrics
            returns = self._calculate_returns(historical_data)
            volatility = float(np.std(returns) * np.sqrt(252))  # Annualized
            
            value_at_risk = self._calculate_var(returns, 0.95)
            expected_shortfall = self._calculate_es(returns, 0.95)
            sharpe_ratio = self._calculate_sharpe_ratio(returns)
            current_drawdown = self._calculate_current_drawdown(historical_data)
            
            return RiskMetrics(
                value_at_risk=value_at_risk,
                expected_shortfall=expected_shortfall,
                sharpe_ratio=sharpe_ratio,
                volatility=volatility,
                current_drawdown=current_drawdown
            )
            
        except Exception as e:
            logging.error(f"Risk metrics calculation error: {str(e)}")
            raise

    # Helper methods...
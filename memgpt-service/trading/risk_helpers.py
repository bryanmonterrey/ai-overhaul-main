# memgpt-service/trading/risk_helpers.py
from typing import Dict, Any, List
import numpy as np
from decimal import Decimal
import pandas as pd
from datetime import datetime, timedelta

class RiskHelpers:
    @staticmethod
    def calculate_var(returns: np.ndarray, confidence_level: float = 0.95) -> float:
        """Calculate Value at Risk"""
        return np.percentile(returns, (1 - confidence_level) * 100)

    @staticmethod
    def calculate_es(returns: np.ndarray, confidence_level: float = 0.95) -> float:
        """Calculate Expected Shortfall (Conditional VaR)"""
        var = np.percentile(returns, (1 - confidence_level) * 100)
        return returns[returns <= var].mean()

    @staticmethod
    def calculate_volatility(prices: np.ndarray, annualize: bool = True) -> float:
        """Calculate price volatility"""
        returns = np.diff(np.log(prices))
        vol = np.std(returns)
        if annualize:
            vol *= np.sqrt(252)  # Annualize assuming daily data
        return vol

    @staticmethod
    def calculate_sharpe_ratio(
        returns: np.ndarray,
        risk_free_rate: float = 0.02
    ) -> float:
        """Calculate Sharpe Ratio"""
        excess_returns = returns - (risk_free_rate / 252)  # Daily risk-free rate
        return np.sqrt(252) * np.mean(excess_returns) / np.std(returns)

    @staticmethod
    def calculate_max_drawdown(prices: np.ndarray) -> float:
        """Calculate Maximum Drawdown"""
        cumulative = np.maximum.accumulate(prices)
        drawdowns = (prices - cumulative) / cumulative
        return np.min(drawdowns)

    @staticmethod
    def calculate_liquidity_score(
        market_data: Dict[str, Any],
        position_size: Decimal
    ) -> float:
        """Calculate liquidity score based on market data"""
        volume_24h = Decimal(str(market_data.get("volume24h", 0)))
        liquidity = Decimal(str(market_data.get("liquidity", 0)))
        
        if liquidity == 0:
            return 0.0
        
        # Calculate scores
        size_to_liquidity = float(position_size / liquidity)
        volume_to_liquidity = float(volume_24h / liquidity)
        
        # Combine scores
        score = (
            (1 - min(size_to_liquidity, 1)) * 0.7 +  # Weight size impact more heavily
            (1 - min(volume_to_liquidity, 1)) * 0.3
        )
        
        return score

    @staticmethod
    def estimate_slippage(
        size: Decimal,
        market_data: Dict[str, Any]
    ) -> float:
        """Estimate slippage for a given trade size"""
        liquidity = Decimal(str(market_data.get("liquidity", 0)))
        if liquidity == 0:
            return 1.0  # Maximum slippage if no liquidity
            
        # Basic square root price impact model
        impact = float(np.sqrt(size / liquidity))
        return min(impact, 1.0)  # Cap at 100% slippage

    @staticmethod
    def calculate_position_concentration(
        position_value: Decimal,
        portfolio_value: Decimal
    ) -> float:
        """Calculate position concentration risk"""
        if portfolio_value == 0:
            return 1.0
        return float(position_value / portfolio_value)
    
    async def calculate_trade_risk_metrics(self, trade: Dict[str, Any]) -> Dict[str, float]:
        """Calculate risk metrics for a trade"""
        try:
            # Extract trade parameters
            amount = Decimal(str(trade.get('amount', 0)))
            asset = trade.get('asset', '')
            side = trade.get('side', 'buy')

            # Default metrics
            metrics = {
                "position_risk": 0.0,
                "liquidity_risk": 0.0,
                "slippage_risk": 0.0,
                "overall_risk": 0.0
            }

            # If we have market data, calculate detailed metrics
            if hasattr(self, 'get_market_data'):
                market_data = await self.get_market_data(asset)
                if market_data:
                    # Calculate individual risk components
                    metrics["liquidity_risk"] = 1.0 - self.calculate_liquidity_score(
                        market_data,
                        amount
                    )
                    metrics["slippage_risk"] = self.estimate_slippage(
                        amount,
                        market_data
                    )

                    # Overall risk is weighted average of components
                    metrics["overall_risk"] = (
                        metrics["liquidity_risk"] * 0.4 +
                        metrics["slippage_risk"] * 0.6
                    )

            return metrics

        except Exception as e:
            print(f"Error calculating trade risk metrics: {str(e)}")
            return {
                "position_risk": 1.0,  # Maximum risk on error
                "liquidity_risk": 1.0,
                "slippage_risk": 1.0,
                "overall_risk": 1.0
            }
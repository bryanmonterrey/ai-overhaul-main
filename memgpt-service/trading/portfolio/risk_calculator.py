"""
Risk calculator for portfolio management.
Handles risk metrics, exposure calculations, and position sizing.
"""
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime, timedelta
import numpy as np
from decimal import Decimal
import pandas as pd

@dataclass
class RiskMetrics:
    """Portfolio risk metrics"""
    value_at_risk: float  # 95% VaR
    expected_shortfall: float  # Conditional VaR
    sharpe_ratio: float
    max_drawdown: float
    beta: float
    volatility: float
    correlation_matrix: Optional[pd.DataFrame]
    timestamp: datetime

@dataclass
class PositionRisk:
    """Individual position risk metrics"""
    position_size: Decimal
    notional_value: Decimal
    unrealized_pnl: Decimal
    risk_contribution: float
    max_loss: Decimal
    liquidation_impact: float
    concentration_risk: float

class RiskCalculator:
    """Calculates and monitors portfolio risk metrics"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        
        # Risk limits
        self.max_position_size = Decimal(config.get("max_position_size", "100000"))
        self.max_portfolio_var = float(config.get("max_portfolio_var", 0.05))
        self.max_concentration = float(config.get("max_concentration", 0.2))
        
        # VaR parameters
        self.var_confidence = config.get("var_confidence", 0.95)
        self.var_window = config.get("var_window", 30)
        
        # Historical data
        self.price_history: Dict[str, pd.DataFrame] = {}
        self.risk_metrics_history: List[RiskMetrics] = []
        
    async def calculate_portfolio_risk(
        self,
        positions: Dict[str, Dict[str, Any]],
        market_data: Dict[str, Dict[str, Any]]
    ) -> RiskMetrics:
        """Calculate comprehensive portfolio risk metrics"""
        try:
            # Update price history
            self._update_price_history(positions.keys(), market_data)
            
            # Calculate returns
            returns = self._calculate_returns()
            
            # Calculate VaR and ES
            var, es = self._calculate_var_metrics(returns)
            
            # Calculate other risk metrics
            sharpe = self._calculate_sharpe_ratio(returns)
            drawdown = self._calculate_max_drawdown(returns)
            beta = self._calculate_portfolio_beta(returns)
            vol = self._calculate_portfolio_volatility(returns)
            corr = self._calculate_correlation_matrix(returns)
            
            metrics = RiskMetrics(
                value_at_risk=var,
                expected_shortfall=es,
                sharpe_ratio=sharpe,
                max_drawdown=drawdown,
                beta=beta,
                volatility=vol,
                correlation_matrix=corr,
                timestamp=datetime.now()
            )
            
            # Update history
            self.risk_metrics_history.append(metrics)
            
            return metrics
            
        except Exception as e:
            logging.error(f"Portfolio risk calculation error: {str(e)}")
            raise
            
    async def calculate_position_risk(
        self,
        token_address: str,
        position: Dict[str, Any],
        market_data: Dict[str, Any]
    ) -> PositionRisk:
        """Calculate risk metrics for individual position"""
        try:
            size = Decimal(str(position["size"]))
            price = Decimal(str(market_data["price"]))
            entry_price = Decimal(str(position["entry_price"]))
            
            # Calculate basic metrics
            notional = size * price
            unrealized_pnl = (price - entry_price) * size
            
            # Calculate risk contribution
            risk_contrib = self._calculate_risk_contribution(
                token_address,
                notional
            )
            
            # Calculate maximum potential loss
            max_loss = self._calculate_max_loss(
                token_address,
                size,
                price,
                market_data
            )
            
            # Calculate liquidation impact
            liq_impact = self._calculate_liquidation_impact(
                size,
                market_data
            )
            
            # Calculate concentration risk
            concentration = self._calculate_concentration_risk(
                notional,
                market_data
            )
            
            return PositionRisk(
                position_size=size,
                notional_value=notional,
                unrealized_pnl=unrealized_pnl,
                risk_contribution=risk_contrib,
                max_loss=max_loss,
                liquidation_impact=liq_impact,
                concentration_risk=concentration
            )
            
        except Exception as e:
            logging.error(f"Position risk calculation error: {str(e)}")
            raise
            
    def _update_price_history(
        self,
        tokens: List[str],
        market_data: Dict[str, Dict[str, Any]]
    ):
        """Update price history for tokens"""
        current_time = datetime.now()
        
        for token in tokens:
            if token not in self.price_history:
                self.price_history[token] = pd.DataFrame(
                    columns=["price", "timestamp"]
                )
                
            # Add new price data
            if token in market_data:
                self.price_history[token] = self.price_history[token].append(
                    {
                        "price": float(market_data[token]["price"]),
                        "timestamp": current_time
                    },
                    ignore_index=True
                )
                
            # Remove old data
            cutoff = current_time - timedelta(days=self.var_window)
            self.price_history[token] = self.price_history[token][
                self.price_history[token]["timestamp"] > cutoff
            ]
            
    def _calculate_returns(self) -> pd.DataFrame:
        """Calculate returns for all tokens"""
        returns_dict = {}
        
        for token, df in self.price_history.items():
            if len(df) > 1:
                returns = df["price"].pct_change().dropna()
                returns_dict[token] = returns
                
        return pd.DataFrame(returns_dict)
        
    def _calculate_var_metrics(
        self,
        returns: pd.DataFrame
    ) -> Tuple[float, float]:
        """Calculate Value at Risk and Expected Shortfall"""
        if returns.empty:
            return 0.0, 0.0
            
        # Calculate portfolio returns
        portfolio_returns = returns.mean(axis=1)
        
        # Calculate VaR
        var = np.percentile(
            portfolio_returns,
            (1 - self.var_confidence) * 100
        )
        
        # Calculate Expected Shortfall
        es = portfolio_returns[portfolio_returns < var].mean()
        
        return abs(var), abs(es) if not np.isnan(es) else 0.0
        
    def _calculate_sharpe_ratio(self, returns: pd.DataFrame) -> float:
        """Calculate Sharpe Ratio"""
        if returns.empty:
            return 0.0
            
        portfolio_returns = returns.mean(axis=1)
        
        # Annualized Sharpe Ratio
        mean_return = portfolio_returns.mean() * 252  # Annualize
        std_return = portfolio_returns.std() * np.sqrt(252)  # Annualize
        
        if std_return == 0:
            return 0.0
            
        return mean_return / std_return
        
    def _calculate_max_drawdown(self, returns: pd.DataFrame) -> float:
        """Calculate Maximum Drawdown"""
        if returns.empty:
            return 0.0
            
        portfolio_returns = returns.mean(axis=1)
        cumulative = (1 + portfolio_returns).cumprod()
        running_max = cumulative.expanding(min_periods=1).max()
        drawdowns = cumulative / running_max - 1
        
        return abs(drawdowns.min())
        
    def _calculate_portfolio_beta(self, returns: pd.DataFrame) -> float:
        """Calculate portfolio beta against market"""
        if returns.empty:
            return 1.0
            
        portfolio_returns = returns.mean(axis=1)
        
        # Use SOL as market proxy
        if "So11111111111111111111111111111111111111112" in returns.columns:
            market_returns = returns["So11111111111111111111111111111111111111112"]
            covariance = portfolio_returns.cov(market_returns)
            market_variance = market_returns.var()
            
            if market_variance == 0:
                return 1.0
                
            return covariance / market_variance
            
        return 1.0
        
    def _calculate_portfolio_volatility(self, returns: pd.DataFrame) -> float:
        """Calculate portfolio volatility"""
        if returns.empty:
            return 0.0
            
        portfolio_returns = returns.mean(axis=1)
        return portfolio_returns.std() * np.sqrt(252)  # Annualized
        
    def _calculate_correlation_matrix(
        self,
        returns: pd.DataFrame
    ) -> Optional[pd.DataFrame]:
        """Calculate correlation matrix between assets"""
        if returns.empty or returns.shape[1] < 2:
            return None
            
        return returns.corr()
        
    def _calculate_risk_contribution(
        self,
        token_address: str,
        notional_value: Decimal
    ) -> float:
        """Calculate risk contribution of position to portfolio"""
        if token_address not in self.price_history:
            return 0.0
            
        returns = self.price_history[token_address]["price"].pct_change().dropna()
        
        # Calculate metrics
        volatility = returns.std() * np.sqrt(252)  # Annualized
        var_contribution = float(notional_value) * volatility
        
        return var_contribution
        
    def _calculate_max_loss(
        self,
        token_address: str,
        size: Decimal,
        price: Decimal,
        market_data: Dict[str, Any]
    ) -> Decimal:
        """Calculate maximum potential loss"""
        # Consider stop loss if set
        stop_loss = Decimal(str(market_data.get("stop_loss", 0)))
        if stop_loss > 0:
            return (price - stop_loss) * size
            
        # Otherwise use historical worst case
        if token_address in self.price_history:
            historical_low = Decimal(str(self.price_history[token_address]["price"].min()))
            return (price - historical_low) * size
            
        # Fallback to 100% loss
        return price * size
        
    def _calculate_liquidation_impact(
        self,
        size: Decimal,
        market_data: Dict[str, Any]
    ) -> float:
        """Calculate market impact of liquidating position"""
        liquidity = Decimal(str(market_data.get("liquidity", 0)))
        if liquidity == 0:
            return 1.0
            
        # Calculate impact as percentage of liquidity
        impact = float(size / liquidity)
        return min(1.0, impact)
        
    def _calculate_concentration_risk(
        self,
        notional_value: Decimal,
        market_data: Dict[str, Any]
    ) -> float:
        """Calculate concentration risk"""
        market_cap = Decimal(str(market_data.get("marketCap", 0)))
        if market_cap == 0:
            return 1.0
            
        # Calculate as percentage of market cap
        concentration = float(notional_value / market_cap)
        return min(1.0, concentration)
        
    def get_risk_limits(self) -> Dict[str, Any]:
        """Get current risk limits"""
        return {
            "max_position_size": float(self.max_position_size),
            "max_portfolio_var": self.max_portfolio_var,
            "max_concentration": self.max_concentration,
            "var_confidence": self.var_confidence,
            "var_window": self.var_window
        }
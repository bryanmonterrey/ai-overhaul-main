"""
Trading module initialization.
Implements sophisticated Solana trading system with multi-strategy approach.
"""
from typing import Dict, Any
from .agents.analyst_agent import AnalystAgent
from .agents.trader_agent import TraderAgent
from .agents.risk_manager import RiskManager
from .portfolio.risk_calculator import RiskCalculator

class TradingSystem:
    def __init__(self, config: Dict[str, Any]):
        # Initialize agents
        self.analyst = AnalystAgent(config.get("analyst", {}))
        self.trader = TraderAgent(config.get("trader", {}))
        self.risk_manager = RiskManager(config.get("risk", {}))
        
        # Initialize strategies
        self.strategies = {
            "momentum": MomentumStrategy(
                ichimoku_config=config.get("ichimoku", {}),
                bollinger_config=config.get("bollinger", {}),
                rsi_config=config.get("rsi", {}),
                macd_config=config.get("macd", {})
            ),
            "mean_reversion": MeanReversionStrategy(),
            "sentiment": SentimentStrategy()
        }
        
        # Initialize portfolio management
        self.portfolio_manager = PortfolioManager(
            config.get("portfolio", {})
        )
        self.risk_calculator = RiskCalculator(
            config.get("risk_calc", {})
        )
        
        # DexScreener API configuration
        self.dex_config = config.get("dexscreener", {
            "api_url": "https://api.dexscreener.com/latest/dex/pairs",
            "filters": {
                "pair_age": 24,  # hours
                "txns_1h": 150,
                "txns_5m": 25
            }
        })
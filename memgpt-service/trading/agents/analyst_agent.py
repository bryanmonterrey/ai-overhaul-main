from typing import Dict, Any, List, Optional
import aiohttp
import numpy as np
from datetime import datetime, timedelta
import asyncio
import pandas as pd
from dataclasses import dataclass
import logging
import anthropic
import json
import os
from ..services.solana_bridge import SolanaBridge

from .base_agent import BaseAgent
from ..utils.indicators import (
    calculate_ichimoku,
    calculate_bollinger_bands,
    calculate_rsi,
    calculate_macd
)

@dataclass
class MarketAnalysis:
    """Represents a complete market analysis"""
    symbol: str
    contract_address: str
    price: float
    volume_24h: float
    liquidity: float
    indicators: Dict[str, Any]
    dex_metrics: Dict[str, Any]
    jupiter_routes: List[Dict[str, Any]]
    sentiment_score: float
    risk_score: float
    timestamp: datetime
    ai_analysis: Optional[Dict[str, Any]] = None  # Added for Claude analysis
    solana_metrics: Optional[Dict[str, Any]] = None  # Added for Solana Agent Kit data

class AnalystAgent(BaseAgent):
    """Analyzes market data and generates trading signals"""
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.dex_api_url = "https://api.dexscreener.com/latest/dex"
        self.jupiter_api_url = "https://price.jup.ag/v4"
        self.analysis_cache = {}
        self.analysis_expiry = timedelta(minutes=5)
        self.claude = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        self.solana_bridge = SolanaBridge(config.get("solana", {}))
        
        # Initialize Claude and Solana Agent Kit
        self.claude = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        
    async def analyze_market(self, token_address: str) -> MarketAnalysis:
        """Perform comprehensive market analysis with AI enhancement"""
        try:
            # Check cache first
            cached = self._get_cached_analysis(token_address)
            if cached:
                return cached
                
            # Fetch all data in parallel including Solana Agent Kit data
            dex_data, price_data, routes, solana_price = await asyncio.gather(
                self._fetch_dex_data(token_address),
                self._fetch_price_history(token_address),
                self._fetch_jupiter_routes(token_address),
                self.solana_agent.pythFetchPrice(token_address)
            )
            
            # Calculate technical indicators
            indicators = self._calculate_indicators(price_data)
            
            # Analyze DEX metrics
            dex_metrics = self._analyze_dex_metrics(dex_data)
            
            # Calculate risk and sentiment scores
            risk_score = await self._calculate_risk_score(token_address, dex_metrics)
            sentiment_score = await self._calculate_sentiment_score(token_address)
            
            # Get Solana Agent Kit metrics
            solana_metrics = await self._get_solana_metrics(token_address)
            
            # Create base analysis
            analysis = MarketAnalysis(
                symbol=dex_data["symbol"],
                contract_address=token_address,
                price=float(dex_data["price"]),
                volume_24h=float(dex_data["volume24h"]),
                liquidity=float(dex_data["liquidity"]),
                indicators=indicators,
                dex_metrics=dex_metrics,
                jupiter_routes=routes,
                sentiment_score=sentiment_score,
                risk_score=risk_score,
                timestamp=datetime.now(),
                solana_metrics=solana_metrics
            )
            
            # Enhance with Claude's analysis
            ai_analysis = await self._get_claude_analysis(analysis)
            analysis.ai_analysis = ai_analysis
            
            # Cache the analysis
            self._cache_analysis(token_address, analysis)
            
            return analysis
            
        except Exception as e:
            self.logger.error(f"Market analysis error: {str(e)}")
            raise

    async def _get_claude_analysis(self, analysis: MarketAnalysis) -> Dict[str, Any]:
        """Get enhanced analysis from Claude"""
        try:
            response = await self.claude.messages.create(
                model="claude-3-opus-20240229",
                messages=[{
                    "role": "system",
                    "content": "You are an expert Solana market analyst specializing in technical analysis and risk assessment."
                },
                {
                    "role": "user",
                    "content": f"""Analyze this market data and provide insights:

Technical Indicators:
{json.dumps(analysis.indicators, indent=2)}

DEX Metrics:
{json.dumps(analysis.dex_metrics, indent=2)}

Market Data:
- Price: {analysis.price}
- 24h Volume: {analysis.volume_24h}
- Liquidity: {analysis.liquidity}
- Risk Score: {analysis.risk_score}
- Sentiment Score: {analysis.sentiment_score}

Solana Metrics:
{json.dumps(analysis.solana_metrics, indent=2)}

Provide analysis in JSON format including:
1. market_sentiment: string (bullish, bearish, neutral)
2. risk_assessment: object
3. trading_opportunities: array
4. key_metrics_analysis: object
5. technical_outlook: string
6. recommendation: string
7. warning_flags: array
"""
                }]
            )
            
            return json.loads(response.content[0].text)
            
        except Exception as e:
            self.logger.error(f"Claude analysis error: {str(e)}")
            return {
                "market_sentiment": "neutral",
                "risk_assessment": {"level": "high", "reason": str(e)},
                "trading_opportunities": [],
                "key_metrics_analysis": {},
                "technical_outlook": "Analysis failed",
                "recommendation": "Unable to provide recommendation",
                "warning_flags": ["Analysis failed"]
            }

    async def _get_solana_metrics(self, token_address: str) -> Dict[str, Any]:
        """Get additional metrics through Solana bridge"""
        try:
            token_data = await self.solana_bridge.get_token_data(token_address)
            pyth_price = await self.solana_bridge.fetch_pyth_price(token_address)
            
            return {
                "token_data": token_data,
                "pyth_price": pyth_price,
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            self.logger.error(f"Solana metrics error: {str(e)}")
            return {}
            
    async def _fetch_dex_data(self, token_address: str) -> Dict[str, Any]:
        """Fetch token data from DexScreener"""
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{self.dex_api_url}/pairs/solana/{token_address}"
            ) as response:
                data = await response.json()
                if "pairs" not in data or not data["pairs"]:
                    raise ValueError(f"No DEX data found for {token_address}")
                return data["pairs"][0]
                
    async def _fetch_price_history(self, token_address: str) -> pd.DataFrame:
        """Fetch price history from DexScreener"""
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{self.dex_api_url}/tokens/{token_address}/ohlcv/1h/100"
            ) as response:
                data = await response.json()
                df = pd.DataFrame(data["data"])
                df["timestamp"] = pd.to_datetime(df["timestamp"], unit="s")
                return df.set_index("timestamp")
                
    async def _fetch_jupiter_routes(self, token_address: str) -> List[Dict[str, Any]]:
        """Fetch available routes from Jupiter"""
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{self.jupiter_api_url}/quote",
                params={
                    "inputMint": token_address,
                    "outputMint": "So11111111111111111111111111111111111111112",  # SOL
                    "amount": "1000000"  # 1 unit in lamports
                }
            ) as response:
                data = await response.json()
                return data.get("routes", [])
                
    def _calculate_indicators(self, price_data: pd.DataFrame) -> Dict[str, Any]:
        """Calculate technical indicators"""
        indicators = {}
        
        # Ichimoku Cloud
        indicators["ichimoku"] = calculate_ichimoku(
            price_data["high"],
            price_data["low"],
            price_data["close"]
        )
        
        # Bollinger Bands
        indicators["bollinger"] = calculate_bollinger_bands(
            price_data["close"]
        )
        
        # RSI
        indicators["rsi"] = calculate_rsi(
            price_data["close"]
        )
        
        # MACD
        indicators["macd"] = calculate_macd(
            price_data["close"]
        )
        
        return indicators
        
    def _analyze_dex_metrics(self, dex_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze DEX metrics for token"""
        return {
            "liquidity_score": self._calculate_liquidity_score(dex_data),
            "volume_score": self._calculate_volume_score(dex_data),
            "price_impact": self._calculate_price_impact(dex_data),
            "holder_metrics": self._analyze_holder_metrics(dex_data)
        }
        
    async def _calculate_risk_score(
        self,
        token_address: str,
        dex_metrics: Dict[str, Any]
    ) -> float:
        """Calculate comprehensive risk score"""
        risk_factors = {
            "liquidity": dex_metrics["liquidity_score"] * 0.3,
            "volume": dex_metrics["volume_score"] * 0.2,
            "price_impact": (1 - dex_metrics["price_impact"]) * 0.2,
            "holder_concentration": (
                1 - dex_metrics["holder_metrics"]["concentration"]
            ) * 0.3
        }
        
        return sum(risk_factors.values())
        
    async def _calculate_sentiment_score(self, token_address: str) -> float:
        """Calculate sentiment score using LettA's analysis"""
        try:
            # Integrate with your LettA service here
            sentiment_data = await self.letta_service.analyze_token_sentiment(
                token_address
            )
            return sentiment_data.get("score", 0.5)
        except Exception as e:
            self.logger.warning(f"Sentiment analysis error: {str(e)}")
            return 0.5
            
    def _calculate_liquidity_score(self, dex_data: Dict[str, Any]) -> float:
        """Calculate liquidity score"""
        liquidity = float(dex_data.get("liquidity", 0))
        if liquidity <= 0:
            return 0
        
        # Logarithmic scaling for liquidity score
        return min(1.0, np.log10(liquidity) / 6)  # Normalized to [0,1]
        
    def _calculate_volume_score(self, dex_data: Dict[str, Any]) -> float:
        """Calculate volume score"""
        volume = float(dex_data.get("volume24h", 0))
        if volume <= 0:
            return 0
            
        return min(1.0, np.log10(volume) / 7)  # Normalized to [0,1]
        
    def _calculate_price_impact(self, dex_data: Dict[str, Any]) -> float:
        """Calculate price impact score"""
        liquidity = float(dex_data.get("liquidity", 0))
        volume = float(dex_data.get("volume24h", 0))
        
        if liquidity <= 0:
            return 1.0  # Maximum price impact
            
        return min(1.0, volume / (liquidity * 10))
        
    def _analyze_holder_metrics(self, dex_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze token holder metrics"""
        return {
            "concentration": 0.5,  # Placeholder - implement actual holder analysis
            "top_holders": [],
            "holder_count": 0
        }
        
    def _get_cached_analysis(self, token_address: str) -> Optional[MarketAnalysis]:
        """Get cached analysis if not expired"""
        if token_address in self.analysis_cache:
            analysis = self.analysis_cache[token_address]
            if datetime.now() - analysis.timestamp < self.analysis_expiry:
                return analysis
        return None
        
    def _cache_analysis(self, token_address: str, analysis: MarketAnalysis):
        """Cache market analysis"""
        self.analysis_cache[token_address] = analysis
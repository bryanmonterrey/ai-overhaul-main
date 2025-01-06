"""
Momentum trading strategy implementation.
Combines multiple technical indicators for signal generation.
"""
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime
import numpy as np
import pandas as pd
from enum import Enum

class SignalStrength(Enum):
    STRONG_BUY = 5
    BUY = 4
    NEUTRAL = 3
    SELL = 2
    STRONG_SELL = 1

@dataclass
class Signal:
    """Trading signal with analysis"""
    strength: SignalStrength
    direction: str  # "buy" or "sell"
    confidence: float  # 0 to 1
    indicators: Dict[str, Any]
    price: float
    timestamp: datetime
    metadata: Dict[str, Any]

class MomentumStrategy:
    """Implements momentum trading strategy with multiple indicators"""
    
    def __init__(
        self,
        ichimoku_config: Dict[str, Any],
        bollinger_config: Dict[str, Any],
        rsi_config: Dict[str, Any],
        macd_config: Dict[str, Any]
    ):
        # Initialize indicator configurations
        self.ichimoku_config = {
            "tenkan_period": ichimoku_config.get("tenkan_period", 9),
            "kijun_period": ichimoku_config.get("kijun_period", 26),
            "senkou_b_period": ichimoku_config.get("senkou_b_period", 52),
            "displacement": ichimoku_config.get("displacement", 26)
        }
        
        self.bollinger_config = {
            "window": bollinger_config.get("window", 20),
            "num_std": bollinger_config.get("num_std", 2),
            "squeeze_threshold": bollinger_config.get("squeeze_threshold", 0.1)
        }
        
        self.rsi_config = {
            "period": rsi_config.get("period", 14),
            "overbought": rsi_config.get("overbought", 70),
            "oversold": rsi_config.get("oversold", 30)
        }
        
        self.macd_config = {
            "fast_period": macd_config.get("fast_period", 12),
            "slow_period": macd_config.get("slow_period", 26),
            "signal_period": macd_config.get("signal_period", 9)
        }
        
        # Weight configuration for indicator combination
        self.weights = {
            "ichimoku": 0.3,
            "bollinger": 0.2,
            "rsi": 0.25,
            "macd": 0.25
        }
        
    async def generate_signal(
        self,
        price_data: pd.DataFrame,
        market_data: Dict[str, Any]
    ) -> Signal:
        """Generate trading signal from indicators"""
        try:
            # Calculate all indicators
            ichimoku = self._calculate_ichimoku(price_data)
            bollinger = self._calculate_bollinger_bands(price_data)
            rsi = self._calculate_rsi(price_data)
            macd = self._calculate_macd(price_data)
            
            # Get individual signals
            ichimoku_signal = self._analyze_ichimoku(ichimoku, price_data)
            bollinger_signal = self._analyze_bollinger(bollinger, price_data)
            rsi_signal = self._analyze_rsi(rsi)
            macd_signal = self._analyze_macd(macd)
            
            # Combine signals
            combined_signal = self._combine_signals(
                ichimoku_signal,
                bollinger_signal,
                rsi_signal,
                macd_signal,
                market_data
            )
            
            return Signal(
                strength=combined_signal["strength"],
                direction=combined_signal["direction"],
                confidence=combined_signal["confidence"],
                indicators={
                    "ichimoku": ichimoku,
                    "bollinger": bollinger,
                    "rsi": rsi,
                    "macd": macd
                },
                price=price_data["close"].iloc[-1],
                timestamp=datetime.now(),
                metadata=combined_signal["metadata"]
            )
            
        except Exception as e:
            logging.error(f"Signal generation error: {str(e)}")
            raise
            
    def _calculate_ichimoku(self, data: pd.DataFrame) -> Dict[str, pd.Series]:
        """Calculate Ichimoku Cloud indicators"""
        highs = data["high"]
        lows = data["low"]
        
        # Tenkan-sen (Conversion Line)
        tenkan_high = highs.rolling(window=self.ichimoku_config["tenkan_period"]).max()
        tenkan_low = lows.rolling(window=self.ichimoku_config["tenkan_period"]).min()
        tenkan = (tenkan_high + tenkan_low) / 2
        
        # Kijun-sen (Base Line)
        kijun_high = highs.rolling(window=self.ichimoku_config["kijun_period"]).max()
        kijun_low = lows.rolling(window=self.ichimoku_config["kijun_period"]).min()
        kijun = (kijun_high + kijun_low) / 2
        
        # Senkou Span A (Leading Span A)
        senkou_a = ((tenkan + kijun) / 2).shift(self.ichimoku_config["displacement"])
        
        # Senkou Span B (Leading Span B)
        senkou_high = highs.rolling(window=self.ichimoku_config["senkou_b_period"]).max()
        senkou_low = lows.rolling(window=self.ichimoku_config["senkou_b_period"]).min()
        senkou_b = ((senkou_high + senkou_low) / 2).shift(self.ichimoku_config["displacement"])
        
        # Chikou Span (Lagging Span)
        chikou = data["close"].shift(-self.ichimoku_config["displacement"])
        
        return {
            "tenkan": tenkan,
            "kijun": kijun,
            "senkou_a": senkou_a,
            "senkou_b": senkou_b,
            "chikou": chikou
        }
        
    def _calculate_bollinger_bands(self, data: pd.DataFrame) -> Dict[str, pd.Series]:
        """Calculate Bollinger Bands"""
        close = data["close"]
        
        # Calculate moving average
        ma = close.rolling(window=self.bollinger_config["window"]).mean()
        
        # Calculate standard deviation
        std = close.rolling(window=self.bollinger_config["window"]).std()
        
        # Calculate bands
        upper = ma + (std * self.bollinger_config["num_std"])
        lower = ma - (std * self.bollinger_config["num_std"])
        
        # Calculate bandwidth and squeeze
        bandwidth = (upper - lower) / ma
        squeeze = bandwidth < self.bollinger_config["squeeze_threshold"]
        
        return {
            "middle": ma,
            "upper": upper,
            "lower": lower,
            "bandwidth": bandwidth,
            "squeeze": squeeze
        }
        
    def _calculate_rsi(self, data: pd.DataFrame) -> pd.Series:
        """Calculate RSI"""
        close = data["close"]
        delta = close.diff()
        
        gain = (delta.where(delta > 0, 0)).rolling(window=self.rsi_config["period"]).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=self.rsi_config["period"]).mean()
        
        rs = gain / loss
        rsi = 100 - (100 / (1 + rs))
        
        return rsi
        
    def _calculate_macd(self, data: pd.DataFrame) -> Dict[str, pd.Series]:
        """Calculate MACD"""
        close = data["close"]
        
        # Calculate EMAs
        fast_ema = close.ewm(span=self.macd_config["fast_period"], adjust=False).mean()
        slow_ema = close.ewm(span=self.macd_config["slow_period"], adjust=False).mean()
        
        # Calculate MACD line
        macd_line = fast_ema - slow_ema
        
        # Calculate signal line
        signal_line = macd_line.ewm(span=self.macd_config["signal_period"], adjust=False).mean()
        
        # Calculate histogram
        histogram = macd_line - signal_line
        
        return {
            "macd": macd_line,
            "signal": signal_line,
            "histogram": histogram
        }
        
    def _analyze_ichimoku(
        self,
        ichimoku: Dict[str, pd.Series],
        price_data: pd.DataFrame
    ) -> Dict[str, Any]:
        """Analyze Ichimoku signals"""
        current_price = price_data["close"].iloc[-1]
        
        # Check cloud position
        above_cloud = (
            current_price > ichimoku["senkou_a"].iloc[-1] and
            current_price > ichimoku["senkou_b"].iloc[-1]
        )
        below_cloud = (
            current_price < ichimoku["senkou_a"].iloc[-1] and
            current_price < ichimoku["senkou_b"].iloc[-1]
        )
        
        # Check crossovers
        tenkan_cross_up = (
            ichimoku["tenkan"].iloc[-2] < ichimoku["kijun"].iloc[-2] and
            ichimoku["tenkan"].iloc[-1] > ichimoku["kijun"].iloc[-1]
        )
        
        tenkan_cross_down = (
            ichimoku["tenkan"].iloc[-2] > ichimoku["kijun"].iloc[-2] and
            ichimoku["tenkan"].iloc[-1] < ichimoku["kijun"].iloc[-1]
        )
        
        # Generate signal
        if above_cloud and tenkan_cross_up:
            strength = SignalStrength.STRONG_BUY
        elif above_cloud:
            strength = SignalStrength.BUY
        elif below_cloud and tenkan_cross_down:
            strength = SignalStrength.STRONG_SELL
        elif below_cloud:
            strength = SignalStrength.SELL
        else:
            strength = SignalStrength.NEUTRAL
            
        return {
            "strength": strength,
            "above_cloud": above_cloud,
            "below_cloud": below_cloud,
            "tenkan_cross_up": tenkan_cross_up,
            "tenkan_cross_down": tenkan_cross_down
        }
        
    def _analyze_bollinger(
        self,
        bollinger: Dict[str, pd.Series],
        price_data: pd.DataFrame
    ) -> Dict[str, Any]:
        """Analyze Bollinger Bands signals"""
        current_price = price_data["close"].iloc[-1]
        
        # Check band position
        above_upper = current_price > bollinger["upper"].iloc[-1]
        below_lower = current_price < bollinger["lower"].iloc[-1]
        
        # Check squeeze
        squeeze = bollinger["squeeze"].iloc[-1]
        
        # Generate signal
        if below_lower and not squeeze:
            strength = SignalStrength.STRONG_BUY
        elif below_lower:
            strength = SignalStrength.BUY
        elif above_upper and not squeeze:
            strength = SignalStrength.STRONG_SELL
        elif above_upper:
            strength = SignalStrength.SELL
        else:
            strength = SignalStrength.NEUTRAL
            
        return {
            "strength": strength,
            "above_upper": above_upper,
            "below_lower": below_lower,
            "squeeze": squeeze
        }
        
    def _analyze_rsi(self, rsi: pd.Series) -> Dict[str, Any]:
        """Analyze RSI signals"""
        current_rsi = rsi.iloc[-1]
        
        # Check overbought/oversold
        overbought = current_rsi > self.rsi_config["overbought"]
        oversold = current_rsi < self.rsi_config["oversold"]
        
        # Generate signal
        if oversold and current_rsi > rsi.iloc[-2]:
            strength = SignalStrength.STRONG_BUY
        elif oversold:
            strength = SignalStrength.BUY
        elif overbought and current_rsi < rsi.iloc[-2]:
            strength = SignalStrength.STRONG_SELL
        elif overbought:
            strength = SignalStrength.SELL
        else:
            strength = SignalStrength.NEUTRAL
            
        return {
            "strength": strength,
            "current_rsi": current_rsi,
            "overbought": overbought,
            "oversold": oversold
        }
        
    def _analyze_macd(self, macd: Dict[str, pd.Series]) -> Dict[str, Any]:
        """Analyze MACD signals"""
        # Check crossovers
        signal_cross_up = (
            macd["macd"].iloc[-2] < macd["signal"].iloc[-2] and
            macd["macd"].iloc[-1] > macd["signal"].iloc[-1]
        )
        
        signal_cross_down = (
            macd["macd"].iloc[-2] > macd["signal"].iloc[-2] and
            macd["macd"].iloc[-1] < macd["signal"].iloc[-1]
        )
        
        # Check histogram
        increasing_momentum = (
            macd["histogram"].iloc[-1] > macd["histogram"].iloc[-2] > macd["histogram"].iloc[-3]
        )
        
        decreasing_momentum = (
            macd["histogram"].iloc[-1] < macd["histogram"].iloc[-2] < macd["histogram"].iloc[-3]
        )
        
        # Generate signal
        if signal_cross_up and increasing_momentum:
            strength = SignalStrength.STRONG_BUY
        elif signal_cross_up:
            strength = SignalStrength.BUY
        elif signal_cross_down and decreasing_momentum:
            strength = SignalStrength.STRONG_SELL
        elif signal_cross_down:
            strength = SignalStrength.SELL
        else:
            strength = SignalStrength.NEUTRAL
            
        return {
            "strength": strength,
            "signal_cross_up": signal_cross_up,
            "signal_cross_down": signal_cross_down,
            "increasing_momentum": increasing_momentum,
            "decreasing_momentum": decreasing_momentum
        }
        
    def _combine_signals(
        self,
        ichimoku: Dict[str, Any],
        bollinger: Dict[str, Any],
        rsi: Dict[str, Any],
        macd: Dict[str, Any],
        market_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Combine signals from all indicators"""
        # Convert signals to numerical scores (1-5)
        scores = {
            "ichimoku": ichimoku["strength"].value * self.weights["ichimoku"],
            "bollinger": bollinger["strength"].value * self.weights["bollinger"],
            "rsi": rsi["strength"].value * self.weights["rsi"],
            "macd": macd["strength"].value * self.weights["macd"]
        }
        
        # Calculate weighted average
        total_score = sum(scores.values())
        
        # Determine overall signal
        if total_score >= 4:
            strength = SignalStrength.STRONG_BUY
            direction = "buy"
        elif total_score >= 3:
            strength = SignalStrength.BUY
            direction = "buy"
        elif total_score <= 2:
            strength = SignalStrength.STRONG_SELL
            direction = "sell"
        elif total_score <= 3:
            strength = SignalStrength.SELL
            direction = "sell"
        else:
            strength = SignalStrength.NEUTRAL
            direction = "neutral"
            
        # Calculate confidence based on signal agreement
        unique_directions = len(set([
            "buy" if s.value > 3 else "sell" if s.value < 3 else "neutral"
            for s in [ichimoku["strength"], bollinger["strength"], 
                     rsi["strength"], macd["strength"]]
        ]))
        confidence = 1 - ((unique_directions - 1) / 3)  # 1.0 if all agree, 0.0 if all differ
        
        return {
            "strength": strength,
            "direction": direction,
            "confidence": confidence,
            "metadata": {
                "individual_scores": scores,
                "total_score": total_score,
                "signal_agreement": confidence,
                "ichimoku_analysis": ichimoku,
                "bollinger_analysis": bollinger,
                "rsi_analysis": rsi,
                "macd_analysis": macd
            }
        }
        
    def get_strategy_state(self) -> Dict[str, Any]:
        """Get current strategy state and configuration"""
        return {
            "configuration": {
                "ichimoku": self.ichimoku_config,
                "bollinger": self.bollinger_config,
                "rsi": self.rsi_config,
                "macd": self.macd_config,
                "weights": self.weights
            },
            "indicators": {
                "ichimoku_enabled": True,
                "bollinger_enabled": True,
                "rsi_enabled": True,
                "macd_enabled": True
            }
        }
        
    async def analyze_trade_opportunity(
        self,
        signal: Signal,
        market_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Analyze trade opportunity based on signal"""
        try:
            # Check signal strength and confidence
            if signal.confidence < 0.7:  # Minimum confidence threshold
                return {
                    "should_trade": False,
                    "reason": "Low signal confidence",
                    "metadata": signal.metadata
                }
                
            # Check market conditions
            if not self._verify_market_conditions(market_data):
                return {
                    "should_trade": False,
                    "reason": "Unfavorable market conditions",
                    "metadata": signal.metadata
                }
                
            # Determine trade parameters
            trade_params = self._calculate_trade_parameters(signal, market_data)
            
            return {
                "should_trade": True,
                "direction": signal.direction,
                "entry_price": trade_params["entry_price"],
                "stop_loss": trade_params["stop_loss"],
                "take_profit": trade_params["take_profit"],
                "size_recommendation": trade_params["position_size"],
                "metadata": {
                    **signal.metadata,
                    "trade_params": trade_params
                }
            }
            
        except Exception as e:
            logging.error(f"Trade opportunity analysis error: {str(e)}")
            return {
                "should_trade": False,
                "reason": f"Analysis error: {str(e)}",
                "metadata": signal.metadata
            }
            
    def _verify_market_conditions(self, market_data: Dict[str, Any]) -> bool:
        """Verify if market conditions are suitable for trading"""
        try:
            # Check volume requirements
            min_volume = 10000  # Minimum 24h volume in USD
            if float(market_data.get("volume24h", 0)) < min_volume:
                return False
                
            # Check liquidity requirements
            min_liquidity = 5000  # Minimum liquidity in USD
            if float(market_data.get("liquidity", 0)) < min_liquidity:
                return False
                
            # Check price stability
            max_price_change = 30  # Maximum 24h price change %
            if abs(float(market_data.get("priceChange24h", 0))) > max_price_change:
                return False
                
            return True
            
        except Exception:
            return False
            
    def _calculate_trade_parameters(
        self,
        signal: Signal,
        market_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Calculate trade parameters based on signal and market data"""
        current_price = float(market_data.get("price", signal.price))
        
        # Calculate position size based on confidence
        base_position = 100  # Base position in USD
        position_size = base_position * signal.confidence
        
        # Calculate stop loss and take profit based on volatility
        volatility = float(market_data.get("volatility", 0.05))
        if signal.direction == "buy":
            stop_loss = current_price * (1 - volatility * 2)
            take_profit = current_price * (1 + volatility * 3)
        else:
            stop_loss = current_price * (1 + volatility * 2)
            take_profit = current_price * (1 - volatility * 3)
            
        return {
            "entry_price": current_price,
            "stop_loss": stop_loss,
            "take_profit": take_profit,
            "position_size": position_size,
            "risk_reward_ratio": abs(take_profit - current_price) / abs(current_price - stop_loss)
        }
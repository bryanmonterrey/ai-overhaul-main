"""
Mean Reversion Strategy implementation.
Identifies and trades price deviations from moving averages.
"""
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime
import numpy as np
import pandas as pd
from enum import Enum

class ReversionStrength(Enum):
    STRONG_REVERSION = 5
    MODERATE_REVERSION = 4
    WEAK_REVERSION = 3
    NO_REVERSION = 2
    TREND_CONTINUATION = 1

@dataclass
class ReversionSignal:
    """Mean reversion trading signal"""
    strength: ReversionStrength
    direction: str  # "long" or "short"
    deviation: float  # Current deviation from mean
    mean_price: float
    current_price: float
    confidence: float
    timestamp: datetime
    metrics: Dict[str, Any]

class MeanReversionStrategy:
    """Implements mean reversion trading strategy"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        
        # Moving average parameters
        self.ma_windows = {
            "short": config.get("short_ma", 20),
            "medium": config.get("medium_ma", 50),
            "long": config.get("long_ma", 200)
        }
        
        # Bollinger Band parameters
        self.bollinger_window = config.get("bollinger_window", 20)
        self.bollinger_std = config.get("bollinger_std", 2.0)
        
        # Z-score parameters
        self.zscore_window = config.get("zscore_window", 20)
        self.zscore_threshold = config.get("zscore_threshold", 2.0)
        
        # RSI parameters for confirmation
        self.rsi_window = config.get("rsi_window", 14)
        self.rsi_oversold = config.get("rsi_oversold", 30)
        self.rsi_overbought = config.get("rsi_overbought", 70)
        
        # Volume filter
        self.min_volume_percentile = config.get("min_volume_percentile", 25)
        
    async def generate_signal(
        self,
        price_data: pd.DataFrame,
        market_data: Dict[str, Any]
    ) -> ReversionSignal:
        """Generate mean reversion trading signal"""
        try:
            # Calculate key metrics
            mas = self._calculate_moving_averages(price_data)
            bands = self._calculate_bollinger_bands(price_data)
            zscore = self._calculate_zscore(price_data)
            rsi = self._calculate_rsi(price_data)
            volume_signal = self._analyze_volume(price_data)
            
            # Calculate deviations
            deviations = self._calculate_deviations(
                price_data["close"].iloc[-1],
                mas,
                bands
            )
            
            # Determine reversion potential
            reversion = self._evaluate_reversion_potential(
                deviations,
                zscore,
                rsi,
                volume_signal
            )
            
            # Calculate confidence
            confidence = self._calculate_signal_confidence(
                reversion,
                deviations,
                market_data
            )
            
            return ReversionSignal(
                strength=reversion["strength"],
                direction=reversion["direction"],
                deviation=deviations["total_deviation"],
                mean_price=mas["medium"][-1],
                current_price=price_data["close"].iloc[-1],
                confidence=confidence,
                timestamp=datetime.now(),
                metrics={
                    "moving_averages": mas,
                    "bollinger_bands": bands,
                    "zscore": zscore,
                    "rsi": rsi,
                    "volume_signal": volume_signal,
                    "deviations": deviations
                }
            )
            
        except Exception as e:
            logging.error(f"Mean reversion signal generation error: {str(e)}")
            raise
            
    def _calculate_moving_averages(self, data: pd.DataFrame) -> Dict[str, pd.Series]:
        """Calculate multiple moving averages"""
        closes = data["close"]
        
        return {
            "short": closes.rolling(window=self.ma_windows["short"]).mean(),
            "medium": closes.rolling(window=self.ma_windows["medium"]).mean(),
            "long": closes.rolling(window=self.ma_windows["long"]).mean()
        }
        
    def _calculate_bollinger_bands(self, data: pd.DataFrame) -> Dict[str, pd.Series]:
        """Calculate Bollinger Bands"""
        closes = data["close"]
        
        middle = closes.rolling(window=self.bollinger_window).mean()
        std = closes.rolling(window=self.bollinger_window).std()
        
        return {
            "upper": middle + (std * self.bollinger_std),
            "middle": middle,
            "lower": middle - (std * self.bollinger_std),
            "bandwidth": (std * self.bollinger_std * 2) / middle
        }
        
    def _calculate_zscore(self, data: pd.DataFrame) -> pd.Series:
        """Calculate rolling Z-score"""
        closes = data["close"]
        mean = closes.rolling(window=self.zscore_window).mean()
        std = closes.rolling(window=self.zscore_window).std()
        
        return (closes - mean) / std
        
    def _calculate_rsi(self, data: pd.DataFrame) -> pd.Series:
        """Calculate RSI"""
        closes = data["close"]
        delta = closes.diff()
        
        gain = (delta.where(delta > 0, 0)).rolling(window=self.rsi_window).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=self.rsi_window).mean()
        
        rs = gain / loss
        return 100 - (100 / (1 + rs))
        
    def _analyze_volume(self, data: pd.DataFrame) -> Dict[str, Any]:
        """Analyze volume patterns"""
        volume = data["volume"]
        
        # Calculate volume metrics
        volume_ma = volume.rolling(window=20).mean()
        volume_std = volume.rolling(window=20).std()
        relative_volume = volume / volume_ma
        
        # Calculate volume percentile
        volume_percentile = volume.rank(pct=True)
        
        return {
            "relative_volume": relative_volume,
            "volume_percentile": volume_percentile,
            "is_high_volume": relative_volume.iloc[-1] > 1.5,
            "is_low_volume": relative_volume.iloc[-1] < 0.5,
            "volume_trend": self._calculate_volume_trend(volume)
        }
        
    def _calculate_volume_trend(self, volume: pd.Series) -> str:
        """Calculate volume trend"""
        short_ma = volume.rolling(window=5).mean()
        long_ma = volume.rolling(window=20).mean()
        
        if short_ma.iloc[-1] > long_ma.iloc[-1] * 1.2:
            return "increasing"
        elif short_ma.iloc[-1] < long_ma.iloc[-1] * 0.8:
            return "decreasing"
        return "stable"
        
    def _calculate_deviations(
        self,
        current_price: float,
        mas: Dict[str, pd.Series],
        bands: Dict[str, pd.Series]
    ) -> Dict[str, float]:
        """Calculate price deviations from various means"""
        deviations = {}
        
        # Calculate MA deviations
        for ma_type, ma_series in mas.items():
            deviation = (current_price - ma_series.iloc[-1]) / ma_series.iloc[-1]
            deviations[f"{ma_type}_ma_deviation"] = deviation
            
        # Calculate Bollinger Band deviation
        bb_deviation = (
            current_price - bands["middle"].iloc[-1]
        ) / bands["middle"].iloc[-1]
        deviations["bollinger_deviation"] = bb_deviation
        
        # Calculate total deviation (weighted average)
        weights = {
            "short_ma_deviation": 0.2,
            "medium_ma_deviation": 0.3,
            "long_ma_deviation": 0.2,
            "bollinger_deviation": 0.3
        }
        
        total_deviation = sum(
            deviations[k] * weights[k]
            for k in weights.keys()
        )
        
        deviations["total_deviation"] = total_deviation
        
        return deviations
        
    def _evaluate_reversion_potential(
        self,
        deviations: Dict[str, float],
        zscore: pd.Series,
        rsi: pd.Series,
        volume_signal: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Evaluate mean reversion potential"""
        current_zscore = zscore.iloc[-1]
        current_rsi = rsi.iloc[-1]
        total_deviation = deviations["total_deviation"]
        
        # Determine direction
        if total_deviation > 0:
            direction = "short"  # Price above mean, expect downward reversion
        else:
            direction = "long"   # Price below mean, expect upward reversion
            
        # Determine strength based on multiple factors
        strength_factors = []
        
        # Z-score factor
        if abs(current_zscore) > self.zscore_threshold * 1.5:
            strength_factors.append(ReversionStrength.STRONG_REVERSION)
        elif abs(current_zscore) > self.zscore_threshold:
            strength_factors.append(ReversionStrength.MODERATE_REVERSION)
            
        # RSI factor
        if direction == "long" and current_rsi < self.rsi_oversold:
            strength_factors.append(ReversionStrength.STRONG_REVERSION)
        elif direction == "short" and current_rsi > self.rsi_overbought:
            strength_factors.append(ReversionStrength.STRONG_REVERSION)
            
        # Deviation factor
        if abs(total_deviation) > 0.1:  # 10% deviation
            strength_factors.append(ReversionStrength.STRONG_REVERSION)
        elif abs(total_deviation) > 0.05:  # 5% deviation
            strength_factors.append(ReversionStrength.MODERATE_REVERSION)
            
        # Volume confirmation
        if volume_signal["is_high_volume"]:
            if len(strength_factors) > 0:
                strength_factors.append(max(s.value for s in strength_factors))
                
        # Determine final strength
        if not strength_factors:
            final_strength = ReversionStrength.NO_REVERSION
        else:
            avg_strength = sum(s.value for s in strength_factors) / len(strength_factors)
            final_strength = ReversionStrength(round(avg_strength))
            
        return {
            "strength": final_strength,
            "direction": direction,
            "factors": strength_factors
        }
        
    def _calculate_signal_confidence(
        self,
        reversion: Dict[str, Any],
        deviations: Dict[str, float],
        market_data: Dict[str, Any]
    ) -> float:
        """Calculate confidence in reversion signal"""
        confidence_factors = []
        
        # Strength-based confidence
        strength_confidence = (reversion["strength"].value - 1) / 4  # 0 to 1
        confidence_factors.append(strength_confidence)
        
        # Deviation-based confidence
        deviation_confidence = min(abs(deviations["total_deviation"]) * 5, 1.0)
        confidence_factors.append(deviation_confidence)
        
        # Market condition confidence
        market_confidence = self._evaluate_market_conditions(market_data)
        confidence_factors.append(market_confidence)
        
        # Calculate weighted average
        weights = [0.4, 0.4, 0.2]
        return sum(c * w for c, w in zip(confidence_factors, weights))
        
    def _evaluate_market_conditions(self, market_data: Dict[str, Any]) -> float:
        """Evaluate market conditions for mean reversion"""
        try:
            # Check liquidity
            liquidity = float(market_data.get("liquidity", 0))
            liquidity_score = min(liquidity / 1000000, 1.0)  # Normalize to 0-1
            
            # Check volume stability
            volume_change = abs(float(market_data.get("volumeChange24h", 0)))
            volume_score = 1 - min(volume_change / 100, 1.0)
            
            # Check price stability
            price_change = abs(float(market_data.get("priceChange24h", 0)))
            price_score = 1 - min(price_change / 50, 1.0)
            
            # Combine scores
            return (liquidity_score * 0.4 + volume_score * 0.3 + price_score * 0.3)
            
        except Exception:
            return 0.5
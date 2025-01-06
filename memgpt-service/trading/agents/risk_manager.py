"""
Risk Manager for Solana trading system.
Manages risk exposure and position sizing with advanced risk metrics.
"""
from typing import Dict, Any, List, Optional
from decimal import Decimal
from dataclasses import dataclass
from datetime import datetime, timedelta
import numpy as np
from enum import Enum

class RiskLevel(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    EXTREME = "extreme"

@dataclass
class PositionSize:
    base_size: Decimal
    max_size: Decimal
    recommended_size: Decimal
    risk_factors: Dict[str, float]

@dataclass
class RiskAssessment:
    level: RiskLevel
    score: float
    factors: Dict[str, float]
    warnings: List[str]
    max_position_size: Decimal
    stop_loss: Optional[float]
    timestamp: datetime

class RiskManager:
    """Manages trading risk and position sizing"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        
        # Risk limits
        self.max_position_size = Decimal(config.get("max_position_size", "5.0"))  # In SOL
        self.max_daily_loss = Decimal(config.get("max_daily_loss", "10.0"))  # Percentage
        self.max_token_exposure = Decimal(config.get("max_token_exposure", "20.0"))  # Percentage
        
        # Position sizing parameters
        self.base_position_size = Decimal(config.get("base_position_size", "0.5"))  # In SOL
        self.position_size_multiplier = Decimal(config.get("position_size_multiplier", "2.0"))
        
        # Initialize risk tracking
        self.current_positions: Dict[str, Dict[str, Any]] = {}
        self.daily_stats = self._initialize_daily_stats()
        
    async def assess_trade_risk(
        self,
        token_address: str,
        market_data: Dict[str, Any],
        wallet_balance: Decimal
    ) -> RiskAssessment:
        """Assess risk for a potential trade"""
        try:
            # Calculate individual risk factors
            liquidity_risk = self._assess_liquidity_risk(market_data)
            volatility_risk = self._assess_volatility_risk(market_data)
            exposure_risk = self._assess_exposure_risk(token_address, wallet_balance)
            market_risk = self._assess_market_risk(market_data)
            
            # Combine risk factors
            risk_score = self._calculate_combined_risk(
                liquidity_risk,
                volatility_risk,
                exposure_risk,
                market_risk
            )
            
            # Determine risk level
            risk_level = self._determine_risk_level(risk_score)
            
            # Generate warnings
            warnings = self._generate_risk_warnings(
                risk_score,
                {
                    "liquidity": liquidity_risk,
                    "volatility": volatility_risk,
                    "exposure": exposure_risk,
                    "market": market_risk
                }
            )
            
            # Calculate max position size
            max_position = self._calculate_max_position(
                risk_score,
                wallet_balance,
                market_data
            )
            
            # Calculate stop loss
            stop_loss = self._calculate_stop_loss(
                risk_score,
                market_data
            )
            
            return RiskAssessment(
                level=risk_level,
                score=risk_score,
                factors={
                    "liquidity": liquidity_risk,
                    "volatility": volatility_risk,
                    "exposure": exposure_risk,
                    "market": market_risk
                },
                warnings=warnings,
                max_position_size=max_position,
                stop_loss=stop_loss,
                timestamp=datetime.now()
            )
            
        except Exception as e:
            self.logger.error(f"Risk assessment error: {str(e)}")
            raise
            
    def calculate_position_size(
        self,
        risk_assessment: RiskAssessment,
        wallet_balance: Decimal,
        market_data: Dict[str, Any]
    ) -> PositionSize:
        """Calculate recommended position size"""
        try:
            # Base size calculation
            base_size = self.base_position_size
            
            # Adjust for risk score
            risk_multiplier = 1 - (risk_assessment.score * 0.5)  # Reduce size as risk increases
            
            # Adjust for market conditions
            market_multiplier = self._calculate_market_multiplier(market_data)
            
            # Adjust for wallet balance
            balance_multiplier = min(
                Decimal("1.0"),
                wallet_balance / (self.base_position_size * Decimal("20.0"))
            )
            
            # Calculate recommended size
            recommended_size = (
                base_size *
                Decimal(str(risk_multiplier)) *
                Decimal(str(market_multiplier)) *
                balance_multiplier
            )
            
            # Enforce limits
            max_size = min(
                self.max_position_size,
                wallet_balance * Decimal("0.2")  # Max 20% of wallet
            )
            
            recommended_size = min(recommended_size, max_size)
            
            return PositionSize(
                base_size=base_size,
                max_size=max_size,
                recommended_size=recommended_size,
                risk_factors={
                    "risk_multiplier": float(risk_multiplier),
                    "market_multiplier": float(market_multiplier),
                    "balance_multiplier": float(balance_multiplier)
                }
            )
            
        except Exception as e:
            self.logger.error(f"Position size calculation error: {str(e)}")
            raise
            
    def _assess_liquidity_risk(self, market_data: Dict[str, Any]) -> float:
        """Assess liquidity risk"""
        liquidity = Decimal(str(market_data.get("liquidity", 0)))
        volume_24h = Decimal(str(market_data.get("volume24h", 0)))
        
        if liquidity == 0:
            return 1.0
            
        # Calculate liquidity ratios
        volume_to_liquidity = volume_24h / liquidity
        
        # Score between 0 and 1, higher is riskier
        risk_score = 1 - (1 / (1 + float(volume_to_liquidity)))
        return min(1.0, max(0.0, risk_score))
        
    def _assess_volatility_risk(self, market_data: Dict[str, Any]) -> float:
        """Assess volatility risk"""
        price_changes = market_data.get("price_changes", {})
        
        # Calculate volatility score
        hour_change = abs(float(price_changes.get("1h", 0)))
        day_change = abs(float(price_changes.get("24h", 0)))
        
        # Weight recent volatility more heavily
        volatility_score = (hour_change * 0.7 + day_change * 0.3) / 100
        return min(1.0, volatility_score)
        
    def _assess_exposure_risk(
        self,
        token_address: str,
        wallet_balance: Decimal
    ) -> float:
        """Assess current exposure risk"""
        if token_address in self.current_positions:
            current_exposure = self.current_positions[token_address]["size"]
            exposure_ratio = float(current_exposure / wallet_balance)
            return min(1.0, exposure_ratio * 2)  # Scale to 0-1
        return 0.0
        
    def _assess_market_risk(self, market_data: Dict[str, Any]) -> float:
        """Assess general market risk"""
        # Combine multiple market risk factors
        factors = {
            "price_trend": self._analyze_price_trend(market_data),
            "market_impact": self._calculate_market_impact(market_data),
            "smart_money_flow": self._analyze_smart_money_flow(market_data)
        }
        
        return sum(factors.values()) / len(factors)
        
    def _calculate_combined_risk(self, *risk_factors: float) -> float:
        """Calculate combined risk score"""
        weights = [0.3, 0.25, 0.25, 0.2]  # Weights for different factors
        return sum(f * w for f, w in zip(risk_factors, weights))
        
    def _determine_risk_level(self, risk_score: float) -> RiskLevel:
        """Determine risk level from score"""
        if risk_score < 0.3:
            return RiskLevel.LOW
        elif risk_score < 0.6:
            return RiskLevel.MEDIUM
        elif risk_score < 0.8:
            return RiskLevel.HIGH
        return RiskLevel.EXTREME
        
    def _generate_risk_warnings(
        self,
        risk_score: float,
        factors: Dict[str, float]
    ) -> List[str]:
        """Generate risk warnings"""
        warnings = []
        
        if risk_score > 0.8:
            warnings.append("EXTREME RISK: Trading not recommended")
            
        if factors["liquidity"] > 0.7:
            warnings.append("High liquidity risk - Limited exit opportunities")
            
        if factors["volatility"] > 0.7:
            warnings.append("High volatility - Increased slippage risk")
            
        if factors["exposure"] > 0.5:
            warnings.append("High exposure - Consider reducing position size")
            
        return warnings
        
    def _calculate_stop_loss(
        self,
        risk_score: float,
        market_data: Dict[str, Any]
    ) -> Optional[float]:
        """Calculate recommended stop loss"""
        try:
            volatility = float(market_data.get("volatility", 0))
            if volatility == 0:
                return None
                
            # Base stop loss on volatility and risk
            base_stop = volatility * 2  # 2x volatility
            risk_adjustment = 1 + risk_score  # Tighter stops for higher risk
            
            return base_stop * risk_adjustment
            
        except Exception:
            return None
            
    def _initialize_daily_stats(self) -> Dict[str, Any]:
        """Initialize daily trading statistics"""
        return {
            "start_balance": Decimal("0"),
            "current_balance": Decimal("0"),
            "total_trades": 0,
            "winning_trades": 0,
            "losing_trades": 0,
            "total_pnl": Decimal("0"),
            "last_reset": datetime.now()
        }
        
    def _calculate_market_multiplier(self, market_data: Dict[str, Any]) -> float:
        """Calculate market condition multiplier"""
        # Analyze market conditions for position sizing
        trend_strength = self._analyze_trend_strength(market_data)
        volume_profile = self._analyze_volume_profile(market_data)
        
        # Combine factors
        return (trend_strength + volume_profile) / 2
        
    def _analyze_trend_strength(self, market_data: Dict[str, Any]) -> float:
        """Analyze trend strength"""
        # Implementation for trend strength analysis
        return 0.5  # Placeholder
        
    def _analyze_volume_profile(self, market_data: Dict[str, Any]) -> float:
        """Analyze volume profile"""
        # Implementation for volume profile analysis
        return 0.5  # Placeholder
        
    def update_position(
        self,
        token_address: str,
        size_change: Decimal,
        price: Decimal
    ):
        """Update position tracking"""
        if token_address not in self.current_positions:
            self.current_positions[token_address] = {
                "size": Decimal("0"),
                "average_price": price,
                "last_update": datetime.now()
            }
            
        position = self.current_positions[token_address]
        position["size"] += size_change
        
        if position["size"] == 0:
            del self.current_positions[token_address]
        else:
            position["last_update"] = datetime.now()
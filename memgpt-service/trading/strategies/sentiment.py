"""
Sentiment trading strategy using social media analysis and market sentiment.
Integrates with LettA for enhanced sentiment analysis.
"""
from typing import Dict, Any, List, Optional, Union
from dataclasses import dataclass
from datetime import datetime, timedelta
import numpy as np
from enum import Enum
import asyncio

class SentimentLevel(Enum):
    VERY_BULLISH = 5
    BULLISH = 4
    NEUTRAL = 3
    BEARISH = 2
    VERY_BEARISH = 1

@dataclass
class SentimentSignal:
    """Represents a sentiment-based trading signal"""
    level: SentimentLevel
    score: float  # 0 to 1
    confidence: float
    sources: Dict[str, float]  # Source -> sentiment score
    social_metrics: Dict[str, Any]
    market_metrics: Dict[str, Any]
    timestamp: datetime

class SentimentStrategy:
    """Implements sentiment-based trading strategy"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.letta_service = config.get("letta_service")
        
        # Configure sentiment thresholds
        self.thresholds = {
            "very_bullish": 0.8,
            "bullish": 0.6,
            "bearish": 0.4,
            "very_bearish": 0.2
        }
        
        # Configure source weights
        self.source_weights = {
            "twitter": 0.4,
            "telegram": 0.3,
            "dexscreener": 0.3
        }
        
        # Initialize sentiment tracking
        self.sentiment_history = []
        self.max_history_age = timedelta(hours=24)
        
    async def generate_signal(
        self,
        token_address: str,
        market_data: Dict[str, Any]
    ) -> SentimentSignal:
        """Generate trading signal based on sentiment analysis"""
        try:
            # Gather sentiment from multiple sources
            twitter_sentiment = await self._analyze_twitter_sentiment(token_address)
            telegram_sentiment = await self._analyze_telegram_sentiment(token_address)
            market_sentiment = await self._analyze_market_sentiment(market_data)
            
            # Combine sentiment scores
            combined_sentiment = self._combine_sentiment_scores({
                "twitter": twitter_sentiment,
                "telegram": telegram_sentiment,
                "market": market_sentiment
            })
            
            # Calculate confidence
            confidence = self._calculate_confidence(
                combined_sentiment["scores"],
                combined_sentiment["metrics"]
            )
            
            # Determine sentiment level
            level = self._determine_sentiment_level(
                combined_sentiment["score"]
            )
            
            # Create signal
            signal = SentimentSignal(
                level=level,
                score=combined_sentiment["score"],
                confidence=confidence,
                sources=combined_sentiment["scores"],
                social_metrics=combined_sentiment["metrics"]["social"],
                market_metrics=combined_sentiment["metrics"]["market"],
                timestamp=datetime.now()
            )
            
            # Update sentiment history
            self._update_sentiment_history(signal)
            
            return signal
            
        except Exception as e:
            logging.error(f"Sentiment signal generation error: {str(e)}")
            raise
            
    async def _analyze_twitter_sentiment(self, token_address: str) -> Dict[str, Any]:
        """Analyze Twitter sentiment using LettA"""
        try:
            # Use LettA service for Twitter analysis
            analysis = await self.letta_service.analyze_social_sentiment(
                platform="twitter",
                token=token_address
            )
            
            tweets = analysis.get("tweets", [])
            if not tweets:
                return {
                    "score": 0.5,
                    "metrics": {
                        "volume": 0,
                        "engagement": 0,
                        "influencer_ratio": 0
                    }
                }
                
            # Calculate weighted sentiment
            weighted_sentiment = 0
            total_weight = 0
            
            for tweet in tweets:
                weight = self._calculate_tweet_weight(tweet)
                sentiment = tweet.get("sentiment", 0.5)
                weighted_sentiment += sentiment * weight
                total_weight += weight
                
            return {
                "score": weighted_sentiment / total_weight if total_weight > 0 else 0.5,
                "metrics": {
                    "volume": len(tweets),
                    "engagement": sum(t.get("engagement", 0) for t in tweets),
                    "influencer_ratio": self._calculate_influencer_ratio(tweets)
                }
            }
            
        except Exception as e:
            logging.error(f"Twitter sentiment analysis error: {str(e)}")
            return {"score": 0.5, "metrics": {}}
            
    async def _analyze_telegram_sentiment(self, token_address: str) -> Dict[str, Any]:
        """Analyze Telegram sentiment"""
        try:
            # Use LettA service for Telegram analysis
            analysis = await self.letta_service.analyze_social_sentiment(
                platform="telegram",
                token=token_address
            )
            
            messages = analysis.get("messages", [])
            if not messages:
                return {
                    "score": 0.5,
                    "metrics": {
                        "volume": 0,
                        "activity": 0,
                        "unique_users": 0
                    }
                }
                
            # Calculate metrics
            unique_users = len(set(m.get("user_id") for m in messages))
            activity_score = len(messages) / (24 * 60)  # Messages per minute
                
            return {
                "score": analysis.get("sentiment_score", 0.5),
                "metrics": {
                    "volume": len(messages),
                    "activity": activity_score,
                    "unique_users": unique_users
                }
            }
            
        except Exception as e:
            logging.error(f"Telegram sentiment analysis error: {str(e)}")
            return {"score": 0.5, "metrics": {}}
            
    async def _analyze_market_sentiment(self, market_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze market-based sentiment"""
        try:
            # Extract market metrics
            price_change = float(market_data.get("priceChange24h", 0))
            volume_change = float(market_data.get("volumeChange24h", 0))
            buy_pressure = self._calculate_buy_pressure(market_data)
            
            # Calculate market sentiment score
            sentiment_score = self._calculate_market_sentiment_score(
                price_change,
                volume_change,
                buy_pressure
            )
            
            return {
                "score": sentiment_score,
                "metrics": {
                    "price_change": price_change,
                    "volume_change": volume_change,
                    "buy_pressure": buy_pressure
                }
            }
            
        except Exception as e:
            logging.error(f"Market sentiment analysis error: {str(e)}")
            return {"score": 0.5, "metrics": {}}
            
    def _calculate_tweet_weight(self, tweet: Dict[str, Any]) -> float:
        """Calculate weight for a tweet based on influence and engagement"""
        base_weight = 1.0
        
        # Account for follower count
        followers = tweet.get("follower_count", 0)
        follower_multiplier = np.log10(followers + 1) / 4  # Logarithmic scaling
        
        # Account for engagement
        engagement = tweet.get("engagement", 0)
        engagement_multiplier = np.log10(engagement + 1) / 3
        
        # Account for user credibility
        credibility = tweet.get("user_credibility", 0.5)
        
        return base_weight * (1 + follower_multiplier) * (1 + engagement_multiplier) * credibility
        
    def _calculate_influencer_ratio(self, tweets: List[Dict[str, Any]]) -> float:
        """Calculate ratio of influential tweets"""
        if not tweets:
            return 0
            
        influencer_threshold = 10000  # Minimum followers for influencer status
        influencer_tweets = sum(
            1 for t in tweets
            if t.get("follower_count", 0) >= influencer_threshold
        )
        
        return influencer_tweets / len(tweets)
        
    def _calculate_buy_pressure(self, market_data: Dict[str, Any]) -> float:
        """Calculate buy pressure from market data"""
        buys = float(market_data.get("buys24h", 0))
        sells = float(market_data.get("sells24h", 0))
        
        if buys + sells == 0:
            return 0.5
            
        return buys / (buys + sells)
        
    def _calculate_market_sentiment_score(
        self,
        price_change: float,
        volume_change: float,
        buy_pressure: float
    ) -> float:
        """Calculate market sentiment score"""
        # Normalize price change
        price_score = 1 / (1 + np.exp(-price_change/10))  # Sigmoid function
        
        # Normalize volume change
        volume_score = 1 / (1 + np.exp(-volume_change/20))
        
        # Combine scores
        return (
            price_score * 0.4 +
            volume_score * 0.3 +
            buy_pressure * 0.3
        )
        
    def _combine_sentiment_scores(self, sentiments: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
        """Combine sentiment scores from different sources"""
        scores = {}
        total_weight = 0
        
        for source, data in sentiments.items():
            weight = self.source_weights.get(source, 0.1)
            scores[source] = data.get("score", 0.5)
            total_weight += weight
            
        # Calculate weighted average
        weighted_score = sum(
            scores[source] * self.source_weights.get(source, 0.1)
            for source in scores
        ) / total_weight
        
        return {
            "score": weighted_score,
            "scores": scores,
            "metrics": {
                "social": {
                    source: data.get("metrics", {})
                    for source, data in sentiments.items()
                    if source != "market"
                },
                "market": sentiments.get("market", {}).get("metrics", {})
            }
        }
        
    def _calculate_confidence(
        self,
        scores: Dict[str, float],
        metrics: Dict[str, Dict[str, Any]]
    ) -> float:
        """Calculate confidence in sentiment signal"""
        # Check score agreement
        score_std = np.std(list(scores.values()))
        agreement_factor = 1 - (score_std * 2)  # Lower std = higher agreement
        
        # Check data quality
        quality_scores = []
        
        # Social metrics quality
        if metrics["social"]["twitter"]["volume"] > 0:
            quality_scores.append(min(
                metrics["social"]["twitter"]["volume"] / 100, 1.0
            ))
            
        if metrics["social"]["telegram"]["volume"] > 0:
            quality_scores.append(min(
                metrics["social"]["telegram"]["volume"] / 50, 1.0
            ))
            
        # Market metrics quality
        if metrics["market"]:
            quality_scores.append(0.8)  # Base quality for market data
            
        data_quality = sum(quality_scores) / len(quality_scores) if quality_scores else 0.5
        
        return min(1.0, agreement_factor * 0.7 + data_quality * 0.3)
        
    def _determine_sentiment_level(self, score: float) -> SentimentLevel:
        """Determine sentiment level from score"""
        if score >= self.thresholds["very_bullish"]:
            return SentimentLevel.VERY_BULLISH
        elif score >= self.thresholds["bullish"]:
            return SentimentLevel.BULLISH
        elif score <= self.thresholds["very_bearish"]:
            return SentimentLevel.VERY_BEARISH
        elif score <= self.thresholds["bearish"]:
            return SentimentLevel.BEARISH
        return SentimentLevel.NEUTRAL
        
    def _update_sentiment_history(self, signal: SentimentSignal):
        """Update sentiment history"""
        # Remove old entries
        current_time = datetime.now()
        self.sentiment_history = [
            s for s in self.sentiment_history
            if current_time - s.timestamp <= self.max_history_age
        ]
        
        # Add new signal
        self.sentiment_history.append(signal)
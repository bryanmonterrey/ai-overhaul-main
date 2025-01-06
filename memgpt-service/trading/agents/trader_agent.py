"""
Trader Agent for Solana with Jupiter and Jito integration.
Handles trade execution with MEV protection.
"""
from typing import Dict, Any, List, Optional
from decimal import Decimal
import aiohttp
import asyncio
from datetime import datetime
import base58
from solders.keypair import Keypair
from solana.rpc.async_api import AsyncClient
from solana.transaction import Transaction
from dataclasses import dataclass
from .base_agent import BaseAgent

@dataclass
class TradeParams:
    """Trading parameters"""
    input_token: str
    output_token: str
    amount: Decimal
    slippage: float
    priority_fee: float  # in SOL
    use_jito: bool
    auto_retry: bool

@dataclass
class TradeResult:
    """Result of a trade execution"""
    success: bool
    tx_hash: Optional[str]
    input_amount: Decimal
    output_amount: Decimal
    price_impact: float
    fees_paid: Dict[str, float]
    route_info: Dict[str, Any]
    timestamp: datetime
    error: Optional[str] = None

class TraderAgent(BaseAgent):
    """Executes trades using Jupiter with Jito MEV protection"""
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.jupiter_api_url = "https://quote-api.jup.ag/v6"
        self.jito_api_url = "https://blocks.jito.wtf"
        
        # Initialize Solana client
        self.solana_client = AsyncClient(config["rpc_url"])
        
        # Configure trading parameters
        self.default_slippage = config.get("default_slippage", 0.01)  # 1%
        self.max_slippage = config.get("max_slippage", 0.05)  # 5%
        self.default_priority_fee = config.get("priority_fee", 0.0025)  # SOL
        self.use_jito = config.get("use_jito", True)
        
        # Initialize trading stats
        self.trading_stats = {
            "total_trades": 0,
            "successful_trades": 0,
            "failed_trades": 0,
            "total_volume": Decimal("0"),
            "total_fees_paid": Decimal("0")
        }
        
    async def execute_trade(
        self,
        trade_params: TradeParams,
        wallet: Keypair
    ) -> TradeResult:
        """Execute a trade through Jupiter with Jito protection"""
        try:
            # 1. Get Quote and Routes
            quote = await self._get_jupiter_quote(trade_params)
            if not quote["routes"]:
                raise ValueError("No viable routes found")
            
            # 2. Select best route considering Jito
            best_route = await self._select_optimal_route(quote["routes"])
            
            # 3. Prepare transaction
            swap_tx = await self._prepare_swap_transaction(
                best_route,
                trade_params,
                wallet.public_key
            )
            
            # 4. Add Jito protection if enabled
            if trade_params.use_jito and self.use_jito:
                swap_tx = await self._add_jito_protection(swap_tx, trade_params)
            
            # 5. Execute trade
            result = await self._execute_transaction(swap_tx, wallet)
            
            # 6. Update trading stats
            await self._update_trading_stats(result)
            
            return result
            
        except Exception as e:
            self.logger.error(f"Trade execution error: {str(e)}")
            return TradeResult(
                success=False,
                tx_hash=None,
                input_amount=trade_params.amount,
                output_amount=Decimal("0"),
                price_impact=0,
                fees_paid={},
                route_info={},
                timestamp=datetime.now(),
                error=str(e)
            )
            
    async def _get_jupiter_quote(self, params: TradeParams) -> Dict[str, Any]:
        """Get quote from Jupiter"""
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{self.jupiter_api_url}/quote",
                params={
                    "inputMint": params.input_token,
                    "outputMint": params.output_token,
                    "amount": str(params.amount),
                    "slippageBps": int(params.slippage * 10000),
                    "onlyDirectRoutes": False,
                    "asLegacyTransaction": False
                }
            ) as response:
                return await response.json()
                
    async def _select_optimal_route(self, routes: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Select optimal route considering MEV protection"""
        # Score routes based on multiple factors
        scored_routes = []
        for route in routes:
            score = self._calculate_route_score(route)
            scored_routes.append((score, route))
            
        # Select best route
        return max(scored_routes, key=lambda x: x[0])[1]
        
    def _calculate_route_score(self, route: Dict[str, Any]) -> float:
        """Calculate route score based on multiple factors"""
        # Base score from price impact
        price_impact = float(route.get("priceImpactPct", 0))
        base_score = 1 - price_impact
        
        # Adjust for liquidity
        liquidity_score = min(1.0, float(route.get("liquidityScore", 0)))
        
        # Adjust for number of hops
        hop_penalty = 0.05 * (len(route.get("marketInfos", [])) - 1)
        
        # Final score
        return (base_score * 0.5 + liquidity_score * 0.5) - hop_penalty
        
    async def _prepare_swap_transaction(
        self,
        route: Dict[str, Any],
        params: TradeParams,
        wallet_pubkey: str
    ) -> Transaction:
        """Prepare Jupiter swap transaction"""
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.jupiter_api_url}/swap",
                json={
                    "route": route,
                    "userPublicKey": wallet_pubkey,
                    "priorityFee": int(params.priority_fee * 1e9),  # Convert to lamports
                    "computeUnits": 300000  # Maximum compute units
                }
            ) as response:
                swap_data = await response.json()
                return Transaction.deserialize(
                    base58.b58decode(swap_data["swapTransaction"])
                )
                
    async def _add_jito_protection(
        self,
        transaction: Transaction,
        params: TradeParams
    ) -> Transaction:
        """Add Jito MEV protection to transaction"""
        try:
            # Get Jito bundle pricing
            bundle_price = await self._get_jito_bundle_price()
            
            # Add Jito instructions to transaction
            jito_ix = await self._create_jito_instruction(
                bundle_price,
                params.priority_fee
            )
            
            # Add instruction to transaction
            transaction.add_instruction(jito_ix)
            
            return transaction
            
        except Exception as e:
            self.logger.warning(f"Jito protection error: {str(e)}")
            return transaction
            
    async def _get_jito_bundle_price(self) -> int:
        """Get current Jito bundle pricing"""
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{self.jito_api_url}/bundle-pricing"
            ) as response:
                data = await response.json()
                return data.get("minimumBundlePriceInLamports", 5000)
                
    async def _create_jito_instruction(
        self,
        bundle_price: int,
        priority_fee: float
    ) -> Any:
        """Create Jito protection instruction"""
        # Note: This is a simplified version. Actual Jito integration
        # would require their SDK for proper bundle submission
        return {
            "bundle_price": bundle_price,
            "priority_fee": int(priority_fee * 1e9)
        }
        
    async def _execute_transaction(
        self,
        transaction: Transaction,
        wallet: Keypair
    ) -> TradeResult:
        """Execute the prepared transaction"""
        try:
            # Sign transaction
            transaction.sign(wallet)
            
            # Submit transaction
            tx_hash = await self.solana_client.send_transaction(
                transaction,
                wallet
            )
            
            # Wait for confirmation
            confirmation = await self.solana_client.confirm_transaction(
                tx_hash,
                "confirmed"
            )
            
            if confirmation["value"]["err"]:
                raise ValueError(f"Transaction failed: {confirmation['value']['err']}")
                
            # Parse transaction result
            result = await self._parse_transaction_result(tx_hash)
            
            return result
            
        except Exception as e:
            raise ValueError(f"Transaction execution failed: {str(e)}")
            
    async def _parse_transaction_result(self, tx_hash: str) -> TradeResult:
        """Parse transaction result"""
        # Get transaction details
        tx_info = await self.solana_client.get_transaction(
            tx_hash,
            encoding="jsonParsed"
        )
        
        # Extract relevant information
        result = TradeResult(
            success=True,
            tx_hash=tx_hash,
            input_amount=Decimal("0"),  # Extract from tx
            output_amount=Decimal("0"),  # Extract from tx
            price_impact=0.0,  # Calculate from amounts
            fees_paid={
                "network": float(tx_info["result"]["meta"]["fee"]) / 1e9,
                "priority": 0.0  # Extract from tx
            },
            route_info={},  # Extract from tx
            timestamp=datetime.now()
        )
        
        return result
        
    async def _update_trading_stats(self, result: TradeResult):
        """Update trading statistics"""
        self.trading_stats["total_trades"] += 1
        if result.success:
            self.trading_stats["successful_trades"] += 1
            self.trading_stats["total_volume"] += result.input_amount
            self.trading_stats["total_fees_paid"] += Decimal(
                sum(result.fees_paid.values())
            )
        else:
            self.trading_stats["failed_trades"] += 1
            
    def get_trading_stats(self) -> Dict[str, Any]:
        """Get current trading statistics"""
        return {
            **self.trading_stats,
            "success_rate": (
                self.trading_stats["successful_trades"] /
                max(1, self.trading_stats["total_trades"])
            ),
            "average_fee": (
                self.trading_stats["total_fees_paid"] /
                max(1, self.trading_stats["total_trades"])
            )
        }
    
    async def execute_autonomous_trade(self, strategy: Dict[str, Any]) -> TradeResult:
        """Execute autonomous trade based on strategy"""
        try:
            # Get market conditions
            market_data = await self._analyze_market_conditions()
            
            # Make trading decision
            decision = await self._evaluate_trading_opportunity(
                market_data,
                strategy
            )
            
            if decision["should_trade"]:
                # Execute trade
                params = TradeParams(
                    input_token=decision["tokenIn"],
                    output_token=decision["tokenOut"],
                    amount=decision["amount"],
                    slippage=strategy.get("slippage", 0.01),
                    priority_fee=strategy.get("priorityFee", 0.0025),
                    use_jito=strategy.get("useMev", True),
                    auto_retry=True
                )
                
                return await self.execute_trade(params, self.wallet)
                
        except Exception as e:
            self.logger.error(f"Autonomous trade error: {str(e)}")
            return TradeResult(
                success=False,
                error=str(e)
            )
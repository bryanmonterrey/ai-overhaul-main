# memgpt-service/trading/services/solana_bridge.py
from typing import Dict, Any, Optional
import aiohttp
import json
from functools import lru_cache
import os

class SolanaBridge:
    """Bridge service to communicate with Solana Agent Kit frontend"""
    
    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}
        self.api_url = self.config.get("solana_api_url", 
            os.getenv("SOLANA_API_URL", "http://localhost:3000/api/solana"))
        self.wallet_address = None

    async def set_wallet(self, wallet_address: str):
        """Update wallet address"""
        self.wallet_address = wallet_address
        async with aiohttp.ClientSession() as session:
            await session.post(
                f"{self.api_url}/wallet/connect",
                json={"wallet_address": wallet_address}
            )
        
    async def get_token_data(self, token_address: str) -> Dict[str, Any]:
        """Get token data through frontend Solana Agent Kit"""
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.api_url}/token-data",
                json={
                    "token_address": token_address,
                }
            ) as response:
                if not response.ok:
                    raise ValueError(f"Failed to get token data: {await response.text()}")
                return await response.json()
                
    async def fetch_pyth_price(self, token_address: str) -> Dict[str, Any]:
        """Get Pyth price through frontend Solana Agent Kit"""
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.api_url}/pyth-price",
                json={
                    "token_address": token_address,
                }
            ) as response:
                if not response.ok:
                    raise ValueError(f"Failed to fetch Pyth price: {await response.text()}")
                return await response.json()

    async def execute_trade(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Execute trade through frontend Solana Agent Kit"""
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.api_url}/trade",
                json=params
            ) as response:
                if not response.ok:
                    raise ValueError(f"Failed to execute trade: {await response.text()}")
                return await response.json()
            
    async def execute_trade_with_wallet(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Execute trade with connected wallet"""
        if not self.wallet_address:
            raise ValueError("No wallet connected")
            
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.api_url}/trade",
                json={
                    **params,
                    "wallet_address": self.wallet_address
                }
            ) as response:
                return await response.json()

    async def stake(self, amount: float) -> Dict[str, Any]:
        """Stake SOL through frontend"""
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.api_url}/stake",
                json={"amount": amount}
            ) as response:
                return await response.json()

    async def send_compressed_airdrop(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Send compressed airdrop"""
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.api_url}/airdrop/compressed",
                json=params
            ) as response:
                return await response.json()

    async def create_market(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Create market"""
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.api_url}/market/create",
                json=params
            ) as response:
                return await response.json()

    @lru_cache(maxsize=100)
    def get_cached_token_data(self, token_address: str) -> Dict[str, Any]:
        """Cached version of token data (useful for frequently accessed tokens)"""
        return self.get_token_data(token_address)
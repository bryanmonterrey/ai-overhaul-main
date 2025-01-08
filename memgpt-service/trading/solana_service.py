# memgpt-service/trading/solana_service.py
from typing import Dict, Any, Optional
import logging
from decimal import Decimal
from datetime import datetime, timedelta
import uuid
import aiohttp
import os
import json

class SolanaService:
    """Solana utilities that coordinate with frontend agent-kit"""
    def __init__(self, supabase_client=None):
        # Initialize Supabase client
        self.supabase = supabase_client
        if not self.supabase:
            from supabase import create_client
            url = os.getenv("SUPABASE_URL")
            key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
            if not url or not key:
                raise ValueError("Missing Supabase credentials")
            self.supabase = create_client(url, key)

        # Ensure RPC URL is properly formatted
        default_rpc = 'https://api.mainnet-beta.solana.com'
        rpc_url = os.getenv('NEXT_PUBLIC_RPC_URL', default_rpc)
        if not rpc_url.startswith(('http://', 'https://')):
            rpc_url = 'https://' + rpc_url
        self.rpc_url = rpc_url

        # Rest of initialization
        is_production = os.getenv('NODE_ENV') == 'production'
        default_url = 'https://terminal.goatse.app' if is_production else 'http://localhost:3000'
        frontend_url = os.getenv('NEXT_PUBLIC_FRONTEND_URL', default_url).rstrip('/')
        if not frontend_url.startswith(('http://', 'https://')):
            frontend_url = 'https://' + frontend_url
            
        self.agent_kit_url = f"{frontend_url}/api/agent-kit"
        
        # Log which environment we're using
        logging.info(f"Initializing SolanaService with frontend URL: {self.agent_kit_url}")
        
        self.token_addresses = {
            'SOL': 'So11111111111111111111111111111111111111112',
            'BONK': 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
            'WIF': 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
            'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
        }

    async def init_trading_session(self, wallet_info: Dict[str, Any]) -> Dict[str, Any]:
        """Initialize a trading session with agent-kit"""
        try:
            # Try all possible signature locations
            signature = (
                wallet_info.get('signature') or
                wallet_info.get('credentials', {}).get('signature') or
                wallet_info.get('credentials', {}).get('sessionProof')
            )
            
            if not signature:
                # Generate session message and ask frontend to sign
                return {
                    'success': False,
                    'error': 'session_signature_required',
                    'session_message': f"Trading session initialization for {wallet_info['publicKey']}"
                }
                
            init_params = {
                'wallet': {
                    'publicKey': wallet_info['publicKey'],
                    'signature': signature,
                    'credentials': {
                        'publicKey': wallet_info['publicKey'],
                        'signature': signature,
                        'signTransaction': wallet_info.get('credentials', {}).get('signTransaction', True),
                        'signAllTransactions': wallet_info.get('credentials', {}).get('signAllTransactions', True),
                        'connected': wallet_info.get('credentials', {}).get('connected', True)
                    }
                }
            }
            
            logging.info(f"Initializing session with params: {init_params}")
            result = await self._call_agent_kit('initSession', init_params)
            
            if result.get('success'):
                logging.info("Session initialization successful")
                
                # Update wallet credentials with session info if provided
                if session_id := result.get('sessionId'):
                    init_params['wallet']['signature'] = session_id
                    init_params['wallet']['credentials']['signature'] = session_id
                    logging.info(f"Updated session ID: {session_id}")
            else:
                logging.error(f"Session initialization failed: {result.get('error')}")
                
            return result
            
        except Exception as e:
            logging.error(f"Session initialization error: {str(e)}")
            raise

    async def _verify_session(self, wallet_info: Dict[str, Any]) -> Dict[str, Any]:
        """Verify and initialize trading session"""
        try:
            # Log incoming wallet info for debugging
            logging.info(f"Verifying session with wallet info: {json.dumps(wallet_info, default=str)}")
            
            # Extract credentials in the format the API expects
            public_key = wallet_info.get('publicKey') or wallet_info.get('credentials', {}).get('publicKey')
            original_signature = (
                wallet_info.get('credentials', {}).get('signature') or
                wallet_info.get('signature')
            )

            if not public_key or not original_signature:
                return {
                    'success': False,
                    'error': 'Missing public key or signature',
                    'code': 'MISSING_CREDENTIALS'
                }

            # Format exactly as agent-kit/route.ts expects for verifySession
            init_params = {
                'wallet': {
                    'publicKey': public_key,
                    'signature': original_signature,  # Use original signature
                    'credentials': {
                        'publicKey': public_key,
                        'signature': original_signature,  # Use original signature
                        'signTransaction': True,
                        'signAllTransactions': True,
                        'connected': True
                    }
                }
            }

            # Call initSession
            session_result = await self._call_agent_kit('initSession', init_params)

            if not session_result.get('success'):
                logging.error(f"Session verification failed: {session_result}")
                return {
                    'success': False,
                    'error': session_result.get('error', 'Session verification failed'),
                    'code': session_result.get('code', 'SESSION_VERIFICATION_FAILED')
                }

            # Return success with both wallet info and session data
            return {
                'success': True,
                'wallet_info': wallet_info,
                'sessionId': session_result.get('sessionId'),
                'expiresAt': session_result.get('expiresAt'),
                'signature': original_signature  # Include original signature
            }

        except Exception as e:
            logging.error(f"Session verification error: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'code': 'SESSION_VERIFICATION_ERROR'
            }

    async def _verify_token(self, asset: str) -> Dict[str, Any]:
        """Verify and get token information using Jupiter's token list via agent-kit"""
        try:
            # First check our known tokens for quick lookup
            upper_asset = asset.upper()
            if token_address := self.token_addresses.get(upper_asset):
                return {
                    'symbol': upper_asset,
                    'address': token_address,
                    'verified': True,
                    'decimals': 9,
                    'source': 'internal'
                }

            # Try Jupiter API through agent-kit
            try:
                # If it looks like an address, try address lookup first
                if len(asset) == 44:
                    params = {'mint': asset}
                    token_data = await self._call_agent_kit('getTokenData', params)
                    if token_data and token_data.get('success'):
                        return {
                            'symbol': token_data.get('data', {}).get('symbol', asset[:8]),
                            'address': asset,
                            'verified': True,
                            'decimals': token_data.get('data', {}).get('decimals', 9),
                            'source': 'jupiter_address'
                        }

                # Try symbol lookup
                params = {
                    'symbol': asset,
                    'discover': True  # Enable Jupiter discovery
                }
                token_data = await self._call_agent_kit('getTokenData', params)
                if token_data and token_data.get('success'):
                    data = token_data.get('data', {})
                    return {
                        'symbol': data.get('symbol', asset),
                        'address': data.get('address'),
                        'verified': True,
                        'decimals': data.get('decimals', 9),
                        'source': 'jupiter_symbol'
                    }

                # If symbol lookup failed but it's an address, return unverified
                if len(asset) == 44:
                    logging.warning(f"Token {asset} not found in Jupiter, proceeding as unverified address")
                    return {
                        'symbol': asset[:8],
                        'address': asset,
                        'verified': False,
                        'decimals': 9,
                        'source': 'unverified_address'
                    }

                raise ValueError(f"Token {asset} not found")

            except Exception as e:
                logging.error(f"Error verifying token: {str(e)}")
                raise

        except Exception as e:
            logging.error(f"Token verification error: {str(e)}")
            raise

    async def _call_agent_kit(self, action: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Make a request to the agent-kit API"""
        try:
            headers = {
                'Content-Type': 'application/json'
            }
            
            # Extract session info for trade requests
            if action == 'trade':
                # Get original signature from wallet info
                wallet_info = params.get('wallet', {})
                original_signature = (
                    wallet_info.get('credentials', {}).get('signature') or
                    wallet_info.get('signature')
                )
                
                if original_signature:
                    headers['X-Trading-Session'] = original_signature  # Use original signature
                    logging.info(f"Using original signature for trade: {original_signature}")
                else:
                    logging.warning("No original signature found for trade request")

            logging.info(f"Making request to {self.agent_kit_url}")
            logging.info(f"Request payload: action={action}, params={params}")
            logging.info(f"Request headers: {headers}")

            async with aiohttp.ClientSession() as session:
                async with session.post(
                    self.agent_kit_url,
                    json={
                        'action': action,
                        'params': params
                    },
                    headers=headers
                ) as response:
                    logging.info(f"Response status: {response.status}")
                    logging.info(f"Response headers: {dict(response.headers)}")
                    
                    content_type = response.headers.get('Content-Type', '')
                    if response.status != 200 or 'application/json' not in content_type.lower():
                        error_text = await response.text()
                        logging.error(f"Error response: {error_text}")
                        raise ValueError(f"API error: status={response.status}, content-type={content_type}, body={error_text}")
                    
                    data = await response.json()
                    logging.info(f"Response data: {data}")
                    return data

        except Exception as e:
            logging.error(f"Agent-kit API call error: {str(e)}")
            raise

    async def execute_swap(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a swap transaction"""
        try:
            # Verify wallet info
            wallet_info = params.get('wallet')
            if not wallet_info:
                raise ValueError("No wallet info provided")

            # Store original wallet signature before verification
            original_signature = (
                wallet_info.get('credentials', {}).get('signature') or
                wallet_info.get('signature')
            )

            # Get public key from wallet info using dictionary access
            public_key = (
                wallet_info.get('publicKey') or 
                wallet_info.get('credentials', {}).get('publicKey')
            )
            if not public_key:
                raise ValueError("No public key found in wallet info")

            # Verify session
            session_result = await self._verify_session(wallet_info)
            if not session_result.get('success'):
                return session_result

            # Store session ID for subsequent requests
            session_id = session_result.get('sessionId')
            if not session_id:
                return {
                    'success': False,
                    'error': 'No session ID returned from verification',
                    'code': 'SESSION_ID_MISSING'
                }

            # Create a new wallet info object with original signature preserved
            trade_wallet_info = {
                'publicKey': public_key,
                'signature': original_signature,  # Keep original signature
                'credentials': {
                    'publicKey': public_key,
                    'signature': original_signature,  # Keep original signature
                    'signTransaction': True,
                    'signAllTransactions': True,
                    'connected': True
                }
            }

            # Verify token using the dedicated method
            try:
                token_info = await self._verify_token(params['asset'])
                params['token_data'] = token_info
                token_address = token_info['address']
            except Exception as token_error:
                logging.error(f"Token verification failed: {str(token_error)}")
                return {
                    'success': False,
                    'error': 'token_verification_failed',
                    'details': str(token_error),
                    'user_message': 'Could not verify token. Please check the symbol/address.'
                }

            # Format parameters for agent-kit trade
            swap_params = {
                'outputMint': token_address,
                'inputAmount': float(params['amount']),
                'inputMint': self.token_addresses['SOL'],
                'tokenIn': self.token_addresses['SOL'],
                'tokenOut': token_address,
                'slippageBps': params.get('slippage', 100),
                'token_data': token_info,
                'wallet': trade_wallet_info,  # Use wallet info with original signature
                'sessionId': session_id  # Session ID only at root level
            }

            logging.info(f"Executing trade with params: {swap_params}")
            result = await self._call_agent_kit('trade', swap_params)

            if not result.get('success'):
                return {
                    'success': False,
                    'error': result.get('error', 'Trade execution failed'),
                    'details': result,
                    'user_message': result.get('user_message', 'Failed to execute trade')
                }

            return result

        except Exception as e:
            logging.error(f"Swap execution error: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'user_message': 'Failed to execute swap. Please try again.'
            }

    async def get_token_data(self, token_address: str) -> Dict[str, Any]:
        """Get token data through agent-kit"""
        return await self._call_agent_kit('getTokenData', {'mint': token_address})

    async def get_token_price(self, token: str) -> Decimal:
        """Get token price through agent-kit"""
        result = await self._call_agent_kit('getPrice', {
            'mint': self.token_addresses.get(token.upper(), token)
        })
        return Decimal(str(result.get('price', 0)))

    async def get_token_info(self, symbol_or_address: str) -> Dict[str, Any]:
        """Dynamically get token info from Jupiter API or on-chain"""
        try:
            # Check known tokens first (IMPORTANT: Check before doing any uppercase)
            if symbol_or_address.upper() in self.token_addresses:
                return {
                    'symbol': symbol_or_address.upper(),
                    'address': self.token_addresses[symbol_or_address.upper()],
                    'verified': True,
                    'decimals': 9  # Default decimals for known tokens
                }

            # If it's an exact address match in token_addresses values
            for symbol, address in self.token_addresses.items():
                if symbol_or_address == address:
                    return {
                        'symbol': symbol,
                        'address': address,
                        'verified': True,
                        'decimals': 9
                    }

            # Try Jupiter token list
            jupiter_url = "https://token.jup.ag/all"
            async with aiohttp.ClientSession() as session:
                async with session.get(jupiter_url) as response:
                    if response.ok:
                        token_list = await response.json()
                        # Look for exact matches first
                        token = next((t for t in token_list 
                            if t['symbol'].upper() == symbol_or_address.upper() or 
                            t['address'] == symbol_or_address), None)
                        
                        if token:
                            return {
                                'symbol': token['symbol'],
                                'address': token['address'],
                                'verified': True,
                                'decimals': token.get('decimals', 9)
                            }

            # If it looks like an address, treat as unverified token
            if len(symbol_or_address) == 44:
                return {
                    'symbol': symbol_or_address[:8],  # Short version of address
                    'address': symbol_or_address,
                    'verified': False,
                    'decimals': 9
                }

            raise ValueError(f"Could not find token info for: {symbol_or_address}")

        except Exception as e:
            logging.error(f"Error getting token info: {str(e)}")
            raise

    async def get_routes(self, input_mint: str, output_mint: str, amount: float) -> Dict[str, Any]:
        """Get routes through agent-kit"""
        return await self._call_agent_kit('getRoutes', {
            'inputMint': input_mint,
            'outputMint': output_mint,
            'amount': amount
        })
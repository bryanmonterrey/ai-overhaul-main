# memgpt-service/trading/solana_service.py
from typing import Dict, Any, Optional
import logging
from decimal import Decimal
from datetime import datetime, timedelta
import uuid
import aiohttp
import os
import json
from memory.utils.supabase_helpers import safe_supabase_execute, handle_supabase_response

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
            logging.info(f"Initializing trading session for wallet: {wallet_info}")
            
            # Extract credentials from all possible locations with detailed logging
            public_key = (
                wallet_info.get('publicKey') or 
                wallet_info.get('credentials', {}).get('publicKey')
            )
            
            # Try all possible signature locations with fallbacks
            original_signature = (
                wallet_info.get('signature') or  # Try top level first
                wallet_info.get('credentials', {}).get('signature')  # Then credentials
            )

            session_signature = (
                wallet_info.get('sessionSignature') or  # Try top level first
                wallet_info.get('credentials', {}).get('sessionSignature') or  # Then credentials
                original_signature  # Fall back to original signature if no session signature
            )
            
            logging.info(f"Extracted credentials - Public Key: {public_key}, Signature Present: {bool(session_signature)}")
            
            if not public_key:
                return {
                    'success': False,
                    'error': 'missing_public_key',
                    'code': 'MISSING_CREDENTIALS',
                    'message': 'Public key is required for session initialization'
                }
                    
            if not session_signature:
                # Generate session message and ask frontend to sign
                session_message = f"Trading session initialization for {public_key} at {datetime.now().isoformat()}"
                return {
                    'success': False,
                    'error': 'session_signature_required',
                    'session_message': session_message,
                    'public_key': public_key
                }
            
            # Create new session ID
            session_id = str(uuid.uuid4())
                        
            # Build complete initialization parameters with correct signature handling
            init_params = {
                'wallet': {
                    'publicKey': public_key,
                    'signature': original_signature,      # Keep original signature at top level
                    'sessionId': session_id,             # You already have this!
                    'sessionSignature': session_signature, # Add the session signature here
                    'credentials': {
                        'publicKey': public_key,
                        'signature': original_signature,  # Keep original signature in credentials
                        'sessionId': session_id,         # You already have this!
                        'sessionSignature': session_signature,  # Add session signature in credentials too
                        'signTransaction': wallet_info.get('credentials', {}).get('signTransaction', True),
                        'signAllTransactions': wallet_info.get('credentials', {}).get('signAllTransactions', True),
                        'connected': wallet_info.get('credentials', {}).get('connected', True)
                    }
                }
            }
                
            logging.info(f"Initializing session with params: {init_params}")
            
            # Store session in Supabase first - Fixed the query
            session_data = {
                'public_key': public_key,
                'signature': session_signature,
                'session_id': session_id,
                'expires_at': (datetime.now() + timedelta(days=1)).isoformat(),
                'is_active': True,
                'wallet_data': init_params['wallet']
            }
            
            # Changed this part to remove .select()
            success, store_result = await safe_supabase_execute(
                self.supabase.table('trading_sessions').insert(session_data),
                error_message="Failed to store session"
            )

            if not success:
                logging.error(f"Failed to store session: {store_result}")
                return {
                    'success': False,
                    'error': 'Failed to initialize session',
                    'code': 'SESSION_STORE_ERROR'
                }
                
            # Return successful result with session info
            return {
                'success': True,
                'sessionId': session_id,
                'signature': session_signature,
                'publicKey': public_key,
                'expiresAt': session_data['expires_at'],
                'wallet': init_params['wallet']
            }
                    
        except Exception as e:
            logging.error(f"Session initialization error: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'code': 'SESSION_INIT_ERROR'
            }

    async def _verify_session(self, wallet_info: Dict[str, Any]) -> Dict[str, Any]:
        """Verify and initialize trading session"""
        try:
            # Extract credentials
            public_key = wallet_info.get('publicKey') or wallet_info.get('credentials', {}).get('publicKey')
            
            # First try to get session ID
            session_id = (
                wallet_info.get('sessionId') or
                wallet_info.get('credentials', {}).get('sessionId') or
                wallet_info.get('credentials', {}).get('sessionSignature')
            )
            
            # Only fall back to signature if no session ID found
            if not session_id:
                logging.info("No session ID found, falling back to signature")
                session_id = (
                    wallet_info.get('credentials', {}).get('signature') or
                    wallet_info.get('signature')
                )
                logging.info(f"Using fallback signature as session ID: {session_id}")

            if not public_key or not session_id:
                return {
                    'success': False,
                    'error': 'Missing public key or session credentials',
                    'code': 'MISSING_CREDENTIALS'
                }

            # Check existing session
            current_time = datetime.now().isoformat()
            
            success, result = await safe_supabase_execute(
                self.supabase.table('trading_sessions')
                    .select('*')
                    .eq('public_key', public_key)
                    .eq('is_active', True)
                    .gt('expires_at', current_time),
                error_message="Failed to verify session"
            )

            if not success:
                logging.error(f"Session verification failed: {result}")
                return {
                    'success': False,
                    'error': str(result)
                }

            if result and len(result) > 0:
                session = result[0]
                return {
                    'success': True,
                    'sessionId': session['signature'],
                    'expiresAt': session['expires_at']
                }

            # Initialize new session with agent-kit
            logging.info("No active session found, initializing new session")
            session_result = await self._call_agent_kit('initSession', {
                'wallet': {
                    'publicKey': public_key,
                    'signature': session_id,  # Use the session_id we found earlier
                    'credentials': {
                        'publicKey': public_key,
                        'signature': session_id,  # Use the session_id here too
                        'sessionId': session_id  # Add this to maintain consistency
                    }
                }
            })

            if not session_result.get('success'):
                return {
                    'success': False,
                    'error': session_result.get('error', 'Session initialization failed')
                }

            # Store new session
            success, store_result = await safe_supabase_execute(
                self.supabase.table('trading_sessions').upsert({
                    'public_key': public_key,
                    'signature': session_result['sessionId'],
                    'expires_at': datetime.fromtimestamp(session_result['expiresAt'] / 1000).isoformat(),
                    'is_active': True,
                    'wallet_data': wallet_info
                }),
                error_message="Failed to store session"
            )

            if not success:
                logging.warning(f"Failed to store session (continuing): {store_result}")

            return {
                'success': True,
                'sessionId': session_result['sessionId'],
                'expiresAt': session_result['expiresAt']
            }

        except Exception as e:
            logging.error(f"Session verification failed: {e}")
            return {
                'success': False,
                'error': str(e)
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

    async def _call_agent_kit(self, action: str, params: Dict[str, Any], headers: Dict[str, str] = None) -> Dict[str, Any]:
        """Make a request to the agent-kit API"""
        try:
            headers = headers or {
                'Content-Type': 'application/json'
            }
            
            # If headers already contain session info, don't override it
            if (action == 'trade' and
                'X-Trading-Session' not in headers and
                'X-Force-Session' not in headers):
                
                # Create deep copy of params to avoid modifying original
                trade_params = {**params}
                wallet_info = {**params.get('wallet', {})}
                
                # First try to get sessionId from params
                session_id = params.get('sessionId')
                
                # If no sessionId in params, check wallet info
                if not session_id:
                    session_id = (
                        wallet_info.get('sessionId') or
                        wallet_info.get('credentials', {}).get('sessionSignature')
                    )
                    
                # Only use signature as last resort
                if not session_id:
                    session_id = (
                        wallet_info.get('signature') or
                        wallet_info.get('credentials', {}).get('signature')
                    )
                
                if session_id:
                    headers['X-Trading-Session'] = session_id
                    # Update wallet info with consistent session ID
                    wallet_info['sessionId'] = session_id
                    wallet_info['signature'] = session_id
                    if 'credentials' in wallet_info:
                        wallet_info['credentials'] = {
                            **wallet_info.get('credentials', {}),
                            'signature': session_id,
                            'sessionSignature': session_id
                        }
                    
                    trade_params['wallet'] = wallet_info
                    trade_params['sessionId'] = session_id
                    params = trade_params
                    
                    logging.info(f"Using session ID for trade: {session_id}")
                else:
                    logging.warning("No session ID found for trade request")

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
        try:
            # Get original signature FIRST and keep it separate
            original_signature = (
                params['wallet'].get('credentials', {}).get('signature') or
                params['wallet'].get('signature')
            )

            logging.info(f"Original signature retrieved: {original_signature}")
            
            # Store original session ID if it exists
            original_session_id = (
                params['wallet'].get('sessionId') or
                params['wallet'].get('credentials', {}).get('sessionId') or
                params['wallet'].get('credentials', {}).get('sessionSignature')
            )
            
            if original_session_id:
                logging.info(f"Found original session ID: {original_session_id}")

            # Session verification BEFORE anything else
            session_result = await self._verify_session(params['wallet'])
            if not session_result.get('success'):
                # Session invalid or expired, try to initialize a new one
                session_result = await self.init_trading_session(params['wallet'])
                if not session_result.get('success'):
                    return session_result

            # Get the current valid session ID - prioritize original session if valid
            session_id = original_session_id if original_session_id else session_result['sessionId']
            logging.info(f"Using verified session ID for swap: {session_id}")

            # Update the wallet credentials with both session ID and original signature
            wallet_with_session = {
                'publicKey': params['wallet']['publicKey'],
                'sessionId': session_id,  # Add session ID
                'signature': original_signature,  # Keep original signature
                'credentials': {
                    'publicKey': params['wallet']['publicKey'],
                    'sessionId': session_id,  # Add session ID
                    'signature': original_signature,  # Keep original signature
                    'sessionSignature': session_id,  # Use session ID for session-specific signature
                    'signTransaction': True,
                    'signAllTransactions': True,
                    'connected': True
                }
            }

            logging.info(f"Prepared wallet with session: {wallet_with_session}")

            # Verify token
            token_info = await self._verify_token(params['asset'])
            if not token_info.get('address'):
                return {
                    'success': False,
                    'error': 'Invalid token',
                    'user_message': 'Token not found'
                }

            # Build trade params with verified session
            trade_params = {
                'outputMint': token_info['address'],
                'inputAmount': float(params['amount']),
                'inputMint': self.token_addresses['SOL'],
                'tokenIn': self.token_addresses['SOL'],
                'tokenOut': token_info['address'],
                'slippageBps': 100,
                'token_data': token_info,
                'wallet': wallet_with_session,  # Use the updated wallet info
                'sessionId': session_id,  # Add session ID
                'originalSignature': original_signature,  # Keep track of original signature
                'originalSessionId': original_session_id if original_session_id else ''  # Keep original session ID
            }

            # Call agent-kit with session header
            headers = {
                'Content-Type': 'application/json',
                'X-Trading-Session': session_id,
                'X-Original-Signature': original_signature
            }

            # Log the final request details
            logging.info(f"Making trade request with session ID: {session_id} and signature: {original_signature}")
            
            result = await self._call_agent_kit('trade', trade_params, headers)
            return result

        except Exception as e:
            logging.error(f"Swap execution error: {e}")
            return {
                'success': False,
                'error': str(e),
                'user_message': 'Trading error occurred. Please try again.'
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
    
    # In solana_service.py, add this method to the SolanaService class:
    async def _store_session(self, wallet_info: Dict[str, Any], session_result: Dict[str, Any]) -> None:
        """Store the session information in Supabase"""
        try:
            public_key = wallet_info.get('publicKey') or wallet_info.get('credentials', {}).get('publicKey')
            session_id = session_result.get('sessionId')
            
            if not public_key or not session_id:
                logging.error("Missing required session data for storage")
                return
                
            session_data = {
                'public_key': public_key,
                'signature': session_id,
                'expires_at': datetime.fromtimestamp(session_result['expiresAt'] / 1000).isoformat(),
                'is_active': True,
                'wallet_data': wallet_info
            }
            
            success, store_result = await safe_supabase_execute(
                self.supabase.table('trading_sessions').upsert(session_data),
                error_message="Failed to store session"
            )

            if not success:
                logging.warning(f"Failed to store session (continuing): {store_result}")
                
        except Exception as e:
            logging.error(f"Error storing session: {str(e)}")
            # Don't raise the error to allow trading to continue
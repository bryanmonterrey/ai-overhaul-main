from datetime import datetime, timedelta
import logging
from typing import Dict, Any
import aiohttp

class SolanaService:
    def __init__(self, supabase, agent_kit_url: str):
        self.supabase = supabase
        self.agent_kit_url = agent_kit_url

    async def _verify_session(self, wallet_info: Dict[str, Any]) -> Dict[str, Any]:
        """Verify and initialize trading session"""
        try:
            # Extract credentials
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

            # Check existing session
            current_time = datetime.now().isoformat()
            try:
                # Execute without await - Supabase calls are synchronous in Python
                result = self.supabase.table('trading_sessions')\
                    .select('*')\
                    .eq('public_key', public_key)\
                    .eq('is_active', True)\
                    .gt('expires_at', current_time)\
                    .execute()
                    
                # Convert Supabase response to dict if needed
                if result.data and len(result.data) > 0:
                    session_data = result.data[0]
                    
                    if session_data:
                        return {
                            'success': True,
                            'wallet_info': wallet_info,
                            'sessionId': session_data.get('signature'),
                            'expiresAt': session_data.get('expires_at'),
                            'signature': original_signature
                        }
            except Exception as e:
                logging.warning(f"Error checking existing session: {e}")

            # If no valid session found, initialize new session with agent-kit
            init_params = {
                'wallet': {
                    'publicKey': public_key,
                    'signature': original_signature,
                    'credentials': {
                        'publicKey': public_key,
                        'signature': original_signature,
                        'signTransaction': True,
                        'signAllTransactions': True,
                        'connected': True
                    }
                }
            }

            session_result = await self._call_agent_kit('initSession', init_params)

            if not session_result.get('success'):
                logging.error(f"Session verification failed: {session_result}")
                return {
                    'success': False,
                    'error': session_result.get('error', 'Session verification failed'),
                    'code': session_result.get('code', 'SESSION_VERIFICATION_FAILED')
                }

            # Store session in Supabase
            try:
                expires_at = (datetime.now() + timedelta(hours=1)).isoformat()
                session_data = {
                    'public_key': public_key,
                    'signature': original_signature,
                    'expires_at': expires_at,
                    'is_active': True,
                    'wallet_data': {
                        'publicKey': public_key,
                        'connected': True,
                        'signature': original_signature,
                        'timestamp': int(datetime.now().timestamp() * 1000)
                    }
                }
                
                # Execute without await - Supabase calls are synchronous
                result = self.supabase.table('trading_sessions')\
                    .upsert(session_data)\
                    .execute()
                
                if result.error:
                    logging.error(f"Failed to store session: {result.error}")
                    # Continue anyway since we have a valid session from agent-kit
                else:
                    logging.info(f"Stored session in Supabase: {session_data}")

            except Exception as e:
                logging.error(f"Failed to store session: {e}")
                # Continue since we have a valid session from agent-kit

            return {
                'success': True,
                'wallet_info': wallet_info,
                'sessionId': session_result.get('sessionId'),
                'expiresAt': session_result.get('expiresAt'),
                'signature': original_signature
            }

        except Exception as e:
            logging.error(f"Session verification error: {e}")
            return {
                'success': False,
                'error': str(e),
                'code': 'SESSION_VERIFICATION_ERROR'
            }

    async def _call_agent_kit(self, action: str, params: Dict[str, Any]) -> Dict[str, Any]:
        try:
            headers = {
                'Content-Type': 'application/json'
            }
            
            if action == 'trade':
                # Use the correct session id from params
                session_id = params.get('sessionId')
                if session_id:
                    logging.info(f"Using session ID for trade: {session_id}")
                    headers['X-Trading-Session'] = session_id
                else:
                    logging.warning("No session ID found for trade request")

            # Make request to the agent-kit API
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
                    data = await response.json()
                    logging.info(f"Response data: {data}")
                    return data

        except Exception as e:
            logging.error(f"Agent-kit API call error: {str(e)}")
            raise 
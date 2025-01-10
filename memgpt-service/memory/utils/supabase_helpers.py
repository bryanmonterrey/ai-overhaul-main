# memgpt-service/memory/utils/supabase_helpers.py

import logging
from typing import Tuple, Any
from postgrest import APIError

async def safe_supabase_execute(query, error_message="Failed to execute query") -> Tuple[bool, Any]:
    """Execute a Supabase query safely without awaiting"""
    try:
        # Execute without await
        response = query.execute()
        
        # Check for errors using hasattr to avoid attribute errors
        if hasattr(response, 'error') and response.error:
            logging.error(f"{error_message}: {response.error}")
            return False, response.error
            
        # Get data safely using hasattr
        data = response.data if hasattr(response, 'data') else None
        return True, data
        
    except Exception as e:
        logging.error(f"Unexpected error in Supabase execution: {str(e)}")
        return False, f"{error_message}: {str(e)}"

def handle_supabase_response(response) -> Any:
    """Handle different types of Supabase responses"""
    try:
        if hasattr(response, 'data'):
            return response.data
        elif isinstance(response, dict):
            return response
        else:
            logging.warning(f"Unexpected response type in handle_supabase_response: {type(response)}")
            return response
    except Exception as e:
        logging.error(f"Error handling Supabase response: {str(e)}")
        raise
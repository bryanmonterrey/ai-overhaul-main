# memgpt-service/memory/utils/supabase_helpers.py

import logging
from typing import Tuple, Any
from postgrest import APIError
from postgrest.exceptions import APIError as PostgRESTAPIError

async def safe_supabase_execute(query, error_message="Failed to execute query"):
    try:
        # For Python Supabase client, we don't await the execute() call
        response = query.execute()  # Remove await here
        
        if hasattr(response, 'error') and response.error:
            logging.error(f"{error_message}: {response.error}")
            return False, response.error
            
        return True, response.data
        
    except Exception as e:
        logging.error(f"Unexpected error in Supabase execution: {str(e)}")
        logging.error(str(e))
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
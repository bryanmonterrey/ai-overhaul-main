# memgpt-service/memory/utils/supabase_helpers.py

from typing import Any, Dict, List, Optional, TypeVar, Union
from supabase.client import ClientResponse

T = TypeVar('T')

def handle_supabase_response(
    response: Union[ClientResponse, Dict, Any], 
    default_value: T = None
) -> T:
    """
    Consistently handle Supabase responses across the codebase.
    
    Args:
        response: The response from a Supabase operation
        default_value: Value to return if no data is found (default: None)
        
    Returns:
        The data from the response, or the default_value if no data is found
    """
    try:
        # Handle dictionary response
        if isinstance(response, dict):
            return response.get('data', default_value)
            
        # Handle ClientResponse
        if hasattr(response, 'data'):
            return response.data or default_value
            
        # Handle any other type of response
        return default_value
        
    except Exception as e:
        print(f"Error handling Supabase response: {str(e)}")
        return default_value

async def safe_supabase_execute(query, error_message: str = "Database operation failed"):
    """
    Safely execute a Supabase query with proper error handling.
    
    Args:
        query: The Supabase query to execute
        error_message: Custom error message to log if operation fails
        
    Returns:
        Tuple of (success, data/error_message)
    """
    try:
        response = await query.execute()
        data = handle_supabase_response(response)
        if data is None:
            return False, f"{error_message}: No data returned"
        return True, data
    except Exception as e:
        return False, f"{error_message}: {str(e)}"
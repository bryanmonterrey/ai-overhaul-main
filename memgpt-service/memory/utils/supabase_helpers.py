# memgpt-service/memory/utils/supabase_helpers.py

import logging
from typing import Tuple, Any
from postgrest import APIError
from postgrest.exceptions import APIError as PostgRESTAPIError

async def safe_supabase_execute(query, error_message: str = "Database operation failed") -> Tuple[bool, Any]:
    """Safely execute a Supabase query with error handling"""
    try:
        # Log the query being executed
        logging.info(f"Executing Supabase query: {str(query)}")
        
        # Execute the query
        if hasattr(query, 'execute'):
            response = await query.execute()
        else:
            # If already executed, just get the data
            response = query
        
        # Log the response structure
        logging.info(f"Supabase response structure: {type(response)}")
        logging.info(f"Supabase response data: {response.data if hasattr(response, 'data') else response}")
        
        # Check for error attribute
        if hasattr(response, 'error') and response.error:
            logging.error(f"Supabase error: {response.error}")
            return False, response.error
            
        # Handle different response types
        if hasattr(response, 'data'):
            if response.data is None:
                logging.error("Supabase returned None data")
                return False, "No data returned from database"
            return True, response.data
        elif isinstance(response, dict):
            return True, response
        else:
            logging.warning(f"Unexpected response type: {type(response)}")
            return True, response
            
    except (PostgRESTAPIError, APIError) as e:
        logging.error(f"Supabase API error: {str(e)}")
        logging.error(f"Error details: {e.details if hasattr(e, 'details') else 'No details'}")
        return False, f"{error_message}: {str(e)}"
        
    except Exception as e:
        logging.error(f"Unexpected error in Supabase execution: {str(e)}")
        logging.exception(e)  # This logs the full stack trace
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
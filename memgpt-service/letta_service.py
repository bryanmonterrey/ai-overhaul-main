# memgpt-service/letta_service.py
import os
import json
import time
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ValidationError, validator
from enum import Enum
from typing import Optional, Dict, Any, List, Union
from config import LLMConfig  
from interface import CLIInterface
from agent import Agent  
from memory_processor import MemoryProcessor  
import uvicorn
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from supabase import create_client, Client
import asyncio
from memory_base import Memory
import uuid
from dspy_modules.service import DSPyService
from pathlib import Path
from trading.websocket.event_handler import WebSocketEventHandler
from trading.realtime import RealTimeMonitor
from trading.memory.trading_memory import TradingMemory
from chat.trading_chat import TradingChat
import logging
from dataclasses import asdict
import gc
import psutil
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import StreamingResponse
from trading.solana_service import SolanaService
load_dotenv()

# At the top after imports:
required_env_vars = {
    "PORT": os.getenv('PORT')
}

missing_vars = [key for key, value in required_env_vars.items() if not value]
if missing_vars:
    raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

DEFAULT_PERSONA = {
    "text": """You are a highly capable AI memory system focused on organizing and processing memories.
    You excel at pattern recognition, emotional analysis, and contextual understanding.
    Your goal is to help maintain and enhance the personality system's memory capabilities."""
}

DEFAULT_HUMAN = {
    "text": """A user interacting with the memory and personality system."""
}

class MemoryType(str, Enum):
    chat_history = "chat_history"
    tweet_history = "tweet_history"
    trading_params = "trading_params"
    trading_history = "trading_history"
    custom_prompts = "custom_prompts"
    agent_state = "agent_state"
    user_interaction = "user_interaction"
    memory_chain = "memory_chain"
    memory_cluster = "memory_cluster"

class ContentRequest(BaseModel):
    content: str

class QueryRequest(BaseModel):
    type: str = Field(..., description="Type of query (e.g. 'analysis')")
    query: Union[str, Dict[str, Any]] = Field(..., description="Query content or parameters")
    context: Optional[Dict[str, Any]] = Field(default=None, description="Optional context")

    @validator('query')
    def validate_query(cls, v):
        if isinstance(v, dict):
            return json.dumps(v)
        return v

class BaseMemory(BaseModel):
    key: str
    memory_type: MemoryType
    data: Dict[str, Any]
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)

class MemoryResponse(BaseModel):
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class ChainConfig(BaseModel):
    depth: int = 2
    min_similarity: float = 0.5

class ClusterConfig(BaseModel):
    time_period: str = 'week'
    min_cluster_size: int = 3
    similarity_threshold: float = 0.7

class ContextConfig(BaseModel):
    max_tokens: int = 4000
    priority_keywords: List[str] = []

class ConsciousnessState:
    def __init__(
        self,
        currentThought: str = '',
        shortTermMemory: list = None,
        longTermMemory: list = None,
        emotionalState: str = 'neutral',
        attentionFocus: list = None,
        activeContexts: set = None
    ):
        self.currentThought = currentThought
        self.shortTermMemory = shortTermMemory or []
        self.longTermMemory = longTermMemory or []
        self.emotionalState = emotionalState
        self.attentionFocus = attentionFocus or []
        self.activeContexts = activeContexts or set

class AgentState:
    def __init__(self, persona, human, messages, memory):
        self.persona = persona
        self.human = human
        self.messages = messages
        self.message_ids = []
        self.memory = memory
        self.tools = []
        self.tool_rules = []
        self.llm_config = None
        # Add these new attributes
        self.tweetStyle = 'shitpost'  # Default style
        self.consciousness = ConsciousnessState(
            currentThought='',
            shortTermMemory=[],
            longTermMemory=[],
            emotionalState='neutral',
            attentionFocus=[],
            activeContexts=set()
        )

class MemGPTService:
    def __init__(self):
        # Validate environment variables first
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise ValueError("Missing Supabase credentials in environment variables")
        if not OPENAI_API_KEY and not ANTHROPIC_API_KEY:
            raise ValueError("Either OPENAI_API_KEY or ANTHROPIC_API_KEY must be provided")

        try:
            # Initialize core services first
            self.supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
            print("Supabase client initialized successfully")

            # Test connection
            test = self.supabase.table('memories').select('*').limit(1).execute()
            print("Supabase connection tested successfully")

            # Initialize WebSocket handler early
            self.ws_handler = WebSocketEventHandler()
            print("WebSocket handler initialized")

            # Initialize SolanaService first
            self.solana_service = SolanaService(self.supabase)
            print("Solana service initialized")

            # Initialize RealTimeMonitor with configuration
            self.realtime_monitor = RealTimeMonitor({
                "risk_thresholds": {
                    "max_drawdown": 0.15,
                    "position_concentration": 0.25,
                    "volatility_threshold": 0.50
                },
                "update_interval": 5,
                "risk_calculator": {
                    "max_position_size": 100,
                    "max_portfolio_var": 0.05,
                    "max_concentration": 0.2,
                    "var_confidence": 0.95,
                    "var_window": 30
                }
            })
            print("RealTime monitor initialized")

            # Set up RealTimeMonitor dependencies
            self.realtime_monitor.set_supabase_client(self.supabase)
            self.realtime_monitor.set_solana_service(self.solana_service)
            self.realtime_monitor.set_ws_handler(self.ws_handler)
            print("RealTime monitor dependencies configured")

            # Create default wallet info
            default_wallet_info = {
                "publicKey": None,  # Will be set when user connects
                "credentials": {
                    "publicKey": None,
                    "signature": None,
                    "signTransaction": True,
                    "signAllTransactions": True,
                    "connected": False
                }
            }
            self.realtime_monitor.set_wallet(default_wallet_info)
            print("RealTime monitor dependencies configured")

            # Create LLM config
            llm_config = LLMConfig(
                model="anthropic/claude-2" if ANTHROPIC_API_KEY else "gpt-4",
                model_endpoint_type="anthropic" if ANTHROPIC_API_KEY else "openai",
                context_window=100000 if ANTHROPIC_API_KEY else 8192,
                model_endpoint=f"https://api.{'anthropic' if ANTHROPIC_API_KEY else 'openai'}.com/v1",
                embedding_endpoint_type="openai",
                embedding_endpoint="https://api.openai.com/v1",
                embedding_model="text-embedding-ada-002"
            )
            print("LLM config created")
                
            # Initialize core components
            self.interface = CLIInterface()
            memory = Memory(blocks=[])
                
            # Create and configure agent state
            agent_state = AgentState(
                persona=DEFAULT_PERSONA,
                human=DEFAULT_HUMAN,
                messages=[],
                memory=memory
            )
            agent_state.llm_config = llm_config
                
            # Create default user
            user = {
                "id": "default_user",
                "name": "User",
                "preferences": {}
            }
                
            # Initialize Letta agent
            self.agent = Agent(
                agent_state=agent_state,
                user=user,
                interface=self.interface
            )
            self.agent.service = self
            print("Letta agent initialized")

                
            # Initialize memory processor
            self.memory_processor = MemoryProcessor(self.agent)
            print("Memory processor initialized")

            # Initialize DSPy service
            try:
                prompt_dir = Path('../app/core/prompts')
                if not prompt_dir.exists():
                    print(f"Warning: Prompt directory not found at {prompt_dir}")
                    prompt_dir = Path('./app/core/prompts')  # Fallback path
                    
                self.dspy_service = DSPyService(
                    prompt_dir=prompt_dir,
                    model_config={
                        'model': "anthropic/claude-2" if ANTHROPIC_API_KEY else "gpt-4",
                        'llm_config': llm_config,
                        'api_key': ANTHROPIC_API_KEY if ANTHROPIC_API_KEY else OPENAI_API_KEY
                    }
                )
                print("DSPy service initialized")
            except Exception as dspy_error:
                print(f"Warning: DSPy service initialization error: {str(dspy_error)}")
                raise

            # Initialize trading components
            self.trading_memory = TradingMemory(self.supabase)
            self.trading_memory.set_realtime_monitor(self.realtime_monitor)
            print("Trading memory initialized")

            # Initialize trading chat
            self.trading_chat = TradingChat(
                self,
                self.memory_processor,
                self.dspy_service
            )
            print("Trading chat initialized")

            # Initialize consciousness connection
            self._init_consciousness_connection()
            print("Consciousness connection initialized")

            print("MemGPTService initialization completed successfully")
                
        except Exception as e:
            error_msg = f"Failed to initialize MemGPTService: {str(e)}"
            print(error_msg)
            raise RuntimeError(error_msg)
        
    async def _memory_maintenance_loop(self):
        """Background task for periodic memory maintenance"""
        while True:
            try:
                await self.memory_processor.maintain_memory_system()
                await asyncio.sleep(3600)  # Run every hour
            except Exception as e:
                print(f"Error in memory maintenance loop: {str(e)}")
                await asyncio.sleep(300)  # Wait 5 minutes before retrying

    async def process_memory_content(self, content: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Process and analyze content with optional context"""
        try:
            if not content or not isinstance(content, str):
                raise ValueError("Invalid content provided")

            # Use the agent to analyze the content
            agent_analysis = await self.agent.analyze_content(content, context)
            dspy_analysis = await self.dspy_service.generate_response(
                input_text=content,
                emotional_state=agent_analysis.get('emotional_context', 'neutral'),
                style=self.agent.agent_state.tweetStyle,
                context=context
            )
            
            if not agent_analysis:
                raise ValueError("Analysis failed to produce results")

            return {
                'sentiment': agent_analysis.get('sentiment', 0),
                'emotional_context': agent_analysis.get('emotional_context', 'neutral'),
                'key_concepts': agent_analysis.get('key_concepts', []),
                'patterns': agent_analysis.get('patterns', []),
                'importance': agent_analysis.get('importance', 0.5),
                'associations': agent_analysis.get('associations', []),
                'summary': agent_analysis.get('summary', ''),
                'dspy_analysis': dspy_analysis.get('data', {})
            }
        except Exception as e:
            print(f"Error processing content: {str(e)}")
            raise ValueError(f"Content analysis failed: {str(e)}")

    async def store_memory(self, memory: BaseMemory):
        """Store memory with enhanced logging."""
        try:
            print(f"Storing memory with key: {memory.key}")
            print(f"Memory type: {memory.memory_type}")
            print(f"Memory metadata: {json.dumps(memory.metadata, indent=2)}")
            
            content = str(memory.data.get('content', memory.data))
            memory_analysis = await self.process_memory_content(content)
            
            # Prepare data for Supabase
            memory_id = str(uuid.uuid4())
            supabase_data = {
                "id": memory_id,
                "key": memory_id,
                "type": memory.memory_type,
                "content": content,
                "metadata": {
                    **memory.metadata,
                    "original_key": memory.key  # Store original key in metadata
                },
                "emotional_context": memory_analysis.get('emotional_context', 'neutral'),
                "importance": memory_analysis.get('importance_score', 0.5),
                "associations": memory_analysis.get('associations', []),
                "platform": memory.metadata.get('platform', 'default'),
                "archive_status": "active"
            }

            print(f"Prepared Supabase data: {json.dumps(supabase_data, indent=2)}")
            
            result = self.supabase.table('memories').insert(supabase_data).execute()
            print(f"Supabase insert result: {json.dumps(result.data if hasattr(result, 'data') else {}, indent=2)}")
            
            if hasattr(result, 'data'):
                inserted_data = result.data[0] if isinstance(result.data, list) and result.data else result.data
            else:
                inserted_data = supabase_data

            return {
                "success": True,
                "data": inserted_data
            }

        except Exception as e:
            print(f"Error storing memory: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
        
    async def chain_memories(self, memory_key: str, config: ChainConfig):
        """Chain memories with support for tweet-based relationships and DSPy enhancement."""
        try:
            # Validate and sanitize config
            depth = min(max(1, config.depth), 5)
            min_similarity = min(max(0.1, config.min_similarity), 1.0)

            # Get initial memory with expanded search
            initial_memory = await self.get_memory(memory_key)
            if not initial_memory["success"]:
                return {"success": False, "error": "Initial memory not found"}

            # Extract content safely
            memory_data = initial_memory["data"]
            content = memory_data.get("content", "")
            if isinstance(content, dict) and 'messages' in content:
                content = content['messages'][0].get('content', "") if content['messages'] else ""

            # Start building the chain
            memory_chain = [memory_data]
            seen_ids = {memory_data['id']}

            try:
                # First, check for direct replies using metadata
                reply_query = self.supabase.table('memories')\
                    .select("*")\
                    .eq('type', memory_data['type'])\
                    .eq('archive_status', 'active')\
                    .execute()

                replies = [m for m in reply_query.data 
                          if m.get('metadata', {}).get('reply_to') == memory_key 
                          and m['id'] not in seen_ids]

                # Add replies to chain
                for reply in replies[:depth-1]:
                    if reply['id'] not in seen_ids:
                        memory_chain.append(reply)
                        seen_ids.add(reply['id'])

                # If we still need more memories, use both systems for search
                if len(memory_chain) < depth:
                    # Original semantic search
                    agent_results = self.supabase.table('memories')\
                        .select('*')\
                        .eq('id', memory_key)\
                        .execute()
                        
                    # Use helper function
                    data = handle_supabase_response(agent_results)
                    if not data:
                        return {"success": False, "error": "Memory not found"}

                    # DSPy semantic search (run in parallel)
                    dspy_results = await self.dspy_service.find_related(
                        source_content=content,
                        limit=(depth - len(memory_chain)) * 2,
                        context={
                            'emotional_state': self.agent.agent_state.consciousness.emotionalState,
                            'style': self.agent.agent_state.tweetStyle
                        }
                    )
                    
                    # Process agent search results
                    agent_memories = []
                    if agent_results:
                        agent_memories = (
                            agent_results.data if hasattr(agent_results, 'data')
                            else agent_results if isinstance(agent_results, list)
                            else []
                        )

                    # Process DSPy search results
                    dspy_memories = dspy_results.get('data', {}).get('memories', []) if dspy_results.get('success') else []

                    # Combine and deduplicate results
                    all_memories = []
                    for memory in agent_memories + dspy_memories:
                        if memory.get('id') and memory['id'] not in seen_ids:
                            all_memories.append(memory)
                            seen_ids.add(memory['id'])
                            if len(memory_chain) >= depth:
                                break
                    
                    # Sort combined results by relevance score if available
                    sorted_memories = sorted(
                        all_memories,
                        key=lambda x: (
                            x.get('relevance_score', 0) +  # Agent score
                            x.get('dspy_score', 0)         # DSPy score
                        ),
                        reverse=True
                    )

                    # Add top memories to chain
                    memory_chain.extend(sorted_memories[:depth - len(memory_chain)])

                return {
                    "success": True,
                    "data": {
                        "chain": memory_chain,
                        "total": len(memory_chain),
                        "dspy_insights": dspy_results.get('data', {}).get('insights', []) if 'dspy_results' in locals() else []
                    }
                }

            except Exception as search_error:
                print(f"Error in memory search: {str(search_error)}")
                return {
                    "success": True,
                    "data": {
                        "chain": memory_chain,
                        "error": "Failed to find additional related memories"
                    }
                }

        except Exception as e:
            print(f"Error in memory chaining: {str(e)}")
            return {"success": False, "error": str(e)}

    # Memory Clustering feature
    async def cluster_memories(self, config: ClusterConfig):
        try:
            memories = await self.get_memories_by_timeframe(config.time_period)
            
            if not memories:
                return {"success": True, "data": {"clusters": []}}

            # Use memory processor for clustering
            clusters = await self.memory_processor.cluster_memories(
                memories,
                min_size=config.min_cluster_size,
                similarity_threshold=config.similarity_threshold
            )

            return {"success": True, "data": {"clusters": clusters}}
        except Exception as e:
            print(f"Error in memory clustering: {str(e)}")
            return {"success": False, "error": str(e)}

    async def track_memory_evolution(self, concept: str):
        """Track how a concept evolved over different time periods"""
        try:
            time_periods = ['day', 'week', 'month']
            evolution_data = {}
            
            for period in time_periods:
                memories = await self.get_memories_by_timeframe(period)
                if memories:
                    analysis = await self.memory_processor.analyze_concept_evolution(
                        concept,
                        memories
                    )
                    evolution_data[period] = analysis

            return {"success": True, "data": {"evolution": evolution_data}}
        except Exception as e:
            print(f"Error tracking memory evolution: {str(e)}")
            return {"success": False, "error": str(e)}
        
    def _init_consciousness_connection(self):
        """Initialize consciousness state connection to trading system"""
        async def consciousness_update_handler(state: Dict[str, Any]):
            if self.agent and self.agent.agent_state:
                # Update emotional state based on trading performance
                if state.get("risk_level") == "high":
                    self.agent.agent_state.consciousness.emotionalState = "cautious"
                elif state.get("day_pnl_percent", 0) > 5:
                    self.agent.agent_state.consciousness.emotionalState = "confident"
                
                # Update attention focus
                self.agent.agent_state.consciousness.attentionFocus = [
                    "trading_performance",
                    *state.get("risk_warnings", [])
                ]
                
                # Update current thought
                self.agent.agent_state.consciousness.currentThought = (
                    f"Monitoring trading performance. "
                    f"Risk level: {state.get('risk_level', 'unknown')}. "
                    f"Daily P&L: {state.get('day_pnl_percent', 0):.2f}%"
                )
                
                # Store in short term memory
                self.agent.agent_state.consciousness.shortTermMemory.append({
                    "type": "trading_update",
                    "timestamp": datetime.now().isoformat(),
                    "data": state
                })

        # Register consciousness update handler with realtime monitor
        asyncio.create_task(
            self.realtime_monitor.subscribe(consciousness_update_handler)
        )
        
    async def analyze_content(self, content: str) -> Dict[str, Any]:
        """Analyze content for patterns and context"""
        try:
            # Use both systems for better analysis
            memory_result = await self.memory_processor.analyze_content(content)
            dspy_result = await self.dspy_service.analyze_content(
                content=content,
                emotional_state=self.agent.state.consciousness.emotionalState,
                style=self.agent.state.tweetStyle
            )

            return {
                "success": True,
                "data": {
                    **memory_result,  # Original analysis
                    "dspy_patterns": dspy_result.get('patterns', []),
                    "dspy_insights": dspy_result.get('insights', []),
                    "combined_score": (
                        memory_result.get('importance', 0) + 
                        dspy_result.get('importance', 0)
                    ) / 2
                }
            }
        except Exception as e:
            print(f"Error in analyze_content: {str(e)}")
            return {
                "success": False,
                "error": f"Content analysis failed: {str(e)}"
            }

    async def _find_most_related(self, source_memory: Dict, potential_memories: List[Dict]) -> Optional[Dict]:
        """Find the most semantically similar memory using both systems"""
        try:
            if not potential_memories or not source_memory:
                return None

            # Get source content
            source_content = self._extract_content(source_memory)
            if not source_content:
                return None

            # Process potential memories
            valid_memories = self._process_memories(potential_memories)
            if not valid_memories:
                return None

            # Use both systems to find related memories
            memory_similar = await self.memory_processor.find_most_similar(
                {"content": source_content},
                [{"content": m['_processed_content']} for m in valid_memories]
            )

            dspy_similar = await self.dspy_service.find_related(
                source_content=source_content,
                candidates=[m['_processed_content'] for m in valid_memories],
                context={
                    'emotional_state': self.agent.state.consciousness.emotionalState,
                    'style': self.agent.state.tweetStyle
                }
            )

            # Combine results
            memory_score = memory_similar.get('score', 0) if memory_similar else 0
            dspy_score = dspy_similar.get('score', 0) if dspy_similar else 0

            # Use the result with higher confidence
            best_match = memory_similar if memory_score > dspy_score else dspy_similar
            if best_match:
                for memory in valid_memories:
                    if memory['_processed_content'] == best_match.get('content'):
                        memory.pop('_processed_content', None)
                        return memory

            return None
        except Exception as e:
            print(f"Error finding related memory: {str(e)}")
            return None
        
    async def _process_memories(self, memories: List[Dict]) -> List[Dict]:
        """Process and prepare memories for comparison"""
        try:
            processed = []
            for memory in memories:
                content = self._extract_content(memory)
                if content:
                    memory_copy = memory.copy()
                    memory_copy['_processed_content'] = content
                    processed.append(memory_copy)
            return processed
        except Exception as e:
            print(f"Error processing memories: {str(e)}")
            return []

    def _extract_content(self, memory: Dict) -> Optional[str]:
        """Helper to extract content safely"""
        try:
            content = memory.get("content", "")
            if isinstance(content, dict):
                content = (
                    content.get("messages", [])[0].get("content", "")
                    if "messages" in content
                    else str(content)
                )
            return str(content) if content else None
        except (AttributeError, IndexError) as e:
            print(f"Error extracting content: {e}")
            return None

    async def get_memories_by_timeframe(self, timeframe: str) -> List[Dict]:
        """Get memories within specified timeframe"""
        try:
            # Use UTC.now() instead of deprecated utcnow()
            end_date = datetime.now(timezone.utc)
            start_date = end_date - {
                'day': timedelta(days=1),
                'week': timedelta(weeks=1),
                'month': timedelta(days=30)
            }.get(timeframe, timedelta(days=1))

            # Remove await, add execute() directly
            response = self.supabase.table('memories')\
                .select("*")\
                .gte('created_at', start_date.isoformat())\
                .lte('created_at', end_date.isoformat())\
                .execute()

            # Properly handle response
            if hasattr(response, 'data'):
                return response.data or []
            return []
        except Exception as e:
            print(f"Error getting memories by timeframe: {str(e)}")
            return []

    async def query_memories(self, memory_type: MemoryType, query: Dict[str, Any]):
        """Query memories with proper metadata handling and async search."""
        try:
            # Modified Supabase query without await
            query_result = self.supabase.table('memories')\
                .select("*")\
                .eq('type', memory_type)\
                .eq('archive_status', 'active')\
                .execute()
            
            # Handle the response data
            db_results = []
            if hasattr(query_result, 'data'):
                db_results = query_result.data

            # Modified semantic search with proper await
            semantic_results = []
            if query.get('content'):
                try:
                    search_result = await self.agent.memory.search(
                        query=query.get('content', ''),
                        limit=10,
                        filter_fn=lambda x: x.get('type') == memory_type
                    )
                    
                    if isinstance(search_result, list):
                        semantic_results = search_result
                    elif hasattr(search_result, 'data'):
                        semantic_results = search_result.data
                except Exception as search_error:
                    print(f"Search error: {str(search_error)}")
                    semantic_results = []

            # Combine and rank results
            all_results = await self.memory_processor.combine_and_rank_results(
                db_results,
                semantic_results,
                query
            )

            return {
                "success": True, 
                "data": {
                    "memories": all_results
                }
            }

        except Exception as e:
            print(f"Error querying memories: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
        
    async def get_memory(self, key: str, type: Optional[MemoryType] = None):
        """Get memory with properly formatted JSONB querying."""
        try:
            # Build base query
            base_query = self.supabase.table('memories')
            
            # Try direct ID match first
            response = base_query.select("*").eq('id', key).execute()
            data_list = response.data if hasattr(response, 'data') else []
            memory_data = data_list[0] if data_list else None

            if not memory_data:
                # Try to find by tweet_id in metadata using containment operator
                metadata_query = base_query.select("*")\
                    .eq('type', 'tweet_history')\
                    .contains('metadata', {'tweet_id': key})\
                    .execute()
                
                data_list = metadata_query.data if hasattr(metadata_query, 'data') else []
                memory_data = data_list[0] if data_list else None

            if not memory_data:
                # Try to find by reply_to in metadata using containment
                reply_query = base_query.select("*")\
                    .contains('metadata', {'reply_to': key})\
                    .execute()
                
                data_list = reply_query.data if hasattr(reply_query, 'data') else []
                memory_data = data_list[0] if data_list else None

            if memory_data:
                # Process content if it's a JSON string
                try:
                    if isinstance(memory_data.get('content'), str):
                        if memory_data['content'].startswith('{'):
                            memory_data['content'] = json.loads(memory_data['content'])
                except json.JSONDecodeError:
                    pass  # Keep original content if parse fails
                
                return {"success": True, "data": memory_data}
                
            return {
                "success": False, 
                "error": "Memory not found",
                "debug_info": {
                    "key": key,
                    "type": type,
                    "search_attempts": [
                        "direct_id",
                        "metadata_tweet_id",
                        "metadata_reply_to"
                    ]
                }
            }

        except Exception as e:
            print(f"Error getting memory: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def summarize_memories(self, timeframe: str = 'recent', limit: int = 5):
        """Generate a summary of recent memories"""
        try:
            memories = await self.get_memories_by_timeframe(timeframe)
            if not memories:
                return {"success": True, "data": {"summary": "No memories found for the specified timeframe."}}

            # Get both summaries
            memory_summary = await self.memory_processor.generate_summary(memories[:limit])
            dspy_summary = await self.dspy_service.generate_summary(
                memories=memories[:limit],
                style=self.agent.agent_state.tweetStyle,
                emotional_state=self.agent.agent_state.consciousness.emotionalState
            )

            return {
                "success": True, 
                "data": {
                    "memory_summary": memory_summary,
                    "dspy_summary": dspy_summary.get('summary', ''),
                    "key_points": dspy_summary.get('key_points', []),
                    "trends": dspy_summary.get('trends', [])
                }
            }
        except Exception as e:
            print(f"Error summarizing memories: {str(e)}")
            return {"success": False, "error": str(e)}
        
    async def update_system_settings(self, settings: Dict[str, Any]) -> Dict[str, Any]:
        """Update system settings."""
        try:
            command_type = settings.get('type')
            
            if command_type == 'trading':
                # Update trading settings through realtime monitor
                await self.realtime_monitor.update_settings(settings)
                
            # Store settings in memory
            await self.trading_memory.store_settings_update({
                "type": "settings_update",
                "data": settings,
                "timestamp": datetime.now().isoformat()
            })
            
            return {
                "success": True,
                "data": {
                    "settings": settings,
                    "updated_at": datetime.now().isoformat()
                }
            }
        except Exception as e:
            logging.error(f"Error updating system settings: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    async def analyze_market(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze market data."""
        try:
            asset = parameters.get('asset')
            if not asset:
                raise ValueError("Asset parameter is required")

            # Get market data from realtime monitor
            market_data = await self.realtime_monitor.get_market_data(asset)
            
            # Store analysis in memory
            await self.trading_memory.store_market_analysis({
                "type": "market_analysis",
                "data": {
                    "asset": asset,
                    "market_data": market_data
                },
                "timestamp": datetime.now().isoformat()
            })
            
            return {
                "success": True,
                "data": {
                    "asset": asset,
                    "market_data": market_data,
                    "timestamp": datetime.now().isoformat()
                }
            }
        except Exception as e:
            logging.error(f"Error analyzing market: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
        
    async def execute_ai_trade(self, command: Dict[str, Any]) -> Dict[str, Any]:
        """Execute trading operations through Jupiter on Solana"""
        try:
            # Extract basic parameters
            asset = command.get('asset')
            amount = command.get('amount')
            side = command.get('side')

            if not asset:
                return {
                    "success": False,
                    "error": "Asset not specified"
                }

            if not amount:
                return {
                    "success": False,
                    "error": "Amount not specified"
                }

            if not side:
                return {
                    "success": False,
                    "error": "Trade side (buy/sell) not specified"
                }

            try:
                # Store trade attempt
                await self.trading_memory.store_trade_execution({
                    "type": "trade_attempt",
                    "data": command,
                    "timestamp": datetime.now().isoformat()
                })

                # Execute through Jupiter/Solana
                solana_params = {
                    "targetMint": asset,
                    "amount": amount,
                    "side": side,
                    "slippage": 1.0,  # 1% default slippage
                }

                # Execute trade through realtime monitor
                trade_result = await self.realtime_monitor.execute_solana_trade(solana_params)

                # Store successful trade
                await self.trading_memory.store_trade_execution({
                    "type": "trade_success",
                    "data": {
                        "params": solana_params,
                        "result": trade_result
                    },
                    "timestamp": datetime.now().isoformat()
                })

                return {
                    "success": True,
                    "data": {
                        "trade_params": command,
                        "result": trade_result,
                        "status": "executed",
                        "timestamp": datetime.now().isoformat()
                    }
                }

            except Exception as trade_error:
                error_msg = f"Trade execution error: {str(trade_error)}"
                logging.error(error_msg)
                return {
                    "success": False,
                    "error": error_msg
                }

        except Exception as e:
            error_msg = f"Trade processing error: {str(e)}"
            logging.error(error_msg)
            
            # Store error
            await self.trading_memory.store_trade_execution({
                "type": "trade_error",
                "data": {
                    "command": command,
                    "error": error_msg
                },
                "timestamp": datetime.now().isoformat()
            })
            
            return {
                "success": False,
                "error": error_msg
            }

    async def handle_ai_trading(self, command: Dict[str, Any]) -> Dict[str, Any]:
        """Handle AI trading operations with realtime monitoring and consciousness integration"""
        try:
            # Update realtime monitor with command
            await self.realtime_monitor.process_command(command)
            
            # Get current consciousness state for context
            consciousness_state = self.agent.agent_state.consciousness
            
            command_type = command.get('type')
            
            # Enhance command with consciousness context
            command["context"] = {
                "emotional_state": consciousness_state.emotionalState,
                "attention_focus": consciousness_state.attentionFocus,
                "current_thought": consciousness_state.currentThought
            }
            
            # Store command in trading memory
            await self.trading_memory.store_trade_execution({
                "type": "command",
                "data": command,
                "timestamp": datetime.now().isoformat()
            })

            # Process command based on type
            result = None
            if command_type == 'execute_trade':
                result = await self._execute_ai_trade(command)
                
                # Update realtime monitor with trade result
                if result.get("success"):
                    await self.realtime_monitor.process_trade(result["data"])
                    
            elif command_type == 'update_strategy':
                result = await self._update_ai_strategy(command)
                
                # Update realtime monitor with new strategy
                if result.get("success"):
                    await self.realtime_monitor.update_strategy(result["data"])
                    
            elif command_type == 'get_status':
                # Get status from both trading system and realtime monitor
                ai_status = await self._get_ai_trading_status()
                monitor_metrics = await self.realtime_monitor.get_current_metrics()
                
                result = {
                    "success": True,
                    "data": {
                        **ai_status.get("data", {}),
                        "realtime_metrics": monitor_metrics,
                        "consciousness_state": asdict(consciousness_state)
                    }
                }
            else:
                raise ValueError(f"Unknown command type: {command_type}")

            # Broadcast update via WebSocket if result is successful
            if result and result.get("success"):
                await self.ws_handler.broadcast_update(
                    channel="admin_trading",
                    data={
                        "type": command_type,
                        "result": result["data"]
                    }
                )

            return result

        except Exception as e:
            error_msg = f"AI trading error: {str(e)}"
            logging.error(error_msg)
            
            # Store error in memory
            await self.trading_memory.store_trade_execution({
                "type": "error",
                "data": {
                    "command": command,
                    "error": error_msg
                },
                "timestamp": datetime.now().isoformat()
            })
            
            # Broadcast error via WebSocket
            await self.ws_handler.broadcast_update(
                channel="admin_trading",
                data={
                    "type": "error",
                    "error": error_msg
                }
            )
            
            return {
                "success": False,
                "error": error_msg
            }

    async def handle_holder_trading(
        self,
        user_address: str,
        command: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle holder trading operations"""
        try:
            # Verify holder status
            is_holder = await self._verify_token_holder(user_address)
            if not is_holder:
                return {
                    "success": False,
                    "error": "Not a token holder"
                }

            command_type = command.get('type')
            if command_type == 'update_settings':
                return await self._update_holder_settings(user_address, command)
            elif command_type == 'get_portfolio':
                return await self._get_holder_portfolio(user_address)
            elif command_type == 'toggle_trading':
                return await self._toggle_holder_trading(user_address, command)
            else:
                raise ValueError(f"Unknown command type: {command_type}")
        except Exception as e:
            logging.error(f"Holder trading error: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

# FastAPI setup
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("Starting MemGPT Service...")
    app.state.memgpt_service = MemGPTService()
    await app.state.memgpt_service.ws_handler.start()
    yield
    # Cleanup on shutdown
    if hasattr(app.state, 'memgpt_service'):
        await app.state.memgpt_service.ws_handler.cleanup()

# Create FastAPI app only once
app = FastAPI(lifespan=lifespan)

app.add_middleware(GZipMiddleware, minimum_size=1000)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://terminal.goatse.app",
        "*"  # Add this for development
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalyzeRequest(BaseModel):
    content: str = Field(..., description="Content to analyze")
    context: Optional[Dict[str, Any]] = Field(default=None, description="Optional context")

class AIRequest(BaseModel):
    messages: List[Dict[str, str]]
    wallet: Optional[Dict[str, Any]] = None
    context: Optional[Dict[str, Any]] = None

@app.get("/")
def root():
    return {"status": "ok"}

@app.on_event("startup")
async def startup_event():
    app.state.memgpt_service = MemGPTService()
    # Add health check status
    app.state.healthy = True

@app.post("/api/ai")
async def handle_ai_request(request: AIRequest):
    try:
        if not request.messages:
            raise HTTPException(status_code=400, detail="No messages provided")
            
        # Process through trading chat
        result = await app.state.memgpt_service.trading_chat.process_admin_message(
            request.messages[-1]['content'],
            wallet_info=request.wallet,
            context=request.context
        )
        
        return {
            "success": True,
            "data": result
        }
    except Exception as e:
        logging.error(f"AI request error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze")
async def analyze_content(request: AnalyzeRequest):
    try:
        if not request.content:
            raise HTTPException(status_code=400, detail="Content is required")

        # Process the content
        result = await app.state.memgpt_service.process_memory_content(
            content=request.content,
            context=request.context
        )

        return {
            "success": True,
            "data": result
        }
    except Exception as e:
        print(f"Error in analyze_content: {str(e)}")
        raise HTTPException(status_code=422, detail=str(e))

@app.post("/query")
async def query_content(request: QueryRequest):
    try:
        print(f"Received query request: {request}")  
        
        # Add request timeout
        timeout = 30  # seconds
        try:
            async with asyncio.timeout(timeout):
                if request.type == 'analysis':
                    result = await app.state.memgpt_service.process_memory_content(
                        content=request.query,
                        context=request.context
                    )
                    return {"success": True, "data": result}
                else:
                    result = await app.state.memgpt_service.query_memories(
                        memory_type=request.type,
                        query={"content": request.query, "context": request.context}
                    )
                    return result
        except asyncio.TimeoutError:
            print(f"Request timed out after {timeout} seconds")
            raise HTTPException(status_code=504, detail="Request timed out")
            
    except ValidationError as e:
        print(f"Validation error: {str(e)}")
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        print(f"Error processing query: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    
# Existing endpoints
@app.post("/store", response_model=MemoryResponse)
async def store_memory(memory: BaseMemory):
    result = await app.state.memgpt_service.store_memory(memory)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

@app.get("/memories/{key}", response_model=MemoryResponse)  # This one should be added
async def get_memory(key: str, type: Optional[MemoryType] = None):
    result = await app.state.memgpt_service.get_memory(key)
    if not result["success"]:
        raise HTTPException(
            status_code=404 if "not found" in str(result["error"]).lower() else 500, 
            detail=result["error"]
        )
    return result


@app.on_event("startup")
async def startup_event():
    app.state.memgpt_service = MemGPTService()
    await app.state.memgpt_service.ws_handler.start()
    # Enable garbage collection
    gc.enable()
    # Set garbage collection threshold
    gc.set_threshold(700, 10, 5)

@app.middleware("http")
async def cleanup_middleware(request: Request, call_next):
    response = await call_next(request)
    # Force garbage collection after each request
    gc.collect()
    return response

@app.websocket("/ws/trading") 
async def websocket_endpoint(websocket: WebSocket):
    client_id = websocket.query_params.get("clientId", str(uuid.uuid4()))
    try:
        # Let the WebSocketEventHandler handle the connection
        await app.state.memgpt_service.ws_handler.handle_connection(websocket, client_id)
    except WebSocketDisconnect:
        print(f"Client {client_id} disconnected normally")
    except Exception as e:
        print(f"Error in websocket_endpoint: {str(e)}")

@app.post("/memories/chain/{memory_key}")
async def chain_memories(memory_key: str, config: ChainConfig):
    """Chain memories endpoint with better error handling."""
    try:
        # Validate UUID format
        try:
            uuid_obj = uuid.UUID(memory_key)
            key = str(uuid_obj)
        except ValueError:
            if not memory_key:
                raise HTTPException(status_code=400, detail="Memory key is required")
            key = memory_key  # Allow non-UUID keys for metadata lookup
            
        result = await app.state.memgpt_service.get_memory(key)
        if not result["success"]:
            return {
                "success": True,
                "data": {
                    "chain": [],
                    "error": "Initial memory not found"
                }
            }
            
        # If we found the memory, proceed with chaining
        chain_result = await app.state.memgpt_service.chain_memories(key, config)
        if not chain_result["success"]:
            return {
                "success": True,
                "data": {
                    "chain": [result["data"]],  # Return at least the initial memory
                    "error": chain_result["error"]
                }
            }
            
        return chain_result
        
    except Exception as e:
        print(f"Chain memories error: {str(e)}")
        return {
            "success": True,
            "data": {
                "chain": [],
                "error": str(e)
            }
        }
    
@app.post("/memories/cluster")
async def cluster_memories(config: ClusterConfig):
    result = await app.state.memgpt_service.cluster_memories(config)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

@app.get("/metrics")
async def get_metrics():
    import psutil
    process = psutil.Process()
    memory_info = process.memory_info()
    return {
        "memory_used_mb": memory_info.rss / 1024 / 1024,
        "cpu_percent": process.cpu_percent(),
        "num_threads": process.num_threads()
    }

def cleanup_memory():
    gc.collect()
    import psutil
    process = psutil.Process()
    if process.memory_info().rss > 500 * 1024 * 1024:  # 500MB
        print("Memory threshold exceeded, performing cleanup")
        # Force garbage collection
        gc.collect()
        # Clear any caches
        if hasattr(app.state.memgpt_service, 'memory_processor'):
            app.state.memgpt_service.memory_processor.clear_caches()

@app.post("/trading/admin/chat")
async def admin_chat_endpoint(request: Request):
    try:
        # Add timeout for initial request processing
        async with asyncio.timeout(30):  # 30 second timeout
            data = await request.json()
            print("Received request data:", data)
            
            messages = data.get('messages', [])
            if not messages:
                raise HTTPException(status_code=400, detail="No messages provided")
                
            last_message = messages[-1].get('content', '')
            print("Processing message:", last_message)

            # Pass wallet info to process_admin_message
            wallet_info = data.get('wallet', {})
            print("getting wallet_info:", wallet_info)
            
            result = await app.state.memgpt_service.trading_chat.process_admin_message(
                message=last_message,
                wallet_info=wallet_info
            )
            print("Generated result:", result)

            async def event_stream():
                try:
                    # Send minimal required structure for InputMorphMessage
                    if result.get("response"):
                        # Add keep-alive ping before sending message
                        yield ": ping\n\n"
                        message = {
                            "role": "assistant",
                            "content": result["response"]
                        }
                        yield f"data: {json.dumps(message)}\n\n"
                    yield "data: [DONE]\n\n"

                except Exception as e:
                    error_message = {
                        "role": "assistant",
                        "content": f"Error: {str(e)}"
                    }
                    yield f"data: {json.dumps(error_message)}\n\n"
                    yield "data: [DONE]\n\n"

            return StreamingResponse(
                event_stream(),
                media_type="text/event-stream",
                headers={
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                    'Content-Type': 'text/event-stream',
                    'X-Accel-Buffering': 'no'  # Prevent proxy buffering
                }
            )
        
    except asyncio.TimeoutError:
        print("Request timed out")
        return StreamingResponse(
            iter([
                f"data: {json.dumps({'role': 'assistant', 'content': 'Request timed out'})}\n\n",
                "data: [DONE]\n\n"
            ]),
            media_type="text/event-stream",
            headers={
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Content-Type': 'text/event-stream',
            }
        )
    except Exception as e:
        print("Endpoint error:", str(e))
        # Return error as streaming response instead of raising HTTP exception
        return StreamingResponse(
            iter([
                f"data: {json.dumps({'role': 'assistant', 'content': f'Error: {str(e)}'})}\n\n",
                "data: [DONE]\n\n"
            ]),
            media_type="text/event-stream",
            headers={
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Content-Type': 'text/event-stream',
            }
        )

@app.get("/health")
async def health_check():
    if not app.state.healthy:
        raise HTTPException(status_code=503, detail="Service unhealthy")
    return {"status": "healthy"}
    
@app.post("/trading/holders/chat")
async def holder_chat_endpoint(request: Request):
    try:
        data = await request.json()
        
        messages = data.get('messages', [])
        if not messages:
            raise HTTPException(status_code=400, detail="No messages provided")
            
        user_address = data.get('userAddress')
        if not user_address:
            raise HTTPException(status_code=400, detail="No user address provided")
            
        last_message = messages[-1].get('content', '')
        
        # Process through trading chat
        result = await app.state.memgpt_service.trading_chat.process_holder_message(
            message=last_message,
            user_address=user_address
        )
        
        # Return as streaming response
        async def event_stream():
            try:
                yield f"data: {json.dumps(result)}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"

        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/memories/evolution/{concept}")
async def track_memory_evolution(concept: str):
    result = await app.state.memgpt_service.track_memory_evolution(concept)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

@app.get("/metrics")
async def get_metrics():
    process = psutil.Process()
    memory_info = process.memory_info()
    return {
        "memory_used_mb": memory_info.rss / 1024 / 1024,
        "cpu_percent": process.cpu_percent(),
        "num_threads": process.num_threads()
    }

@app.get("/summary")
async def get_memory_summary(timeframe: str = 'recent', limit: int = 5):
    result = await app.state.memgpt_service.summarize_memories(timeframe, limit)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

if __name__ == "__main__":
    try:
        print("Starting MemGPT Service...")
        
        async def start_service():
            # Create service with maintenance loop
            service = MemGPTService()
            
            # Update these settings
            config = uvicorn.Config(
                app,
                host="0.0.0.0",
                port=3001,
                log_level="info",
                timeout_keep_alive=65,  # Increase keep-alive timeout
                workers=4,              # Add multiple workers
                loop="uvloop"           # Use uvloop for better performance
            )
            server = uvicorn.Server(config)
            await server.serve()
        
        # Run everything in the event loop
        asyncio.run(start_service())
        
    except Exception as e:
        print(f"Failed to start service: {str(e)}")
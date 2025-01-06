# test_letta_service.py
import asyncio
import uuid
from datetime import datetime
import httpx
import json

BASE_URL = "http://localhost:3001"

async def test_store_memory():
    print("\n📝 Testing store_memory...")
    async with httpx.AsyncClient() as client:
        try:
            test_memory = {
                "key": str(uuid.uuid4()),
                "memory_type": "chat_history",
                "data": {
                    "content": "This is a test memory for unit testing.",
                    "timestamp": datetime.now().isoformat()
                },
                "metadata": {
                    "source": "test",
                    "priority": "high"
                }
            }
            
            response = await client.post(
                f"{BASE_URL}/store",
                json=test_memory,
                headers={"Content-Type": "application/json"}
            )
            
            print(f"Status Code: {response.status_code}")
            print(f"Response: {json.dumps(response.json(), indent=2)}")
            
            if response.status_code == 200:
                return response.json().get("data", {}).get("id")
            return None
            
        except Exception as e:
            print(f"❌ Error in store_memory: {str(e)}")
            return None

async def test_query_memories():
    print("\n🔍 Testing query_memories...")
    async with httpx.AsyncClient() as client:
        try:
            query_request = {
                "type": "chat_history",
                "query": {"status": "active"},
                "context": None
            }
            
            response = await client.post(
                f"{BASE_URL}/query",
                json=query_request,
                headers={"Content-Type": "application/json"}
            )
            
            print(f"Status Code: {response.status_code}")
            print(f"Response: {json.dumps(response.json(), indent=2)}")
            
        except Exception as e:
            print(f"❌ Error in query_memories: {str(e)}")

async def test_chain_memories(memory_key: str):
    print("\n⛓️ Testing chain_memories...")
    async with httpx.AsyncClient() as client:
        try:
            config = {
                "depth": 2,
                "min_similarity": 0.5
            }
            
            response = await client.post(
                f"{BASE_URL}/memories/chain/{memory_key}",
                json=config,
                headers={"Content-Type": "application/json"}
            )
            
            print(f"Status Code: {response.status_code}")
            print(f"Response: {json.dumps(response.json(), indent=2)}")
            
        except Exception as e:
            print(f"❌ Error in chain_memories: {str(e)}")

async def test_get_memories_timeframe():
    print("\n📅 Testing get_memories_by_timeframe...")
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{BASE_URL}/summary?timeframe=recent&limit=5",
                headers={"Content-Type": "application/json"}
            )
            
            print(f"Status Code: {response.status_code}")
            print(f"Response: {json.dumps(response.json(), indent=2)}")
            
        except Exception as e:
            print(f"❌ Error in get_memories_by_timeframe: {str(e)}")

async def test_analyze_content():
    print("\n🔬 Testing analyze_content...")
    async with httpx.AsyncClient() as client:
        try:
            analyze_request = {
                "content": "This is a test message to analyze sentiment and context.",
                "context": {"source": "test"}
            }
            
            response = await client.post(
                f"{BASE_URL}/analyze",
                json=analyze_request,
                headers={"Content-Type": "application/json"}
            )
            
            print(f"Status Code: {response.status_code}")
            print(f"Response: {json.dumps(response.json(), indent=2)}")
            
        except Exception as e:
            print(f"❌ Error in analyze_content: {str(e)}")

async def run_tests():
    print("🚀 Starting Letta Service Tests...")
    
    # Test analyze_content first as it's most basic
    await test_analyze_content()
    
    # Test store_memory and get the ID for chain testing
    memory_id = await test_store_memory()
    
    if memory_id:
        print(f"\n✅ Successfully stored memory with ID: {memory_id}")
        # Test chain_memories with the stored memory
        await test_chain_memories(memory_id)
    
    # Test querying
    await test_query_memories()
    
    # Test timeframe retrieval
    await test_get_memories_timeframe()
    
    print("\n🏁 Testing Complete!")

if __name__ == "__main__":
    asyncio.run(run_tests())
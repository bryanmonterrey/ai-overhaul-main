# memgpt-service/tests/workflow_test.py
import asyncio
import logging
from memgpt_service import MemGPTService

logger = logging.getLogger('WorkflowTest')

async def test_workflow():
    """Test the complete workflow"""
    try:
        # 1. Initialize service
        logger.info("Starting workflow test...")
        service = MemGPTService()
        
        # 2. Test memory processing
        memory_result = await service.process_memory_content(
            "Test trading message about buying SOL"
        )
        logger.info(f"Memory processing result: {memory_result}")
        
        # 3. Test trading chat
        chat_result = await service.trading_chat.process_admin_message(
            "Analyze the market for SOL"
        )
        logger.info(f"Trading chat result: {chat_result}")
        
        # 4. Test memory storage
        storage_result = await service.store_memory({
            "key": "test_memory",
            "memory_type": "trading_history",
            "data": {"content": "Test trade execution"},
            "metadata": {"test": True}
        })
        logger.info(f"Memory storage result: {storage_result}")
        
        # 5. Test real-time monitoring
        monitoring_result = await service.realtime_monitor.get_current_metrics()
        logger.info(f"Monitoring result: {monitoring_result}")
        
        logger.info("Workflow test completed successfully")
        
    except Exception as e:
        logger.error(f"Workflow test failed: {str(e)}")
        raise

if __name__ == "__main__":
    asyncio.run(test_workflow())
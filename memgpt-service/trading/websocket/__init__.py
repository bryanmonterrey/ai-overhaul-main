# memgpt-service/trading/websocket/__init__.py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from .event_handler import WebSocketEventHandler
import logging
import json

class WebSocketServer:
    def __init__(self, app: FastAPI):
        self.app = app
        self.event_handler = WebSocketEventHandler()
        self.setup_routes()

    def setup_routes(self):
        @self.app.websocket("/ws")
        async def websocket_endpoint(websocket: WebSocket):
            await websocket.accept()
            client_id = str(id(websocket))

            try:
                # Register the client
                client = await self.event_handler.register_client(client_id)
                
                # Keep connection alive and handle messages
                while True:
                    try:
                        # Receive and parse message
                        data = await websocket.receive_json()
                        
                        # Update client's last heartbeat
                        await self.event_handler.update_heartbeat(client_id)
                        
                        # Process message based on type
                        if data.get('type') == 'trading_chat':
                            response = {
                                'type': 'trading_chat_response',
                                'text': "Processing your request...",
                                'messages': data.get('messages', [])
                            }
                            await websocket.send_json(response)

                    except WebSocketDisconnect:
                        await self.event_handler.unregister_client(client_id)
                        break
                    except Exception as e:
                        logging.error(f"Error handling message: {str(e)}")
                        await websocket.send_json({
                            'type': 'error',
                            'message': str(e)
                        })

            except Exception as e:
                logging.error(f"WebSocket error: {str(e)}")
                await websocket.close()
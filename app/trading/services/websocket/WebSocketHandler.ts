// services/websocket/WebSocketHandler.ts
import { WebSocketMessage, WebSocketConfig, WebSocketTradeStatus, 
    WebSocketQuoteUpdate, WebSocketExecutionUpdate, WebSocketSessionStatus } from './types';

export class WebSocketHandler {
private ws: WebSocket | null = null;
private readonly config: WebSocketConfig;
private reconnectAttempts = 0;
private pingInterval: NodeJS.Timer | null = null;
private listeners: Map<string, Set<Function>>;

constructor(config: Partial<WebSocketConfig>) {
   this.config = {
       url: 'ws://localhost:3001/ws',
       reconnectAttempts: 5,
       reconnectDelay: 1000,
       pingInterval: 30000,
       ...config
   };
   this.listeners = new Map();
}

public connect(): void {
   if (typeof window === 'undefined') return;
   if (this.ws?.readyState === WebSocket.OPEN) return;

   this.ws = new WebSocket(this.config.url);
   
   this.ws.onopen = () => {
       console.log('WebSocket connected');
       this.reconnectAttempts = 0;
       this.emit('connection', { status: 'connected' });
       this.startPing();
   };

   this.ws.onmessage = (event) => {
       try {
           const data = JSON.parse(event.data);
           this.handleMessage(data);
       } catch (error) {
           console.error('WebSocket message error:', error);
           this.emit('error', error);
       }
   };

   this.ws.onclose = () => {
       console.log('WebSocket disconnected');
       this.clearPing();
       this.emit('connection', { status: 'disconnected' });
       this.handleReconnect();
   };

   this.ws.onerror = (error) => {
       console.error('WebSocket error:', error);
       this.emit('error', error);
   };
}

public disconnect(): void {
   if (this.ws) {
       this.ws.close();
       this.ws = null;
       this.clearPing();
       this.listeners.clear();
   }
}

public reconnect(): void {
   this.disconnect();
   this.reconnectAttempts = 0;
   this.connect();
}

public isConnected(): boolean {
   return this.ws?.readyState === WebSocket.OPEN;
}

public on(event: string, callback: Function): () => void {
   if (!this.listeners.has(event)) {
       this.listeners.set(event, new Set());
   }
   this.listeners.get(event)!.add(callback);
   
   return () => {
       const callbacks = this.listeners.get(event);
       if (callbacks) {
           callbacks.delete(callback);
       }
   };
}

public send(message: WebSocketMessage): void {
   if (this.ws?.readyState === WebSocket.OPEN) {
       this.ws.send(JSON.stringify(message));
   } else {
       console.error('WebSocket not connected');
       this.emit('error', new Error('WebSocket not connected'));
   }
}

private handleMessage(message: WebSocketMessage): void {
   switch (message.type) {
       case 'trade_status':
           this.handleTradeStatus(message.data as WebSocketTradeStatus);
           break;
       case 'quote_update':
           this.handleQuoteUpdate(message.data as WebSocketQuoteUpdate);
           break;
       case 'execution_update':
           this.handleExecutionUpdate(message.data as WebSocketExecutionUpdate);
           break;
       case 'session_status':
           this.handleSessionStatus(message.data as WebSocketSessionStatus);
           break;
       default:
           console.warn('Unknown message type:', message.type);
   }
}

private handleTradeStatus(data: WebSocketTradeStatus): void {
   this.emit('tradeStatus', data);
}

private handleQuoteUpdate(data: WebSocketQuoteUpdate): void {
   this.emit('quoteUpdate', data);
}

private handleExecutionUpdate(data: WebSocketExecutionUpdate): void {
   this.emit('executionUpdate', data);
}

private handleSessionStatus(data: WebSocketSessionStatus): void {
   this.emit('sessionStatus', data);
}

private emit(event: string, data: any): void {
   const callbacks = this.listeners.get(event);
   if (callbacks) {
       callbacks.forEach(callback => {
           try {
               callback(data);
           } catch (error) {
               console.error(`Error in ${event} listener:`, error);
           }
       });
   }
}

private handleReconnect(): void {
   if (this.reconnectAttempts < this.config.reconnectAttempts) {
       this.reconnectAttempts++;
       const delay = this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
       setTimeout(() => this.connect(), delay);
   } else {
       console.error('Max reconnection attempts reached');
       this.emit('connection', { 
           status: 'failed', 
           error: 'Max reconnection attempts reached' 
       });
   }
}

private startPing(): void {
   this.clearPing();
   this.pingInterval = setInterval(() => {
       if (this.ws?.readyState === WebSocket.OPEN) {
           this.ws.send(JSON.stringify({ type: 'ping' }));
       }
   }, this.config.pingInterval);
}

private clearPing(): void {
   if (this.pingInterval) {
       clearInterval(this.pingInterval);
       this.pingInterval = null;
   }
}
}
// app/trading/services/tradingChatService.ts
export class TradingChatService {
    private ws: WebSocket | null = null;
    private messageHandlers: ((message: any) => void)[] = [];
    private API_URL = process.env.NEXT_PUBLIC_PYTHON_API_URL || 'http://localhost:3001';
  
    constructor() {
      this.connect();
    }
  
    private connect() {
      if (this.ws) {
        this.ws.close();
      }
  
      this.ws = new WebSocket(`${this.API_URL.replace('http', 'ws')}/ws`);
      
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.messageHandlers.forEach(handler => handler(data));
        } catch (error) {
          console.error('Error processing message:', error);
        }
      };
  
      this.ws.onclose = () => {
        setTimeout(() => this.connect(), 1000); // Reconnect after 1 second
      };
    }
  
    public sendMessage(message: string, userId: string) {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'trading_chat',
          messages: [{
            role: 'user',
            content: message
          }],
          role: 'admin',
          userId: userId,
          context: {
            isAdmin: true,
            sessionId: userId
          }
        }));
      }
    }
  
    public onMessage(handler: (message: any) => void) {
      this.messageHandlers.push(handler);
      return () => {
        this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
      };
    }
  
    public disconnect() {
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }
    }
  }
  
  export const tradingChatService = new TradingChatService();
// app/types/socket.ts
import { Server as NetServer } from 'http'
import { Socket } from 'net'
import { NextApiResponse } from 'next'
import { WebSocket, WebSocketServer } from 'ws'

export interface WebSocketServerIO extends WebSocketServer {
  clients: Set<WebSocket>
}

export interface ServerIO extends NetServer {
  ws?: WebSocketServerIO
}

export interface SocketIOResponse extends NextApiResponse {
  socket: Socket & {
    server: ServerIO;
  }
}

export interface NextApiResponseServerIO extends NextApiResponse {
  socket: Socket & {
    server: ServerIO;
  }
}

export type WebSocketMessage = {
  type: string;
  data?: any;
  error?: string;
}
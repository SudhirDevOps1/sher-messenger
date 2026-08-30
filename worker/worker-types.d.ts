declare interface DurableObjectState {
  id: any;
  storage: any;
  acceptWebSocket(ws: WebSocket): void;
  getWebSockets(tag?: string): WebSocket[];
}

declare interface DurableObjectNamespace {
  idFromName(name: string): any;
  get(id: any): any;
}

declare interface D1Database {
  prepare(query: string): any;
  batch(statements: any[]): Promise<any[]>;
  exec(query: string): Promise<any>;
}

declare interface KVNamespace {
  get(key: string, type?: string): Promise<any>;
  put(key: string, value: string, options?: any): Promise<void>;
  delete(key: string): Promise<void>;
}

declare interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}

declare class WebSocketPair {
  0: WebSocket;
  1: WebSocket;
  [key: number]: WebSocket;
}

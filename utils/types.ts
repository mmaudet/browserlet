// Message types for service worker communication
export type MessageType =
  | 'PING'
  | 'GET_STATE'
  | 'SET_STATE'
  | 'STORAGE_CHANGED';

export interface Message {
  type: MessageType;
  payload?: unknown;
}

export interface PingResponse {
  status: 'ok';
  timestamp: number;
}

export interface AppState {
  version: string;
  firstInstall: number;
  lastActivity: number;
}

export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

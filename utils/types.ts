import type { CapturedAction } from '../entrypoints/content/recording/types';

// Message types for service worker communication
export type MessageType =
  | 'PING'
  | 'GET_STATE'
  | 'SET_STATE'
  | 'STORAGE_CHANGED'
  | 'START_RECORDING'
  | 'STOP_RECORDING'
  | 'RECORDING_STATE_CHANGED'
  | 'ACTION_CAPTURED';

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
  recordingState: 'idle' | 'recording' | 'paused';
  recordedActions: CapturedAction[];
}

// Re-export recording types for convenience
export type { CapturedAction };

export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

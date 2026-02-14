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
  | 'ACTION_CAPTURED'
  // Playback messages
  | 'EXECUTE_SCRIPT'
  | 'STOP_EXECUTION'
  | 'EXECUTION_PROGRESS'
  | 'EXECUTION_COMPLETED'
  | 'EXECUTION_FAILED'
  | 'AUTH_REQUIRED'
  // Execution state persistence (for cross-page navigation)
  | 'SAVE_EXECUTION_STATE'
  | 'GET_EXECUTION_STATE'
  | 'CLEAR_EXECUTION_STATE'
  // LLM messages
  | 'GENERATE_BSL'
  | 'CONFIGURE_LLM'
  | 'GET_LLM_STATUS'
  | 'MICRO_PROMPT_REQUEST'      // Micro-prompt for element resolution (Phase 20)
  // Trigger messages
  | 'CONTEXT_MATCH'
  | 'GET_TRIGGERS'
  | 'SAVE_TRIGGER'
  | 'DELETE_TRIGGER'
  | 'GET_SUGGESTED_SCRIPTS'
  | 'SET_SITE_OVERRIDE'
  | 'TRIGGERS_UPDATED'
  | 'STOP_TRIGGERS'
  // In-page notifications (cross-platform, works on macOS)
  | 'SHOW_AUTO_EXECUTE_NOTIFICATION'
  | 'SHOW_COMPLETION_NOTIFICATION'
  // Password messages
  | 'GET_VAULT_STATE'
  | 'UNLOCK_VAULT'
  | 'LOCK_VAULT'
  | 'GET_PASSWORDS'
  | 'SAVE_PASSWORD'
  | 'SAVE_PASSWORDS'
  | 'DELETE_PASSWORD'
  // Content script password capture (sent directly to content script)
  | 'GET_CAPTURED_PASSWORDS'
  | 'START_PASSWORD_CAPTURE'
  | 'STOP_PASSWORD_CAPTURE'
  // Credential substitution (for content script playback)
  | 'SUBSTITUTE_CREDENTIALS'
  // AI extraction suggestions
  | 'SUGGEST_EXTRACTIONS'
  | 'GET_PAGE_CONTEXT'
  // Screenshot messages
  | 'CAPTURE_SCREENSHOT'          // Content -> Background: request viewport capture
  | 'GET_SCREENSHOTS'             // Sidepanel -> Background: fetch screenshots for script
  | 'DELETE_SCREENSHOT';          // Sidepanel -> Background: delete single screenshot

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

// Script metadata (STOR-04)
export interface Script {
  id: string;                    // UUID
  name: string;                  // Required, display name
  description?: string;          // Optional description
  version: string;               // Semantic version
  target_app?: string;           // Target application name
  author?: string;               // Author name
  tags?: string[];               // Searchable tags
  content: string;               // YAML content (BSL script)
  createdAt: number;             // Timestamp
  updatedAt: number;             // Timestamp
}

// Execution history (STOR-05)
export interface ExecutionRecord {
  id: string;                    // UUID
  scriptId: string;              // Reference to script
  scriptName: string;            // Denormalized for history
  startedAt: number;             // Start timestamp
  completedAt?: number;          // End timestamp (undefined if running)
  status: 'running' | 'completed' | 'failed' | 'stopped';
  currentStep?: number;          // Current step index (for progress)
  totalSteps?: number;           // Total steps in script
  results?: unknown;             // Extracted data
  error?: string;                // Error message if failed
}

// Screenshot record (SHOT-03)
export interface ScreenshotRecord {
  id: string;                    // UUID
  scriptId: string;              // Associated script
  executionId?: string;          // Optional execution record ID
  stepIndex: number;             // Step number (1-based for display)
  timestamp: number;             // Capture time
  pageUrl: string;               // Page URL at capture
  pageTitle: string;             // Page title
  isFailure: boolean;            // True if captured on step failure
  failureReason?: string;        // Error message if failure screenshot
  dataUrl: string;               // PNG data URL (base64)
}

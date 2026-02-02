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
  // Self-healing selector messages
  | 'HEALING_REQUESTED'           // Content -> Background: trigger healing analysis
  | 'HEALING_SUGGESTION'          // Background -> Sidepanel: LLM response ready
  | 'TEST_REPAIR'                 // Sidepanel -> Content: test proposed hints (resolve only)
  | 'TEST_REPAIR_RESULT'          // Content -> Sidepanel: test succeeded/failed
  | 'APPLY_REPAIR'                // Sidepanel -> Background: persist approved repair
  | 'HEALING_APPROVED'            // Background -> Content: resume with new hints
  | 'HEALING_REJECTED'            // Background -> Content: stop healing, fail step
  | 'HIGHLIGHT_HEALING_ELEMENT'   // Sidepanel -> Content: show healing overlay
  | 'GET_HEALING_HISTORY'         // Sidepanel -> Background: fetch audit trail
  | 'UNDO_HEALING';               // Sidepanel -> Background: revert a healing repair

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

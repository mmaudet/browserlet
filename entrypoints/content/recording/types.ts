/**
 * Recording types for capturing user interactions
 */

// Recording state machine
export type RecordingState = 'idle' | 'recording' | 'paused';

// Semantic hint types (10 types from POC)
export type HintType =
  | 'role'
  | 'text_contains'
  | 'type'
  | 'name'
  | 'placeholder_contains'
  | 'aria_label'
  | 'near_label'
  | 'class_contains'
  | 'data_attribute'
  | 'id';

// Captured semantic hint
export interface SemanticHint {
  type: HintType;
  value: string | { name: string; value: string }; // data_attribute uses object
}

// Action types that can be recorded
export type ActionType = 'click' | 'input' | 'navigate' | 'submit';

// A single captured user action
export interface CapturedAction {
  type: ActionType;
  timestamp: number;
  url: string;
  hints: SemanticHint[];
  // For input actions
  value?: string;
  // For navigation
  targetUrl?: string;
  // Frame context
  frameId?: string;
  isIframe: boolean;
}

// Recording session metadata
export interface RecordingSession {
  id: string;
  startTime: number;
  endTime?: number;
  actions: CapturedAction[];
  startUrl: string;
}

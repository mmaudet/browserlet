/**
 * Recording types for capturing user interactions
 *
 * Shared types (SemanticHint, HintType) re-exported from @browserlet/core.
 * Recording-specific types (RecordingState, CapturedAction, RecordingSession, ActionType) kept local.
 */

// Re-export shared types from @browserlet/core
export type { SemanticHint, HintType } from '@browserlet/core/types';
import type { SemanticHint } from '@browserlet/core/types';

// Recording state machine
export type RecordingState = 'idle' | 'recording' | 'paused';

// Action types that can be recorded (DIFFERENT from BSL ActionType)
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
  // Fallback CSS selector for resilience (e.g., href for links)
  fallbackSelector?: string;
}

// Recording session metadata
export interface RecordingSession {
  id: string;
  startTime: number;
  endTime?: number;
  actions: CapturedAction[];
  startUrl: string;
}

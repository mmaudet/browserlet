/**
 * Playback types for BSL script execution
 */

// Re-export SemanticHint from recording for convenience
export type { SemanticHint, HintType } from '../recording/types';
import type { SemanticHint } from '../recording/types';

// BSL action types (8 actions for playback)
export type ActionType =
  | 'click'
  | 'type'
  | 'select'
  | 'extract'
  | 'wait_for'
  | 'navigate'
  | 'scroll'
  | 'hover';

// A single step in a BSL script
export interface BSLStep {
  id?: string;
  action: ActionType;
  target?: {
    intent?: string;
    hints: SemanticHint[];
    fallback_selector?: string;
  };
  value?: string;
  output?: {
    variable: string;
    transform?: string;
  };
  timeout?: string; // e.g., "10s", "30s", "5000ms"
}

// Session check configuration for AUTH requirements
export interface SessionCheckConfig {
  indicator?: { hints: SemanticHint[] };
  absence_indicator?: { hints: SemanticHint[] };
  url_patterns?: string[];
}

// A parsed BSL script ready for execution
export interface ParsedScript {
  name: string;
  steps: BSLStep[];
  metadata?: Record<string, unknown>;
  session_check?: SessionCheckConfig;
}

// Playback state machine
export type PlaybackState = 'idle' | 'running' | 'paused' | 'waiting_auth' | 'stopped';

// Result of script execution
export interface ExecutionResult {
  status: 'completed' | 'failed' | 'stopped';
  step?: number;
  error?: string;
  results?: Record<string, unknown>;
}

// Result of semantic element resolution
export interface ResolverResult {
  element: Element | null;
  confidence: number;
  matchedHints: string[];
  failedHints: string[];
}

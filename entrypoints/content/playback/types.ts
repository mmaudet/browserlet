/**
 * Playback types for BSL script execution
 *
 * Shared types re-exported from @browserlet/core.
 * Playback-runtime types (PlaybackState, ExecutionResult, ResolverResult, PersistedExecutionState) kept local.
 */

// Re-export shared types from @browserlet/core
export type {
  SemanticHint,
  HintType,
  ActionType,
  TransformType,
  OutputConfig,
  TableExtractionResult,
  BSLStep,
  SessionCheckConfig,
  ParsedScript,
} from '@browserlet/core/types';
import type { SemanticHint } from '@browserlet/core/types';

// Playback state machine
export type PlaybackState = 'idle' | 'running' | 'paused' | 'waiting_auth' | 'stopped';

// Result of script execution
export interface ExecutionResult {
  status: 'completed' | 'failed' | 'stopped';
  step?: number;
  error?: string;
  /** @deprecated Use extractedData for extraction results */
  results?: Record<string, unknown>;
  /** Extracted data from extract/table_extract actions, keyed by variable name */
  extractedData?: Record<string, unknown>;
}

// Result of semantic element resolution
export interface ResolverResult {
  element: Element | null;
  confidence: number;
  matchedHints: string[];
  failedHints: string[];
}

// Persisted execution state for cross-page navigation
export interface PersistedExecutionState {
  yamlContent: string;
  currentStep: number;
  results: Record<string, unknown>;
  timestamp: number;
  scriptId?: string;
  executionId?: string;
}

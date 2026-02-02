/**
 * Playback types for BSL script execution
 */

// Re-export SemanticHint from recording for convenience
export type { SemanticHint, HintType } from '../recording/types';
import type { SemanticHint } from '../recording/types';

// BSL action types (10 actions for playback)
export type ActionType =
  | 'click'
  | 'type'
  | 'select'
  | 'extract'
  | 'table_extract'
  | 'wait_for'
  | 'navigate'
  | 'scroll'
  | 'hover'
  | 'screenshot';

// Transform types for extraction
export type TransformType =
  | 'trim'
  | 'lowercase'
  | 'uppercase'
  | 'parse_number'
  | 'parse_currency'
  | 'parse_date'
  | 'extract_number';

// Output configuration for extraction actions
export interface OutputConfig {
  variable: string;           // e.g., "extracted.client_name"
  attribute?: string;         // For extracting href, src, value, data-*
  transform?: TransformType;  // Optional transform to apply
}

// Result of table extraction
export interface TableExtractionResult {
  headers: string[];
  rows: Record<string, string>[];
}

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
  output?: OutputConfig;
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
export type PlaybackState = 'idle' | 'running' | 'paused' | 'waiting_auth' | 'waiting_healing' | 'stopped';

// Context for healing when element resolution fails
export interface HealingContext {
  /** Step index in the script (0-based) */
  stepIndex: number;
  /** Original hints that failed to resolve */
  originalHints: SemanticHint[];
  /** Confidence achieved (< threshold) */
  confidence: number;
  /** Hints that matched */
  matchedHints: string[];
  /** Hints that failed */
  failedHints: string[];
  /** Current page URL */
  pageUrl: string;
  /** Current page title */
  pageTitle: string;
  /** DOM excerpt around expected element location */
  domExcerpt: string;
}

// LLM-suggested repair for failed element resolution
export interface RepairSuggestion {
  /** Proposed semantic hints to try */
  proposedHints: SemanticHint[];
  /** Confidence in this suggestion (0-1) */
  confidence: number;
  /** Explanation of why these hints should work */
  reason: string;
}

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
}

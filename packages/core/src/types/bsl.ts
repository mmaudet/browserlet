/**
 * BSL (Browserlet Scripting Language) type definitions
 *
 * These types define the structure of parsed BSL scripts,
 * shared between the parser (which produces them) and
 * the playback engine (which consumes them).
 */

import type { SemanticHint } from './hints';

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

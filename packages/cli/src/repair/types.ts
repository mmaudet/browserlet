/**
 * Repair data model types
 *
 * Defines the full data model for the auto-repair pipeline:
 * context capture, suggestion ranking, result tracking, and audit history.
 *
 * Phase 30 - Plan 30-01
 */

import type { BSLStep } from '@browserlet/core/types';
import type { SemanticHint } from '@browserlet/core/types';

/** Context captured when cascade resolution fails for a step */
export interface RepairContext {
  scriptPath: string;
  stepIndex: number;
  step: BSLStep;
  failedHints: string[];       // Hint types that failed during cascade
  matchedHints: string[];      // Hint types that matched (partial matches)
  cascadeError: string;        // Error message from CascadeCLIResolver
  domExcerpt: string;          // Captured DOM context (max 600 chars)
  pageUrl: string;             // Current page URL
}

/** A single repair suggestion from the LLM */
export interface RepairSuggestion {
  hints: SemanticHint[];       // Replacement hints
  confidence: number;          // 0.0 - 1.0
  reasoning: string;           // LLM explanation
}

/** Result of a repair attempt for a single step */
export interface RepairResult {
  stepIndex: number;
  originalHints: SemanticHint[];
  suggestions: RepairSuggestion[];  // Sorted by confidence descending
  applied: boolean;                 // Whether repair was applied
  appliedSuggestion?: RepairSuggestion;
}

/** Audit trail entry for a single repair action */
export interface RepairHistoryEntry {
  timestamp: string;           // ISO 8601
  scriptPath: string;
  stepIndex: number;
  stepId?: string;
  originalHints: SemanticHint[];
  appliedHints: SemanticHint[];
  confidence: number;
  reasoning: string;
  pageUrl: string;
}

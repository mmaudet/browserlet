/**
 * Shared repair types for the extension repair workflow
 *
 * Used by the sidepanel repair store and DiagnosticRepairPanel to identify
 * which step to repair, track applied changes, and maintain audit history.
 *
 * Phase 39 - Plan 039-01
 */

import type { SemanticHint } from './hints.js';

/**
 * Identifies which step to repair, what failed, and what the page was doing.
 * Populated by the execution store when EXECUTION_FAILED is received with step info.
 */
export interface RepairTarget {
  scriptId: string;
  scriptContent: string;    // full YAML at the moment of failure
  stepIndex: number;        // 0-based
  stepIntent?: string;      // from step.target.intent
  originalHints: SemanticHint[];
  failedHints: string[];    // hint type strings that scored 0
  matchedHints: string[];   // hint type strings that scored > 0
  pageUrl: string;
  failureReason: string;    // human-readable error from EXECUTION_FAILED payload
}

/**
 * Audit trail entry written to chrome.storage.local["browserlet_repair_history"].
 * Mirrors packages/cli/src/repair/types.ts RepairHistoryEntry, but without
 * the file-system scriptPath (extension uses scriptId instead).
 */
export interface RepairAuditEntry {
  timestamp: string;        // ISO 8601
  scriptId: string;
  stepIndex: number;
  stepIntent?: string;
  originalHints: SemanticHint[];
  appliedHints: SemanticHint[];
  pageUrl: string;
  source: 'dom_suggestion' | 'manual_edit'; // how the repair was produced
}

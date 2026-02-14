/**
 * Trigger types for contextual script execution
 */

import type { SemanticHint } from '@browserlet/core/types';

// Trigger mode: suggest shows in sidepanel, auto_execute runs immediately
export type TriggerMode = 'suggest' | 'auto_execute';

// Condition for element presence detection
export interface ElementCondition {
  hints: SemanticHint[];  // Reuse existing SemanticHint type
  required: boolean;      // All required conditions must match
}

// Trigger condition combining URL and element checks
export interface TriggerCondition {
  url_pattern?: string;           // Wildcard pattern like "*/login*"
  element_present?: ElementCondition;  // Element must be visible
  element_absent?: ElementCondition;   // Element must NOT be visible
}

// Full trigger configuration attached to a script
export interface TriggerConfig {
  id: string;                     // crypto.randomUUID()
  scriptId: string;               // Reference to parent script
  name: string;                   // User-friendly name
  conditions: TriggerCondition[]; // All conditions must match (AND logic)
  mode: TriggerMode;              // suggest or auto_execute
  enabled: boolean;               // Global enable/disable
  cooldownMs?: number;            // Prevent spam for auto_execute (default 300000 = 5 min)
  createdAt: number;              // timestamp
  updatedAt: number;              // timestamp
}

// Per-site override for trigger enable/disable
export interface SiteOverride {
  domain: string;
  enabled: boolean;
  timestamp: number;
}

// Context state result from detection
export interface ContextState {
  matches: boolean;
  reason: string;
  matchedTriggers?: TriggerConfig[];
  url?: string;
  tabId?: number;
}

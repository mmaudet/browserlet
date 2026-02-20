/**
 * Repair store - state management for the diagnostic repair workflow
 *
 * Manages repair target state, DOM-based suggestion fetching, hint application,
 * and audit trail persistence to chrome.storage.local.
 *
 * Phase 39 - Plan 039-01
 */

import { signal } from '@preact/signals';
import type { SemanticHint } from '@browserlet/core/types';
import type { RepairTarget, RepairAuditEntry } from '@browserlet/core/types';
import { updateStepHints } from '@browserlet/core/parser';
import { saveScript } from '../../../utils/storage/scripts';
import { scriptsState, updateScriptInState } from './scripts';

// ---------------------------------------------------------------------------
// Signals
// ---------------------------------------------------------------------------

/** Current repair target — null means repair panel is closed */
export const repairTarget = signal<RepairTarget | null>(null);

/** Status of the repair workflow */
export const repairStatus = signal<'idle' | 'loading_suggestions' | 'applying' | 'done'>('idle');

/** DOM-based suggestion sets from content script (each inner array = one suggestion) */
export const domSuggestions = signal<SemanticHint[][]>([]);

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Open the repair panel for a given target.
 */
export function openRepair(target: RepairTarget): void {
  repairTarget.value = target;
  repairStatus.value = 'idle';
  domSuggestions.value = [];
}

/**
 * Close the repair panel and reset state.
 */
export function closeRepair(): void {
  repairTarget.value = null;
  repairStatus.value = 'idle';
  domSuggestions.value = [];
}

/**
 * Fetch DOM-based alternative hint suggestions from the active tab's content script.
 * Sends DOM_HINT_SUGGEST message and expects { suggestions: SemanticHint[][] } in reply.
 * Gracefully handles missing content script or unresponsive tab.
 */
export async function fetchDOMSuggestions(): Promise<void> {
  if (!repairTarget.value) return;

  repairStatus.value = 'loading_suggestions';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      console.warn('[Repair] No active tab found for DOM suggestions');
      domSuggestions.value = [];
      repairStatus.value = 'idle';
      return;
    }

    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'DOM_HINT_SUGGEST',
      payload: {
        hints: repairTarget.value.originalHints,
        intent: repairTarget.value.stepIntent,
      },
    });

    if (response?.suggestions && Array.isArray(response.suggestions)) {
      domSuggestions.value = response.suggestions;
    } else {
      domSuggestions.value = [];
    }
  } catch (error) {
    // Content script not available, tab closed, chrome:// page, etc.
    console.warn('[Repair] Failed to fetch DOM suggestions:', error);
    domSuggestions.value = [];
  }

  repairStatus.value = 'idle';
}

/**
 * Apply a suggestion (new hints) to the repair target's step.
 * Rewrites the script YAML via updateStepHints, persists via saveScript,
 * updates in-memory state, and records an audit entry.
 *
 * @returns true if the suggestion was applied successfully
 */
export async function applySuggestion(
  newHints: SemanticHint[],
  source: 'dom_suggestion' | 'manual_edit'
): Promise<boolean> {
  const target = repairTarget.value;
  if (!target) return false;

  repairStatus.value = 'applying';

  try {
    // Rewrite YAML with new hints for the failed step
    const newYaml = updateStepHints(target.scriptContent, target.stepIndex, newHints);

    // Find existing script to preserve metadata (name, version, etc.)
    const existing = scriptsState.value.find(s => s.id === target.scriptId);
    if (!existing) {
      console.error('[Repair] Script not found in state:', target.scriptId);
      repairStatus.value = 'idle';
      return false;
    }

    // Persist the updated script
    const savedScript = await saveScript({
      id: existing.id,
      name: existing.name,
      version: existing.version,
      content: newYaml,
      description: existing.description,
      target_app: existing.target_app,
      author: existing.author,
      tags: existing.tags,
    });

    // Update in-memory state
    updateScriptInState(savedScript);

    // Record audit trail
    await saveRepairAudit({
      timestamp: new Date().toISOString(),
      scriptId: target.scriptId,
      stepIndex: target.stepIndex,
      stepIntent: target.stepIntent,
      originalHints: target.originalHints,
      appliedHints: newHints,
      pageUrl: target.pageUrl,
      source,
    });

    // Update repair target with new content so re-run uses updated script
    repairTarget.value = {
      ...target,
      scriptContent: newYaml,
      originalHints: newHints,
    };

    repairStatus.value = 'done';
    return true;
  } catch (error) {
    console.error('[Repair] Failed to apply suggestion:', error);
    repairStatus.value = 'idle';
    return false;
  }
}

/**
 * Persist a repair audit entry to chrome.storage.local["browserlet_repair_history"].
 * Non-fatal: logs errors but never throws.
 */
export async function saveRepairAudit(entry: RepairAuditEntry): Promise<void> {
  try {
    const result = await chrome.storage.local.get('browserlet_repair_history');
    let history: RepairAuditEntry[] = [];

    if (Array.isArray(result.browserlet_repair_history)) {
      history = result.browserlet_repair_history;
    }

    history.push(entry);

    await chrome.storage.local.set({ browserlet_repair_history: history });
    console.log('[Repair] Audit entry saved (' + history.length + ' total)');
  } catch (error) {
    console.error('[Repair] Failed to save audit entry:', error);
    // Non-fatal — do not throw
  }
}

/**
 * Hint preservation audit module
 *
 * Compares recorded CapturedAction hints against generated BSL script steps
 * to detect silently dropped high-weight hints. Only audits hints with
 * HINT_WEIGHTS >= 0.7 (meaningful, stable hints).
 *
 * Used post-generation to warn callers about hint loss that could degrade
 * playback reliability.
 */

import type { CapturedAction } from '../../content/recording/types';
import type { ParsedScript, BSLStep } from '@browserlet/core/types';
import type { HintType, SemanticHint } from '@browserlet/core/types';
import { HINT_WEIGHTS } from '@browserlet/core/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A single hint that was present in a recorded action but absent
 * from the corresponding generated BSL step.
 */
export interface HintLoss {
  /** 0-based index in ParsedScript.steps (after filtering navigate/screenshot) */
  stepIndex: number;
  /** 0-based index in CapturedAction[] (after filtering navigate/screenshot) */
  actionIndex: number;
  /** The hint type that was lost */
  hintType: HintType;
  /** The hint value that was lost */
  hintValue: string | { name: string; value: string };
  /** Weight from HINT_WEIGHTS */
  weight: number;
}

/**
 * Report of hint preservation analysis between recorded actions
 * and generated BSL script.
 */
export interface HintPreservationReport {
  /** Meaningful hints that did not appear in generated BSL */
  losses: HintLoss[];
  /** Number of steps compared (excludes navigate/screenshot) */
  auditedSteps: number;
  /** losses.length shortcut */
  lossCount: number;
  /** losses.length > 0 */
  hasLoss: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum weight threshold for auditing hint preservation */
const MEANINGFUL_HINT_WEIGHT_THRESHOLD = 0.7;

/** Actions that have no hints to compare */
const SKIP_ACTION_TYPES = new Set(['navigate', 'screenshot']);

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Check whether two SemanticHint values are equal.
 * For data_attribute, compares name + value fields.
 * For string values, compares with strict equality.
 */
function hintValuesMatch(
  a: string | { name: string; value: string },
  b: string | { name: string; value: string },
): boolean {
  if (typeof a === 'string' && typeof b === 'string') {
    return a === b;
  }
  if (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null) {
    return a.name === b.name && a.value === b.value;
  }
  return false;
}

/**
 * Check whether a specific hint exists in a hints array.
 */
function hintExistsIn(hint: SemanticHint, hints: SemanticHint[]): boolean {
  return hints.some(
    (h) => h.type === hint.type && hintValuesMatch(h.value, hint.value),
  );
}

/**
 * Get high-weight hints from a SemanticHint array.
 * Returns only hints with HINT_WEIGHTS[type] >= MEANINGFUL_HINT_WEIGHT_THRESHOLD.
 */
function getHighWeightHints(hints: SemanticHint[]): SemanticHint[] {
  return hints.filter((h) => {
    const weight = HINT_WEIGHTS[h.type as HintType] ?? 0;
    return weight >= MEANINGFUL_HINT_WEIGHT_THRESHOLD;
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Audit hint preservation between recorded actions and generated BSL script.
 *
 * Compares each recorded action's high-weight hints (weight >= 0.7) against
 * the corresponding generated BSL step's hints. Reports any meaningful hints
 * that were present in the recording but absent from the generated script.
 *
 * Navigate and screenshot actions/steps are excluded from comparison since
 * they have no target hints.
 *
 * @param actions  Recorded user actions from the recording session
 * @param script   Generated and parsed BSL script
 * @returns Preservation report with any detected hint losses
 */
export function auditHintPreservation(
  actions: CapturedAction[],
  script: ParsedScript,
): HintPreservationReport {
  // Filter out navigate/screenshot from both sides
  const filteredActions = actions.filter(
    (a) => !SKIP_ACTION_TYPES.has(a.type),
  );
  const filteredSteps = script.steps.filter(
    (s) => !SKIP_ACTION_TYPES.has(s.action),
  );

  // Pair by index up to the shorter length
  const pairCount = Math.min(filteredActions.length, filteredSteps.length);

  if (filteredActions.length !== filteredSteps.length) {
    console.warn(
      `[HintPreservationAudit] Action/step count mismatch: ${filteredActions.length} actions vs ${filteredSteps.length} steps. Pairing up to ${pairCount}.`,
    );
  }

  const losses: HintLoss[] = [];

  for (let i = 0; i < pairCount; i++) {
    const action = filteredActions[i]!;
    const step = filteredSteps[i]!;
    const stepHints = step.target?.hints ?? [];

    // Get high-weight hints from the recorded action
    const meaningfulHints = getHighWeightHints(action.hints);

    for (const hint of meaningfulHints) {
      if (!hintExistsIn(hint, stepHints)) {
        losses.push({
          stepIndex: i,
          actionIndex: i,
          hintType: hint.type,
          hintValue: hint.value,
          weight: HINT_WEIGHTS[hint.type as HintType] ?? 0,
        });
      }
    }
  }

  return {
    losses,
    auditedSteps: pairCount,
    lossCount: losses.length,
    hasLoss: losses.length > 0,
  };
}

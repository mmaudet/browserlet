/**
 * Post-generation DOM validation module
 *
 * Compares generated BSL script hints against a DOM snapshot
 * captured during recording. Flags hints whose values were never
 * observed on the page, indicating the LLM may have hallucinated them.
 *
 * The snapshot format is intentionally minimal and forward-compatible
 * with richer Phase 36 (Recording Enrichment) output.
 */

import type { ParsedScript, BSLStep } from '@browserlet/core/types';
import type { SemanticHint, HintType } from '@browserlet/core/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A minimal DOM snapshot captured during recording.
 * Maps hint type to the set of values observed on the page.
 * Forward-compatible with richer Phase 36 output.
 */
export interface DOMSnapshot {
  /** URL of the page when the snapshot was taken */
  url: string;
  /**
   * Observed hint values per hint type.
   * For data_attribute, keys are "data-attrname" and values are the attribute values.
   * For all others, it is a flat string set.
   */
  observedValues: Partial<Record<HintType, string[]>>;
  /** data_attribute entries: { attrName: string; attrValue: string }[] */
  observedDataAttributes?: Array<{ attrName: string; attrValue: string }>;
}

export interface StepValidationResult {
  stepIndex: number;
  action: string;
  hintsChecked: number;
  mismatches: Array<{
    hintType: HintType;
    hintValue: string | { name: string; value: string };
    reason: 'value_not_in_snapshot'; // extend in future phases
  }>;
  /** true if mismatches.length === 0 */
  valid: boolean;
}

export interface GenerationValidationReport {
  /** false if no snapshot was available */
  validated: boolean;
  stepResults: StepValidationResult[];
  invalidStepCount: number;
  totalStepsChecked: number;
  /** true when invalidStepCount > 0 */
  hasIssues: boolean;
}

// ---------------------------------------------------------------------------
// Actions that have no target hints and should be skipped
// ---------------------------------------------------------------------------

const SKIP_ACTIONS = new Set(['navigate', 'screenshot']);

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Check whether a data_attribute hint value matches any entry in the snapshot.
 */
function matchesDataAttribute(
  hintValue: string | { name: string; value: string },
  observed: Array<{ attrName: string; attrValue: string }> | undefined,
): boolean {
  if (!observed || observed.length === 0) return false;

  if (typeof hintValue === 'object' && hintValue !== null) {
    // Structured { name, value } form
    return observed.some(
      (entry) =>
        entry.attrName === hintValue.name &&
        entry.attrValue === hintValue.value,
    );
  }

  // Plain string form — match by attrValue
  return observed.some((entry) => entry.attrValue === hintValue);
}

/**
 * Validate a single hint against the snapshot.
 * Returns true if the hint value was observed, false otherwise.
 */
function isHintObserved(hint: SemanticHint, snapshot: DOMSnapshot): boolean {
  if (hint.type === 'data_attribute') {
    return matchesDataAttribute(hint.value, snapshot.observedDataAttributes);
  }

  const observed = snapshot.observedValues[hint.type];
  if (!observed) return false;
  return observed.includes(hint.value as string);
}

/**
 * Validate a single step's hints against the snapshot.
 */
function validateStep(
  step: BSLStep,
  stepIndex: number,
  snapshot: DOMSnapshot,
): StepValidationResult {
  const hints = step.target?.hints ?? [];
  const mismatches: StepValidationResult['mismatches'] = [];

  for (const hint of hints) {
    if (!isHintObserved(hint, snapshot)) {
      mismatches.push({
        hintType: hint.type,
        hintValue: hint.value,
        reason: 'value_not_in_snapshot',
      });
    }
  }

  return {
    stepIndex,
    action: step.action,
    hintsChecked: hints.length,
    mismatches,
    valid: mismatches.length === 0,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate a generated BSL script against a DOM snapshot.
 *
 * Compares each step's semantic hints against the values that were
 * actually observed on the page during recording. Returns a structured
 * report (never throws) so callers can display warnings without
 * blocking script use.
 *
 * @param script  The parsed BSL script produced by the LLM
 * @param snapshot  The DOM snapshot captured during recording, or null
 * @returns A validation report with per-step results
 */
export function validateGeneratedBSL(
  script: ParsedScript,
  snapshot: DOMSnapshot | null,
): GenerationValidationReport {
  // No snapshot available — cannot validate
  if (snapshot === null) {
    return {
      validated: false,
      stepResults: [],
      invalidStepCount: 0,
      totalStepsChecked: 0,
      hasIssues: false,
    };
  }

  const stepResults: StepValidationResult[] = [];

  for (let i = 0; i < script.steps.length; i++) {
    const step = script.steps[i]!;

    // Skip actions that have no target hints to validate
    if (SKIP_ACTIONS.has(step.action)) continue;

    // Skip steps with no target (defensive)
    if (!step.target) continue;

    stepResults.push(validateStep(step, i, snapshot));
  }

  const invalidStepCount = stepResults.filter((r) => !r.valid).length;

  return {
    validated: true,
    stepResults,
    invalidStepCount,
    totalStepsChecked: stepResults.length,
    hasIssues: invalidStepCount > 0,
  };
}

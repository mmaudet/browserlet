/**
 * StructuralScorer - Computes confidence boosts based on enriched DOM context
 *
 * Purpose: When the base hint-matching score is not high enough for Stage 1 (< 0.85),
 * or when multiple candidates score similarly, StructuralScorer adds confidence boosts
 * based on structural DOM context. A +0.15 fieldset boost can differentiate two identical
 * "Email" inputs in different form sections. This is Stage 2 of the cascade resolver.
 *
 * Pure function module: (DOMContext, SemanticHint[]) -> StructuralBoost with no side effects.
 */

import type { DOMContext } from './domContextExtractor';
import type { SemanticHint } from '@browserlet/core/types';
import { normalizeText } from '../../../utils/hints/text';

/** Structural boost values for each signal type */
export const STRUCTURAL_BOOST_VALUES = {
  FIELDSET_LEGEND: 0.15,   // RSLV-05: fieldset legend match
  ASSOCIATED_LABEL: 0.15,  // RSLV-06: label[for] or aria-labelledby match
  NEAR_LABEL: 0.10,        // RSLV-07: near_label proximity match (max, before distance weighting)
  LANDMARK: 0.10,          // landmark region match
  SECTION_HEADING: 0.08,   // section heading match
} as const;

/** Maximum total structural boost to prevent structural signals from dominating */
const MAX_STRUCTURAL_BOOST = 0.35;

/** Breakdown of which boosts were applied and why */
export interface StructuralBoost {
  /** Total additive boost to apply to raw score */
  total: number;
  /** Breakdown of which boosts were applied and why */
  details: Array<{
    type: 'fieldset' | 'label' | 'near_label' | 'landmark' | 'heading';
    boost: number;
    reason: string;
  }>;
}

/**
 * Extract all string hint values into a flat normalized array.
 * Skips data_attribute objects -- those are structural, not text-based.
 */
function hintValuesToStrings(hints: SemanticHint[]): string[] {
  const values: string[] = [];
  for (const hint of hints) {
    if (typeof hint.value === 'string') {
      const normalized = normalizeText(hint.value);
      if (normalized) values.push(normalized);
    }
  }
  return values;
}

/**
 * Check if any hint value matches the given text (bidirectional includes).
 * Returns the first matching hint value, or null.
 */
function findMatchingHintValue(text: string, hintValues: string[]): string | null {
  const normalizedText = normalizeText(text);
  if (!normalizedText) return null;

  for (const value of hintValues) {
    // Bidirectional: text contains hint value OR hint value contains text
    if (normalizedText.includes(value) || value.includes(normalizedText)) {
      return value;
    }
  }
  return null;
}

/**
 * Compute structural confidence boost for a candidate element.
 *
 * Evaluates each structural signal from DOMContext against the hint set
 * and accumulates additive boosts, capped at MAX_STRUCTURAL_BOOST (0.35).
 */
export function computeStructuralBoost(context: DOMContext, hints: SemanticHint[]): StructuralBoost {
  const details: StructuralBoost['details'] = [];
  let total = 0;

  const hintValues = hintValuesToStrings(hints);

  // Boost 1: Fieldset legend (RSLV-05, +0.15)
  if (context.fieldset_legend) {
    const match = findMatchingHintValue(context.fieldset_legend, hintValues);
    if (match) {
      const boost = STRUCTURAL_BOOST_VALUES.FIELDSET_LEGEND;
      total += boost;
      details.push({
        type: 'fieldset',
        boost,
        reason: `fieldset legend '${context.fieldset_legend}' matches hint '${match}'`,
      });
    }
  }

  // Boost 2: Associated label (RSLV-06, +0.15)
  if (context.associated_label) {
    // Check specifically against near_label, aria_label, and text_contains hints
    const labelHintValues = hints
      .filter(h => h.type === 'near_label' || h.type === 'aria_label' || h.type === 'text_contains')
      .filter((h): h is SemanticHint & { value: string } => typeof h.value === 'string')
      .map(h => normalizeText(h.value));

    // Also check against all hint values for broader matching
    const allValues = [...new Set([...labelHintValues, ...hintValues])];
    const match = findMatchingHintValue(context.associated_label, allValues);
    if (match) {
      const boost = STRUCTURAL_BOOST_VALUES.ASSOCIATED_LABEL;
      total += boost;
      details.push({
        type: 'label',
        boost,
        reason: `associated label '${context.associated_label}' matches hint '${match}'`,
      });
    }
  }

  // Boost 3: Near label proximity (RSLV-07, +0.10 max, weighted by distance)
  if (context.near_label) {
    // Check against near_label, text_contains, and placeholder_contains hints
    const proximityHintValues = hints
      .filter(h => h.type === 'near_label' || h.type === 'text_contains' || h.type === 'placeholder_contains')
      .filter((h): h is SemanticHint & { value: string } => typeof h.value === 'string')
      .map(h => normalizeText(h.value));

    const allValues = [...new Set([...proximityHintValues, ...hintValues])];
    const match = findMatchingHintValue(context.near_label.text, allValues);
    if (match) {
      // Weight by distance: distance 1 gets full 0.10, distance 2 gets ~0.067, distance 3 gets ~0.033
      const distanceWeight = 1 - (context.near_label.distance - 1) / 3;
      const boost = STRUCTURAL_BOOST_VALUES.NEAR_LABEL * distanceWeight;
      total += boost;
      details.push({
        type: 'near_label',
        boost,
        reason: `near label '${context.near_label.text}' at distance ${context.near_label.distance} matches hint '${match}'`,
      });
    }
  }

  // Boost 4: Landmark region (+0.10)
  if (context.landmark) {
    // Check if any hint references the landmark (e.g., role hint matches landmark)
    const landmarkMatch = hints.some(h => {
      if (typeof h.value !== 'string') return false;
      const normalizedValue = normalizeText(h.value);
      const normalizedLandmark = normalizeText(context.landmark!);
      return normalizedValue === normalizedLandmark || normalizedValue.includes(normalizedLandmark);
    });

    // Also check if the landmark name appears in any hint value
    const nameMatch = !landmarkMatch && findMatchingHintValue(context.landmark, hintValues);

    if (landmarkMatch || nameMatch) {
      const boost = STRUCTURAL_BOOST_VALUES.LANDMARK;
      total += boost;
      details.push({
        type: 'landmark',
        boost,
        reason: `landmark '${context.landmark}' matches hint`,
      });
    }
  }

  // Boost 5: Section heading (+0.08)
  if (context.section_heading) {
    const match = findMatchingHintValue(context.section_heading, hintValues);
    if (match) {
      const boost = STRUCTURAL_BOOST_VALUES.SECTION_HEADING;
      total += boost;
      details.push({
        type: 'heading',
        boost,
        reason: `section heading '${context.section_heading}' matches hint '${match}'`,
      });
    }
  }

  // Cap total boost at MAX_STRUCTURAL_BOOST (0.35)
  total = Math.min(total, MAX_STRUCTURAL_BOOST);

  return { total, details };
}

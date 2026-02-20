/**
 * DiagnosticSuggester - Derives fix suggestions from FailureDiagnostic (DIAG-04)
 *
 * Pure function -- deterministic, no LLM, no I/O.
 * Analyzes the diagnostic data to produce a plain-English fix suggestion
 * that helps users repair BSL scripts without re-recording.
 */

import type { FailureDiagnostic } from '@browserlet/core/types';
import { HINT_WEIGHTS } from '@browserlet/core/types';

/**
 * Derive a plain-English fix suggestion from a FailureDiagnostic.
 * Pure function -- deterministic, no LLM, no I/O.
 *
 * Logic:
 * 1. If bestCandidateScore is null (no candidates found at all):
 *    Reference high-weight hints that found no candidates.
 *
 * 2. If there are candidates but confidence gap is large (>= 0.40):
 *    List the high-weight hints that failed across all top candidates.
 *
 * 3. If there are candidates and gap is moderate (0.15-0.39):
 *    Suggest adding disambiguating hints.
 *
 * 4. If gap is small (< 0.15):
 *    Suggest checking low-weight hints or reducing threshold.
 */
export function suggestFix(diagnostic: FailureDiagnostic): string {
  const { bestCandidateScore, confidenceGap, confidenceThreshold, topCandidates, searchedHints } = diagnostic;

  // Case 1: No candidates at all
  if (bestCandidateScore === null || topCandidates.length === 0) {
    const highWeightHints = searchedHints
      .filter(h => {
        const type = h.type as string;
        return (HINT_WEIGHTS as Record<string, number>)[type] >= 0.9;
      })
      .map(h => `${h.type}:${typeof h.value === 'string' ? h.value : `${h.value.name}=${h.value.value}`}`);

    if (highWeightHints.length > 0) {
      return (
        `No elements matched any hint on this page. ` +
        `High-weight hint(s) [${highWeightHints.join(', ')}] found no candidates -- ` +
        `check that the page has fully loaded and that these attribute values still exist in the DOM.`
      );
    }
    return (
      `No elements matched any hint. The page may not have loaded yet, or the page structure ` +
      `has changed significantly. Try adding a 'role' or 'type' hint to anchor the search.`
    );
  }

  const gap = confidenceGap ?? (confidenceThreshold - bestCandidateScore);

  // Find hints that universally failed across all top candidates
  const allHintKeys = topCandidates[0]?.hintScores.map(s => s.hint) ?? [];
  const universallyFailedHints = allHintKeys.filter(hint =>
    topCandidates.every(row => row.hintScores.find(s => s.hint === hint)?.matched === false)
  );

  // High-weight universally-failed hints are the most actionable fix signal
  const failedHighWeightHints = universallyFailedHints.filter(hint => {
    const type = hint.split(':')[0] ?? '';
    return (HINT_WEIGHTS as Record<string, number>)[type] >= 0.8;
  });

  // Case 2: Large gap -- high-weight hints failed
  if (gap >= 0.40 && failedHighWeightHints.length > 0) {
    return (
      `High-weight hint(s) failed across all candidates: [${failedHighWeightHints.join(', ')}]. ` +
      `Best score: ${bestCandidateScore.toFixed(2)} (needed: ${confidenceThreshold.toFixed(2)}). ` +
      `These hints carry the most scoring weight -- verify their values match the current page. ` +
      `The element text, ARIA label, or type attribute may have changed.`
    );
  }

  // Case 3: Moderate gap -- ambiguous, multiple similar candidates
  if (gap >= 0.15) {
    const candidateCount = topCandidates.length;
    return (
      `${candidateCount} candidate(s) found but none reached the confidence threshold ` +
      `(best: ${bestCandidateScore.toFixed(2)}, needed: ${confidenceThreshold.toFixed(2)}, gap: ${gap.toFixed(2)}). ` +
      `Add disambiguating hints such as 'fieldset_context', 'associated_label', or 'near_label' ` +
      `to distinguish the target from similar elements on the page.`
    );
  }

  // Case 4: Small gap -- close but not enough
  return (
    `Best candidate scored ${bestCandidateScore.toFixed(2)} (threshold: ${confidenceThreshold.toFixed(2)}, ` +
    `gap: ${gap.toFixed(2)}). The element was likely found but confidence is just below the threshold. ` +
    `Check that low-weight hints (class_contains, near_label) still apply, or remove hints that ` +
    `no longer match to improve the signal-to-noise ratio.`
  );
}

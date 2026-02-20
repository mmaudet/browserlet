/**
 * Failure diagnostic types for Phase 38 (DIAG-01 through DIAG-05)
 * Shared between resolver bundle (in-browser) and CLI (Node.js).
 * All types must be fully JSON-serializable -- no DOM Element references.
 */

/** Score a single candidate received for a single hint */
export interface DiagnosticHintScore {
  /** e.g., "text_contains:Submit" */
  hint: string;
  /** HINT_WEIGHTS value for this hint type (e.g., 0.8) */
  weight: number;
  /** true if candidate matched this hint */
  matched: boolean;
  /** Weighted contribution: weight if matched, 0 if not */
  contribution: number;
}

/** Snapshot of one candidate element as a human-readable descriptor (no DOM ref) */
export interface CandidateDescriptor {
  /** e.g., "button", "input", "a" */
  tag: string;
  /** Visible text content, trimmed to 80 chars */
  text: string;
  /** Key attributes: id, name, type, role, aria-label, placeholder, class (first 3 tokens) */
  attributes: Record<string, string>;
  /** Structural context: fieldset legend, associated label, landmark, section heading */
  structuralContext: string;
}

/** Per-candidate scoring row (DIAG-01) */
export interface CandidateScoringRow {
  candidate: CandidateDescriptor;
  /** Raw hint-matching confidence (before structural boosts), 0.0-1.0 */
  baseConfidence: number;
  /** Confidence after structural boosts, 0.0-1.0 */
  adjustedConfidence: number;
  /** Score breakdown per hint */
  hintScores: DiagnosticHintScore[];
}

/** Full failure diagnostic produced when cascade resolution cannot find a match */
export interface FailureDiagnostic {
  /** Step identifier from BSL (step.id or step.action) */
  stepId: string;
  /** Original hints the resolver searched for */
  searchedHints: Array<{ type: string; value: string | { name: string; value: string } }>;
  /** Cascade stage reached before failure (1-5) */
  failedAtStage: number;
  /** Confidence threshold required for success */
  confidenceThreshold: number;
  /** Best candidate score achieved, null if no candidates found at all */
  bestCandidateScore: number | null;
  /** Gap: confidenceThreshold - bestCandidateScore, null if no candidates */
  confidenceGap: number | null;
  /** Top candidates evaluated (up to 5), scored against all hints (DIAG-01, DIAG-02) */
  topCandidates: CandidateScoringRow[];
  /** Current page URL at time of failure */
  pageUrl: string;
  /** ISO timestamp */
  timestamp: string;
}

/**
 * Resolver bundle types - Inlined from @browserlet/core to avoid esbuild resolution
 *
 * These types are copied from packages/core/src/types/hints.ts and weights.ts
 * so the resolver bundle can be self-contained for page injection.
 *
 * AUTO-ADAPTED for CLI resolver bundle -- DO NOT import from @browserlet/core
 */

// From packages/core/src/types/hints.ts
export type HintType =
  | 'role'
  | 'text_contains'
  | 'type'
  | 'name'
  | 'placeholder_contains'
  | 'aria_label'
  | 'near_label'
  | 'class_contains'
  | 'data_attribute'
  | 'id'
  | 'fieldset_context'
  | 'associated_label'
  | 'section_context'
  | 'landmark_context'
  | 'position_context';

export interface SemanticHint {
  type: HintType;
  value: string | { name: string; value: string }; // data_attribute uses object
}

// From packages/core/src/types/weights.ts
export const HINT_WEIGHTS: Record<HintType, number> = {
  data_attribute: 1.0,
  role: 1.0,
  type: 1.0,
  aria_label: 0.9,
  name: 0.9,
  id: 0.85,
  text_contains: 0.8,
  placeholder_contains: 0.7,
  fieldset_context: 0.7,
  associated_label: 0.7,
  landmark_context: 0.65,
  section_context: 0.6,
  near_label: 0.6,
  position_context: 0.55,
  class_contains: 0.5,
};

// From entrypoints/content/playback/types.ts
export interface ResolverResult {
  element: Element | null;
  confidence: number;
  matchedHints: string[];
  failedHints: string[];
}

// Simplified micro-prompt types -- only fields actually used by cascadeResolver.ts
// From entrypoints/background/llm/microPromptBuilder.ts

export interface HintSuggesterInput {
  original_hints: SemanticHint[];
  dom_excerpt: string;
  page_url: string;
  action_type: string;
}

export interface DisambiguatorInput {
  candidates: Array<{
    index: number;
    tag: string;
    text: string;
    attributes: Record<string, string>;
    structural_context: string;
  }>;
  original_hints: SemanticHint[];
  action_type: string;
  action_value?: string;
}

export interface ConfidenceBoosterInput {
  candidate: {
    tag: string;
    text: string;
    attributes: Record<string, string>;
    structural_context: string;
  };
  original_hints: SemanticHint[];
  matched_hints: string[];
  failed_hints: string[];
  confidence: number;
}

export type MicroPromptInput =
  | { type: 'hint_suggester'; data: HintSuggesterInput }
  | { type: 'disambiguator'; data: DisambiguatorInput }
  | { type: 'confidence_booster'; data: ConfidenceBoosterInput };

export interface HintSuggesterOutput {
  suggested_hints: SemanticHint[];
  reasoning: string;
}

export interface DisambiguatorOutput {
  selected_index: number;
  confidence: number;
  reasoning: string;
}

export interface ConfidenceBoosterOutput {
  is_correct: boolean;
  reasoning: string;
}

// ---------------------------------------------------------------------------
// Diagnostic types -- Copied from packages/core/src/types/diagnostic.ts -- keep in sync
// ---------------------------------------------------------------------------

/** Score a single candidate received for a single hint */
export interface DiagnosticHintScore {
  hint: string;
  weight: number;
  matched: boolean;
  contribution: number;
}

/** Snapshot of one candidate element as a human-readable descriptor (no DOM ref) */
export interface CandidateDescriptor {
  tag: string;
  text: string;
  attributes: Record<string, string>;
  structuralContext: string;
}

/** Per-candidate scoring row (DIAG-01) */
export interface CandidateScoringRow {
  candidate: CandidateDescriptor;
  baseConfidence: number;
  adjustedConfidence: number;
  hintScores: DiagnosticHintScore[];
}

/** In-browser partial diagnostic -- stepId and pageUrl added by CLI caller */
export interface PartialFailureDiagnostic {
  failedAtStage: number;
  confidenceThreshold: number;
  bestCandidateScore: number | null;
  confidenceGap: number | null;
  topCandidates: CandidateScoringRow[];
}

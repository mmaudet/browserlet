/**
 * @browserlet/core type exports
 *
 * Shared type definitions for BSL scripts, semantic hints,
 * parsed script structures, and hint weights.
 */

export type { SemanticHint, HintType } from './hints.js';
export type {
  ActionType,
  TransformType,
  OutputConfig,
  TableExtractionResult,
  BSLStep,
  SessionCheckConfig,
  SessionPersistenceConfig,
  ParsedScript,
} from './bsl.js';
export { HINT_WEIGHTS } from './weights.js';
export type { FailureDiagnostic, CandidateScoringRow, CandidateDescriptor, DiagnosticHintScore } from './diagnostic.js';

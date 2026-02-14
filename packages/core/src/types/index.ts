/**
 * @browserlet/core type exports
 *
 * Shared type definitions for BSL scripts, semantic hints,
 * parsed script structures, and hint weights.
 */

export type { SemanticHint, HintType } from './hints';
export type {
  ActionType,
  TransformType,
  OutputConfig,
  TableExtractionResult,
  BSLStep,
  SessionCheckConfig,
  ParsedScript,
} from './bsl';
export { HINT_WEIGHTS } from './weights';

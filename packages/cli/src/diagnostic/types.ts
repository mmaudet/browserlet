/**
 * CLI-side diagnostic types (Phase 38)
 * Imports FailureDiagnostic from core and extends for presentation layer.
 */
import type { FailureDiagnostic } from '@browserlet/core/types';

export type { FailureDiagnostic };

/** Full diagnostic report ready for formatting -- adds fix suggestion */
export interface DiagnosticReport {
  diagnostic: FailureDiagnostic;
  /** Plain-English fix suggestion derived by DiagnosticSuggester */
  suggestion: string;
}

/**
 * BSL file updater for auto-repair
 *
 * Applies repair suggestions by updating hints in a BSL script file on disk.
 * Leverages the existing updateStepHints function from @browserlet/core/parser
 * which handles YAML parsing, hint replacement, and re-serialization.
 *
 * Phase 30 - Plan 30-02
 */

import fs from 'node:fs';
import { updateStepHints } from '@browserlet/core/parser';
import type { SemanticHint } from '@browserlet/core/types';

/**
 * Apply a repair by updating hints in a BSL script file on disk.
 *
 * Reads the file, calls updateStepHints from core parser (which handles
 * YAML re-serialization), and writes the result back to disk.
 *
 * @param scriptPath - Absolute path to the .bsl file
 * @param stepIndex - Zero-based index of the step to update
 * @param newHints - Replacement hints from repair suggestion
 * @returns true if file was updated, false on error
 */
export function applyRepair(
  scriptPath: string,
  stepIndex: number,
  newHints: SemanticHint[],
): boolean {
  try {
    const content = fs.readFileSync(scriptPath, 'utf-8');
    const updated = updateStepHints(content, stepIndex, newHints);
    fs.writeFileSync(scriptPath, updated, 'utf-8');
    console.log(`[RepairApplier] Updated ${scriptPath} step ${stepIndex + 1} with ${newHints.length} new hints`);
    return true;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[RepairApplier] Failed to update ${scriptPath}: ${msg}`);
    return false;
  }
}

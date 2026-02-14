/**
 * Repair history logger for audit trail
 *
 * Appends repair entries to a JSON file in the same directory as
 * the script being repaired. Non-fatal: never blocks execution
 * if history write fails.
 *
 * Phase 30 - Plan 30-02
 */

import fs from 'node:fs';
import path from 'node:path';
import type { RepairHistoryEntry } from './types.js';

const HISTORY_FILENAME = '.browserlet-repair-history.json';

/**
 * RepairHistoryLogger appends repair entries to a JSON file
 * in the same directory as the script being repaired.
 */
export class RepairHistoryLogger {
  private historyPath: string;

  /**
   * @param scriptPath - Path to the .bsl file being repaired.
   *   History file is created in the same directory.
   */
  constructor(scriptPath: string) {
    const dir = path.dirname(path.resolve(scriptPath));
    this.historyPath = path.join(dir, HISTORY_FILENAME);
  }

  /**
   * Append a repair entry to the history file.
   * Creates the file if it doesn't exist. Appends to existing array.
   */
  logRepair(entry: RepairHistoryEntry): void {
    try {
      let history: RepairHistoryEntry[] = [];

      if (fs.existsSync(this.historyPath)) {
        const raw = fs.readFileSync(this.historyPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          history = parsed;
        }
      }

      history.push(entry);

      fs.writeFileSync(
        this.historyPath,
        JSON.stringify(history, null, 2),
        'utf-8',
      );

      console.log(`[RepairHistory] Logged repair to ${this.historyPath} (${history.length} total entries)`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[RepairHistory] Failed to log repair: ${msg}`);
      // Non-fatal: don't block execution if history write fails
    }
  }
}

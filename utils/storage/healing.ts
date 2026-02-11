/**
 * Healing audit trail storage
 * Tracks all repairs applied to scripts for undo capability
 * Follows pattern established by history.ts
 */

import { storage } from './browserCompat';
import type { SemanticHint } from '../../entrypoints/content/playback/types';

const HEALING_PREFIX = 'browserlet_healing_';
const MAX_HEALING_PER_SCRIPT = 100;

/**
 * Record of a repair applied to a script step
 */
export interface HealingRecord {
  /** Unique identifier (UUID) */
  id: string;
  /** Script ID the repair was applied to */
  scriptId: string;
  /** Script name for display (denormalized) */
  scriptName: string;
  /** Step index in the script (0-based) */
  stepIndex: number;
  /** Original hints that failed */
  originalHints: SemanticHint[];
  /** New hints that replaced the original */
  newHints: SemanticHint[];
  /** Confidence score from LLM (0-1) */
  confidence: number;
  /** Explanation from LLM for the repair */
  reason: string;
  /** Who approved the repair (always 'user' for now) */
  approvedBy: 'user';
  /** Timestamp when repair was approved */
  approvedAt: number;
  /** Page URL where the repair was made */
  pageUrl: string;
  /** Timestamp when repair was undone (if undone) */
  undoneAt?: number;
}

/**
 * Get storage key for a script's healing history
 */
function healingKey(scriptId: string): string {
  return `${HEALING_PREFIX}${scriptId}`;
}

/**
 * Get healing history for a script (most recent first)
 * @param scriptId - Script ID to get history for
 * @returns Array of healing records, sorted by approvedAt descending
 */
export async function getHealingHistory(scriptId: string): Promise<HealingRecord[]> {
  const key = healingKey(scriptId);
  const result = await storage.local.get(key);
  const records = (result[key] as HealingRecord[] | undefined) ?? [];
  // Ensure sorted by approvedAt descending (most recent first)
  return records.sort((a, b) => b.approvedAt - a.approvedAt);
}

/**
 * Add a healing record (caps at MAX_HEALING_PER_SCRIPT per script)
 * @param record - Healing record without id (will be generated)
 * @returns The created record with id
 */
export async function addHealingRecord(
  record: Omit<HealingRecord, 'id'>
): Promise<HealingRecord> {
  const key = healingKey(record.scriptId);
  const history = await getHealingHistory(record.scriptId);

  const newRecord: HealingRecord = {
    ...record,
    id: crypto.randomUUID()
  };

  // Prepend new record, cap at MAX_HEALING_PER_SCRIPT
  const updated = [newRecord, ...history].slice(0, MAX_HEALING_PER_SCRIPT);
  await storage.local.set({ [key]: updated });

  console.log('[Browserlet] Added healing record:', newRecord.id, 'for script:', record.scriptId);
  return newRecord;
}

/**
 * Mark a healing record as undone
 * @param scriptId - Script ID
 * @param recordId - Healing record ID to mark as undone
 */
export async function markHealingUndone(
  scriptId: string,
  recordId: string
): Promise<void> {
  const key = healingKey(scriptId);
  const history = await getHealingHistory(scriptId);

  const index = history.findIndex(r => r.id === recordId);
  if (index >= 0) {
    const record = history[index];
    if (record && !record.undoneAt) {
      history[index] = { ...record, undoneAt: Date.now() };
      await storage.local.set({ [key]: history });
      console.log('[Browserlet] Marked healing undone:', recordId);
    }
  }
}

/**
 * Clear all healing history for a script
 * @param scriptId - Script ID to clear history for
 */
export async function clearHealingHistory(scriptId: string): Promise<void> {
  const key = healingKey(scriptId);
  await storage.local.remove(key);
  console.log('[Browserlet] Cleared healing history for script:', scriptId);
}

import { storage } from './browserCompat';
import type { ExecutionRecord } from '../types';

const HISTORY_PREFIX = 'browserlet_history_';
const MAX_HISTORY_PER_SCRIPT = 50;

// Get history key for a script
function historyKey(scriptId: string): string {
  return `${HISTORY_PREFIX}${scriptId}`;
}

// Get execution history for a script (most recent first)
export async function getExecutionHistory(scriptId: string): Promise<ExecutionRecord[]> {
  const key = historyKey(scriptId);
  const result = await storage.local.get(key);
  return (result[key] as ExecutionRecord[] | undefined) ?? [];
}

// Add execution record (caps at 50 per script)
export async function addExecutionRecord(record: Omit<ExecutionRecord, 'id'>): Promise<ExecutionRecord> {
  const key = historyKey(record.scriptId);
  const history = await getExecutionHistory(record.scriptId);

  const newRecord: ExecutionRecord = {
    ...record,
    id: crypto.randomUUID()
  };

  // Prepend new record, cap at MAX_HISTORY
  const updated = [newRecord, ...history].slice(0, MAX_HISTORY_PER_SCRIPT);
  await storage.local.set({ [key]: updated });

  return newRecord;
}

// Update execution record (for status changes during execution)
export async function updateExecutionRecord(
  scriptId: string,
  recordId: string,
  updates: Partial<ExecutionRecord>
): Promise<void> {
  const key = historyKey(scriptId);
  const history = await getExecutionHistory(scriptId);

  const index = history.findIndex(r => r.id === recordId);
  if (index >= 0) {
    const existing = history[index];
    if (existing) {
      history[index] = { ...existing, ...updates };
      await storage.local.set({ [key]: history });
    }
  }
}

// Clear history for a script
export async function clearExecutionHistory(scriptId: string): Promise<void> {
  const key = historyKey(scriptId);
  await storage.local.remove(key);
}

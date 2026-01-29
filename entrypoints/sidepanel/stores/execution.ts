import van from 'vanjs-core';
import type { Script, ExecutionRecord } from '../../../utils/types';
import { addExecutionRecord, updateExecutionRecord } from '../../../utils/storage/history';

// Execution state
export const isExecuting = van.state(false);
export const currentScript = van.state<Script | null>(null);
export const currentStep = van.state(0);
export const totalSteps = van.state(0);
export const executionStatus = van.state<'idle' | 'running' | 'completed' | 'failed' | 'stopped'>('idle');
export const executionResults = van.state<unknown[]>([]);
export const executionError = van.state<string | null>(null);
export const currentRecordId = van.state<string | null>(null);

// Progress percentage derived
export const progressPercent = van.derive(() => {
  if (totalSteps.val === 0) return 0;
  return Math.round((currentStep.val / totalSteps.val) * 100);
});

// Start execution (placeholder - actual execution in Phase 4)
export async function startExecution(script: Script): Promise<void> {
  isExecuting.val = true;
  currentScript.val = script;
  currentStep.val = 0;
  executionStatus.val = 'running';
  executionResults.val = [];
  executionError.val = null;

  // Parse steps from script content to get total
  // For now, use placeholder count
  totalSteps.val = 10; // Will be parsed from script.content in Phase 4

  // Create execution record
  const record = await addExecutionRecord({
    scriptId: script.id,
    scriptName: script.name,
    startedAt: Date.now(),
    status: 'running',
    currentStep: 0,
    totalSteps: totalSteps.val
  });
  currentRecordId.val = record.id;
}

// Update progress (called by execution engine in Phase 4)
export async function updateProgress(step: number, result?: unknown): Promise<void> {
  currentStep.val = step;

  if (result !== undefined) {
    executionResults.val = [...executionResults.val, result];
  }

  // Update record
  if (currentRecordId.val && currentScript.val) {
    await updateExecutionRecord(currentScript.val.id, currentRecordId.val, {
      currentStep: step,
      status: 'running'
    });
  }
}

// Complete execution
export async function completeExecution(results?: unknown): Promise<void> {
  isExecuting.val = false;
  executionStatus.val = 'completed';
  currentStep.val = totalSteps.val;

  if (results !== undefined) {
    executionResults.val = Array.isArray(results) ? results : [results];
  }

  if (currentRecordId.val && currentScript.val) {
    await updateExecutionRecord(currentScript.val.id, currentRecordId.val, {
      status: 'completed',
      completedAt: Date.now(),
      results: executionResults.val
    });
  }
}

// Fail execution
export async function failExecution(error: string): Promise<void> {
  isExecuting.val = false;
  executionStatus.val = 'failed';
  executionError.val = error;

  if (currentRecordId.val && currentScript.val) {
    await updateExecutionRecord(currentScript.val.id, currentRecordId.val, {
      status: 'failed',
      completedAt: Date.now(),
      error
    });
  }
}

// Stop execution (user requested)
export async function stopExecution(): Promise<void> {
  isExecuting.val = false;
  executionStatus.val = 'stopped';

  if (currentRecordId.val && currentScript.val) {
    await updateExecutionRecord(currentScript.val.id, currentRecordId.val, {
      status: 'stopped',
      completedAt: Date.now()
    });
  }
}

// Reset to idle
export function resetExecution(): void {
  isExecuting.val = false;
  currentScript.val = null;
  currentStep.val = 0;
  totalSteps.val = 0;
  executionStatus.val = 'idle';
  executionResults.val = [];
  executionError.val = null;
  currentRecordId.val = null;
}

import { signal, computed } from '@preact/signals';
import type { Script, ExecutionRecord } from '../../../utils/types';
import { addExecutionRecord, updateExecutionRecord } from '../../../utils/storage/history';
import { parseSteps } from '../../../utils/yaml/stepParser';

// Execution state
export const isExecuting = signal(false);
export const currentScript = signal<Script | null>(null);
export const currentStep = signal(0);
export const totalSteps = signal(0);
export const executionStatus = signal<'idle' | 'running' | 'completed' | 'failed' | 'stopped' | 'waiting_auth'>('idle');
export const executionResults = signal<unknown[]>([]);
export const executionError = signal<string | null>(null);
export const currentRecordId = signal<string | null>(null);

// Progress percentage derived
export const progressPercent = computed(() => {
  if (totalSteps.value === 0) return 0;
  return Math.round((currentStep.value / totalSteps.value) * 100);
});

// Start execution - sends EXECUTE_SCRIPT to content script
export async function startExecution(script: Script): Promise<void> {
  // Parse script to get accurate step count
  let stepCount = 0;
  try {
    const parsed = parseSteps(script.content);
    stepCount = parsed.steps.length;
  } catch (error) {
    console.error('[Browserlet] Failed to parse script:', error);
    // Use a default if parsing fails
    stepCount = 1;
  }

  isExecuting.value = true;
  currentScript.value = script;
  currentStep.value = 0;
  totalSteps.value = stepCount;
  executionStatus.value = 'running';
  executionResults.value = [];
  executionError.value = null;

  // Create execution record
  const record = await addExecutionRecord({
    scriptId: script.id,
    scriptName: script.name,
    startedAt: Date.now(),
    status: 'running',
    currentStep: 0,
    totalSteps: stepCount
  });
  currentRecordId.value = record.id;

  // Send to content script for execution
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    try {
      await chrome.tabs.sendMessage(tab.id, {
        type: 'EXECUTE_SCRIPT',
        payload: { content: script.content }
      });
    } catch (error) {
      console.error('[Browserlet] Failed to send execute message:', error);
      await failExecution('Failed to communicate with page');
    }
  } else {
    await failExecution('No active tab found');
  }
}

// Update progress (called by execution engine in Phase 4)
export async function updateProgress(step: number, result?: unknown): Promise<void> {
  currentStep.value = step;

  if (result !== undefined) {
    executionResults.value = [...executionResults.value, result];
  }

  // Update record
  if (currentRecordId.value && currentScript.value) {
    await updateExecutionRecord(currentScript.value.id, currentRecordId.value, {
      currentStep: step,
      status: 'running'
    });
  }
}

// Complete execution
export async function completeExecution(results?: unknown): Promise<void> {
  isExecuting.value = false;
  executionStatus.value = 'completed';
  currentStep.value = totalSteps.value;

  if (results !== undefined) {
    executionResults.value = Array.isArray(results) ? results : [results];
  }

  if (currentRecordId.value && currentScript.value) {
    await updateExecutionRecord(currentScript.value.id, currentRecordId.value, {
      status: 'completed',
      completedAt: Date.now(),
      results: executionResults.value
    });
  }
}

// Fail execution
export async function failExecution(error: string): Promise<void> {
  isExecuting.value = false;
  executionStatus.value = 'failed';
  executionError.value = error;

  if (currentRecordId.value && currentScript.value) {
    await updateExecutionRecord(currentScript.value.id, currentRecordId.value, {
      status: 'failed',
      completedAt: Date.now(),
      error
    });
  }
}

// Stop execution (user requested) - sends STOP_EXECUTION to content script
export async function stopExecution(): Promise<void> {
  // Send stop message to content script
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'STOP_EXECUTION' });
    } catch (error) {
      console.error('[Browserlet] Failed to send stop message:', error);
    }
  }

  isExecuting.value = false;
  executionStatus.value = 'stopped';

  if (currentRecordId.value && currentScript.value) {
    await updateExecutionRecord(currentScript.value.id, currentRecordId.value, {
      status: 'stopped',
      completedAt: Date.now()
    });
  }
}

// Reset to idle
export function resetExecution(): void {
  isExecuting.value = false;
  currentScript.value = null;
  currentStep.value = 0;
  totalSteps.value = 0;
  executionStatus.value = 'idle';
  executionResults.value = [];
  executionError.value = null;
  currentRecordId.value = null;
}

// Listen for execution events from content script
chrome.runtime.onMessage.addListener((message) => {
  switch (message.type) {
    case 'EXECUTION_PROGRESS': {
      const { step, totalSteps: total } = message.payload || {};
      if (typeof step === 'number') {
        currentStep.value = step;
      }
      if (typeof total === 'number') {
        totalSteps.value = total;
      }
      // Update record
      if (currentRecordId.value && currentScript.value && typeof step === 'number') {
        updateExecutionRecord(currentScript.value.id, currentRecordId.value, {
          currentStep: step,
          status: 'running'
        });
      }
      break;
    }

    case 'EXECUTION_COMPLETED': {
      const results = message.payload?.results;
      completeExecution(results);
      break;
    }

    case 'EXECUTION_FAILED': {
      const error = message.payload?.error || 'Execution failed';
      const step = message.payload?.step;
      console.log('[Browserlet] Execution failed:', { error, step, payload: message.payload });
      // Update step if provided
      if (typeof step === 'number') {
        currentStep.value = step;
      }
      failExecution(error);
      break;
    }

    case 'AUTH_REQUIRED': {
      executionStatus.value = 'waiting_auth';
      break;
    }
  }
});

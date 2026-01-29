import van from 'vanjs-core';
import type { Script, ExecutionRecord } from '../../../utils/types';
import { addExecutionRecord, updateExecutionRecord } from '../../../utils/storage/history';
import { parseSteps } from '../../../utils/yaml/stepParser';

// Execution state
export const isExecuting = van.state(false);
export const currentScript = van.state<Script | null>(null);
export const currentStep = van.state(0);
export const totalSteps = van.state(0);
export const executionStatus = van.state<'idle' | 'running' | 'completed' | 'failed' | 'stopped' | 'waiting_auth'>('idle');
export const executionResults = van.state<unknown[]>([]);
export const executionError = van.state<string | null>(null);
export const currentRecordId = van.state<string | null>(null);

// Progress percentage derived
export const progressPercent = van.derive(() => {
  if (totalSteps.val === 0) return 0;
  return Math.round((currentStep.val / totalSteps.val) * 100);
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

  isExecuting.val = true;
  currentScript.val = script;
  currentStep.val = 0;
  totalSteps.val = stepCount;
  executionStatus.val = 'running';
  executionResults.val = [];
  executionError.val = null;

  // Create execution record
  const record = await addExecutionRecord({
    scriptId: script.id,
    scriptName: script.name,
    startedAt: Date.now(),
    status: 'running',
    currentStep: 0,
    totalSteps: stepCount
  });
  currentRecordId.val = record.id;

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

// Listen for execution events from content script
chrome.runtime.onMessage.addListener((message) => {
  switch (message.type) {
    case 'EXECUTION_PROGRESS': {
      const { step, totalSteps: total } = message.payload || {};
      if (typeof step === 'number') {
        currentStep.val = step;
      }
      if (typeof total === 'number') {
        totalSteps.val = total;
      }
      // Update record
      if (currentRecordId.val && currentScript.val && typeof step === 'number') {
        updateExecutionRecord(currentScript.val.id, currentRecordId.val, {
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
      failExecution(error);
      break;
    }

    case 'AUTH_REQUIRED': {
      executionStatus.val = 'waiting_auth';
      break;
    }
  }
});

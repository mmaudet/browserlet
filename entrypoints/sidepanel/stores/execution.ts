import { signal, computed } from '@preact/signals';
import type { Script, ExecutionRecord } from '../../../utils/types';
import { addExecutionRecord, updateExecutionRecord } from '../../../utils/storage/history';
import { parseSteps } from '@browserlet/core/parser';

// Execution state
export const isExecuting = signal(false);
export const currentScript = signal<Script | null>(null);
export const currentStep = signal(0);
export const totalSteps = signal(0);
export const executionStatus = signal<'idle' | 'running' | 'completed' | 'failed' | 'stopped' | 'waiting_auth'>('idle');
export const executionResults = signal<unknown[]>([]);
export const executionError = signal<string | null>(null);
export const currentRecordId = signal<string | null>(null);
export const showCompletionModal = signal(false);
export const completedScriptName = signal<string | null>(null);

// Progress percentage derived
export const progressPercent = computed(() => {
  if (totalSteps.value === 0) return 0;
  return Math.round((currentStep.value / totalSteps.value) * 100);
});

// Start execution - sends EXECUTE_SCRIPT to content script
export async function startExecution(script: Script): Promise<void> {
  console.log('[Browserlet] startExecution called with script:', script.name);
  // Parse script to get accurate step count
  let stepCount = 0;
  try {
    const parsed = parseSteps(script.content);
    stepCount = parsed.steps.length;
    console.log('[Browserlet] Parsed script, step count:', stepCount);
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

  console.log('[Browserlet] Creating execution record...');
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
  console.log('[Browserlet] Execution record created:', record.id);

  // Send to content script for execution
  console.log('[Browserlet] Querying active tab...');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  console.log('[Browserlet] Active tab:', tab?.id, tab?.url);
  if (tab?.id) {
    // Session restore: if session persistence is enabled, restore before playback
    if (script.sessionPersistence?.enabled && tab.url) {
      try {
        const domain = new URL(tab.url).hostname;
        console.log('[Browserlet] Restoring session for', domain);
        const response = await chrome.runtime.sendMessage({
          type: 'RESTORE_SESSION',
          payload: {
            scriptId: script.id,
            domain,
            tabId: tab.id
          }
        });
        if (response?.success && response.data?.restored) {
          console.log('[Browserlet] Session restored for', domain);
        } else {
          console.log('[Browserlet] No session to restore for', domain);
        }
      } catch (err) {
        // Non-fatal: session restore failure should not block execution
        console.warn('[Browserlet] Session restore failed (non-fatal):', err);
      }
    }

    try {
      console.log('[Browserlet] Sending EXECUTE_SCRIPT to tab', tab.id);
      await chrome.tabs.sendMessage(tab.id, {
        type: 'EXECUTE_SCRIPT',
        payload: {
          content: script.content,
          scriptId: script.id,
          executionId: currentRecordId.value
        }
      });
      console.log('[Browserlet] EXECUTE_SCRIPT sent successfully');
    } catch (error) {
      console.error('[Browserlet] Failed to send execute message:', error);
      // Provide helpful error message with reload suggestion
      const errorMsg = chrome.i18n.getMessage('failedCommunicatePage') ||
        'Failed to communicate with page. Please reload the page (Ctrl+R / Cmd+R) and try again.';
      await failExecution(errorMsg);
    }
  } else {
    console.error('[Browserlet] No active tab found');
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
  console.log('[Browserlet] completeExecution called with results:', results);
  const script = currentScript.value;
  isExecuting.value = false;
  executionStatus.value = 'completed';
  currentStep.value = totalSteps.value;

  // Show completion modal
  completedScriptName.value = script?.name || null;
  showCompletionModal.value = true;

  // Results from PlaybackManager are already a Record<string, unknown>
  // Don't wrap in array - store as-is for proper display in ExtractedDataModal
  if (results !== undefined) {
    // For display purposes, keep as array for backward compatibility
    executionResults.value = Array.isArray(results) ? results : [results];
  }

  if (currentRecordId.value && script) {
    console.log('[Browserlet] Saving results to record:', { recordId: currentRecordId.value, results });
    await updateExecutionRecord(script.id, currentRecordId.value, {
      status: 'completed',
      completedAt: Date.now(),
      currentStep: totalSteps.value, // Update to final step count
      // Store results directly as object, not wrapped in array
      results: results as Record<string, unknown>
    });
  }

  // Session capture: if execution succeeded and session persistence enabled, capture session
  if (script?.sessionPersistence?.enabled) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id && tab.url) {
        const domain = new URL(tab.url).hostname;
        await chrome.runtime.sendMessage({
          type: 'CAPTURE_SESSION',
          payload: {
            scriptId: script.id,
            tabId: tab.id
          }
        });
        console.log('[Browserlet] Session captured for', domain);
      }
    } catch (err) {
      // Non-fatal: session capture failure should not affect execution result
      console.warn('[Browserlet] Session capture failed (non-fatal):', err);
    }
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
      console.log('[Browserlet] EXECUTION_COMPLETED received:', { payload: message.payload, results });
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

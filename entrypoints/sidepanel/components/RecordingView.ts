import van from 'vanjs-core';

const { div, button, span } = van.tags;

// Recording state (synced with storage)
export const isRecording = van.state(false);
export const recordedActions = van.state<Array<{
  type: string;
  timestamp: number;
  url: string;
  hints: Array<{ type: string; value: unknown }>;
  value?: string;
}>>([]);

// Load state from storage
async function loadRecordingState(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
    if (response.success && response.data) {
      isRecording.val = response.data.recordingState === 'recording';
      recordedActions.val = response.data.recordedActions || [];
    }
  } catch (error) {
    console.error('Failed to load recording state:', error);
  }
}

// Listen for state changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.appState) {
    const state = changes.appState.newValue as {
      recordingState?: string;
      recordedActions?: typeof recordedActions.val;
    } | undefined;
    isRecording.val = state?.recordingState === 'recording';
    recordedActions.val = state?.recordedActions || [];
  }
});

export async function toggleRecording(): Promise<void> {
  try {
    if (isRecording.val) {
      await chrome.runtime.sendMessage({ type: 'STOP_RECORDING' });
    } else {
      await chrome.runtime.sendMessage({
        type: 'SET_STATE',
        payload: { recordedActions: [] }
      });
      await chrome.runtime.sendMessage({ type: 'START_RECORDING' });
    }
  } catch (error) {
    console.error('Failed to toggle recording:', error);
  }
}

function ActionItem({ action }: { action: typeof recordedActions.val[0] }) {
  const hint = action.hints[0];
  const hintText = hint
    ? `${hint.type}: ${typeof hint.value === 'string' ? hint.value : JSON.stringify(hint.value)}`
    : '';
  const valueText = action.value
    ? ` = "${action.value.substring(0, 30)}${action.value.length > 30 ? '...' : ''}"`
    : '';

  return div({
    style: 'padding: 8px; border-bottom: 1px solid #f0f0f0;'
  },
    span({
      style: 'font-weight: 500; color: #333; text-transform: uppercase; font-size: 10px;'
    }, action.type),
    div({
      style: 'margin-top: 4px; font-size: 12px; color: #888; word-break: break-all;'
    }, hintText + valueText)
  );
}

export function RecordingView() {
  // Load initial state
  loadRecordingState();

  return div({ style: 'padding: 16px;' },
    // Recording status
    div({
      style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;'
    },
      span({ style: 'font-weight: 500;' },
        chrome.i18n.getMessage('recording') || 'Recording'
      ),
      span({
        style: () => `font-size: 12px; padding: 4px 8px; border-radius: 4px; ${
          isRecording.val
            ? 'background: #ffebee; color: #c62828;'
            : 'background: #e8f5e9; color: #2e7d32;'
        }`
      }, () => isRecording.val
        ? chrome.i18n.getMessage('recordingActive') || 'Recording...'
        : chrome.i18n.getMessage('idle') || 'Idle'
      )
    ),

    // Record button
    button({
      style: () => `width: 100%; padding: 12px; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; margin-bottom: 16px; ${
        isRecording.val
          ? 'background: #f44336; color: white;'
          : 'background: #4285f4; color: white;'
      }`,
      onclick: toggleRecording
    }, () => isRecording.val
      ? chrome.i18n.getMessage('stopRecording') || 'Stop Recording'
      : chrome.i18n.getMessage('startRecording') || 'Start Recording'
    ),

    // Actions section
    div({
      style: 'background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);'
    },
      div({
        style: 'display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid #f0f0f0;'
      },
        span({ style: 'font-weight: 500; font-size: 14px;' },
          chrome.i18n.getMessage('capturedActions') || 'Captured Actions'
        ),
        span({
          style: 'font-size: 12px; background: #eee; padding: 2px 8px; border-radius: 12px;'
        }, () => recordedActions.val.length.toString())
      ),
      div({ style: 'max-height: 300px; overflow-y: auto;' },
        () => {
          const actions = recordedActions.val;
          if (actions.length === 0) {
            return div({
              style: 'padding: 24px; text-align: center; color: #999; font-size: 13px;'
            }, chrome.i18n.getMessage('noActionsYet') || 'No actions recorded yet');
          }
          return div(
            ...actions.slice(-20).reverse().map(action => ActionItem({ action }))
          );
        }
      )
    )
  );
}

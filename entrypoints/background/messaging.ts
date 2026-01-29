import type { AppState, Message, MessageResponse, PingResponse, CapturedAction } from '../../utils/types';
import { getState, setState, setRecordingState, addRecordedAction } from './storage';

// Storage key for persisted execution state
const EXECUTION_STATE_KEY = 'browserlet_execution_state';

// Type for persisted execution state
interface PersistedExecutionState {
  yamlContent: string;
  currentStep: number;
  results: Record<string, unknown>;
  timestamp: number;
}

export function handleMessage(
  message: Message,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: MessageResponse) => void
): boolean {
  processMessage(message, sender)
    .then(sendResponse)
    .catch((error: Error) => sendResponse({ success: false, error: error.message }));

  return true; // Keep channel open for async response
}

async function processMessage(
  message: Message,
  _sender: chrome.runtime.MessageSender
): Promise<MessageResponse> {
  switch (message.type) {
    case 'PING':
      return {
        success: true,
        data: { status: 'ok', timestamp: Date.now() } as PingResponse,
      };

    case 'GET_STATE': {
      const state = await getState();
      return { success: true, data: state };
    }

    case 'SET_STATE': {
      const updated = await setState(message.payload as Partial<AppState>);
      return { success: true, data: updated };
    }

    case 'START_RECORDING': {
      // Update state
      const updated = await setRecordingState('recording');

      // Broadcast to all tabs to start recording
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (tab.id) {
          try {
            await chrome.tabs.sendMessage(tab.id, { type: 'START_RECORDING' });
          } catch {
            // Tab might not have content script
          }
        }
      }

      return { success: true, data: updated };
    }

    case 'STOP_RECORDING': {
      const updated = await setRecordingState('idle');

      // Broadcast to all tabs to stop recording
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (tab.id) {
          try {
            await chrome.tabs.sendMessage(tab.id, { type: 'STOP_RECORDING' });
          } catch {
            // Tab might not have content script
          }
        }
      }

      return { success: true, data: updated };
    }

    case 'ACTION_CAPTURED': {
      const action = message.payload as CapturedAction;
      await addRecordedAction(action);
      return { success: true };
    }

    case 'SAVE_EXECUTION_STATE': {
      const state = message.payload as PersistedExecutionState;
      await chrome.storage.local.set({ [EXECUTION_STATE_KEY]: state });
      console.log('[Browserlet] Saved execution state, resuming at step', state.currentStep);
      return { success: true };
    }

    case 'GET_EXECUTION_STATE': {
      const data = await chrome.storage.local.get(EXECUTION_STATE_KEY);
      const state = data[EXECUTION_STATE_KEY] as PersistedExecutionState | undefined;

      if (!state) {
        return { success: true, data: null };
      }

      // Check if state is stale (more than 30 seconds old)
      if (Date.now() - state.timestamp > 30000) {
        await chrome.storage.local.remove(EXECUTION_STATE_KEY);
        return { success: true, data: null };
      }

      return { success: true, data: state };
    }

    case 'CLEAR_EXECUTION_STATE': {
      await chrome.storage.local.remove(EXECUTION_STATE_KEY);
      return { success: true };
    }

    default:
      return { success: false, error: `Unknown message type: ${message.type}` };
  }
}

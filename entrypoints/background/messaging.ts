import type { AppState, Message, MessageResponse, PingResponse, CapturedAction } from '../../utils/types';
import { getState, setState, setRecordingState, addRecordedAction } from './storage';

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

    default:
      return { success: false, error: `Unknown message type: ${message.type}` };
  }
}

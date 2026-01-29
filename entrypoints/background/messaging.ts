import type { AppState, Message, MessageResponse, PingResponse } from '../../utils/types';
import { getState, setState } from './storage';

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

    default:
      return { success: false, error: `Unknown message type: ${message.type}` };
  }
}

import { sendMessageSafe } from './messaging';
import { isContextValid } from '../../utils/context-check';
import { RecordingManager } from './recording';

// Singleton instance
let recordingManager: RecordingManager | null = null;

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,

  main() {
    console.log('[Browserlet] Content script loaded on:', window.location.href);

    // Initialize recording manager
    recordingManager = new RecordingManager();

    // Set up event handler to forward actions to service worker
    recordingManager.onEvent(async (event) => {
      if (event.type === 'action_captured' && event.action) {
        try {
          await sendMessageSafe({
            type: 'ACTION_CAPTURED',
            payload: event.action
          });
        } catch (error) {
          console.error('[Browserlet] Failed to send action:', error);
        }
      }
    });

    // Verify communication with service worker on load
    verifyConnection();

    // Listen for messages from service worker
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      handleServiceWorkerMessage(message)
        .then(sendResponse)
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true; // Will respond asynchronously
    });
  },
});

async function verifyConnection(): Promise<void> {
  try {
    const response = await sendMessageSafe({ type: 'PING' });
    if (response.success) {
      console.log('[Browserlet] Service worker connection verified');

      // Check if recording is already active (page refresh during recording)
      const stateResponse = await sendMessageSafe({ type: 'GET_STATE' });
      if (stateResponse.success && stateResponse.data) {
        const state = stateResponse.data as { recordingState?: string };
        if (state.recordingState === 'recording' && recordingManager) {
          console.log('[Browserlet] Resuming recording after page load');
          recordingManager.start();
        }
      }
    } else {
      console.warn('[Browserlet] Service worker responded with error:', response.error);
    }
  } catch (error) {
    console.error('[Browserlet] Failed to connect to service worker:', error);
  }
}

interface ServiceWorkerMessage {
  type: string;
  payload?: unknown;
}

async function handleServiceWorkerMessage(message: ServiceWorkerMessage): Promise<unknown> {
  // Check context validity before processing
  if (!isContextValid()) {
    return { success: false, error: 'Extension context invalidated' };
  }

  switch (message.type) {
    case 'PING':
      return { success: true, data: { status: 'ok', url: window.location.href } };

    case 'STORAGE_CHANGED':
      // Storage change notification from service worker
      console.log('[Browserlet] Storage changed:', message.payload);
      return { success: true };

    case 'START_RECORDING':
      if (recordingManager) {
        recordingManager.start();
        console.log('[Browserlet] Recording started');
      }
      return { success: true };

    case 'STOP_RECORDING':
      if (recordingManager) {
        const session = recordingManager.stop();
        console.log('[Browserlet] Recording stopped, actions:', session?.actions.length ?? 0);
      }
      return { success: true };

    default:
      return { success: false, error: `Unknown message type: ${message.type}` };
  }
}

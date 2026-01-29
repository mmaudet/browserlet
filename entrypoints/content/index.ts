import { sendMessageSafe } from './messaging';
import { isContextValid } from '../../utils/context-check';

export default defineContentScript({
  matches: ['<all_urls>'],

  main() {
    console.log('[Browserlet] Content script loaded on:', window.location.href);

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

    default:
      return { success: false, error: `Unknown message type: ${message.type}` };
  }
}

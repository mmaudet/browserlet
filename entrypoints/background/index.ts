import { handleMessage } from './messaging';
import { initializeState } from './storage';

export default defineBackground(() => {
  console.log('[Browserlet] Service worker started');

  // CRITICAL: Register listeners at TOP LEVEL, synchronously
  // This ensures listeners are ready when service worker restarts
  chrome.runtime.onMessage.addListener(handleMessage);

  // Listen for storage changes and broadcast to extension pages
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace !== 'local') return;

    // Broadcast to all extension pages (side panel, popup if any)
    chrome.runtime.sendMessage({
      type: 'STORAGE_CHANGED',
      payload: changes,
    }).catch(() => {
      // Extension pages may not be open - ignore errors
    });
  });

  // Open side panel when extension action is clicked
  chrome.action.onClicked.addListener(async (tab) => {
    if (tab.id) {
      await chrome.sidePanel.open({ tabId: tab.id });
    }
  });

  // Handle extension install/update
  chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') {
      await initializeState();
      console.log('[Browserlet] Extension installed, state initialized');
    }
    if (details.reason === 'update') {
      console.log('[Browserlet] Extension updated from', details.previousVersion);
    }
  });
});

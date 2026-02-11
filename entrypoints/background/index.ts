import '../../utils/firefoxPolyfill';
import { handleMessage } from './messaging';
import { initializeState } from './storage';
import { initializeTriggerEngine } from './triggers';
import { initializePasswordInfrastructure } from './passwords';
import { initializeLLMFromStorage } from './llm';
import { isFirefox } from '../../utils/browser-detect';
import { storage } from '../../utils/storage/browserCompat';

export default defineBackground(() => {
  console.log('[Browserlet] Service worker started');

  // CRITICAL: Register listeners at TOP LEVEL, synchronously
  // This ensures listeners are ready when service worker restarts
  chrome.runtime.onMessage.addListener(handleMessage);

  // Listen for storage changes and broadcast to extension pages
  storage.onChanged.addListener((changes, namespace) => {
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
    if (isFirefox) {
      // Firefox: use sidebarAction API (opens globally, not per-tab)
      await browser.sidebarAction.toggle();
    } else if (tab.id) {
      // Chrome: use sidePanel API (per-tab)
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

  // Initialize trigger engine
  initializeTriggerEngine().catch(error => {
    console.error('[Browserlet] Failed to initialize trigger engine:', error);
  });

  // Initialize password infrastructure (auto-lock timer, idle detection)
  initializePasswordInfrastructure();

  // Initialize LLM service from stored config (for self-healing, etc.)
  initializeLLMFromStorage().catch(error => {
    console.error('[Browserlet] Failed to initialize LLM from storage:', error);
  });
});

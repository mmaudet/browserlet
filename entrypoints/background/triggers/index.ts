/**
 * Background trigger module exports and initialization
 */

import { getTriggerEngine, TriggerEngine } from './engine';
import { setupNotificationListeners } from './notifications';

export { TriggerEngine, getTriggerEngine };

let initialized = false;

/**
 * Initialize the trigger engine in service worker
 * Must be called once during service worker startup
 */
export async function initializeTriggerEngine(): Promise<void> {
  if (initialized) return;
  initialized = true;

  // Set up notification button handlers
  setupNotificationListeners();

  // Initialize engine (loads triggers from storage)
  const engine = getTriggerEngine();
  await engine.initialize();

  console.log('[Browserlet] Trigger engine initialized');
}

/**
 * Broadcast trigger updates to all content scripts
 */
export async function broadcastTriggerUpdate(): Promise<void> {
  const engine = getTriggerEngine();
  await engine.refresh();

  // Get all enabled triggers
  const triggers = (await import('../../../utils/storage/triggers')).getAllTriggers();

  // Broadcast to all tabs
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id) {
      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: 'TRIGGERS_UPDATED',
          payload: await triggers
        });
      } catch {
        // Tab might not have content script
      }
    }
  }
}

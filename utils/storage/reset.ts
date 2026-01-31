/**
 * Complete extension data reset
 * Clears ALL stored data: scripts, settings, history, triggers, etc.
 */

// All storage keys used by Browserlet
const STORAGE_KEYS = [
  'appState',                    // Recording state and recorded actions
  'browserlet_scripts',          // User scripts
  'browserlet_llm_config',       // LLM configuration
  'browserlet_triggers',         // Trigger configurations
  'browserlet_execution_state',  // Persisted execution state
];

// Prefix for history entries (need to find and remove all)
const HISTORY_PREFIX = 'browserlet_history_';

// Session storage keys
const SESSION_KEYS = [
  'browserlet_session_key',  // Encryption session key
];

/**
 * Reset ALL extension data
 * WARNING: This is destructive and cannot be undone!
 */
export async function resetAllExtensionData(): Promise<void> {
  // 1. Clear known keys from local storage
  await chrome.storage.local.remove(STORAGE_KEYS);

  // 2. Find and remove all history entries (they have dynamic keys)
  const allData = await chrome.storage.local.get(null);
  const historyKeys = Object.keys(allData).filter(key => key.startsWith(HISTORY_PREFIX));
  if (historyKeys.length > 0) {
    await chrome.storage.local.remove(historyKeys);
  }

  // 3. Find and remove all site override keys (browserlet_site_override_*)
  const siteOverrideKeys = Object.keys(allData).filter(key => key.startsWith('browserlet_site_override_'));
  if (siteOverrideKeys.length > 0) {
    await chrome.storage.local.remove(siteOverrideKeys);
  }

  // 4. Clear session storage
  await chrome.storage.session.remove(SESSION_KEYS);

  // 5. Find and remove any suggested scripts in session storage
  const sessionData = await chrome.storage.session.get(null);
  const suggestedKeys = Object.keys(sessionData).filter(key => key.startsWith('browserlet_suggested_'));
  if (suggestedKeys.length > 0) {
    await chrome.storage.session.remove(suggestedKeys);
  }

  console.log('[Browserlet] All extension data has been reset');
}

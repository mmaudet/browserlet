import '../../utils/firefoxPolyfill';
import { sendMessageSafe } from './messaging';
import { isContextValid } from '../../utils/context-check';
import { RecordingManager } from './recording';
import { PlaybackManager } from './playback';
import { initializeTriggers, handleTriggerMessage } from './triggers';
import { showAutoExecuteNotification, showCompletionNotification } from './triggers/inPageNotification';
import { PasswordCapture } from './recording/passwordCapture';
import { CredentialCaptureIndicator } from './recording/visualFeedback';
import { storage } from '../../utils/storage/browserCompat';

// Singleton instances
let recordingManager: RecordingManager | null = null;
let playbackManager: PlaybackManager | null = null;
let standaloneCapturer: PasswordCapture | null = null;
let credentialCaptureIndicator: CredentialCaptureIndicator | null = null;

/**
 * Get or create the PlaybackManager singleton
 * Sets up event forwarding to sidepanel on first call
 */
function getPlaybackManager(): PlaybackManager {
  if (!playbackManager) {
    playbackManager = new PlaybackManager();
    playbackManager.onEvent((event) => {
      // Forward events to sidepanel
      const messageType = event.type === 'progress' ? 'EXECUTION_PROGRESS' :
                          event.type === 'auth_required' ? 'AUTH_REQUIRED' :
                          event.type === 'error' ? 'EXECUTION_FAILED' : 'STATE_CHANGED';
      chrome.runtime.sendMessage({
        type: messageType,
        payload: event
      }).catch(() => {}); // Ignore if no listener
    });
  }
  return playbackManager;
}

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

    // Initialize trigger monitoring (async, don't block)
    initializeTriggers().catch(error => {
      console.warn('[Browserlet] Trigger initialization failed:', error);
    });

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
  // Fast path: read recording state directly from storage to minimize delay.
  // After a page navigation, the content script reinjects and the PING + GET_STATE
  // round-trips can take 200-800ms. By reading storage directly (~10-50ms), we start
  // capturing events before the user finishes typing (e.g., password after username step).
  // RecordingManager.start() is idempotent (guards with `if (state === 'recording') return`),
  // so calling it twice (fast path + verified path) is safe.
  try {
    const result = await storage.local.get('appState');
    const appState = result.appState as { recordingState?: string } | undefined;
    if (appState?.recordingState === 'recording' && recordingManager) {
      console.log('[Browserlet] Fast-resuming recording from storage');
      recordingManager.start();
      schedulePreFilledPasswordScan();
    }
  } catch (error) {
    console.warn('[Browserlet] Fast storage read failed, falling back to messaging:', error);
  }

  // Verified path: confirm connection and state via service worker messaging
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
          recordingManager.start(); // No-op if already started by fast path
          schedulePreFilledPasswordScan();
        }
      }

      // Check for persisted execution state (resume after navigation)
      await checkAndResumeExecution();
    } else {
      console.warn('[Browserlet] Service worker responded with error:', response.error);
    }
  } catch (error) {
    console.error('[Browserlet] Failed to connect to service worker:', error);
  }
}

/**
 * Schedule a scan for pre-filled password fields after a short delay.
 * The delay lets the DOM and browser autofill settle before scanning.
 */
let preFilledScanScheduled = false;
function schedulePreFilledPasswordScan(): void {
  if (preFilledScanScheduled) return; // Only schedule once per page load
  preFilledScanScheduled = true;
  setTimeout(() => {
    if (recordingManager) {
      recordingManager.capturePreFilledPasswords();
    }
  }, 500);
}

/**
 * Check for persisted execution state and resume if found
 * This handles cross-page navigation during script execution
 */
async function checkAndResumeExecution(): Promise<void> {
  try {
    const persistedState = await PlaybackManager.getPersistedState();

    if (persistedState) {
      console.log('[Browserlet] Found persisted execution state, resuming from step', persistedState.currentStep + 1);

      // Clear the persisted state immediately to prevent re-entry
      await PlaybackManager.clearPersistedState();

      // Wait a moment for the page to stabilize
      await new Promise(resolve => setTimeout(resolve, 500));

      // Get or create the PlaybackManager and resume execution
      const manager = getPlaybackManager();
      const result = await manager.execute(persistedState.yamlContent, {
        startStep: persistedState.currentStep,
        previousResults: persistedState.results,
        scriptId: persistedState.scriptId,
        executionId: persistedState.executionId,
      });

      // Send completion/failure message
      chrome.runtime.sendMessage({
        type: result.status === 'completed' ? 'EXECUTION_COMPLETED' : 'EXECUTION_FAILED',
        payload: result
      }).catch(() => {}); // Ignore if no listener
    }
  } catch (error) {
    console.error('[Browserlet] Error resuming execution:', error);
    // Clear state on error to prevent stuck executions
    await PlaybackManager.clearPersistedState();
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

    case 'GET_CAPTURED_PASSWORDS':
      if (recordingManager) {
        const capturedPasswords = recordingManager.getCapturedPasswords();
        console.log('[Browserlet] Returning captured passwords:', capturedPasswords.length);
        return { success: true, data: capturedPasswords };
      }
      return { success: true, data: [] };

    case 'START_PASSWORD_CAPTURE':
      if (!standaloneCapturer) {
        standaloneCapturer = new PasswordCapture();
      }
      standaloneCapturer.start(() => {}); // callback not needed for standalone
      // Show visual indicator
      if (!credentialCaptureIndicator) {
        credentialCaptureIndicator = new CredentialCaptureIndicator();
      }
      credentialCaptureIndicator.show();
      console.log('[Browserlet] Standalone password capture started');
      return { success: true };

    case 'STOP_PASSWORD_CAPTURE':
      // Hide visual indicator
      if (credentialCaptureIndicator) {
        credentialCaptureIndicator.hide();
      }
      if (standaloneCapturer) {
        const captured = standaloneCapturer.stop();
        standaloneCapturer = null;
        console.log('[Browserlet] Standalone capture stopped, got', captured.length, 'passwords');
        return { success: true, data: captured };
      }
      return { success: true, data: [] };

    case 'EXECUTE_SCRIPT': {
      const { content, scriptId, executionId } = message.payload as {
        content: string;
        scriptId?: string;
        executionId?: string;
      };
      const manager = getPlaybackManager();
      // Execute async, send result when done
      manager.execute(content, { scriptId, executionId }).then((result) => {
        chrome.runtime.sendMessage({
          type: result.status === 'completed' ? 'EXECUTION_COMPLETED' : 'EXECUTION_FAILED',
          payload: result
        }).catch(() => {}); // Ignore if no listener
      });
      console.log('[Browserlet] Script execution started');
      return { success: true };
    }

    case 'STOP_EXECUTION': {
      getPlaybackManager().stop();
      console.log('[Browserlet] Execution stopped');
      return { success: true };
    }

    case 'TRIGGERS_UPDATED':
      handleTriggerMessage(message);
      return { success: true };

    case 'STOP_TRIGGERS':
      handleTriggerMessage(message);
      return { success: true };

    case 'SHOW_AUTO_EXECUTE_NOTIFICATION': {
      const { scriptName, scriptId, url } = message.payload as {
        scriptName: string;
        scriptId: string;
        url: string;
      };
      showAutoExecuteNotification({
        scriptName,
        scriptId,
        onStop: () => {
          getPlaybackManager().stop();
          console.log('[Browserlet] Execution stopped via notification');
        },
        onDisableSite: async () => {
          try {
            await chrome.runtime.sendMessage({
              type: 'SET_SITE_OVERRIDE',
              payload: { scriptId, url, enabled: false }
            });
            console.log('[Browserlet] Site disabled for script:', scriptId);
          } catch (error) {
            console.error('[Browserlet] Failed to disable site:', error);
          }
        }
      });
      return { success: true };
    }

    case 'SHOW_COMPLETION_NOTIFICATION': {
      const { scriptName, success } = message.payload as {
        scriptName: string;
        success: boolean;
      };
      showCompletionNotification(scriptName, success);
      return { success: true };
    }

    case 'GET_PAGE_CONTEXT': {
      // Gather relevant text nodes with context for AI extraction analysis
      const textNodes = gatherTextNodes();
      return {
        success: true,
        data: {
          url: window.location.href,
          title: document.title,
          textNodes
        }
      };
    }

    default:
      return { success: false, error: `Unknown message type: ${message.type}` };
  }
}

interface TextNodeContext {
  text: string;
  tagName: string;
  className?: string;
  id?: string;
  ariaLabel?: string;
  nearbyLabels: string[];
  /** Flag for priority elements (headings, amounts, dates) */
  isPriority?: boolean;
  /** Table name if this represents a table for extraction */
  tableName?: string;
}

/**
 * Gather text nodes from the page with their context
 * Prioritizes key data: headings, amounts, dates, tables
 * Used for AI extraction suggestions
 */
function gatherTextNodes(): TextNodeContext[] {
  const nodes: TextNodeContext[] = [];
  const seenTexts = new Set<string>();

  // 1. First pass: collect priority elements (headings, key values)
  const prioritySelectors = [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',      // Headings
    '[class*="title"]', '[class*="name"]',   // Title/name patterns
    '[class*="price"]', '[class*="amount"]', '[class*="total"]', // Amounts
    '[class*="date"]', 'time',               // Dates
    '[class*="status"]', '[class*="badge"]', // Status values
    '[class*="reference"]', '[class*="number"]', '[class*="id"]', // IDs/references
    'strong', 'b', 'em',                     // Emphasized text
    'dd', 'dt',                              // Definition lists (common in detail pages)
    '[aria-label]',                          // Accessible elements
  ];

  for (const selector of prioritySelectors) {
    try {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        const text = el.textContent?.trim();
        if (!text || text.length < 2 || text.length > 200 || seenTexts.has(text)) continue;
        if (!isElementVisible(el)) continue;

        seenTexts.add(text);
        nodes.push({
          text,
          tagName: el.tagName.toLowerCase(),
          className: (el as HTMLElement).className || undefined,
          id: el.id || undefined,
          ariaLabel: el.getAttribute('aria-label') || undefined,
          nearbyLabels: findNearbyLabels(el),
          isPriority: true
        });

        if (nodes.length >= 100) break; // Cap priority elements
      }
    } catch {
      // Skip invalid selectors
    }
  }

  // 2. Detect label-value pairs in tables (common pattern: <th>Label</th><td>Value</td>)
  // This is the primary pattern used in detail pages like OBM
  const labelValueRows = document.querySelectorAll('tr');
  for (const row of labelValueRows) {
    const th = row.querySelector('th');
    const td = row.querySelector('td');
    if (th && td && isElementVisible(row)) {
      const label = th.textContent?.trim();
      const value = td.textContent?.trim();
      if (label && value && value.length > 0 && value.length < 300) {
        const key = `${label}: ${value}`;
        if (!seenTexts.has(key)) {
          seenTexts.add(key);
          nodes.push({
            text: `[FIELD: "${label}" = "${value.substring(0, 100)}${value.length > 100 ? '...' : ''}"]`,
            tagName: 'td',
            className: (td as HTMLElement).className || undefined,
            id: td.id || undefined,
            ariaLabel: td.getAttribute('aria-label') || undefined,
            nearbyLabels: [label],
            isPriority: true
          });
        }
      }
    }
  }

  // 3. Detect data tables (for table_extract suggestions)
  const tables = document.querySelectorAll('table');
  let tableIndex = 0;
  for (const table of tables) {
    if (!isElementVisible(table)) continue;

    // Get table name from multiple sources
    let tableName = table.querySelector('caption')?.textContent?.trim() ||
                    table.getAttribute('aria-label') ||
                    table.getAttribute('summary') || '';

    // Look for preceding heading (check multiple previous siblings and parents)
    if (!tableName) {
      let element: Element | null = table;
      // Check previous siblings
      for (let i = 0; i < 5 && element; i++) {
        const prev = element.previousElementSibling;
        if (prev && /^H[1-6]$/.test(prev.tagName)) {
          tableName = prev.textContent?.trim() || '';
          break;
        }
        element = prev;
      }
      // If still no name, check parent's previous siblings (common in Wikipedia)
      if (!tableName) {
        let parent = table.parentElement;
        for (let level = 0; level < 3 && parent && !tableName; level++) {
          let sibling = parent.previousElementSibling;
          for (let i = 0; i < 3 && sibling; i++) {
            if (/^H[1-6]$/.test(sibling.tagName)) {
              tableName = sibling.textContent?.trim() || '';
              break;
            }
            sibling = sibling.previousElementSibling;
          }
          parent = parent.parentElement;
        }
      }
    }

    // Get headers from multiple places
    const headers: string[] = [];
    // Try thead first
    let headerCells = table.querySelectorAll('thead th');
    if (headerCells.length === 0) {
      // Try first row
      headerCells = table.querySelectorAll('tr:first-child th');
    }
    if (headerCells.length === 0) {
      // Try first row td if they look like headers (Wikipedia sometimes uses td in header row)
      const firstRow = table.querySelector('tr');
      if (firstRow) {
        const cells = firstRow.querySelectorAll('th, td');
        cells.forEach(cell => {
          const h = cell.textContent?.trim();
          if (h && h.length < 50) headers.push(h);
        });
      }
    } else {
      headerCells.forEach(th => {
        const h = th.textContent?.trim();
        if (h && h.length < 100) headers.push(h);
      });
    }

    // Count data rows
    const allRows = table.querySelectorAll('tr');
    const rowCount = Math.max(0, allRows.length - 1);

    // Suggest tables with meaningful structure
    if (headers.length >= 2 && rowCount >= 2) {
      tableIndex++;
      const displayName = tableName || `Table ${tableIndex}`;
      const safeTableName = (tableName || `table_${tableIndex}`)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
        .substring(0, 30);

      nodes.push({
        text: `[TABLE: "${displayName}" with ${headers.length} columns (${headers.slice(0, 4).join(', ')}${headers.length > 4 ? '...' : ''}) and ${rowCount} data rows]`,
        tagName: 'table',
        className: (table as HTMLElement).className || undefined,
        id: table.id || undefined,
        ariaLabel: table.getAttribute('aria-label') || undefined,
        nearbyLabels: [displayName],
        isPriority: true,
        tableName: safeTableName
      });
    }
  }

  // 3. Second pass: gather remaining text nodes using tree walker
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        const text = node.textContent?.trim();
        if (!text || text.length < 2 || text.length > 200) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  let count = 0;
  const maxRemaining = 250 - nodes.length; // Total cap of ~250 nodes
  while (walker.nextNode() && count < maxRemaining) {
    const textNode = walker.currentNode;
    const parent = textNode.parentElement;
    if (!parent) continue;

    const text = textNode.textContent?.trim() || '';
    if (seenTexts.has(text)) continue; // Skip duplicates

    // Skip hidden elements
    if (!isElementVisible(parent)) continue;

    // Skip script/style tags
    if (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE') continue;

    seenTexts.add(text);
    nodes.push({
      text,
      tagName: parent.tagName.toLowerCase(),
      className: parent.className || undefined,
      id: parent.id || undefined,
      ariaLabel: parent.getAttribute('aria-label') || undefined,
      nearbyLabels: findNearbyLabels(parent)
    });
    count++;
  }

  // Sort: priority elements first, then by position in DOM
  return nodes.sort((a, b) => {
    if (a.isPriority && !b.isPriority) return -1;
    if (!a.isPriority && b.isPriority) return 1;
    return 0;
  });
}

/**
 * Check if an element is visible
 */
function isElementVisible(element: Element): boolean {
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/**
 * Find labels near an element (for context)
 */
function findNearbyLabels(element: Element): string[] {
  const labels: string[] = [];

  // Check for associated label (by for attribute)
  if (element.id) {
    const label = document.querySelector(`label[for="${element.id}"]`);
    if (label?.textContent) labels.push(label.textContent.trim());
  }

  // Check previous sibling
  const prev = element.previousElementSibling;
  if (prev?.tagName === 'LABEL') {
    const text = prev.textContent?.trim();
    if (text) labels.push(text);
  }

  // Check parent for label-like patterns
  const parent = element.parentElement;
  if (parent) {
    const siblingLabel = parent.querySelector('label, .label, [class*="label"]');
    if (siblingLabel && siblingLabel !== element) {
      const text = siblingLabel.textContent?.trim();
      if (text) labels.push(text);
    }
  }

  return labels.filter(l => l.length > 0).slice(0, 3);
}

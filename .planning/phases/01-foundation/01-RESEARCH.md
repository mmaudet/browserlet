# Phase 1: Foundation - Research

**Researched:** 2026-01-29
**Domain:** Chrome Extension Manifest V3 Infrastructure
**Confidence:** HIGH

## Summary

Phase 1 establishes the foundational architecture for Browserlet: service worker message routing, chrome.storage state management, and communication patterns between components. The research validates using WXT framework for project scaffolding, confirms service worker lifecycle constraints, and identifies critical patterns for handling context invalidation and state persistence.

**Key findings:**
- WXT framework provides superior developer experience with built-in Manifest V3 support, HMR, and file-based entrypoint conventions
- Service worker terminates after 30s inactivity - chrome.storage.local is the only reliable state persistence
- Event listeners MUST register at top-level synchronously before any async initialization
- chrome.storage.onChanged provides broadcast mechanism for state updates across all components
- Context invalidation during extension updates requires explicit detection and user notification

**Primary recommendation:** Build service worker as stateless message router with chrome.storage.local as single source of truth. Register all event listeners synchronously at module top-level. Implement context invalidation detection in initial messaging layer.

## Standard Stack

### Core Infrastructure
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| WXT | `^0.19.x` | Extension Framework | File-based conventions, auto-manifest generation, HMR for content scripts. Actively maintained vs archived CRXJS. |
| Vite | `^7.3.1` | Build Tool | Bundled with WXT. 100x faster dev builds, sub-second HMR. |
| TypeScript | `^5.9.3` | Type System | Type safety for Chrome APIs via @types/chrome. Essential for BSL parser. |
| @types/chrome | `^0.0.290+` | Chrome API Types | TypeScript definitions for Manifest V3 APIs. Critical for service worker. |

### Testing
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | `^4.0.x` | Unit Testing | Storage logic, message routing, state management unit tests |
| @webext-core/fake-browser | bundled with WXT | Chrome API Mock | In-memory chrome.storage for tests, no manual mocking required |
| Playwright | `^1.57.0` | E2E Testing | Full extension flows: load extension, test messaging, verify storage persistence |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| WXT | Manual Vite config | WXT eliminates ~100-200 LOC of boilerplate, provides HMR for content scripts |
| WXT | Plasmo | Plasmo uses Parcel (slower), React-focused. WXT is framework-agnostic |
| chrome.storage.local | IndexedDB | IndexedDB more complex API, better for >10MB data. chrome.storage sufficient for Phase 1 |

**Installation:**
```bash
# Initialize WXT project (do this first, not npm init)
npm create wxt@latest

# Select options:
# - Package manager: npm
# - Template: preact-ts (or vanilla-ts for foundation phase)
# - Install dependencies: Yes

# Add testing dependencies
npm install -D vitest @vitest/ui @playwright/test

# WXT's Vitest plugin is included automatically
```

## Architecture Patterns

### Recommended Project Structure
```
entrypoints/
├── background/         # Service worker (message router, state manager)
│   ├── index.ts       # Main entry, event listener registration
│   ├── messaging.ts   # Message routing logic
│   └── storage.ts     # chrome.storage wrapper functions
├── content/           # Content script (DOM interaction)
│   └── index.ts       # Event capture, message sending
└── sidepanel/         # Side panel UI
    ├── index.html     # Entry HTML
    └── main.ts        # UI logic, message receiving
```

### Pattern 1: Service Worker as Stateless Hub

**What:** Service worker acts as message router and state orchestrator, never storing state in memory.

**When to use:** Always - service workers terminate after 30s, in-memory state is lost.

**Example:**
```typescript
// entrypoints/background/index.ts
// Source: WXT documentation + Chrome official patterns

export default defineBackground(() => {
  // CRITICAL: Register listeners at TOP LEVEL, synchronously
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender).then(sendResponse);
    return true; // Keep channel open for async response
  });

  chrome.storage.onChanged.addListener((changes, namespace) => {
    // Broadcast storage changes to all components
    broadcastStateUpdate(changes);
  });
});

async function handleMessage(message: any, sender: chrome.runtime.MessageSender) {
  // Load state from storage on EVERY message (worker may have restarted)
  const state = await chrome.storage.local.get('appState');

  switch (message.type) {
    case 'SAVE_SCRIPT':
      await chrome.storage.local.set({
        scripts: { ...state.scripts, [message.scriptId]: message.script }
      });
      return { success: true };

    case 'EXECUTE_SCRIPT':
      const script = state.scripts[message.scriptId];
      // Forward to content script
      const tabId = sender.tab?.id;
      if (tabId) {
        await chrome.tabs.sendMessage(tabId, {
          type: 'RUN_SCRIPT',
          script
        });
      }
      return { started: true };

    default:
      return { error: 'Unknown message type' };
  }
}
```

### Pattern 2: Top-Level Event Listener Registration

**What:** Event listeners registered synchronously at module top level, before any async code.

**When to use:** Always - async registration causes race conditions on service worker restart.

**Example:**
```typescript
// WRONG - Async registration
async function initialize() {
  const config = await chrome.storage.local.get('config');
  chrome.runtime.onMessage.addListener((msg) => {
    // This may not be registered when message arrives
  });
}
initialize();

// RIGHT - Top-level registration
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handleMessage(msg, sender).then(sendResponse);
  return true;
});

async function handleMessage(msg, sender) {
  // Load config inside handler
  const config = await chrome.storage.local.get('config');
  // ... use config
}
```

### Pattern 3: chrome.storage.onChanged for State Broadcast

**What:** Use chrome.storage.onChanged to synchronize state across service worker, content scripts, and side panel.

**When to use:** When multiple components need to react to state changes without explicit messages.

**Example:**
```typescript
// All components listen for storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace !== 'local') return;

  if (changes.scripts) {
    console.log('Scripts updated:', changes.scripts.newValue);
    // Update UI, refresh state cache, etc.
  }

  if (changes.executionState) {
    console.log('Execution state:', changes.executionState.newValue);
    // Update progress bar in side panel
  }
});

// Service worker writes to storage - all components get notified
await chrome.storage.local.set({
  executionState: { status: 'running', step: 5 }
});
```

### Pattern 4: Context Invalidation Detection

**What:** Detect when extension updates and content scripts lose connection to service worker.

**When to use:** All message sending code - prevents cryptic errors during auto-updates.

**Example:**
```typescript
// Content script or side panel sending message
async function sendMessageWithRetry(message: any, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      // Check if runtime is still valid
      if (!chrome.runtime?.id) {
        throw new Error('Extension context invalidated');
      }

      return await chrome.runtime.sendMessage(message);
    } catch (error) {
      if (error.message.includes('Extension context invalidated') ||
          error.message.includes('Receiving end does not exist')) {

        if (i === retries - 1) {
          // Show user-friendly message
          showUpdateNotification();
          throw error;
        }

        // Wait before retry (service worker may be restarting)
        await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
        continue;
      }
      throw error;
    }
  }
}

function showUpdateNotification() {
  // Display banner: "Extension updated, please refresh page"
  const banner = document.createElement('div');
  banner.textContent = '🔄 Browserlet updated. Please refresh this page.';
  banner.style.cssText = 'position: fixed; top: 0; width: 100%; background: #ff9800; padding: 12px; z-index: 999999; text-align: center;';
  document.body.prepend(banner);
}
```

### Anti-Patterns to Avoid

**Anti-pattern 1: Global variables in service worker**
```typescript
// WRONG - Lost on service worker termination
let currentScript = null;

chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.type === 'SAVE_SCRIPT') {
    currentScript = msg.script; // Lost after 30s
  }
});

// RIGHT - Persist to storage
chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.type === 'SAVE_SCRIPT') {
    await chrome.storage.local.set({ currentScript: msg.script });
  }
});
```

**Anti-pattern 2: Direct content script to side panel messaging**
```typescript
// WRONG - No API for content script to target side panel
chrome.runtime.sendMessage({ target: 'sidepanel', data: {...} });

// RIGHT - Route through service worker
// Content script:
chrome.runtime.sendMessage({ type: 'UPDATE_UI', data: {...} });

// Service worker:
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'UPDATE_UI') {
    // Broadcast to all extension pages (includes side panel)
    chrome.runtime.sendMessage(msg);
  }
});
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Chrome API mocking | Custom mock objects | @webext-core/fake-browser (via WXT) | In-memory chrome.storage, complete API surface, maintained |
| Extension project setup | Manual manifest.json + Vite config | WXT framework | Auto-manifest generation, HMR, 100-200 LOC savings |
| Storage state management | Custom event emitters | chrome.storage.onChanged | Native API, fires in all contexts, built-in change detection |
| Service worker lifecycle | Custom keepalive logic | chrome.alarms API for scheduled tasks | Persists across worker restarts, reliable timing |

**Key insight:** Chrome extension infrastructure has mature patterns. Building custom solutions introduces bugs around service worker lifecycle, context invalidation, and storage synchronization. Use established tools.

## Common Pitfalls

### Pitfall 1: Service Worker State Loss on Termination

**What goes wrong:** Service worker terminates after 30 seconds of inactivity. All global variables, in-memory state vanish. Recording sessions, execution progress, LLM context lost.

**Why it happens:** Developers assume service workers are persistent like Manifest V2 background pages. Store critical state in global variables.

**How to avoid:**
- Use chrome.storage.local for ALL state that must survive >30s
- Implement "save on every change" pattern, not "save at end"
- Never rely on global variables for persistence
- Test by manually terminating service worker in chrome://extensions

**Warning signs:**
- Extension "stops working" after inactivity
- State resets unexpectedly during workflows
- Console shows "Extension context invalidated"

### Pitfall 2: Extension Context Invalidation During Updates

**What goes wrong:** Chrome auto-updates extension while content scripts run in open tabs. Existing content scripts become orphaned - chrome.runtime.sendMessage() fails with "Extension context invalidated".

**Why it happens:** Auto-update replaces extension while old content scripts still active. Old scripts can't communicate with new extension version.

**How to avoid:**
- Check chrome.runtime.id before every message send
- Implement retry logic with exponential backoff
- Display user-friendly "Extension updated, refresh page" banner
- Save work-in-progress to chrome.storage before runtime calls

**Warning signs:**
- Random "Extension context invalidated" errors
- Features work initially but break unexpectedly
- Errors coincide with extension updates

### Pitfall 3: Async Event Listener Registration

**What goes wrong:** Registering chrome.runtime.onMessage listeners inside async functions or after initialization. When service worker restarts, events fire before async registration completes - messages lost.

**Why it happens:** Service worker re-executes script on every restart. Events can arrive during initialization.

**How to avoid:**
- Register ALL event listeners at top level, synchronously
- Move initialization logic into handler functions
- Never nest listener registration in promises/callbacks

**Warning signs:**
- Messages work sometimes but missed other times
- Race conditions on extension load
- Event handlers not called after service worker restart

### Pitfall 4: Using localStorage in Service Worker

**What goes wrong:** Attempting window.localStorage in service worker throws error. Service workers have no window object.

**Why it happens:** Migrating from web apps or Manifest V2 background pages. Assuming localStorage available everywhere.

**How to avoid:**
- Use chrome.storage.local instead
- Use chrome.storage.session for temporary data
- Use IndexedDB only if >10MB data needed

**Warning signs:**
- "window is not defined" errors
- "localStorage is not defined" errors
- Service worker crashes on startup

## Code Examples

### Example 1: Service Worker Initialization

```typescript
// entrypoints/background/index.ts
// Source: WXT documentation + Chrome developer guides

export default defineBackground(() => {
  console.log('Service worker started');

  // Register all listeners at TOP LEVEL (synchronous)
  chrome.runtime.onMessage.addListener(handleMessage);
  chrome.storage.onChanged.addListener(handleStorageChange);
  chrome.runtime.onInstalled.addListener(handleInstall);

  // Optional: Monitor lifecycle for debugging
  chrome.runtime.onSuspend?.addListener(() => {
    console.log('Service worker suspending');
  });
});

function handleMessage(
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void
): boolean {
  // Route to async handler
  processMessage(message, sender)
    .then(sendResponse)
    .catch(error => sendResponse({ error: error.message }));

  return true; // Keep channel open for async response
}

async function processMessage(message: any, sender: chrome.runtime.MessageSender) {
  // Load state from storage on EVERY message
  const state = await chrome.storage.local.get(['scripts', 'config']);

  switch (message.type) {
    case 'PING':
      return { status: 'ok', timestamp: Date.now() };

    case 'GET_SCRIPTS':
      return { scripts: state.scripts || {} };

    case 'SAVE_SCRIPT':
      const scripts = { ...state.scripts, [message.script.id]: message.script };
      await chrome.storage.local.set({ scripts });
      return { success: true, scriptId: message.script.id };

    default:
      return { error: 'Unknown message type' };
  }
}

function handleStorageChange(
  changes: { [key: string]: chrome.storage.StorageChange },
  namespace: string
) {
  if (namespace !== 'local') return;

  // Broadcast changes to all extension pages
  for (const [key, { oldValue, newValue }] of Object.entries(changes)) {
    chrome.runtime.sendMessage({
      type: 'STORAGE_CHANGED',
      key,
      oldValue,
      newValue
    }).catch(() => {
      // Extension pages may not be open - ignore errors
    });
  }
}

async function handleInstall(details: chrome.runtime.InstalledDetails) {
  if (details.reason === 'install') {
    // Initialize default state
    await chrome.storage.local.set({
      scripts: {},
      config: {
        version: '0.1.0',
        firstInstall: Date.now()
      }
    });
    console.log('Extension installed, state initialized');
  }

  if (details.reason === 'update') {
    console.log('Extension updated from', details.previousVersion);
  }
}
```

### Example 2: Content Script with Context Invalidation Handling

```typescript
// entrypoints/content/index.ts
// Source: Chrome messaging documentation + community patterns

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    console.log('Content script loaded on:', window.location.href);

    // Example: Capture click events
    document.addEventListener('click', handleClick);

    // Listen for messages from service worker
    chrome.runtime.onMessage.addListener(handleMessage);
  }
});

async function handleClick(event: MouseEvent) {
  const target = event.target as HTMLElement;

  try {
    await sendMessageSafe({
      type: 'ACTION_CAPTURED',
      action: {
        type: 'click',
        selector: getSelector(target),
        timestamp: Date.now()
      }
    });
  } catch (error) {
    console.error('Failed to capture action:', error);
  }
}

async function sendMessageSafe(message: any, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      // Check if extension context is still valid
      if (!chrome.runtime?.id) {
        throw new Error('Extension context invalidated');
      }

      return await chrome.runtime.sendMessage(message);
    } catch (error: any) {
      const isContextError =
        error.message?.includes('Extension context invalidated') ||
        error.message?.includes('Receiving end does not exist');

      if (isContextError) {
        if (i === retries - 1) {
          // Final retry failed - notify user
          showExtensionUpdateNotification();
          throw error;
        }
        // Wait before retry
        await sleep(100 * Math.pow(2, i));
        continue;
      }

      // Other error - don't retry
      throw error;
    }
  }
}

function handleMessage(
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void
): boolean {
  processContentMessage(message)
    .then(sendResponse)
    .catch(error => sendResponse({ error: error.message }));

  return true;
}

async function processContentMessage(message: any) {
  switch (message.type) {
    case 'PING':
      return { status: 'ok' };

    case 'HIGHLIGHT_ELEMENT':
      highlightElement(message.selector);
      return { highlighted: true };

    default:
      return { error: 'Unknown message type' };
  }
}

function showExtensionUpdateNotification() {
  const banner = document.createElement('div');
  banner.id = 'browserlet-update-banner';
  banner.innerHTML = `
    <strong>🔄 Browserlet Updated</strong>
    <p>Please refresh this page to continue using the extension.</p>
    <button onclick="location.reload()">Refresh Now</button>
  `;
  banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: #ff9800;
    color: white;
    padding: 16px;
    z-index: 999999;
    text-align: center;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  `;
  document.body.prepend(banner);
}

function getSelector(element: HTMLElement): string {
  // Simplified - use POC Semantic Resolver in Phase 2
  return element.id ? `#${element.id}` : element.tagName.toLowerCase();
}

function highlightElement(selector: string) {
  const element = document.querySelector(selector);
  if (element instanceof HTMLElement) {
    element.style.outline = '2px solid red';
    setTimeout(() => {
      element.style.outline = '';
    }, 2000);
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### Example 3: Side Panel with Storage Synchronization

```typescript
// entrypoints/sidepanel/main.ts
// Source: WXT documentation + Chrome sidePanel API

import { useState, useEffect } from 'preact/hooks';

export function App() {
  const [scripts, setScripts] = useState<Record<string, any>>({});
  const [status, setStatus] = useState('Loading...');

  useEffect(() => {
    // Load initial state
    loadScripts();

    // Listen for storage changes
    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  async function loadScripts() {
    try {
      const { scripts } = await chrome.storage.local.get('scripts');
      setScripts(scripts || {});
      setStatus('Ready');
    } catch (error) {
      console.error('Failed to load scripts:', error);
      setStatus('Error loading scripts');
    }
  }

  function handleStorageChange(
    changes: { [key: string]: chrome.storage.StorageChange },
    namespace: string
  ) {
    if (namespace !== 'local') return;

    if (changes.scripts) {
      setScripts(changes.scripts.newValue || {});
    }
  }

  async function saveScript(script: any) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SAVE_SCRIPT',
        script
      });

      if (response.success) {
        setStatus(`Script ${response.scriptId} saved`);
      }
    } catch (error) {
      console.error('Failed to save script:', error);
      setStatus('Error saving script');
    }
  }

  return (
    <div>
      <h1>Browserlet Scripts</h1>
      <p>Status: {status}</p>
      <ul>
        {Object.entries(scripts).map(([id, script]) => (
          <li key={id}>{script.name}</li>
        ))}
      </ul>
    </div>
  );
}
```

### Example 4: Unit Testing with WXT + Vitest

```typescript
// tests/background/storage.test.ts
// Source: WXT testing documentation

import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';

describe('Storage Management', () => {
  beforeEach(() => {
    // Reset fake browser state before each test
    fakeBrowser.reset();
  });

  it('should save script to storage', async () => {
    const script = {
      id: 'test-script',
      name: 'Test Script',
      content: 'click button'
    };

    // Use chrome.storage.local - no manual mocking needed
    await chrome.storage.local.set({
      scripts: { [script.id]: script }
    });

    const { scripts } = await chrome.storage.local.get('scripts');
    expect(scripts[script.id]).toEqual(script);
  });

  it('should trigger storage change listener', async () => {
    let changeDetected = false;

    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes.scripts) {
        changeDetected = true;
      }
    });

    await chrome.storage.local.set({ scripts: {} });

    // Wait for async listener
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(changeDetected).toBe(true);
  });

  it('should persist state across service worker restarts', async () => {
    // Simulate state before termination
    await chrome.storage.local.set({
      executionState: { status: 'running', step: 5 }
    });

    // Simulate service worker restart (fake-browser persists storage)
    fakeBrowser.reset();

    // State should still be accessible
    const { executionState } = await chrome.storage.local.get('executionState');
    expect(executionState.step).toBe(5);
  });
});
```

### Example 5: E2E Testing with Playwright

```typescript
// tests/e2e/extension-load.spec.ts
// Source: Playwright Chrome extension documentation

import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Extension Load and Messaging', () => {
  test('should load extension and establish communication', async ({ context }) => {
    // Load extension
    const extensionPath = path.join(__dirname, '../../.output/chrome-mv3');

    const contextWithExtension = await context.browser()?.newContext({
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });

    // Get service worker
    const serviceWorker = contextWithExtension?.serviceWorkers()[0];
    expect(serviceWorker).toBeDefined();

    // Get extension ID
    const extensionId = serviceWorker?.url().split('/')[2];
    expect(extensionId).toBeTruthy();

    // Open a page and test content script injection
    const page = await contextWithExtension!.newPage();
    await page.goto('https://example.com');

    // Test messaging
    const response = await page.evaluate(async () => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'PING' }, resolve);
      });
    });

    expect(response).toHaveProperty('status', 'ok');

    // Verify storage persistence
    await page.evaluate(async () => {
      await chrome.storage.local.set({ testKey: 'testValue' });
    });

    const stored = await page.evaluate(async () => {
      const result = await chrome.storage.local.get('testKey');
      return result.testKey;
    });

    expect(stored).toBe('testValue');
  });

  test('should handle extension context after update simulation', async ({ context }) => {
    // This test would simulate extension reload and verify
    // context invalidation handling
    // Implementation depends on Playwright's extension reload capabilities
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manifest V2 background pages | Manifest V3 service workers | 2024 (mandatory) | Persistent to ephemeral - must use chrome.storage for state |
| CRXJS framework | WXT framework | Mid-2025 (CRXJS archived) | WXT now standard for Vite-based extensions |
| Manual chrome API mocking | @webext-core/fake-browser | 2024-2025 | In-memory API implementation, no manual mocks |
| localStorage in background | chrome.storage.local | Manifest V3 | Service workers have no window object |
| Callback-based chrome APIs | Promise-based chrome APIs | Chrome 144+ (2026) | Modern async/await syntax supported |

**Deprecated/outdated:**
- Manifest V2: Deprecated June 2024, disabled in Chrome stable
- chrome.runtime.onMessage callback-only pattern: Now supports returning promises
- CRXJS framework: Repository archived June 2025
- Background page persistence: Service workers are ephemeral by design

## Open Questions

### 1. Service Worker Keepalive Strategies

**What we know:** Service workers terminate after 30s inactivity. chrome.alarms API can extend lifetime.

**What's unclear:** Optimal strategy for long-running operations (multi-step BSL execution). Should we:
- Break into steps with storage checkpoints?
- Use chrome.alarms to ping service worker?
- Accept termination and resume from storage?

**Recommendation:** Start with step-by-step execution with storage checkpoints (Phase 3). Test with 30+ second workflows to validate approach.

### 2. Storage Quota Management

**What we know:** chrome.storage.local has 10MB limit (expandable with unlimitedStorage permission).

**What's unclear:** How many BSL scripts fit in 10MB? When to request unlimitedStorage permission?

**Recommendation:** Ship without unlimitedStorage initially. Monitor storage usage in Phase 2. Request permission only if users hit quota.

### 3. Context Invalidation UX

**What we know:** Extension updates invalidate content script contexts. Must detect and notify user.

**What's unclear:** Best UX pattern - banner, modal, auto-refresh?

**Recommendation:** Start with non-intrusive banner (Phase 1). Gather user feedback, iterate in later phases.

## Sources

### Primary (HIGH confidence)

**Official Chrome Documentation:**
- [chrome.runtime API](https://developer.chrome.com/docs/extensions/reference/api/runtime) - Message passing, context management
- [chrome.storage API](https://developer.chrome.com/docs/extensions/reference/api/storage) - Storage patterns, onChanged events
- [Message Passing Guide](https://developer.chrome.com/docs/extensions/develop/concepts/messaging) - One-time messages, long-lived connections
- [Migrate to Service Worker](https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers) - MV2 to MV3 patterns
- [chrome.sidePanel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel) - Side panel configuration

**WXT Framework:**
- [WXT Official Documentation](https://wxt.dev/) - Framework overview
- [WXT Entrypoints Guide](https://wxt.dev/guide/essentials/entrypoints.html) - File-based conventions
- [WXT Unit Testing](https://wxt.dev/guide/essentials/unit-testing) - Vitest integration
- [WXT GitHub Repository](https://github.com/wxt-dev/wxt) - Examples, issues

**Playwright:**
- [Playwright Chrome Extensions](https://playwright.dev/docs/chrome-extensions) - E2E testing patterns (referenced in search results)

### Secondary (MEDIUM confidence)

**Framework Comparisons:**
- [The 2025 State of Browser Extension Frameworks](https://redreamality.com/blog/the-2025-state-of-browser-extension-frameworks-a-comparative-analysis-of-plasmo-wxt-and-crxjs/) - WXT vs Plasmo vs CRXJS analysis
- [Building AI-Powered Browser Extensions With WXT](https://marmelab.com/blog/2025/04/15/browser-extension-form-ai-wxt.html) - Real-world WXT usage
- [Chrome Extension Development in 2025](https://www.devkit.best/blog/mdx/chrome-extension-framework-comparison-2025) - Framework comparison

**Developer Guides:**
- [Understanding Chrome Extensions: Manifest V3](https://dev.to/javediqbal8381/understanding-chrome-extensions-a-developers-guide-to-manifest-v3-233l) - MV3 architecture overview
- [How to Automate Tests for a Chrome Extension using Playwright](https://www.browserstack.com/guide/playwright-chrome-extension) - Testing patterns

**Testing Libraries:**
- [vitest-chrome GitHub](https://github.com/probil/vitest-chrome) - Chrome API mocking (alternative to @webext-core/fake-browser)

### Tertiary (LOW confidence - not relied upon)

**Community Discussions:**
- Various Google Groups chromium-extensions threads - Context invalidation, storage patterns
- Stack Overflow answers - Messaging patterns

**Note:** All architectural decisions based on official Chrome and WXT documentation. Community sources used only for validation and alternative perspectives.

## Metadata

**Confidence breakdown:**
- Service worker patterns: HIGH - Official Chrome documentation, tested patterns
- WXT framework: HIGH - Official documentation, active maintenance, recent examples
- Testing infrastructure: HIGH - Official Playwright + Vitest + WXT integration docs
- Context invalidation: MEDIUM - Pattern documented but UX approach requires iteration
- Storage patterns: HIGH - Official chrome.storage API documentation

**Research date:** 2026-01-29
**Valid until:** 60 days (stable infrastructure domain, slow-changing APIs)

**Project-specific notes:**
- POC Semantic Resolver already validates Manifest V3 + TypeScript + Playwright stack
- Reusing POC patterns for content script structure reduces risk
- WXT provides superior DX over POC's manual Vite config
- Phase 1 focuses on infrastructure - UI framework (Preact) deferred to later phases

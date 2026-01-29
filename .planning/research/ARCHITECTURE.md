# Architecture Patterns: Chrome Manifest V3 Extension

**Domain:** Browser automation extension
**Researched:** 2026-01-29
**Confidence:** HIGH

## Executive Summary

Browserlet requires a three-component architecture typical of complex Manifest V3 extensions: Content Script (DOM access), Service Worker (orchestration and API access), and Side Panel (UI). The critical architectural challenge is managing communication and state across these components given the service worker's non-persistent lifecycle. This document provides proven patterns for component boundaries, message passing, state management, and build order.

## Recommended Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Web Page (Untrusted)                     │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Content Script (Isolated World)                            │ │
│  │ - DOM observation (MutationObserver)                       │ │
│  │ - Event capture (user actions)                             │ │
│  │ - Element highlighting                                     │ │
│  │ - Semantic target resolution execution                     │ │
│  └─────────────────────┬──────────────────────────────────────┘ │
└────────────────────────┼────────────────────────────────────────┘
                         │ chrome.runtime.sendMessage()
                         │ chrome.runtime.onMessage
                         ▼
         ┌───────────────────────────────────────────┐
         │ Service Worker (Background)               │
         │ - Script engine (BSL parser)              │
         │ - Trigger engine (condition matching)     │
         │ - Context manager (state orchestration)   │
         │ - Semantic resolver (LLM integration)     │
         │ - chrome.storage management               │
         └───────────┬───────────────────────────────┘
                     │ chrome.runtime.sendMessage()
                     │ chrome.runtime.onMessage
                     ▼
         ┌───────────────────────────────────────────┐
         │ Side Panel (Extension Page)               │
         │ - Context display                         │
         │ - Script list management                  │
         │ - Execution progress UI                   │
         │ - Results visualization                   │
         │ - Full Chrome API access                  │
         └───────────────────────────────────────────┘
```

### Component Boundaries

| Component | Responsibility | API Access | Persistence | Communicates With |
|-----------|---------------|------------|-------------|-------------------|
| **Content Script** | DOM interaction only - read page state, execute actions, highlight elements | Limited (no chrome.storage, chrome.tabs) | None (reloaded on navigation) | Service Worker only |
| **Service Worker** | Orchestration hub - manages state, processes BSL, coordinates components | Full Chrome APIs | Non-persistent (30s idle timeout) | Content Scripts, Side Panel, External APIs |
| **Side Panel** | UI presentation - displays state, receives user input | Full Chrome APIs | Persistent while open | Service Worker only |

**Critical Rule:** Content Scripts cannot directly communicate with Side Panel. All messages must route through Service Worker.

## Data Flow Patterns

### Pattern 1: Recording Flow (User → LLM → BSL)

```
User Action on Page
    ↓
1. Content Script captures event
    ↓ chrome.runtime.sendMessage({type: 'ACTION_CAPTURED', action: {...}})
    ↓
2. Service Worker receives action
    ↓ Stores in chrome.storage.local
    ↓ Sends to LLM API
    ↓ Receives BSL script
    ↓ chrome.runtime.sendMessage({type: 'BSL_GENERATED', script: {...}})
    ↓
3. Side Panel updates UI
    (displays new script)
```

**Key Decision:** Service Worker acts as central state manager, persisting to chrome.storage.local immediately to survive termination.

### Pattern 2: Execution Flow (BSL → Actions)

```
User clicks "Execute" in Side Panel
    ↓ chrome.runtime.sendMessage({type: 'EXECUTE_SCRIPT', scriptId: '...'})
    ↓
1. Service Worker receives command
    ↓ Retrieves BSL from chrome.storage.local
    ↓ Parses BSL into action steps
    ↓ chrome.tabs.sendMessage({type: 'EXECUTE_STEP', step: {...}})
    ↓
2. Content Script executes step
    ↓ Resolves semantic targets
    ↓ Executes DOM action
    ↓ chrome.runtime.sendMessage({type: 'STEP_COMPLETE', result: {...}})
    ↓
3. Service Worker updates progress
    ↓ Stores in chrome.storage.local
    ↓ chrome.runtime.sendMessage({type: 'PROGRESS_UPDATE', progress: {...}})
    ↓
4. Side Panel updates UI
    (shows execution progress)
```

**Key Decision:** Step-by-step execution with acknowledgment ensures resilience to service worker termination between steps.

### Pattern 3: Trigger Flow (Context → Suggestion)

```
Page Navigation / DOM Change
    ↓
1. Content Script observes context
    ↓ chrome.runtime.sendMessage({type: 'CONTEXT_DETECTED', context: {...}})
    ↓
2. Service Worker matches triggers
    ↓ Queries chrome.storage.local for trigger rules
    ↓ Evaluates conditions
    ↓ chrome.runtime.sendMessage({type: 'TRIGGER_MATCHED', suggestion: {...}})
    ↓
3. Side Panel displays suggestion
    (or Content Script shows overlay)
```

**Key Decision:** Trigger evaluation happens in Service Worker to access full storage and avoid content script memory limits.

## Message Passing Architecture

### Message Types and Direction

| Message Type | From | To | Purpose | Response Expected |
|--------------|------|-----|---------|-------------------|
| `ACTION_CAPTURED` | Content Script | Service Worker | User action during recording | No |
| `BSL_GENERATED` | Service Worker | Side Panel | New script created | No |
| `EXECUTE_SCRIPT` | Side Panel | Service Worker | Start script execution | No |
| `EXECUTE_STEP` | Service Worker | Content Script | Execute single action | Yes (result) |
| `STEP_COMPLETE` | Content Script | Service Worker | Action executed | No |
| `PROGRESS_UPDATE` | Service Worker | Side Panel | Execution progress | No |
| `CONTEXT_DETECTED` | Content Script | Service Worker | Page context changed | No |
| `TRIGGER_MATCHED` | Service Worker | Side Panel/Content | Trigger condition met | No |
| `STORAGE_CHANGED` | chrome.storage.onChanged | All components | State synchronized | No |

### Implementation Pattern: One-Time Messages

**Sender (Content Script to Service Worker):**
```typescript
// Content Script
async function captureAction(action: UserAction) {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'ACTION_CAPTURED',
      action: action
    });
    console.log('Action recorded:', response.recordingId);
  } catch (error) {
    console.error('Failed to send action:', error);
    // Service worker may have terminated - retry logic needed
  }
}
```

**Receiver (Service Worker):**
```typescript
// Service Worker - MUST register at top level
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Async handling pattern
  handleMessage(message, sender).then(sendResponse);
  return true; // Keep channel open for async response
});

async function handleMessage(message, sender) {
  switch (message.type) {
    case 'ACTION_CAPTURED':
      const recordingId = await storeAction(message.action);
      return { recordingId };
    case 'EXECUTE_STEP':
      const result = await executeStep(message.step);
      return { result };
    default:
      return { error: 'Unknown message type' };
  }
}
```

**Critical Pattern:** Event listeners MUST be registered synchronously at the top level of the service worker script. Asynchronous registration (inside promises, callbacks, or after initialization) will cause race conditions where messages are lost when the service worker restarts.

### Implementation Pattern: Long-Lived Connections

Use for streaming execution progress or continuous DOM observation.

**Service Worker to Content Script (Execution Session):**
```typescript
// Service Worker
async function startExecution(scriptId: string, tabId: number) {
  const port = chrome.tabs.connect(tabId, { name: 'execution' });

  port.onMessage.addListener((msg) => {
    if (msg.type === 'STEP_COMPLETE') {
      updateProgress(scriptId, msg.stepIndex);
      // Send next step
      port.postMessage({ type: 'EXECUTE_STEP', step: nextStep });
    }
  });

  port.onDisconnect.addListener(() => {
    console.log('Execution port disconnected');
    // Handle reconnection if service worker restarted
  });

  // Start execution
  port.postMessage({ type: 'START_EXECUTION', scriptId });
}
```

**Content Script:**
```typescript
// Content Script
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'execution') return;

  port.onMessage.addListener(async (msg) => {
    if (msg.type === 'EXECUTE_STEP') {
      const result = await executeAction(msg.step);
      port.postMessage({ type: 'STEP_COMPLETE', result });
    }
  });
});
```

**Important:** Ports disconnect when service worker terminates. Implement reconnection logic for long-running operations.

## State Management Strategy

### State Categories and Storage

| State Type | Storage Location | Sync | Max Size | Use Case |
|------------|-----------------|------|----------|----------|
| **Scripts (BSL)** | chrome.storage.local | No | Unlimited* | User's automation scripts |
| **User Settings** | chrome.storage.sync | Yes | 100KB total | Preferences, API keys |
| **Execution State** | chrome.storage.local | No | Unlimited* | Current execution progress |
| **Page Context** | chrome.storage.session | No | 10MB | Temporary context during session |
| **Trigger Cache** | chrome.storage.local | No | Unlimited* | Trigger rules and conditions |

*Requires `unlimitedStorage` permission in manifest.json

### Service Worker State Pattern

**Problem:** Service worker terminates after 30 seconds of inactivity. Global variables are lost.

**Solution:** Treat chrome.storage as source of truth, with in-memory cache for performance.

```typescript
// Service Worker - State Management
class StateManager {
  private cache: Map<string, any> = new Map();
  private loadPromise: Promise<void> | null = null;

  async initialize() {
    // Load critical state on startup
    if (!this.loadPromise) {
      this.loadPromise = this.loadFromStorage();
    }
    await this.loadPromise;
  }

  private async loadFromStorage() {
    const data = await chrome.storage.local.get(['scripts', 'triggers']);
    this.cache.set('scripts', data.scripts || {});
    this.cache.set('triggers', data.triggers || []);
  }

  async getScripts() {
    await this.initialize();
    return this.cache.get('scripts');
  }

  async saveScript(script: Script) {
    await this.initialize();
    const scripts = this.cache.get('scripts');
    scripts[script.id] = script;
    this.cache.set('scripts', scripts);

    // Persist immediately
    await chrome.storage.local.set({ scripts });
  }
}

const stateManager = new StateManager();

// In message handlers
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message).then(sendResponse);
  return true;
});

async function handleMessage(message) {
  switch (message.type) {
    case 'GET_SCRIPTS':
      return await stateManager.getScripts();
    case 'SAVE_SCRIPT':
      await stateManager.saveScript(message.script);
      return { success: true };
  }
}
```

**Critical Pattern:** Load state asynchronously in message handlers, not globally. Service worker may restart between messages.

### State Synchronization Across Components

**Problem:** Side Panel and Content Script need to react to state changes made by Service Worker.

**Solution:** Use chrome.storage.onChanged for broadcast updates.

```typescript
// All components listen for storage changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;

  if (changes.scripts) {
    updateScriptsList(changes.scripts.newValue);
  }

  if (changes.executionState) {
    updateProgressUI(changes.executionState.newValue);
  }
});
```

**Important:** chrome.storage.onChanged fires in all contexts (service worker, side panel, content scripts), enabling reactive state updates without explicit messaging.

## Side Panel Integration

### Configuration (manifest.json)

```json
{
  "manifest_version": 3,
  "side_panel": {
    "default_path": "sidepanel.html"
  },
  "permissions": [
    "sidePanel",
    "storage",
    "tabs"
  ]
}
```

### Opening Side Panel

**From User Action (Action Icon):**
```typescript
// Service Worker
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
```

**Programmatically (from Service Worker):**
```typescript
// Must be in response to user action
chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ tabId: tab.id });
});
```

**Per-Tab Panel (Context-Specific):**
```typescript
// Enable side panel only on specific domains
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === 'complete' && tab.url?.includes('example.com')) {
    chrome.sidePanel.setOptions({
      tabId,
      path: 'sidepanel.html',
      enabled: true
    });
  }
});
```

### Side Panel Lifecycle

**Key Characteristics:**
- Persists across tab navigation (if configured globally)
- Has full Chrome API access (unlike content scripts)
- Can be global or per-tab
- Closes when user closes it or window closes

**Side Panel to Service Worker Communication:**
```typescript
// Side Panel
async function executeScript(scriptId: string) {
  const response = await chrome.runtime.sendMessage({
    type: 'EXECUTE_SCRIPT',
    scriptId
  });
  console.log('Execution started:', response);
}

// Listen for updates from service worker
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'PROGRESS_UPDATE') {
    updateProgressBar(message.progress);
  }
});
```

## Content Script Injection and Lifecycle

### Declarative Injection (manifest.json)

```json
{
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content-script.js"],
      "run_at": "document_idle"
    }
  ]
}
```

**When to use:**
- Script needed on most pages
- Script is core functionality
- Simplicity preferred

### Programmatic Injection (Service Worker)

```typescript
// Service Worker
chrome.action.onClicked.addListener(async (tab) => {
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content-script.js']
  });
});
```

**When to use:**
- Script only needed on demand
- Resource optimization important
- User triggers injection

### Content Script Run Timing

| run_at | When | DOM State | Use Case |
|--------|------|-----------|----------|
| `document_start` | Before DOM constructed | None | Intercept page scripts early |
| `document_end` | DOM complete, resources loading | Complete | Safe DOM access, faster than idle |
| `document_idle` | Page idle (default) | Complete | Standard choice for most scripts |

**Recommendation:** Use `document_idle` for Browserlet. DOM observation and action execution require full DOM and should not impact page load performance.

### Content Script Isolation

**What Content Scripts CAN Access:**
- Page DOM (read and modify)
- chrome.runtime messaging APIs
- chrome.storage APIs
- Window location and history

**What Content Scripts CANNOT Access:**
- chrome.tabs, chrome.windows (requires service worker)
- Page JavaScript variables (isolated world)
- Cross-origin fetch (requires service worker with host permissions)

**Pattern for Privileged Operations:**
```typescript
// Content Script - needs to fetch data
async function fetchUserData(url: string) {
  // Cannot fetch cross-origin directly - ask service worker
  const response = await chrome.runtime.sendMessage({
    type: 'FETCH_DATA',
    url
  });
  return response.data;
}

// Service Worker - has permissions
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FETCH_DATA') {
    fetch(message.url)
      .then(r => r.json())
      .then(data => sendResponse({ data }))
      .catch(error => sendResponse({ error: error.message }));
    return true; // Async response
  }
});
```

## Performance Patterns

### Content Script Performance

**Problem:** Content scripts can slow down page load and interaction.

**Solutions:**

1. **Use MutationObserver for DOM monitoring, not polling:**
```typescript
// Good: Efficient DOM observation
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.type === 'childList') {
      handleNewElements(mutation.addedNodes);
    }
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Bad: Expensive polling
setInterval(() => {
  const elements = document.querySelectorAll('.new-element');
  // This runs repeatedly even when nothing changes
}, 1000);
```

2. **Cache querySelector results:**
```typescript
// Good: Cache selectors
const cache = new Map<string, Element>();

function getElement(selector: string): Element | null {
  if (cache.has(selector)) {
    const el = cache.get(selector);
    if (el?.isConnected) return el;
    cache.delete(selector);
  }
  const el = document.querySelector(selector);
  if (el) cache.set(selector, el);
  return el;
}

// Bad: Repeated expensive queries
function highlightElement() {
  document.querySelector('.target').classList.add('highlight');
  document.querySelector('.target').scrollIntoView();
  document.querySelector('.target').focus();
}
```

3. **Use document_idle run timing:**
```json
{
  "content_scripts": [{
    "run_at": "document_idle"  // Default, runs after page load
  }]
}
```

### Service Worker Performance

**Problem:** Service worker has 30-second idle timeout and 5-minute maximum execution time.

**Solutions:**

1. **Use Alarms API instead of setTimeout:**
```typescript
// Good: Survives service worker restart
chrome.alarms.create('checkTriggers', { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkTriggers') {
    evaluateTriggers();
  }
});

// Bad: Canceled when service worker terminates
setTimeout(() => {
  evaluateTriggers(); // May never run
}, 60000);
```

2. **Batch chrome.storage writes:**
```typescript
// Good: Single write operation
const updates = {
  script1: updatedScript1,
  script2: updatedScript2,
  lastSync: Date.now()
};
await chrome.storage.local.set(updates);

// Bad: Multiple round trips
await chrome.storage.local.set({ script1: updatedScript1 });
await chrome.storage.local.set({ script2: updatedScript2 });
await chrome.storage.local.set({ lastSync: Date.now() });
```

3. **Keep WebSocket connections to extend lifetime:**
```typescript
// WebSocket connections extend service worker lifetime
const ws = new WebSocket('wss://api.example.com');
ws.onmessage = (event) => {
  handleMessage(JSON.parse(event.data));
};
// Connection keeps worker alive
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Synchronous Storage Access

**What goes wrong:** chrome.storage is asynchronous only. No synchronous API exists.

**Why bad:** Trying to use localStorage or global variables instead will lose data on service worker termination.

**Instead:**
```typescript
// Wrong: localStorage doesn't work in service workers
localStorage.setItem('script', JSON.stringify(script));

// Wrong: Global variables lost on termination
let currentScript = null;

// Right: Async chrome.storage
await chrome.storage.local.set({ currentScript: script });
const { currentScript } = await chrome.storage.local.get('currentScript');
```

### Anti-Pattern 2: Direct Content Script to Side Panel Messaging

**What goes wrong:** Attempting to message side panel directly from content script.

**Why bad:** Content scripts can only message the service worker using chrome.runtime.sendMessage(). They have no API to target specific extension pages.

**Instead:**
```typescript
// Wrong: No direct path
// content-script.js
chrome.runtime.sendMessage({ target: 'sidepanel', data: {...} }); // Won't work

// Right: Route through service worker
// content-script.js
chrome.runtime.sendMessage({ type: 'UPDATE_UI', data: {...} });

// service-worker.js
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'UPDATE_UI') {
    // Broadcast to all extension pages (includes side panel)
    chrome.runtime.sendMessage(message);
  }
});
```

### Anti-Pattern 3: Async Event Listener Registration

**What goes wrong:** Registering onMessage listeners inside async functions or after initialization.

**Why bad:** When service worker restarts (which happens frequently), it re-executes the script. Events can fire before async registration completes, causing missed messages and race conditions.

**Instead:**
```typescript
// Wrong: Async registration
async function initialize() {
  const settings = await chrome.storage.local.get('settings');
  chrome.runtime.onMessage.addListener((message) => {
    // This may not be registered when message arrives
  });
}
initialize();

// Right: Top-level registration
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse);
  return true;
});

async function handleMessage(message, sender) {
  const settings = await chrome.storage.local.get('settings');
  // Use settings in handler
}
```

### Anti-Pattern 4: Assuming Service Worker Persistence

**What goes wrong:** Relying on service worker to stay alive between operations.

**Why bad:** Chrome terminates service workers after 30 seconds of inactivity. Any in-memory state is lost.

**Instead:**
```typescript
// Wrong: Stateful multi-step process
let executionState = { currentStep: 0, steps: [] };

function startExecution(steps) {
  executionState.steps = steps;
  executeNextStep(); // This may work initially
}

function executeNextStep() {
  // If service worker restarted, executionState is gone
  const step = executionState.steps[executionState.currentStep];
  // ... execute step
}

// Right: Stateless with storage persistence
async function startExecution(scriptId: string, steps: Step[]) {
  await chrome.storage.local.set({
    [`execution_${scriptId}`]: {
      currentStep: 0,
      steps
    }
  });
  executeNextStep(scriptId);
}

async function executeNextStep(scriptId: string) {
  const { [`execution_${scriptId}`]: state } =
    await chrome.storage.local.get(`execution_${scriptId}`);
  const step = state.steps[state.currentStep];
  // ... execute step
  // Update state in storage
  state.currentStep++;
  await chrome.storage.local.set({ [`execution_${scriptId}`]: state });
}
```

### Anti-Pattern 5: Content Script as State Manager

**What goes wrong:** Storing complex state in content scripts and trying to query it from service worker or side panel.

**Why bad:** Content scripts are reloaded on navigation, have memory limits, and can only be messaged if you know the tab ID.

**Instead:**
```typescript
// Wrong: Content script maintains state
// content-script.js
let capturedActions = [];

function captureAction(action) {
  capturedActions.push(action);
}

// service-worker.js tries to retrieve
chrome.tabs.sendMessage(tabId, { type: 'GET_ACTIONS' }); // Fragile

// Right: Content script sends state to service worker immediately
// content-script.js
function captureAction(action) {
  chrome.runtime.sendMessage({
    type: 'ACTION_CAPTURED',
    action
  });
}

// service-worker.js stores centrally
chrome.runtime.onMessage.addListener(async (message) => {
  if (message.type === 'ACTION_CAPTURED') {
    const actions = await getActions();
    actions.push(message.action);
    await chrome.storage.local.set({ actions });
  }
});
```

### Anti-Pattern 6: Ignoring Message Errors

**What goes wrong:** Not handling errors when service worker is restarting.

**Why bad:** chrome.runtime.sendMessage throws when receiver doesn't exist (e.g., service worker terminated and not yet restarted).

**Instead:**
```typescript
// Wrong: No error handling
chrome.runtime.sendMessage({ type: 'ACTION' });

// Right: Handle receiver unavailable
async function sendMessageWithRetry(message, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await chrome.runtime.sendMessage(message);
    } catch (error) {
      if (error.message.includes('Receiving end does not exist')) {
        // Service worker is restarting, wait and retry
        await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
        continue;
      }
      throw error; // Other error, don't retry
    }
  }
  throw new Error('Failed to send message after retries');
}
```

## Component Build Order

### Phase 1: Foundation (Service Worker + Storage)

**Why first:** Service worker is the orchestration hub. Must exist before other components can communicate.

**Components:**
1. Service worker script with message router
2. chrome.storage schema and state manager
3. Basic message types defined
4. Event listener registration (top-level)

**Validation:** Can store and retrieve data from chrome.storage, can receive messages from chrome.runtime.sendMessage.

**Dependencies:** None

### Phase 2: Content Script (DOM Interaction)

**Why second:** Content script is the data source for recording and the executor for playback. Needs service worker to send data to.

**Components:**
1. Content script injection (declarative or programmatic)
2. DOM observation (MutationObserver)
3. Event capture system
4. Message sending to service worker
5. Message receiving from service worker

**Validation:** Can capture user actions and send to service worker, can receive execution commands and execute them.

**Dependencies:** Phase 1 (Service Worker)

### Phase 3: Side Panel (UI)

**Why third:** UI consumes state managed by service worker and sends commands to service worker. Needs service worker and content script working first to have meaningful data to display.

**Components:**
1. Side panel HTML/CSS/JS
2. Manifest configuration for side panel
3. Message sending to service worker
4. Message receiving from service worker
5. chrome.storage.onChanged listener for reactive updates

**Validation:** Can display scripts from storage, can trigger execution, can show real-time progress.

**Dependencies:** Phase 1 (Service Worker), Phase 2 (Content Script)

### Phase 4: Advanced Features (LLM, Triggers)

**Why last:** These build on the foundation of recording/playback. Require all communication patterns working.

**Components:**
1. LLM integration in service worker
2. BSL parser in service worker
3. Semantic resolver in content script
4. Trigger engine in service worker
5. Trigger UI in side panel

**Validation:** Can generate BSL from actions, can execute BSL, can match triggers.

**Dependencies:** Phase 1, 2, 3 (All core components)

### Testing Strategy per Phase

**Phase 1 Testing:**
```typescript
// Service Worker
console.log('Service worker started');

chrome.runtime.onMessage.addListener((message) => {
  console.log('Received message:', message);
  return { echo: message };
});

// Test from DevTools console (any extension page)
chrome.runtime.sendMessage({ test: 'hello' }, response => {
  console.log('Response:', response);
});
```

**Phase 2 Testing:**
```typescript
// Content Script
console.log('Content script loaded on:', window.location.href);

document.addEventListener('click', (e) => {
  chrome.runtime.sendMessage({
    type: 'CLICK_CAPTURED',
    target: e.target.tagName
  });
});

// Verify in service worker console
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'CLICK_CAPTURED') {
    console.log('Click captured:', message);
  }
});
```

**Phase 3 Testing:**
```typescript
// Side Panel
document.getElementById('testButton').addEventListener('click', async () => {
  const response = await chrome.runtime.sendMessage({
    type: 'GET_SCRIPTS'
  });
  console.log('Scripts:', response);
  document.getElementById('output').textContent = JSON.stringify(response);
});

// Verify two-way communication works
```

**Phase 4 Testing:**
```typescript
// Integration test: Record → Parse → Execute
// 1. Click on page (content script captures)
// 2. Service worker processes and stores
// 3. Side panel shows new script
// 4. User clicks execute in side panel
// 5. Service worker parses BSL
// 6. Content script executes action
// 7. Side panel shows completion
```

## Scalability Considerations

### At 100 Scripts (Typical User)

**Approach:**
- Store all scripts in chrome.storage.local as single object
- Load all scripts into memory on service worker startup
- Linear search for trigger matching
- Single-tab execution

**Performance:** Sub-millisecond script lookup, negligible storage overhead.

### At 1,000 Scripts (Power User)

**Approach:**
- Index scripts by trigger conditions
- Lazy load script content (store IDs separately from content)
- Hash-based trigger matching
- Consider script categories/folders in storage

**Performance:** <10ms trigger evaluation, ~100KB storage.

### At 10,000+ Scripts (Team/Enterprise)

**Approach:**
- External storage (sync to cloud, local cache subset)
- IndexedDB for local storage (better performance than chrome.storage for large datasets)
- Background trigger evaluation with Alarms API
- Multi-tab execution coordination
- Consider service worker memory limits (may need to stream data)

**Performance:** May require architectural changes - evaluate IndexedDB vs chrome.storage based on profiling.

**Note:** chrome.storage.local has no hard size limit with unlimitedStorage permission, but performance degrades with very large objects. Consider splitting into multiple keys or using IndexedDB at scale.

## Sources

### Official Chrome Documentation
- [Message Passing](https://developer.chrome.com/docs/extensions/develop/concepts/messaging)
- [Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- [chrome.sidePanel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
- [chrome.storage API](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [Content Scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)

### Architecture Guides (2026)
- [Chrome Extension Development: The Complete System Architecture Guide for 2026](https://jinlow.medium.com/chrome-extension-development-the-complete-system-architecture-guide-for-2026-9ae81415f93e)
- [Understanding Chrome Extensions: A Developer's Guide to Manifest V3](https://dev.to/javediqbal8381/understanding-chrome-extensions-a-developers-guide-to-manifest-v3-233l)
- [Understanding the Google Chrome Extension Architecture](https://bluegrid.io/blog/understanding-the-google-chrome-extension-architecture/)

### Best Practices
- [Effective State Management in Chrome Extensions](https://reintech.io/blog/effective-state-management-chrome-extensions)
- [Local vs Sync vs Session: Which Chrome Extension Storage Should You Use?](https://dev.to/notearthian/local-vs-sync-vs-session-which-chrome-extension-storage-should-you-use-5ec8)
- [Building a Chrome Extension Using React and Vite: Part 2 - State Management](https://dev.to/bnn1/how-do-they-talk-to-each-other-2p9)

### Performance and Troubleshooting
- [Chrome Extension V3: Mitigate service worker timeout issue](https://medium.com/@bhuvan.gandhi/chrome-extension-v3-mitigate-service-worker-timeout-issue-in-the-easiest-way-fccc01877abd)
- [Minimize an extension's impact on page load time](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/minimize-page-load-time-impact)
- [Content Scripts - Mozilla MDN](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts)

### GitHub Issues and Community
- [Race condition when attaching to Manifest V3 Service Worker](https://github.com/microsoft/vscode-js-debug/issues/1794)
- [Best Practices for State Management in MV3](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/WSepGQIMqd8)

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| Component Boundaries | HIGH | Official Chrome documentation, verified patterns |
| Message Passing | HIGH | Official API docs with code examples |
| Service Worker Lifecycle | HIGH | Official documentation and confirmed by multiple sources |
| Side Panel Integration | MEDIUM | Official API docs, but fewer real-world examples for complex cases |
| State Management | HIGH | Multiple sources agree, patterns verified in official docs |
| Performance Patterns | MEDIUM | Based on general web performance + extension-specific guidance |
| Build Order | HIGH | Logical dependency analysis based on component interactions |

## Key Takeaways for Browserlet Roadmap

1. **Service Worker is the hub:** Build it first. All communication routes through it. Treat it as stateless - persist everything to chrome.storage.local.

2. **Message passing is synchronous at registration:** Event listeners MUST be registered at top level. This dictates service worker structure - define message router before any async initialization.

3. **Content Script isolation requires proxying:** Content scripts cannot make cross-origin requests or access privileged APIs. Service worker must proxy these operations.

4. **Side Panel is an extension page:** It has full Chrome API access, unlike content scripts. Use it for complex UI and coordinating actions across tabs.

5. **Storage is your state:** chrome.storage.local is the source of truth. Service worker can cache for performance but must reload from storage on each startup.

6. **Build order is strictly sequential:** Service Worker → Content Script → Side Panel → Advanced Features. Each layer depends on the previous.

7. **Test incrementally:** Each phase must be fully functional before moving to the next. Integration issues are much harder to debug than component issues.

8. **Handle disconnections gracefully:** Service worker termination and restart is normal. Design for it from day one - retry logic, state persistence, idempotent operations.

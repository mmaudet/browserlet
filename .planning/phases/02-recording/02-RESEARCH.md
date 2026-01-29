# Phase 2: Recording - Research

**Researched:** 2026-01-29
**Domain:** Chrome Extension Event Capture & DOM Observation
**Confidence:** HIGH

## Summary

Phase 2 involves building a recording system that captures user interactions (clicks, typing, navigation) and generates semantic hints for element selection. The standard approach uses event delegation with addEventListener on the document root, MutationObserver for dynamic content, and overlay positioning for visual feedback.

The key technical challenges are: (1) capturing events across iframes using the `all_frames` manifest option, (2) generating semantic hints from DOM elements using existing POC code, (3) providing non-intrusive visual feedback via absolutely positioned overlays, and (4) managing recording state through chrome.storage.local as established in Phase 1.

The POC semantic-resolver provides 85% reusable code with 10 hint evaluators already implemented and tested. This phase focuses on event capture and hint generation, not selector resolution (which is Phase 5's concern).

**Primary recommendation:** Use document-level event delegation with capture phase for reliability, leverage POC hint generation logic, implement overlay highlighting with absolute positioning, and inject content scripts into all frames using `all_frames: true`.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Native DOM APIs | - | Event listeners, MutationObserver | Built-in, zero overhead, WXT framework provides context wrappers |
| WXT Framework | 0.20.13 | Extension scaffolding | Already used in Phase 1, provides ContentScriptContext, messaging, auto-generated manifest |
| chrome.storage.local | Manifest V3 | State persistence | Single source of truth pattern from Phase 1 |
| TypeScript | 5.9.3 | Type safety | Project standard, POC uses TypeScript |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None required | - | - | Native APIs sufficient for this phase |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Event delegation | Individual listeners per element | Delegation is faster, handles dynamic content, lower memory footprint |
| Absolute positioning overlays | CSS outline/border | Overlays don't affect layout, work with complex positioning, can render outside viewport |
| Native MutationObserver | Library wrapper | No benefit; MutationObserver is stable, well-supported, and performant as-is |

**Installation:**
```bash
# No additional packages required - all native APIs
```

## Architecture Patterns

### Recommended Project Structure
```
entrypoints/content/
├── recording/
│   ├── index.ts              # Main recording orchestrator
│   ├── eventCapture.ts       # Event listeners (click, input, navigation)
│   ├── hintGenerator.ts      # Extract semantic hints from elements (reuse POC)
│   ├── visualFeedback.ts     # Overlay highlighting
│   ├── iframeCoordinator.ts  # Cross-frame communication
│   └── types.ts              # Recording-specific types
└── index.ts                  # Main content script (Phase 1)

utils/
├── types.ts                  # Shared types (Phase 1)
└── hints.ts                  # Hint evaluator utilities (ported from POC)
```

### Pattern 1: Event Delegation with Capture Phase
**What:** Single document-level listener with `capture: true` to intercept all events before they reach target elements.
**When to use:** Recording mode active, need to capture all user interactions including those on dynamically added elements.
**Example:**
```typescript
// Source: MDN Web Docs - https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener
let recordingActive = false;

function startRecording() {
  recordingActive = true;
  // Use capture phase to intercept events before target handlers
  document.addEventListener('click', handleClick, { capture: true, passive: true });
  document.addEventListener('input', handleInput, { capture: true, passive: true });
  document.addEventListener('submit', handleSubmit, { capture: true, passive: true });
}

function handleClick(event: MouseEvent) {
  if (!recordingActive) return;

  const target = event.target as Element;
  if (!target) return;

  // Don't prevent default - just observe
  captureInteraction('click', target, event);
}

function stopRecording() {
  recordingActive = false;
  document.removeEventListener('click', handleClick, { capture: true });
  document.removeEventListener('input', handleInput, { capture: true });
  document.removeEventListener('submit', handleSubmit, { capture: true });
}
```

### Pattern 2: Semantic Hint Generation (Reuse POC)
**What:** Extract semantic attributes from DOM elements to create stable, human-readable selectors.
**When to use:** After capturing an interaction, generate hints describing the target element.
**Example:**
```typescript
// Source: POC semantic-resolver - /Users/mmaudet/work/poc-semantic-resolver/src/hints/evaluators.ts
interface CapturedHint {
  type: string;
  value: string | Record<string, string>;
}

function generateHints(element: Element): CapturedHint[] {
  const hints: CapturedHint[] = [];

  // Role (ARIA or implicit)
  const role = getElementRole(element);
  if (role) hints.push({ type: 'role', value: role });

  // Text content
  const text = getVisibleText(element);
  if (text) hints.push({ type: 'text_contains', value: text });

  // Type attribute (input/button)
  const type = element.getAttribute('type');
  if (type) hints.push({ type: 'type', value: type });

  // Name attribute
  const name = element.getAttribute('name');
  if (name) hints.push({ type: 'name', value: name });

  // Aria-label
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) hints.push({ type: 'aria_label', value: ariaLabel });

  // Placeholder
  const placeholder = element.getAttribute('placeholder');
  if (placeholder) hints.push({ type: 'placeholder_contains', value: placeholder });

  // Near label
  const label = findAssociatedLabel(element);
  if (label) hints.push({ type: 'near_label', value: label.textContent || '' });

  // Data attributes
  for (const attr of element.attributes) {
    if (attr.name.startsWith('data-')) {
      hints.push({
        type: 'data_attribute',
        value: { name: attr.name, value: attr.value }
      });
    }
  }

  return hints;
}
```

### Pattern 3: Non-Intrusive Visual Feedback
**What:** Absolutely positioned overlay that highlights elements without affecting page layout.
**When to use:** During recording to show users which element will be captured.
**Example:**
```typescript
// Source: Chrome DevTools Protocol Overlay domain pattern
class HighlightOverlay {
  private overlay: HTMLDivElement | null = null;

  show(element: Element) {
    // Remove existing overlay
    this.hide();

    // Create overlay
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position: absolute;
      pointer-events: none;
      border: 2px solid #4CAF50;
      background-color: rgba(76, 175, 80, 0.1);
      z-index: 2147483647;
      box-sizing: border-box;
    `;

    // Position over element
    const rect = element.getBoundingClientRect();
    this.overlay.style.top = `${rect.top + window.scrollY}px`;
    this.overlay.style.left = `${rect.left + window.scrollX}px`;
    this.overlay.style.width = `${rect.width}px`;
    this.overlay.style.height = `${rect.height}px`;

    document.body.appendChild(this.overlay);
  }

  hide() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  // Update on scroll/resize
  updatePosition(element: Element) {
    if (!this.overlay) return;
    const rect = element.getBoundingClientRect();
    this.overlay.style.top = `${rect.top + window.scrollY}px`;
    this.overlay.style.left = `${rect.left + window.scrollX}px`;
  }
}
```

### Pattern 4: iframe Injection with all_frames
**What:** Content script injected into all frames (main + iframes) using manifest configuration.
**When to use:** Always - many legacy applications use iframes extensively.
**Example:**
```typescript
// Source: Chrome Extensions Content Scripts - https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts

// wxt.config.ts or entrypoints/content/index.ts metadata
export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,  // KEY: Inject into all frames
  runAt: 'document_idle',
  world: 'ISOLATED',
});

// In content script - detect if in iframe
function isInIframe(): boolean {
  return window !== window.top;
}

// If in iframe, coordinate with parent
if (isInIframe()) {
  // Use chrome.runtime messaging to coordinate
  chrome.runtime.sendMessage({
    type: 'IFRAME_RECORDING_EVENT',
    frameUrl: window.location.href,
    event: capturedEvent
  });
}
```

### Pattern 5: MutationObserver for Dynamic Content
**What:** Watch for DOM changes to handle dynamically added/removed elements during recording.
**When to use:** Detect when highlighted element is removed, update overlay position on layout changes.
**Example:**
```typescript
// Source: MDN MutationObserver - https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver
class DOMWatcher {
  private observer: MutationObserver | null = null;

  start(callback: (mutations: MutationRecord[]) => void) {
    this.observer = new MutationObserver(callback);

    // Watch for changes but be selective to avoid performance issues
    this.observer.observe(document.body, {
      childList: true,      // Watch for added/removed nodes
      subtree: true,        // Watch entire tree
      attributes: false,    // Don't watch attribute changes (reduces noise)
      characterData: false  // Don't watch text changes
    });
  }

  stop() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}

// Usage: Update overlay when DOM changes
const watcher = new DOMWatcher();
watcher.start((mutations) => {
  // Check if highlighted element still exists
  if (currentHighlightedElement && !document.contains(currentHighlightedElement)) {
    overlay.hide();
  }
});
```

### Pattern 6: Navigation Event Capture
**What:** Detect page navigations including SPA route changes.
**When to use:** Record navigation actions as part of workflow.
**Example:**
```typescript
// Navigation events to capture
function setupNavigationCapture() {
  // Traditional navigation
  window.addEventListener('beforeunload', handleNavigation);

  // SPA navigation (History API)
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function(...args) {
    captureInteraction('navigate', null, { url: args[2] });
    return originalPushState.apply(this, args);
  };

  history.replaceState = function(...args) {
    captureInteraction('navigate', null, { url: args[2] });
    return originalReplaceState.apply(this, args);
  };

  // Popstate (back/forward)
  window.addEventListener('popstate', (event) => {
    captureInteraction('navigate', null, { url: window.location.href });
  });
}
```

### Anti-Patterns to Avoid

- **Individual event listeners per element:** Memory intensive, doesn't handle dynamic content, creates/removes listeners constantly. Use event delegation instead.

- **CSS outline/border for highlighting:** Affects layout (outline doesn't, but has limited styling), can't render outside element bounds, conflicts with page styles. Use absolutely positioned overlays.

- **Synchronous chrome.storage calls:** Blocks UI thread. Always use async/await or promises with chrome.storage.local.

- **getEventListeners() API:** Only works in DevTools console, not available in content scripts. Capture events through delegation, not introspection.

- **Nested event listener registration:** Chrome requires static registration in service workers. For content scripts, always register at top level of main execution.

- **Observing all MutationObserver options:** Massive performance overhead. Only observe childList + subtree for recording use case.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Semantic hint extraction | Custom attribute priority logic | POC semantic-resolver hint evaluators | Already implemented, tested, supports 10 hint types with scoring |
| Element role detection | Parse tagName + ARIA manually | POC getElementRole() utility | Handles implicit roles, ARIA overrides, edge cases |
| Text normalization | String.trim().toLowerCase() | POC normalizeText() with accent removal | Handles unicode, multiple spaces, zero-width characters |
| Associated label finding | querySelectorAll('label') | POC findAssociatedLabel() | Handles label[for], wrapping labels, aria-labelledby |
| Visible text extraction | element.textContent | POC getVisibleText() | Excludes hidden elements, scripts, styles |
| Cross-frame messaging | Custom postMessage protocol | chrome.runtime messaging | Secure, typed, handles context invalidation |

**Key insight:** The POC semantic-resolver contains battle-tested code for hint generation. Don't reimplement - port and adapt. The hard problems (fuzzy matching, label association, role detection) are already solved.

## Common Pitfalls

### Pitfall 1: Event Listener Memory Leaks
**What goes wrong:** Listeners registered but never removed, especially on SPA route changes or when stopping recording.
**Why it happens:** Content scripts persist across page lifetime, forgotten cleanup on state changes.
**How to avoid:** Always pair addEventListener with removeEventListener, store listener references, implement explicit stop() method.
**Warning signs:** Browser sluggishness after multiple record/stop cycles, DevTools memory profiler shows growing listener count.

### Pitfall 2: iframe Same-Origin Policy Violations
**What goes wrong:** Cannot access iframe content, events don't propagate, recording silently fails in iframes.
**Why it happens:** Cross-origin iframes block direct DOM access, all_frames doesn't bypass security.
**How to avoid:** Inject content script into all frames with `allFrames: true`, use chrome.runtime messaging for coordination, handle cross-origin gracefully.
**Warning signs:** Recording works on main page but not in embedded content, console errors about cross-origin access.

### Pitfall 3: MutationObserver Performance Degradation
**What goes wrong:** UI freezes, high CPU usage, recording lags behind user actions.
**Why it happens:** Observing too many mutation types, running heavy logic in callback, no debouncing.
**How to avoid:** Only observe childList + subtree, debounce callback execution, disconnect observer when not needed, avoid synchronous DOM queries in callback.
**Warning signs:** Performance timeline shows long mutation callback tasks, page feels sluggish during recording.

### Pitfall 4: Overlay Z-Index Conflicts
**What goes wrong:** Highlight overlay appears behind page elements, doesn't show at all, or covers too much.
**Why it happens:** Page uses high z-index values, fixed positioning elements, portals/shadow DOM.
**How to avoid:** Use maximum safe z-index (2147483647), check for fixed/sticky ancestors, handle shadow DOM separately.
**Warning signs:** Highlight not visible on modals, dropdowns appear over highlight, highlight in wrong position.

### Pitfall 5: Context Invalidation on Navigation
**What goes wrong:** Content script stops working after page navigation, message passing fails, recording breaks.
**Why it happens:** Chrome unloads content scripts on certain navigations, WXT context becomes invalid.
**How to avoid:** Use WXT's ContentScriptContext, implement reconnection logic, store state in chrome.storage not memory, detect invalidation and reinitialize.
**Warning signs:** Recording works initially but stops after SPA navigation, console shows "Extension context invalidated" errors.

### Pitfall 6: Event Capture vs Bubbling Phase Confusion
**What goes wrong:** Events not captured, handler called multiple times, event ordering issues.
**Why it happens:** Using wrong phase (bubble vs capture), not understanding event propagation.
**How to avoid:** Use capture phase (`capture: true`) for recording to intercept events first, don't call preventDefault() unless intentional.
**Warning signs:** Missed click events on certain elements, events captured twice, page functionality breaks during recording.

### Pitfall 7: Hint Generation Performance
**What goes wrong:** Noticeable lag when clicking elements, UI freezes on interaction.
**Why it happens:** Synchronous hint generation with expensive DOM traversal (near_label, data attributes).
**How to avoid:** Generate hints asynchronously, use requestIdleCallback for non-critical hints, cache results when possible, limit DOM traversal depth.
**Warning signs:** Performance timeline shows long tasks on click, users report sluggish feel during recording.

### Pitfall 8: Race Conditions with Storage
**What goes wrong:** Recording state out of sync, actions lost, duplicate captures.
**Why it happens:** Multiple async chrome.storage operations, no state coordination between frames.
**How to avoid:** Use message passing through service worker as state coordinator, implement storage change listeners, use transaction-like patterns.
**Warning signs:** Inconsistent recording state, actions appear multiple times, start/stop buttons out of sync with actual state.

## Code Examples

Verified patterns from official sources:

### Recording State Machine
```typescript
// Manage recording lifecycle
type RecordingState = 'idle' | 'recording' | 'paused';

class RecordingManager {
  private state: RecordingState = 'idle';
  private capturedActions: CapturedAction[] = [];
  private eventCleanup: (() => void)[] = [];

  async start() {
    if (this.state === 'recording') return;

    this.state = 'recording';
    this.capturedActions = [];

    // Set up event listeners with cleanup
    const clickHandler = (e: MouseEvent) => this.handleClick(e);
    const inputHandler = (e: Event) => this.handleInput(e);

    document.addEventListener('click', clickHandler, { capture: true, passive: true });
    document.addEventListener('input', inputHandler, { capture: true, passive: true });

    // Store cleanup functions
    this.eventCleanup.push(() => {
      document.removeEventListener('click', clickHandler, { capture: true });
      document.removeEventListener('input', inputHandler, { capture: true });
    });

    // Notify service worker
    await chrome.runtime.sendMessage({
      type: 'RECORDING_STATE_CHANGED',
      state: 'recording'
    });
  }

  async stop() {
    if (this.state === 'idle') return;

    this.state = 'idle';

    // Clean up all listeners
    this.eventCleanup.forEach(cleanup => cleanup());
    this.eventCleanup = [];

    // Save actions to storage
    await chrome.storage.local.set({
      recordedActions: this.capturedActions
    });

    // Notify service worker
    await chrome.runtime.sendMessage({
      type: 'RECORDING_STATE_CHANGED',
      state: 'idle',
      actionCount: this.capturedActions.length
    });
  }

  private handleClick(event: MouseEvent) {
    if (this.state !== 'recording') return;

    const target = event.target as Element;
    if (!target) return;

    const hints = generateHints(target);
    const action: CapturedAction = {
      type: 'click',
      timestamp: Date.now(),
      hints,
      url: window.location.href,
      frameDepth: window.frames.length
    };

    this.capturedActions.push(action);
  }

  private handleInput(event: Event) {
    if (this.state !== 'recording') return;

    const target = event.target as HTMLInputElement;
    if (!target) return;

    const hints = generateHints(target);
    const action: CapturedAction = {
      type: 'input',
      timestamp: Date.now(),
      hints,
      value: target.value,
      url: window.location.href
    };

    this.capturedActions.push(action);
  }
}
```

### Cross-Frame Coordination
```typescript
// Coordinate recording across main frame and iframes
// Source: Chrome Extensions Content Scripts pattern

// In each frame's content script
const isMainFrame = window === window.top;

if (isMainFrame) {
  // Main frame: coordinate child frames
  let childFrameStates = new Map<string, boolean>();

  chrome.runtime.onMessage.addListener((message, sender) => {
    if (message.type === 'IFRAME_READY') {
      const frameId = message.frameId;
      childFrameStates.set(frameId, false);
    }

    if (message.type === 'IFRAME_EVENT') {
      // Aggregate events from child frames
      handleRecordedEvent(message.event);
    }
  });
} else {
  // iframe: report to main frame
  const frameId = generateFrameId();

  chrome.runtime.sendMessage({
    type: 'IFRAME_READY',
    frameId,
    frameUrl: window.location.href
  });

  function captureEvent(event: CapturedAction) {
    chrome.runtime.sendMessage({
      type: 'IFRAME_EVENT',
      frameId,
      event
    });
  }
}

function generateFrameId(): string {
  return `${window.location.href}-${Date.now()}`;
}
```

### Debounced MutationObserver
```typescript
// Avoid performance issues with high-frequency mutations
// Source: MutationObserver best practices

class DebouncedMutationObserver {
  private observer: MutationObserver;
  private timeout: number | null = null;
  private readonly DEBOUNCE_MS = 250;

  constructor(callback: () => void) {
    this.observer = new MutationObserver(() => {
      // Debounce: only call after mutations stop for 250ms
      if (this.timeout !== null) {
        clearTimeout(this.timeout);
      }

      this.timeout = window.setTimeout(() => {
        callback();
        this.timeout = null;
      }, this.DEBOUNCE_MS);
    });
  }

  observe(target: Node) {
    this.observer.observe(target, {
      childList: true,
      subtree: true,
      // IMPORTANT: Only observe what's needed
      attributes: false,
      characterData: false
    });
  }

  disconnect() {
    if (this.timeout !== null) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    this.observer.disconnect();
  }
}

// Usage
const mutationWatcher = new DebouncedMutationObserver(() => {
  // This runs max once per 250ms, even with thousands of mutations
  updateOverlayPosition();
});

mutationWatcher.observe(document.body);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| XPath selectors | Semantic hint-based selectors | 2020s (Playwright test-id pattern) | More stable across UI changes, better for AI/LLM consumption |
| Inline event handlers (onclick) | addEventListener with delegation | ES5+ era | Better separation of concerns, dynamic content support |
| Mutation Events API | MutationObserver | 2012 (Chrome 18) | 10-100x better performance, batched callbacks |
| document.domain for cross-origin | postMessage() and Channel Messaging API | 2022 (Chrome 106) | document.domain deprecated, postMessage is standard |
| CSS outline for highlights | Absolute positioned overlays | DevTools Protocol pattern | No layout impact, better z-index control |
| Manifest V2 background pages | Manifest V3 service workers | 2023 (Chrome 88+) | Stateless architecture, chrome.storage required |

**Deprecated/outdated:**
- **Mutation Events (DOMNodeInserted, etc):** Replaced by MutationObserver in 2012. Synchronous, severe performance issues.
- **document.domain modification:** Chrome made it immutable in 2022. Use postMessage for cross-origin communication.
- **background page with persistent: true:** Manifest V3 only supports service workers (ephemeral).
- **chrome.tabs.executeScript:** Replaced by chrome.scripting.executeScript in MV3.

## Open Questions

Things that couldn't be fully resolved:

1. **Cross-origin iframe recording limitations**
   - What we know: all_frames injects scripts into all frames, but cross-origin iframes have security restrictions
   - What's unclear: Exact behavior with CORS policies, frame-ancestors CSP, whether Permission Policy affects recording
   - Recommendation: Implement and test with real legacy ERP applications (as noted in POC concerns), gracefully degrade for cross-origin frames

2. **Optimal MutationObserver configuration for recording**
   - What we know: Should observe childList + subtree, debounce callbacks, disconnect when not recording
   - What's unclear: Whether to observe during recording or only when overlay is active, performance impact on heavy SPAs
   - Recommendation: Implement performance profiling (as noted in POC concerns), make observer configuration adaptive based on page complexity

3. **Hint generation performance budget**
   - What we know: POC targets <50ms simple, <100ms complex
   - What's unclear: Real-world performance on legacy ERP applications with complex DOM, whether async generation is acceptable
   - Recommendation: Port POC code directly, measure in Phase 2 verification, optimize if needed in Phase 3

4. **Shadow DOM traversal strategy**
   - What we know: POC supports Shadow DOM traversal (includeShadowDOM config)
   - What's unclear: Whether to traverse Shadow DOM during event capture or only during hint generation
   - Recommendation: Traverse during hint generation only to minimize performance impact, document as known limitation for shadow-root events

5. **Visual feedback for elements outside viewport**
   - What we know: Absolute positioning works for in-viewport elements
   - What's unclear: Whether to scroll element into view, show indicator at viewport edge, or skip highlighting
   - Recommendation: Start with no-scroll approach, add scroll-into-view as enhancement in Phase 3 if needed

## Sources

### Primary (HIGH confidence)
- Chrome Extensions Content Scripts - https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts
- MDN Content Scripts - https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts
- MDN MutationObserver - https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver
- Chrome Service Worker Events - https://developer.chrome.com/docs/extensions/get-started/tutorial/service-worker-events
- POC Semantic Resolver - /Users/mmaudet/work/poc-semantic-resolver (local codebase)
- WXT Framework - https://wxt.dev/
- chrome.scripting API - https://developer.chrome.com/docs/extensions/reference/api/scripting

### Secondary (MEDIUM confidence)
- [Event delegation best practices](https://gomakethings.com/why-event-delegation-is-a-better-way-to-listen-for-events-in-vanilla-js/)
- [MutationObserver performance (Mozilla Hacks)](https://hacks.mozilla.org/2012/05/dom-mutationobserver-reacting-to-dom-changes-without-killing-browser-performance/)
- [Chrome Recorder Puppeteer Replay architecture](https://github.com/puppeteer/replay)
- [Headless Recorder extension](https://github.com/checkly/headless-recorder)
- [Playwright selector best practices](https://www.browserstack.com/guide/playwright-selectors-best-practices)
- [CSS Custom Highlight API](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Custom_highlight_API)

### Tertiary (LOW confidence)
- Event delegation performance comparisons (multiple sources, need validation with profiling)
- Chrome Debugger API for getEventListeners workaround (complex, likely unnecessary for this use case)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All native APIs, established patterns, existing Phase 1 infrastructure
- Architecture: HIGH - Patterns verified from official Chrome/MDN docs, POC provides working code
- Pitfalls: HIGH - Based on Chrome extension development experience patterns, well-documented issues

**Research date:** 2026-01-29
**Valid until:** 2026-02-28 (30 days) - Native APIs are stable, Chrome extension architecture is mature

**Key decision points:**
- POC semantic-resolver code is 85% reusable - port rather than rewrite
- Event delegation is proven superior to individual listeners for this use case
- all_frames: true is required for iframe support, but cross-origin limitations exist
- MutationObserver is necessary but must be configured carefully for performance
- Overlay highlighting is standard pattern from Chrome DevTools Protocol

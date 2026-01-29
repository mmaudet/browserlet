# Phase 6: Contextual Triggers - Research

**Researched:** 2026-01-29
**Domain:** Chrome Extension Context Detection & Conditional Script Execution
**Confidence:** HIGH

## Summary

Phase 6 implements a context-aware trigger system that detects page state (URL patterns, element presence) and suggests or auto-executes relevant scripts. The research reveals that Chrome provides excellent native APIs for this functionality, particularly `chrome.declarativeContent` for efficient context matching without content script overhead, and the existing codebase already contains the core building blocks (URL pattern matching, MutationObserver-based element detection, semantic resolution).

The standard approach combines three layers: (1) declarative content rules for lightweight URL/CSS matching to enable Side Panel UI, (2) content script context detection for element-based triggers, and (3) user-configurable trigger rules stored per-script with per-site override capability. Performance is maintained through debouncing, efficient MutationObserver configuration, and conditional observer activation.

**Primary recommendation:** Leverage `chrome.declarativeContent` API for URL-based triggers (zero content script overhead), extend existing `sessionDetector.ts` patterns for element presence detection, store trigger configurations in script metadata with per-domain enable/disable state, and use `chrome.notifications` for auto-execute notifications.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| chrome.declarativeContent | Native | Efficient page context matching | Official Chrome API - enables action/badge without content scripts, batches rule evaluation |
| chrome.notifications | Native | User notifications for auto-execute | Official Chrome API - system-native notifications with interaction support |
| chrome.action | Native | Badge updates for context matches | Official Chrome API - visual feedback on toolbar icon (MV3 standard) |
| MutationObserver | Native DOM API | Dynamic element detection | W3C standard - efficient batched DOM change detection, already used in codebase |
| chrome.storage.local | Native | Trigger configuration persistence | Already in use - storage API for extension data |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| chrome.tabs | Native | Tab-specific side panel control | Open side panel when context matches in suggest mode |
| chrome.sidePanel | Native | Side panel visibility control | Show/hide panel based on context (Chrome 114+) |
| IntersectionObserver | Native DOM API | Visibility detection | Optimize trigger checks - only observe visible elements |
| Page Visibility API | Native | Tab active/background state | Pause context monitoring when tab not visible |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| declarativeContent | Content script only | Content script runs on all pages vs declarative rules evaluated in browser process - significant memory/CPU waste |
| chrome.notifications | Custom in-page notifications | System notifications more reliable and don't interfere with page content |
| URL regex in content script | Match patterns in manifest | Manifest patterns block content script injection entirely - better performance |

**Installation:**
```bash
# No external dependencies - all native Chrome APIs
# Already have: chrome.storage, MutationObserver patterns
```

## Architecture Patterns

### Recommended Project Structure
```
entrypoints/
├── background/
│   ├── triggers/
│   │   ├── engine.ts          # Core trigger evaluation engine
│   │   ├── declarativeRules.ts # chrome.declarativeContent rule management
│   │   ├── notifications.ts    # Notification creation/handling
│   │   └── types.ts            # Trigger configuration types
│   └── storage.ts              # Existing - extend for trigger config
├── content/
│   ├── triggers/
│   │   ├── contextDetector.ts  # Element-based context detection
│   │   ├── observer.ts         # Optimized MutationObserver for triggers
│   │   └── matcher.ts          # Match scripts to current context
│   └── playback/
│       └── sessionDetector.ts  # Existing - reuse patterns
└── sidepanel/
    ├── components/
    │   ├── TriggerConfig.ts    # UI for configuring trigger conditions
    │   └── SuggestedScripts.ts # Display context-matched scripts
    └── stores/
        └── triggers.ts         # Reactive trigger state

utils/
└── triggers/
    ├── patterns.ts             # URL pattern matching (reuse existing)
    ├── conditions.ts           # Condition evaluation logic
    └── types.ts                # Shared trigger types
```

### Pattern 1: Declarative URL Trigger (Lightweight)
**What:** Use `chrome.declarativeContent` for URL-based triggers with zero content script overhead
**When to use:** Script trigger depends only on URL pattern (most common case)
**Example:**
```typescript
// Source: https://developer.chrome.com/docs/extensions/reference/api/declarativeContent
// entrypoints/background/triggers/declarativeRules.ts

import type { TriggerConfig } from './types';

export async function updateDeclarativeRules(
  scriptId: string,
  triggers: TriggerConfig[]
): Promise<void> {
  // Get URL-only triggers
  const urlTriggers = triggers.filter(t =>
    t.conditions.url_pattern && !t.conditions.element_present
  );

  if (urlTriggers.length === 0) {
    await chrome.declarativeContent.onPageChanged.removeRules([scriptId]);
    return;
  }

  const rules = urlTriggers.map(trigger => ({
    id: `${scriptId}_${trigger.id}`,
    conditions: [
      new chrome.declarativeContent.PageStateMatcher({
        pageUrl: { urlContains: trigger.conditions.url_pattern }
      })
    ],
    actions: [
      // Badge to show context match
      new chrome.declarativeContent.SetIcon({
        imageData: getContextBadgeIcon()
      })
    ]
  }));

  // Bulk update - more efficient than individual operations
  await chrome.declarativeContent.onPageChanged.removeRules([scriptId]);
  await chrome.declarativeContent.onPageChanged.addRules(rules);
}
```

### Pattern 2: Element Presence Trigger (Content Script)
**What:** Detect element presence using existing semantic resolver patterns
**When to use:** Trigger depends on specific elements being present (e.g., logged-in state, specific UI component)
**Example:**
```typescript
// Source: Adapted from existing sessionDetector.ts patterns
// entrypoints/content/triggers/contextDetector.ts

import { resolveElement, waitForElement } from '../playback/semanticResolver';
import type { TriggerCondition, ContextState } from './types';

export class ContextDetector {
  private observers: MutationObserver[] = [];
  private listeners: Set<(state: ContextState) => void> = new Set();

  constructor(private conditions: TriggerCondition[]) {}

  /**
   * Start monitoring context - efficient continuous detection
   */
  startMonitoring(): void {
    // Check URL first (cheapest check)
    const urlMatches = this.checkUrlConditions();

    if (!urlMatches) {
      this.notifyListeners({ matches: false, reason: 'url_mismatch' });
      return;
    }

    // Element checks only if URL matches
    this.monitorElementConditions();
  }

  private monitorElementConditions(): void {
    const elementConditions = this.conditions.filter(c => c.element_present);

    if (elementConditions.length === 0) {
      this.notifyListeners({ matches: true, reason: 'no_element_conditions' });
      return;
    }

    // Use debounced observer - avoid excessive checks
    const observer = new MutationObserver(
      this.debounce(() => this.checkElementConditions(), 500)
    );

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'aria-hidden']
    });

    this.observers.push(observer);

    // Initial check
    this.checkElementConditions();
  }

  private checkElementConditions(): void {
    const elementConditions = this.conditions.filter(c => c.element_present);
    const allMatch = elementConditions.every(condition => {
      const result = resolveElement(condition.element_present!.hints);
      return result.element !== null;
    });

    this.notifyListeners({
      matches: allMatch,
      reason: allMatch ? 'all_conditions_met' : 'element_not_found'
    });
  }

  private debounce(fn: Function, ms: number) {
    let timer: number | null = null;
    return () => {
      if (timer) clearTimeout(timer);
      timer = window.setTimeout(() => fn(), ms);
    };
  }

  stopMonitoring(): void {
    this.observers.forEach(obs => obs.disconnect());
    this.observers = [];
  }

  onContextChange(callback: (state: ContextState) => void): void {
    this.listeners.add(callback);
  }

  private notifyListeners(state: ContextState): void {
    this.listeners.forEach(cb => cb(state));
  }
}
```

### Pattern 3: Per-Site Trigger Override
**What:** Allow users to enable/disable triggers per domain
**When to use:** Always - user control over automation is critical
**Example:**
```typescript
// Source: Adapted from chrome.storage patterns
// utils/triggers/overrides.ts

export interface SiteOverride {
  domain: string;
  enabled: boolean;
  timestamp: number;
}

export async function getSiteOverride(
  scriptId: string,
  url: string
): Promise<boolean | null> {
  const domain = new URL(url).hostname;
  const key = `trigger_override_${scriptId}_${domain}`;

  const result = await chrome.storage.local.get(key);
  const override = result[key] as SiteOverride | undefined;

  return override ? override.enabled : null; // null = use script default
}

export async function setSiteOverride(
  scriptId: string,
  url: string,
  enabled: boolean
): Promise<void> {
  const domain = new URL(url).hostname;
  const key = `trigger_override_${scriptId}_${domain}`;

  await chrome.storage.local.set({
    [key]: {
      domain,
      enabled,
      timestamp: Date.now()
    } as SiteOverride
  });
}
```

### Pattern 4: Suggest vs Auto-Execute Modes
**What:** Two trigger behaviors - suggest shows in Side Panel, auto-execute runs immediately
**When to use:** Suggest for discovery, auto-execute for routine tasks
**Example:**
```typescript
// entrypoints/background/triggers/engine.ts

import type { Script, TriggerConfig } from '../../utils/types';

export async function handleContextMatch(
  script: Script,
  trigger: TriggerConfig,
  tabId: number
): Promise<void> {
  // Check per-site override first
  const tab = await chrome.tabs.get(tabId);
  const override = await getSiteOverride(script.id, tab.url!);

  if (override === false) {
    return; // User disabled triggers for this site
  }

  if (trigger.mode === 'suggest') {
    // Show in Side Panel
    await chrome.sidePanel.setOptions({
      tabId,
      path: 'sidepanel.html#suggested',
      enabled: true
    });

    // Update badge
    await chrome.action.setBadgeText({ text: '!', tabId });
    await chrome.action.setBadgeBackgroundColor({ color: '#4285f4', tabId });

    // Store matched scripts for tab
    await chrome.storage.session.set({
      [`suggested_scripts_${tabId}`]: [script.id]
    });

  } else if (trigger.mode === 'auto_execute') {
    // Show notification
    await chrome.notifications.create(`script_${script.id}_${Date.now()}`, {
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title: 'Script Auto-Executing',
      message: `Running: ${script.name}`,
      buttons: [
        { title: 'Stop' },
        { title: 'Disable for this site' }
      ],
      requireInteraction: false,
      priority: 0
    });

    // Execute script
    await chrome.tabs.sendMessage(tabId, {
      type: 'EXECUTE_SCRIPT',
      payload: { scriptId: script.id }
    });
  }
}
```

### Anti-Patterns to Avoid

- **Polling for context changes:** Don't use `setInterval` to check context - use MutationObserver and event listeners instead
- **Content script on all pages:** Don't inject content script everywhere for URL-only triggers - use declarativeContent rules
- **Synchronous context checks:** Don't block execution waiting for elements - use async/await with timeouts
- **Unbounded observers:** Always disconnect MutationObserver when done, use Page Visibility API to pause when tab hidden
- **Complex CSS selectors in declarativeContent:** Keep PageStateMatcher CSS simple - documentation warns hundreds of selectors slow pages

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL pattern matching | Custom regex parser | Existing `sessionDetector.ts` pattern converter + chrome.declarativeContent | Already implemented and tested - handles edge cases (escaping, wildcards) |
| Element visibility detection | Custom getBoundingClientRect checks | `isElementVisible` from existing codebase | Handles display:none, opacity, hidden parents, viewport checks |
| Semantic element matching | querySelector with hardcoded selectors | Existing `semanticResolver.ts` | Multi-hint weighted scoring survives DOM changes |
| Debounce/throttle utilities | Custom timer logic | Standard debounce pattern (see Pattern 2) | Edge cases: leading/trailing calls, cancellation, memory leaks |
| Per-domain storage | Custom domain extraction | URL API + chrome.storage namespace pattern | Handles subdomains, ports, protocols correctly |
| Notification interactions | Custom message passing | chrome.notifications.onButtonClicked events | Native event system more reliable |

**Key insight:** The codebase already has sophisticated context detection primitives (URL patterns, semantic resolution, MutationObserver patterns) from Phase 4 playback implementation. Phase 6 should compose these primitives rather than rebuilding them.

## Common Pitfalls

### Pitfall 1: MutationObserver Performance Degradation
**What goes wrong:** Continuous MutationObserver without debouncing or throttling causes excessive callback invocations, degrading page performance
**Why it happens:** DOM mutations fire frequently (animations, dynamic content) - observer callback runs for every batch
**How to avoid:**
- Use debouncing (500ms typical) for non-critical trigger checks
- Filter observed attributes to minimum needed (not all attributes)
- Use Page Visibility API to pause observers when tab hidden
- Disconnect observers when context definitely won't match (e.g., wrong URL)
**Warning signs:** Page feels sluggish, DevTools Performance tab shows excessive "Recalculate Style" or "Layout"

**Example:**
```typescript
// BAD - No debouncing
observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true // All attributes!
});

// GOOD - Debounced with attribute filter
const observer = new MutationObserver(
  debounce(() => checkContext(), 500)
);
observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['class', 'style', 'hidden'] // Only relevant attributes
});
```

### Pitfall 2: Declarative Rules Memory Leak
**What goes wrong:** Adding declarative content rules without removing old ones causes memory bloat and slow rule evaluation
**Why it happens:** Rules persist across sessions - easy to forget cleanup when scripts deleted or triggers updated
**How to avoid:**
- Always call `removeRules([ruleId])` before `addRules([newRules])`
- Use consistent rule ID scheme: `${scriptId}_${triggerId}`
- Clean up rules when script deleted
- Use bulk operations - `addRules([r1, r2, r3])` not three separate calls
**Warning signs:** Extension slows down over time, chrome://extensions shows high memory usage

### Pitfall 3: Race Condition in Context Detection
**What goes wrong:** Content script checks for elements before they're added to DOM, reports "no match" when elements appear 100ms later
**Why it happens:** Page construction is async - content script might run at document_idle but app still mounting
**How to avoid:**
- Check immediately, then set up MutationObserver for late arrivals
- Use `waitForElement` pattern from existing resolver for initial check
- Add timeout (e.g., 5 seconds) before declaring "no match"
- Listen for framework-specific events (e.g., React app mounted)
**Warning signs:** Triggers inconsistent - sometimes fire, sometimes don't on same page

**Example:**
```typescript
// BAD - Single check only
const result = resolveElement(hints);
if (!result.element) {
  notifyNoMatch();
}

// GOOD - Check + wait pattern
const result = resolveElement(hints);
if (result.element) {
  notifyMatch();
} else {
  // Wait for element to appear (with timeout)
  waitForElement(hints, 5000)
    .then(() => notifyMatch())
    .catch(() => notifyNoMatch());
}
```

### Pitfall 4: Notification Spam in Auto-Execute Mode
**What goes wrong:** Multiple tabs match trigger conditions, extension creates notification for each tab, user annoyed by notification flood
**Why it happens:** Trigger logic runs per-tab without cross-tab coordination
**How to avoid:**
- Use `chrome.storage.session` to track recent auto-executions
- Implement cooldown period (e.g., 5 minutes between same script on same domain)
- Collapse notifications - update existing notification instead of creating new one
- Provide "Snooze" button in notification for user control
**Warning signs:** User feedback about notification spam, rapid repeat executions

### Pitfall 5: Side Panel State Desync
**What goes wrong:** Side Panel shows "suggested scripts" badge but panel displays empty list or stale suggestions
**Why it happens:** Tab context changes (navigation, DOM updates) but Side Panel state not updated
**How to avoid:**
- Listen to `chrome.tabs.onUpdated` to clear suggestions on navigation
- Use VanJS reactive state - content script sends context updates via messages
- Store tab-specific suggestions in `chrome.storage.session` with `tabId` key
- Clear suggestions when Side Panel opened (user acknowledged)
**Warning signs:** Badge shows "!" but panel empty, suggestions for wrong page

## Code Examples

Verified patterns from official sources:

### URL Pattern to Regex Conversion (Existing)
```typescript
// Source: entrypoints/content/playback/sessionDetector.ts (lines 36-42)
// Reuse for trigger URL matching

export function urlPatternToRegex(pattern: string): RegExp {
  // Convert wildcard pattern to regex
  // Escape special regex chars except *, then replace * with .*
  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp(regexPattern, 'i'); // Case insensitive
}
```

### Declarative Content Rules Setup
```typescript
// Source: https://developer.chrome.com/docs/extensions/reference/api/declarativeContent
// Background service worker initialization

chrome.runtime.onInstalled.addListener(() => {
  // Clear any existing rules
  chrome.declarativeContent.onPageChanged.removeRules(undefined, () => {
    // Add rules for each enabled trigger
    loadTriggeredScripts().then(scripts => {
      scripts.forEach(script => {
        updateDeclarativeRules(script.id, script.triggers);
      });
    });
  });
});
```

### Chrome Notification Creation
```typescript
// Source: https://developer.chrome.com/docs/extensions/reference/api/notifications

async function notifyAutoExecution(
  scriptName: string,
  scriptId: string
): Promise<string> {
  return chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon-128.png',
    title: 'Script Running',
    message: `Auto-executing: ${scriptName}`,
    buttons: [
      { title: 'Stop Execution' },
      { title: 'Disable for Site' }
    ],
    priority: 0,
    requireInteraction: false
  });
}

// Handle button clicks
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (buttonIndex === 0) {
    // Stop execution
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'STOP_EXECUTION' });
    });
  } else if (buttonIndex === 1) {
    // Disable for site
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      const scriptId = extractScriptIdFromNotificationId(notificationId);
      setSiteOverride(scriptId, tabs[0].url, false);
    });
  }
  chrome.notifications.clear(notificationId);
});
```

### Tab-Aware Side Panel Trigger
```typescript
// Source: https://developer.chrome.com/docs/extensions/reference/api/sidePanel

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Check for matching triggers
    const matchedScripts = await findMatchingScripts(tab.url);

    if (matchedScripts.length > 0) {
      // Enable side panel for this tab
      await chrome.sidePanel.setOptions({
        tabId,
        path: 'sidepanel.html',
        enabled: true
      });

      // Set badge
      await chrome.action.setBadgeText({ text: String(matchedScripts.length), tabId });
      await chrome.action.setBadgeBackgroundColor({ color: '#4285f4', tabId });

      // Store for side panel to read
      await chrome.storage.session.set({
        [`suggested_${tabId}`]: matchedScripts.map(s => s.id)
      });
    }
  }
});
```

### Debounced MutationObserver
```typescript
// Source: Performance best practices from Mozilla Hacks and MDN

function createDebouncedObserver(
  callback: () => void,
  delay: number = 500
): MutationObserver {
  let timerId: number | null = null;

  const debouncedCallback = () => {
    if (timerId) {
      clearTimeout(timerId);
    }
    timerId = window.setTimeout(() => {
      callback();
      timerId = null;
    }, delay);
  };

  return new MutationObserver(debouncedCallback);
}

// Usage
const observer = createDebouncedObserver(() => {
  checkTriggerConditions();
}, 500);

observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['class', 'style', 'hidden', 'aria-hidden']
});
```

### Page Visibility Optimization
```typescript
// Source: MDN Page Visibility API

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Tab hidden - pause expensive operations
    contextDetector?.pauseMonitoring();
  } else {
    // Tab visible - resume
    contextDetector?.resumeMonitoring();
  }
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| chrome.browserAction | chrome.action | MV3 (2021) | Unified action API, declarativeContent compatible |
| Polling for page changes | MutationObserver + declarativeContent | ~2012 (MutationObserver), 2013 (declarativeContent) | Dramatically better performance, lower memory |
| Content script for all URL matching | Match patterns in manifest + declarativeContent | MV2+ | Content scripts only injected where needed |
| Custom notification UI | chrome.notifications | MV2+ | System-native notifications, better UX consistency |
| chrome.storage.sync | chrome.storage.local | Current best practice | Sync has 100KB limit, local has ~10MB, sync unreliable for large data |
| Broad host permissions | activeTab + declarativeContent | MV3 requirement | Better privacy, faster review process |

**Deprecated/outdated:**
- **chrome.webRequest for page detection**: Replaced by declarativeNetRequest (MV3) - but not needed for triggers, use declarativeContent instead
- **chrome.pageAction**: Merged into chrome.action in MV3
- **Mutation Events**: Replaced by MutationObserver (2012) - much better performance
- **setInterval polling for DOM**: Use MutationObserver + IntersectionObserver instead

## Open Questions

Things that couldn't be fully resolved:

1. **Trigger Precedence with Multiple Matches**
   - What we know: Multiple scripts can match same context
   - What's unclear: UI/UX for showing multiple suggestions, priority/ranking system
   - Recommendation: Show all matches in suggest mode, allow user to rank favorites, auto-execute only highest priority

2. **Cross-Tab Trigger Coordination**
   - What we know: chrome.storage.session can track state across tabs
   - What's unclear: Should auto-execute trigger once globally or once per tab?
   - Recommendation: Per-tab by default with cooldown, add global option in settings

3. **Trigger Condition Complexity Limits**
   - What we know: declarativeContent warns about hundreds of CSS selectors
   - What's unclear: Exact performance threshold, monitoring strategy
   - Recommendation: Start with limit of 10 element conditions per trigger, measure in practice

4. **Entity Detection (TRIG-01 mentions "entities")**
   - What we know: URL and elements are clear
   - What's unclear: What "entities" means in context (semantic entities? data entities?)
   - Recommendation: Defer entity detection to future phase, focus on URL + elements for Phase 6

## Sources

### Primary (HIGH confidence)
- [chrome.declarativeContent API](https://developer.chrome.com/docs/extensions/reference/api/declarativeContent) - Official API reference (updated 2026-01)
- [chrome.notifications API](https://developer.chrome.com/docs/extensions/reference/api/notifications) - Official API reference (updated 2026-01-07)
- [chrome.action API](https://developer.chrome.com/docs/extensions/reference/api/action) - Badge and icon control
- [chrome.sidePanel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel) - Side panel control (updated 2026-01-20)
- [Match Patterns Documentation](https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns) - URL pattern syntax
- [Content Scripts Documentation](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) - Lifecycle and injection timing (updated 2026-01)
- [MDN MutationObserver](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver) - DOM observation API
- Existing codebase:
  - `/Users/mmaudet/work/browserlet/entrypoints/content/playback/sessionDetector.ts` - URL pattern matching implementation
  - `/Users/mmaudet/work/browserlet/entrypoints/content/playback/semanticResolver.ts` - Element detection with MutationObserver

### Secondary (MEDIUM confidence)
- [Mozilla Hacks: MutationObserver Performance](https://hacks.mozilla.org/2012/05/dom-mutationobserver-reacting-to-dom-changes-without-killing-browser-performance/) - Best practices for observers
- [Understanding Chrome Extensions Declarative Content](https://m2kdevelopments.medium.com/24-understanding-chrome-extensions-declarative-content-754c387e5aad) - Practical patterns (2024)
- [Understanding Chrome Extensions Side Panel](https://m2kdevelopments.medium.com/20-understanding-chrome-extensions-side-panel-334ef5de7cfd) - Side panel patterns (2024)
- [WXT Framework Content Scripts](https://wxt.dev/guide/essentials/content-scripts.html) - Framework-specific patterns
- Multiple JavaScript debounce/throttle pattern articles (2024-2025) - Performance optimization patterns

### Tertiary (LOW confidence)
- Various browser automation tool comparisons - Validated conceptual approaches but not specific to Chrome extensions
- Community discussions on Chrome extension forums - Verified against official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All native Chrome APIs with official documentation updated in 2026
- Architecture: HIGH - Patterns derived from existing codebase and official documentation
- Pitfalls: HIGH - Well-documented issues from Mozilla, Chrome docs, and existing codebase evidence

**Research date:** 2026-01-29
**Valid until:** 2026-04-29 (90 days - Chrome extension APIs stable, low churn)

**Key findings validation:**
- URL pattern matching: Already implemented in codebase (sessionDetector.ts)
- Element detection: Already implemented in codebase (semanticResolver.ts, waitForElement)
- MutationObserver patterns: Already in use (resolver.ts lines 340-349)
- Semantic hint system: Already in use (hint weights, multi-hint matching)
- All Chrome APIs: Official documentation confirmed current as of January 2026

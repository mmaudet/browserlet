# Phase 4: Playback - Research

**Researched:** 2026-01-29
**Domain:** Browser automation, semantic element resolution, Chrome extension execution
**Confidence:** HIGH

## Summary

This research covers the implementation of deterministic BSL script execution with resilient semantic selectors in a Chrome extension context. The phase requires building an execution engine that parses YAML scripts, resolves elements using multi-hint semantic strategies, performs DOM actions (click, type, select, extract, wait_for, navigate, scroll, hover), handles authentication detection, and applies humanization delays.

The existing codebase provides strong foundations: js-yaml is already installed for parsing, semantic hint types are defined (10 types from Phase 2), DOM utilities exist in `utils/hints/`, and the execution store infrastructure is ready in `stores/execution.ts`. The content script communication pattern via `sendMessageSafe()` is established.

**Primary recommendation:** Build the Semantic Resolver as the core component that matches hints to DOM elements using a weighted scoring algorithm, then wrap DOM actions with proper event dispatching sequences and humanization delays.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| js-yaml | 4.1.1 | YAML parsing | Already installed, fast, no dependencies |
| MutationObserver | Browser API | Wait for element visibility | Native, event-driven, efficient |
| MouseEvent/KeyboardEvent | Browser API | DOM action simulation | Standard browser events |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vanjs-core | 1.6.0 | Reactive state management | Already used for UI, use for execution state |
| chrome.runtime | MV3 API | Message passing | Content script <-> Service worker communication |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| MutationObserver | setInterval polling | Polling is less efficient, but simpler for timeouts |
| dispatchEvent | chrome.debugger API | Debugger gives isTrusted=true but requires debug permission and pauses page |
| Custom delays | Puppeteer-stealth patterns | Overkill for extension, we control the context |

**Installation:**
```bash
# No new dependencies needed - all core libraries already installed
```

## Architecture Patterns

### Recommended Project Structure
```
entrypoints/content/
  playback/
    index.ts           # PlaybackManager orchestrator
    semanticResolver.ts # Multi-hint element resolution
    actionExecutor.ts  # DOM action execution (8 actions)
    humanizer.ts       # Delay and randomization
    sessionDetector.ts # Auth state detection
    types.ts           # Playback-specific types

utils/
  yaml/
    parser.ts          # Already exists - extend for step extraction
    stepParser.ts      # NEW: Parse individual BSL steps
```

### Pattern 1: Semantic Resolver with Weighted Scoring
**What:** Element resolution using multiple hints with confidence scores
**When to use:** Every time an action needs to find its target element
**Example:**
```typescript
// Source: Phase 2 decisions + Playwright best practices
interface ResolverResult {
  element: Element | null;
  confidence: number;
  matchedHints: string[];
  failedHints: string[];
}

interface HintMatcher {
  type: HintType;
  weight: number;
  match: (element: Element, value: string | DataAttributeValue) => boolean;
}

const HINT_WEIGHTS: Record<HintType, number> = {
  // Highest reliability (from PRD POC validation)
  data_attribute: 1.0,
  role: 1.0,
  type: 1.0,
  // High reliability
  aria_label: 0.9,
  name: 0.9,
  id: 0.85, // Filtered for auto-generated
  text_contains: 0.8,
  // Medium reliability
  placeholder_contains: 0.7,
  near_label: 0.6, // PRD warns: fails in tables
  class_contains: 0.5, // CSS classes often minified
};

function resolveElement(hints: SemanticHint[]): ResolverResult {
  const candidates: Array<{ element: Element; score: number; matched: string[] }> = [];

  // Get all candidate elements based on first hint (usually role)
  const initialCandidates = getInitialCandidates(hints);

  for (const element of initialCandidates) {
    let score = 0;
    const matched: string[] = [];

    for (const hint of hints) {
      const weight = HINT_WEIGHTS[hint.type];
      if (matchHint(element, hint)) {
        score += weight;
        matched.push(hint.type);
      }
    }

    if (score > 0) {
      candidates.push({ element, score, matched });
    }
  }

  // Normalize score and select best match
  const maxPossibleScore = hints.reduce((sum, h) => sum + HINT_WEIGHTS[h.type], 0);
  candidates.sort((a, b) => b.score - a.score);

  const best = candidates[0];
  if (!best || (best.score / maxPossibleScore) < 0.7) { // Threshold from PRD
    return { element: null, confidence: 0, matchedHints: [], failedHints: hints.map(h => h.type) };
  }

  return {
    element: best.element,
    confidence: best.score / maxPossibleScore,
    matchedHints: best.matched,
    failedHints: hints.filter(h => !best.matched.includes(h.type)).map(h => h.type)
  };
}
```

### Pattern 2: Smart Waiting with MutationObserver + Timeout
**What:** Wait for element to appear/become visible with fallback timeout
**When to use:** wait_for action, before any element interaction
**Example:**
```typescript
// Source: MDN MutationObserver documentation
function waitForElement(
  hints: SemanticHint[],
  timeoutMs: number = 10000
): Promise<ResolverResult> {
  return new Promise((resolve, reject) => {
    // Try immediate resolution
    const immediate = resolveElement(hints);
    if (immediate.element && isElementVisible(immediate.element)) {
      return resolve(immediate);
    }

    const observer = new MutationObserver(() => {
      const result = resolveElement(hints);
      if (result.element && isElementVisible(result.element)) {
        observer.disconnect();
        clearTimeout(timeout);
        resolve(result);
      }
    });

    const timeout = setTimeout(() => {
      observer.disconnect();
      const finalTry = resolveElement(hints);
      if (finalTry.element) {
        resolve(finalTry);
      } else {
        reject(new Error(`Element not found within ${timeoutMs}ms`));
      }
    }, timeoutMs);

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'aria-hidden']
    });
  });
}
```

### Pattern 3: Humanized Action Execution
**What:** Add realistic delays between actions to avoid bot detection
**When to use:** Between all user-facing actions
**Example:**
```typescript
// Source: Bot detection research 2026
interface HumanizerConfig {
  baseDelay: { min: number; max: number };  // ms between actions (e.g., 500-2000)
  typeDelay: { min: number; max: number };  // ms between keystrokes (e.g., 50-150)
  scrollDelay: { min: number; max: number }; // ms for scroll settle (e.g., 100-300)
}

const DEFAULT_CONFIG: HumanizerConfig = {
  baseDelay: { min: 500, max: 2000 },
  typeDelay: { min: 50, max: 150 },
  scrollDelay: { min: 100, max: 300 }
};

function randomDelay(min: number, max: number): number {
  // Use slight gaussian distribution for more natural feel
  const u = Math.random();
  const v = Math.random();
  const gaussian = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  const normalized = (gaussian + 3) / 6; // Normalize to ~0-1
  return Math.floor(min + normalized * (max - min));
}

async function humanizedWait(config: HumanizerConfig = DEFAULT_CONFIG): Promise<void> {
  const delay = randomDelay(config.baseDelay.min, config.baseDelay.max);
  await new Promise(resolve => setTimeout(resolve, delay));
}
```

### Pattern 4: DOM Action Event Sequences
**What:** Proper event dispatch sequences that work with modern frameworks
**When to use:** For click, type, select actions
**Example:**
```typescript
// Source: Chrome extension event dispatch research
async function executeClick(element: Element): Promise<void> {
  // Ensure element is visible and scrolled into view
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await new Promise(r => setTimeout(r, 100)); // Wait for scroll

  // Focus if focusable
  if (element instanceof HTMLElement) {
    element.focus();
  }

  // Dispatch full event sequence
  const rect = element.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;

  const eventInit: MouseEventInit = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: x,
    clientY: y,
  };

  element.dispatchEvent(new MouseEvent('mousedown', eventInit));
  element.dispatchEvent(new MouseEvent('mouseup', eventInit));
  element.dispatchEvent(new MouseEvent('click', eventInit));
}

async function executeType(element: Element, text: string, config: HumanizerConfig): Promise<void> {
  if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
    throw new Error('Cannot type into non-input element');
  }

  element.focus();
  element.value = ''; // Clear existing (or respect clear_before option)

  // Type character by character with delays
  for (const char of text) {
    const keyEventInit: KeyboardEventInit = {
      key: char,
      code: `Key${char.toUpperCase()}`,
      bubbles: true,
      cancelable: true,
    };

    element.dispatchEvent(new KeyboardEvent('keydown', keyEventInit));
    element.value += char;
    element.dispatchEvent(new InputEvent('input', { bubbles: true, data: char }));
    element.dispatchEvent(new KeyboardEvent('keyup', keyEventInit));

    await new Promise(r => setTimeout(r, randomDelay(config.typeDelay.min, config.typeDelay.max)));
  }

  // Trigger change event at the end
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

async function executeSelect(element: Element, optionValue: string): Promise<void> {
  if (!(element instanceof HTMLSelectElement)) {
    throw new Error('Cannot select on non-select element');
  }

  element.focus();

  // Find option by value or text
  let found = false;
  for (const option of element.options) {
    if (option.value === optionValue || option.text === optionValue) {
      element.value = option.value;
      found = true;
      break;
    }
  }

  if (!found) {
    throw new Error(`Option "${optionValue}" not found in select`);
  }

  element.dispatchEvent(new Event('change', { bubbles: true }));
}
```

### Anti-Patterns to Avoid
- **Single hint resolution:** Always require multiple hints for robust matching (PRD lesson)
- **Fixed delays:** Use randomized delays within ranges, not constant values
- **Direct value assignment without events:** Always dispatch input/change events after setting values
- **Immediate element access:** Always wait for element visibility before interacting
- **Ignoring isTrusted limitation:** Accept that dispatchEvent creates untrusted events; most legacy apps don't check

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML parsing | Custom parser | js-yaml (installed) | Edge cases, escaping, multi-doc support |
| Element visibility check | Simple display check | isElementVisible from utils/hints/dom.ts | Handles opacity, dimensions, computed styles |
| Text normalization | Basic trim/lowercase | normalizeText from utils/hints/text.ts | Handles accents, multiple spaces, locale issues |
| Random delays | Math.random() directly | Gaussian distribution helper | More natural feel, less detectable |
| ARIA role resolution | Tag name mapping only | getElementRole from utils/hints/dom.ts | Handles implicit roles, input types |

**Key insight:** The Phase 2 recording infrastructure already built robust hint extraction. Playback must use the same utilities to ensure symmetry between what was recorded and what gets resolved.

## Common Pitfalls

### Pitfall 1: Race Condition with Dynamic Content
**What goes wrong:** Element found but disappears before interaction, or stale reference
**Why it happens:** SPAs update DOM asynchronously, element might be replaced
**How to avoid:** Always re-resolve element immediately before interaction, use short stabilization delay
**Warning signs:** "Element is not attached to DOM" errors, intermittent failures

### Pitfall 2: Framework Event Handling (React/Angular/Vue)
**What goes wrong:** Value changes but UI doesn't update, form doesn't submit
**Why it happens:** Frameworks use synthetic events and internal state; direct DOM manipulation bypasses them
**How to avoid:** Dispatch full event sequence (keydown -> input -> keyup -> change), set both value and trigger input event
**Warning signs:** Input shows value but form validation fails, submit doesn't trigger

### Pitfall 3: Session Detection False Positives
**What goes wrong:** Pauses for authentication when user is actually logged in
**Why it happens:** Login indicator elements may be hidden/loading, URL pattern matching too broad
**How to avoid:** Use multiple indicators (element presence + absence of login form), add short delay before session check
**Warning signs:** Script pauses on every page, user confusion

### Pitfall 4: Timeout Configuration
**What goes wrong:** Scripts fail on slow networks, or hang forever on dead elements
**Why it happens:** Fixed timeouts don't account for network variability
**How to avoid:** Configurable timeouts per action type, default reasonable values (10s for element, 30s for page load)
**Warning signs:** Timeout errors on slow connections, scripts that never complete

### Pitfall 5: iframe Handling
**What goes wrong:** Elements in iframes not found, cross-origin security errors
**Why it happens:** Content scripts need explicit iframe injection, cross-origin iframes are inaccessible
**How to avoid:** Use `allFrames: true` in manifest (already configured), handle cross-origin gracefully with error messages
**Warning signs:** "Element not found" when it's visible in iframe, security errors in console

### Pitfall 6: Scroll Position Issues
**What goes wrong:** Click misses target, element reported as not visible
**Why it happens:** Element coordinates calculated before scroll completes
**How to avoid:** scrollIntoView + wait for scroll completion, recalculate coordinates after scroll
**Warning signs:** Clicks on wrong elements, "element not visible" for visible elements

## Code Examples

Verified patterns from official sources:

### BSL Step Parsing
```typescript
// Source: js-yaml documentation + existing utils/yaml/parser.ts pattern
import yaml from 'js-yaml';

interface BSLStep {
  id?: string;
  action: 'click' | 'type' | 'select' | 'extract' | 'wait_for' | 'navigate' | 'scroll' | 'hover';
  target?: {
    intent?: string;
    hints: SemanticHint[];
    fallback_selector?: string;
  };
  value?: string;
  output?: {
    variable: string;
    transform?: string;
  };
  timeout?: string; // e.g., "10s", "30s"
}

interface ParsedScript {
  name: string;
  steps: BSLStep[];
  metadata?: Record<string, unknown>;
}

function parseSteps(yamlContent: string): ParsedScript {
  const doc = yaml.load(yamlContent) as Record<string, unknown>;

  if (!doc.steps || !Array.isArray(doc.steps)) {
    throw new Error('Invalid BSL: missing steps array');
  }

  return {
    name: doc.name as string,
    steps: doc.steps as BSLStep[],
    metadata: doc.metadata as Record<string, unknown>
  };
}

function parseTimeout(timeout: string | undefined): number {
  if (!timeout) return 10000; // Default 10s
  const match = timeout.match(/^(\d+)(s|ms)?$/);
  if (!match) return 10000;
  const value = parseInt(match[1], 10);
  const unit = match[2] || 's';
  return unit === 'ms' ? value : value * 1000;
}
```

### Session Detection
```typescript
// Source: PRD section 4.6 Authentication handling
interface SessionCheckConfig {
  indicator?: {
    hints: SemanticHint[];
  };
  absence_indicator?: {
    hints: SemanticHint[];
  };
  url_patterns?: string[];
}

async function checkSessionActive(config: SessionCheckConfig): Promise<boolean> {
  // Check URL patterns for login pages
  if (config.url_patterns) {
    const currentUrl = window.location.href;
    for (const pattern of config.url_patterns) {
      if (new RegExp(pattern.replace('*', '.*')).test(currentUrl)) {
        return false; // On login page = not authenticated
      }
    }
  }

  // Check for presence of authenticated indicator
  if (config.indicator) {
    const result = resolveElement(config.indicator.hints);
    if (result.element && isElementVisible(result.element)) {
      return true;
    }
  }

  // Check for absence of login form
  if (config.absence_indicator) {
    const result = resolveElement(config.absence_indicator.hints);
    if (!result.element || !isElementVisible(result.element)) {
      return true; // Login form not present = authenticated
    }
  }

  return false; // Default to not authenticated if no indicators match
}
```

### PlaybackManager Orchestrator
```typescript
// Source: Pattern from existing RecordingManager in content/recording/index.ts
export class PlaybackManager {
  private state: 'idle' | 'running' | 'paused' | 'waiting_auth' = 'idle';
  private currentStep = 0;
  private script: ParsedScript | null = null;
  private abortController: AbortController | null = null;
  private results: Map<string, unknown> = new Map();

  async execute(yamlContent: string): Promise<ExecutionResult> {
    this.abortController = new AbortController();
    this.script = parseSteps(yamlContent);
    this.state = 'running';
    this.currentStep = 0;
    this.results.clear();

    try {
      for (let i = 0; i < this.script.steps.length; i++) {
        if (this.abortController.signal.aborted) {
          return { status: 'stopped', step: i };
        }

        this.currentStep = i;
        await this.notifyProgress(i, this.script.steps.length);

        const step = this.script.steps[i];
        await this.executeStep(step);

        // Humanized delay between steps
        await humanizedWait();
      }

      return { status: 'completed', results: Object.fromEntries(this.results) };
    } catch (error) {
      return { status: 'failed', step: this.currentStep, error: error.message };
    } finally {
      this.state = 'idle';
      this.abortController = null;
    }
  }

  stop(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  private async executeStep(step: BSLStep): Promise<void> {
    switch (step.action) {
      case 'navigate':
        window.location.href = step.value!;
        await this.waitForPageLoad();
        break;

      case 'click':
        const clickTarget = await this.resolveTarget(step);
        await executeClick(clickTarget);
        break;

      case 'type':
        const typeTarget = await this.resolveTarget(step);
        await executeType(typeTarget, step.value!, DEFAULT_CONFIG);
        break;

      // ... other actions
    }
  }

  private async resolveTarget(step: BSLStep): Promise<Element> {
    if (!step.target) throw new Error('Step missing target');

    const timeout = parseTimeout(step.timeout);
    const result = await waitForElement(step.target.hints, timeout);

    if (!result.element) {
      // Try fallback selector
      if (step.target.fallback_selector) {
        const fallback = document.querySelector(step.target.fallback_selector);
        if (fallback) return fallback;
      }
      throw new Error(`Element not found: ${step.target.intent || 'unknown'}`);
    }

    return result.element;
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| XPath/CSS selectors | Semantic/ARIA selectors | 2023+ | Resilient to DOM changes |
| Fixed delays | Gaussian random delays | 2024+ | Better bot detection evasion |
| Mutation Events | MutationObserver | 2015+ | Better performance, less deprecated |
| Synchronous execution | Async/await with AbortController | 2020+ | Cancelable, non-blocking |
| Debug mode isTrusted | Accept untrusted events | N/A | Pragmatic for legacy apps |

**Deprecated/outdated:**
- Mutation Events (DOMNodeInserted, etc.): Deprecated, use MutationObserver
- Synchronous XHR: Deprecated, never use
- webkitRequestAnimationFrame: Use standard requestAnimationFrame

## Open Questions

Things that couldn't be fully resolved:

1. **Legacy ERP Bot Detection**
   - What we know: Modern sites use fingerprinting, behavioral analysis
   - What's unclear: What detection legacy ERPs actually implement (likely minimal)
   - Recommendation: Start with basic humanization, validate during testing, add sophistication if needed

2. **isTrusted Event Limitations**
   - What we know: dispatchEvent creates untrusted events, some sites may check
   - What's unclear: Percentage of legacy apps that actually verify isTrusted
   - Recommendation: Proceed with standard event dispatch, document limitation, consider chrome.debugger only if specific apps require it

3. **Cross-Origin iframe Access**
   - What we know: Content scripts cannot access cross-origin iframes
   - What's unclear: How common cross-origin iframes are in target legacy apps
   - Recommendation: Handle gracefully with clear error message, document as limitation

## Sources

### Primary (HIGH confidence)
- Chrome Developer Documentation - Content Scripts: https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts
- MDN Web Docs - MutationObserver: https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver
- js-yaml GitHub: https://github.com/nodeca/js-yaml
- MDN Web Docs - Event.isTrusted: https://developer.mozilla.org/en-US/docs/Web/API/Event/isTrusted

### Secondary (MEDIUM confidence)
- BrowserStack Playwright Selectors Best Practices 2026: https://www.browserstack.com/guide/playwright-selectors-best-practices
- Bot Detection Avoidance Patterns: https://www.browserstack.com/guide/playwright-bot-detection
- ZenRows Bypass Bot Detection 2026: https://www.zenrows.com/blog/bypass-bot-detection

### Tertiary (LOW confidence)
- GitHub ClickIsTrusted project (for isTrusted workarounds): https://github.com/orstavik/ClickIsTrusted
- Various blog posts on React/Angular event handling (cross-verify with testing)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use or native browser APIs
- Architecture: HIGH - Follows established patterns from existing codebase
- Pitfalls: MEDIUM - Some based on general web automation experience, needs validation
- Bot detection: LOW - Legacy ERP behavior unknown, requires empirical testing

**Research date:** 2026-01-29
**Valid until:** 2026-02-28 (30 days - stable domain, libraries well-established)

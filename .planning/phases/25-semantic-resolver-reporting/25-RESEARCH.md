# Phase 25: Semantic Resolver & Reporting - Research

**Researched:** 2026-02-14
**Domain:** Playwright page.evaluate() injection, cascade resolver porting, CLI console reporting, screenshot-on-failure
**Confidence:** HIGH

## Summary

Phase 25 replaces the CLI's `SimpleResolver` (Phase 24 placeholder) with the extension's full cascade resolver running inside Playwright's `page.evaluate()`. The core challenge is that the cascade resolver (cascadeResolver.ts) and its transitive dependencies (semanticResolver.ts, domContextExtractor.ts, structuralScorer.ts, hintStabilityTracker.ts, plus utils/hints/text.ts and utils/hints/dom.ts) are written as TypeScript modules with `import` statements -- code that cannot be directly passed to `page.evaluate()`. Additionally, the cascade resolver depends on two browser-extension-only APIs: `chrome.runtime.sendMessage` (for LLM micro-prompts) and `chrome.storage.local` (for hint stability data). These must be replaced with Playwright-compatible equivalents.

The recommended approach is a **two-layer architecture**: (1) Bundle the deterministic resolver logic (Stages 1-2: hint matching, structural scoring, DOM context extraction) into a single self-contained JavaScript string at build time using esbuild, then inject it via `page.addInitScript()` so it persists across navigations. (2) Use Playwright's `page.exposeFunction()` to bridge LLM micro-prompt calls (Stages 3-5) from page context back to Node.js, where the CLI can call the LLM API directly using `@anthropic-ai/sdk` or Ollama. The StepReporter (output.ts) already has spinner and pass/fail functionality -- it needs enhancement for failure screenshot paths and duration formatting already present. The PlaywrightExecutor needs a screenshot-on-failure wrapper in BSLRunner.

**Primary recommendation:** Bundle deterministic resolver as IIFE string via esbuild (build-time), inject via `page.addInitScript({ content })`, bridge LLM calls via `page.exposeFunction('__browserlet_microPrompt', handler)`, add screenshot-on-failure in BSLRunner's catch block, and enhance StepReporter to display screenshot paths on failure.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| playwright | ^1.58.2 | page.evaluate, page.addInitScript, page.exposeFunction, page.screenshot | Already in CLI from Phase 24, provides all injection and screenshot APIs needed |
| @browserlet/core | workspace:* | SemanticHint types, HINT_WEIGHTS, microPrompt builders/validators | Shared package with all type definitions and prompt logic |
| esbuild | ^0.25.0 | Bundle resolver TypeScript into single IIFE string for injection | Extremely fast, zero-config TypeScript bundling, `write: false` gives in-memory output |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| picocolors | ^1.1.1 | Terminal output colors | Already in CLI, used for PASS/FAIL formatting |
| ora | ^9.0.0 | Spinner animations | Already in CLI, used for step progress |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| esbuild bundling | Manual string concatenation | Concatenation breaks with any `import` statements, requires manually ordering dependencies; esbuild handles dependency resolution automatically |
| page.addInitScript | page.addScriptTag | addScriptTag does NOT persist across navigations -- resolver would need re-injection after every page.goto() |
| page.exposeFunction | Inline LLM logic in page context | Cannot make HTTP/SDK calls from page context; exposeFunction bridges to Node.js naturally |
| Build-time bundling | Runtime bundling | Build-time is simpler, deterministic, no esbuild dependency at runtime; resolver code changes rarely |

**Installation:**
```bash
# In packages/cli
npm install -D esbuild
```

## Architecture Patterns

### Recommended Project Structure
```
packages/
├── core/                    # Existing - types, weights, prompts
└── cli/
    ├── src/
    │   ├── index.ts              # CLI entry point (existing)
    │   ├── runner.ts             # BSLRunner - add screenshot-on-failure (modify)
    │   ├── executor.ts           # PlaywrightExecutor (existing, unchanged)
    │   ├── resolver.ts           # SimpleResolver (existing, kept as fallback)
    │   ├── cascadeResolver.ts    # NEW: CascadeCLIResolver - orchestrates injection + resolution
    │   ├── resolverBundle.ts     # NEW: Build script that produces resolver IIFE string
    │   ├── output.ts             # StepReporter - enhance with screenshot path display (modify)
    │   └── llmBridge.ts          # NEW: LLM micro-prompt handler for page.exposeFunction()
    ├── resolver-bundle/
    │   └── entry.ts              # NEW: Resolver entry point for esbuild (pure DOM logic only)
    ├── bin/
    │   └── browserlet.js         # Compiled executable (existing)
    ├── scripts/
    │   └── build-resolver.ts     # NEW: esbuild script to produce resolver bundle string
    └── package.json
```

### Pattern 1: Build-Time Resolver Bundling with esbuild
**What:** Bundle the deterministic resolver (Stages 1-2) into a self-contained IIFE string at build time
**When to use:** During `npm run build` in packages/cli
**Why:** The extension's resolver files use TypeScript imports across 6+ files with relative paths. page.evaluate() cannot handle multi-file code. esbuild resolves all imports into a single output.

```typescript
// scripts/build-resolver.ts
// Source: esbuild API docs (https://esbuild.github.io/api/)
import * as esbuild from 'esbuild';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

async function buildResolverBundle() {
  const result = await esbuild.build({
    entryPoints: [resolve(__dirname, '../resolver-bundle/entry.ts')],
    bundle: true,
    write: false,
    format: 'iife',
    globalName: '__browserletResolver',
    platform: 'browser',
    target: 'es2020',
    minify: false, // Keep readable for debugging
  });

  const code = new TextDecoder().decode(result.outputFiles[0].contents);

  // Write as a TypeScript module exporting the string
  writeFileSync(
    resolve(__dirname, '../src/resolverBundleCode.ts'),
    `// AUTO-GENERATED by scripts/build-resolver.ts -- DO NOT EDIT\n` +
    `export const RESOLVER_BUNDLE = ${JSON.stringify(code)};\n`
  );
}

buildResolverBundle();
```

### Pattern 2: Resolver Entry Point (Pure DOM Logic)
**What:** A single entry file that re-exports only the deterministic resolver functions, excluding all browser extension APIs
**When to use:** This is what esbuild bundles for injection into page context

```typescript
// resolver-bundle/entry.ts
//
// IMPORTANT: This file must NOT import anything that depends on:
// - chrome.runtime.sendMessage
// - chrome.storage.local
// - Any extension API
//
// It imports ONLY pure DOM + hint logic.

// From @browserlet/core (types + weights)
import type { SemanticHint, HintType } from '@browserlet/core/types';
import { HINT_WEIGHTS } from '@browserlet/core/types';

// Pure DOM utilities (no browser extension dependencies)
// These need to be copied/adapted from utils/hints/ since they
// use relative paths that won't resolve in CLI context
import { normalizeText } from './domUtils';
import { getElementRole, isElementVisible, findAssociatedLabel } from './domUtils';

// Resolver logic (adapted from extension, stripped of chrome.* calls)
import { resolveElement, isElementInteractable } from './semanticResolver';
import { extractDOMContext } from './domContextExtractor';
import { computeStructuralBoost } from './structuralScorer';

// Stage 1+2 deterministic resolution (no LLM dependency)
export function resolveElementDeterministic(
  hints: SemanticHint[],
  confidenceThreshold: number = 0.70
): {
  element: Element | null;
  confidence: number;
  matchedHints: string[];
  failedHints: string[];
  stage: number;
  resolutionTimeMs: number;
} {
  const startTime = performance.now();

  if (hints.length === 0) {
    return { element: null, confidence: 0, matchedHints: [], failedHints: [], stage: 1, resolutionTimeMs: 0 };
  }

  // Stage 1: Direct hint matching
  const stage1 = resolveElement(hints);

  const HIGH_WEIGHT_THRESHOLD = 0.9;
  const STAGE_1_CONFIDENCE = 0.85;

  const hasHighWeight = stage1.matchedHints.some(matched => {
    const colonIdx = matched.indexOf(':');
    if (colonIdx <= 0) return false;
    const type = matched.substring(0, colonIdx) as HintType;
    return (HINT_WEIGHTS[type] ?? 0) >= HIGH_WEIGHT_THRESHOLD;
  });

  if (stage1.element && stage1.confidence >= STAGE_1_CONFIDENCE && hasHighWeight) {
    return {
      ...stage1,
      stage: 1,
      resolutionTimeMs: performance.now() - startTime,
    };
  }

  // Stage 2: Structural scoring (same logic as cascadeResolver.ts gatherCompetitors + structural boost)
  // ... (implementation follows extension's pattern)

  return {
    element: stage1.element,
    confidence: stage1.confidence,
    matchedHints: stage1.matchedHints,
    failedHints: stage1.failedHints,
    stage: 2,
    resolutionTimeMs: performance.now() - startTime,
  };
}

// Expose on globalName for page.addInitScript
(globalThis as any).__browserletResolver = {
  resolveElementDeterministic,
  resolveElement,
  extractDOMContext,
  computeStructuralBoost,
  isElementInteractable,
  HINT_WEIGHTS,
};
```

### Pattern 3: Inject Resolver + LLM Bridge via Playwright
**What:** CascadeCLIResolver that injects the bundled resolver and wires up the LLM bridge
**When to use:** During CLI execution, before running any steps

```typescript
// src/cascadeResolver.ts
// Source: Playwright page.addInitScript + page.exposeFunction docs
import type { Page } from 'playwright';
import type { SemanticHint } from '@browserlet/core/types';
import { RESOLVER_BUNDLE } from './resolverBundleCode.js';

export interface CLIResolveResult {
  found: boolean;
  confidence: number;
  matchedHints: string[];
  failedHints: string[];
  stage: number;
  resolutionTimeMs: number;
}

export class CascadeCLIResolver {
  private page: Page;
  private injected = false;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Inject the resolver bundle into the page context.
   * Uses addInitScript so it persists across navigations.
   */
  async inject(): Promise<void> {
    if (this.injected) return;

    // Inject the bundled resolver code (persists across navigations)
    await this.page.addInitScript({ content: RESOLVER_BUNDLE });
    this.injected = true;
  }

  /**
   * Resolve an element using the cascade resolver running in page context.
   * Returns a Playwright Locator targeting the resolved element.
   */
  async resolve(hints: SemanticHint[], timeout: number = 10000): Promise<string> {
    await this.inject();

    // Run deterministic resolution (Stages 1-2) inside page context
    const result = await this.page.evaluate(
      ({ hints, timeout }) => {
        const resolver = (window as any).__browserletResolver;
        if (!resolver) throw new Error('Resolver not injected');

        const result = resolver.resolveElementDeterministic(hints);

        if (result.element) {
          // Generate a unique selector for the resolved element
          // so Playwright can target it from outside
          const uid = '__brl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
          result.element.setAttribute('data-browserlet-resolved', uid);
          return {
            found: true,
            selector: `[data-browserlet-resolved="${uid}"]`,
            confidence: result.confidence,
            stage: result.stage,
            resolutionTimeMs: result.resolutionTimeMs,
            matchedHints: result.matchedHints,
            failedHints: result.failedHints,
          };
        }

        return {
          found: false,
          selector: '',
          confidence: result.confidence,
          stage: result.stage,
          resolutionTimeMs: result.resolutionTimeMs,
          matchedHints: result.matchedHints,
          failedHints: result.failedHints,
        };
      },
      { hints, timeout }
    );

    if (!result.found) {
      throw new Error(
        `Cascade resolver failed (stage ${result.stage}, confidence ${result.confidence.toFixed(2)}): ` +
        `matched=[${result.matchedHints.join(', ')}] failed=[${result.failedHints.join(', ')}]`
      );
    }

    return result.selector;
  }
}
```

### Pattern 4: LLM Bridge via page.exposeFunction
**What:** Bridge micro-prompt calls from page context to Node.js LLM API
**When to use:** For Stages 3-5 when deterministic resolution fails

```typescript
// src/llmBridge.ts
// Source: Playwright page.exposeFunction docs
import type { Page } from 'playwright';
import type { MicroPromptInput, MicroPromptOutput } from '@browserlet/core/prompts';
import { buildMicroPrompt, validateMicroPromptOutput } from '@browserlet/core/prompts';

export interface LLMBridgeOptions {
  /** LLM provider: 'anthropic' | 'ollama' | 'none' */
  provider: string;
  /** API key for cloud providers */
  apiKey?: string;
  /** Model name */
  model?: string;
  /** Ollama base URL */
  baseUrl?: string;
}

/**
 * Install the LLM bridge function into the page context.
 * Stages 3-5 of the cascade resolver call this from page JS.
 *
 * The function survives navigations (page.exposeFunction persists).
 */
export async function installLLMBridge(
  page: Page,
  options: LLMBridgeOptions
): Promise<void> {
  if (options.provider === 'none') {
    // No LLM configured -- expose a no-op bridge
    await page.exposeFunction('__browserlet_microPrompt', async () => null);
    return;
  }

  await page.exposeFunction(
    '__browserlet_microPrompt',
    async (inputJson: string): Promise<string | null> => {
      try {
        const input: MicroPromptInput = JSON.parse(inputJson);
        const prompt = buildMicroPrompt(input);

        // Call LLM API from Node.js context
        const rawResponse = await callLLM(prompt, options);
        if (!rawResponse) return null;

        // Validate response
        const parsed = extractJSON(rawResponse);
        if (!parsed) return null;

        const validated = validateMicroPromptOutput(input.type, parsed);
        if (!validated) return null;

        return JSON.stringify(validated);
      } catch {
        return null;
      }
    }
  );
}

async function callLLM(prompt: string, options: LLMBridgeOptions): Promise<string | null> {
  // Implementation depends on provider (Anthropic SDK, Ollama, etc.)
  // This is the same LLM service pattern used in the extension background
  return null; // Placeholder
}

function extractJSON(raw: string): unknown | null {
  // Same 3-tier extraction as microPromptRouter.ts
  try { return JSON.parse(raw); } catch {}
  const codeBlock = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlock?.[1]) { try { return JSON.parse(codeBlock[1].trim()); } catch {} }
  const obj = raw.match(/\{[\s\S]*\}/);
  if (obj) { try { return JSON.parse(obj[0]); } catch {} }
  return null;
}
```

### Pattern 5: Screenshot-on-Failure in BSLRunner
**What:** Automatically capture a screenshot when any step fails
**When to use:** In BSLRunner's step execution catch block

```typescript
// In runner.ts, modify the catch block:
// Source: Playwright page.screenshot docs
import path from 'node:path';

// In the step execution catch block:
catch (error: unknown) {
  const stepError = error as StepError;
  const errorMessage = stepError.message || String(error);

  // Screenshot on failure
  const stepName = step.id || `step-${i + 1}-${step.action}`;
  const safeName = stepName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const screenshotPath = path.join(outputDir, `fail-${safeName}.png`);

  try {
    await this.page.screenshot({ path: screenshotPath, fullPage: false });
    reporter.stepFail(errorMessage, screenshotPath);
  } catch {
    // Screenshot itself failed (browser crashed, etc.)
    reporter.stepFail(errorMessage);
  }

  const exitCode = stepError.code === 'TIMEOUT' ? 2 : 1;
  return { exitCode };
}
```

### Pattern 6: Element-to-Selector Bridge
**What:** After resolving an element in page.evaluate(), convert it to a selector Playwright can use
**When to use:** The resolver finds an Element inside page context, but Playwright needs a selector string

The key insight: **mark the resolved element with a unique data attribute inside page.evaluate(), then return that attribute as the selector for Playwright to use**. This is the most reliable approach because:
1. The element is already found and validated in page context
2. A `data-browserlet-resolved="unique-id"` attribute creates a guaranteed unique CSS selector
3. Playwright can then target `[data-browserlet-resolved="unique-id"]` with zero ambiguity
4. The attribute is cleaned up after the action executes

Alternative approaches (returning XPath, using ElementHandle) are less reliable or more complex.

### Anti-Patterns to Avoid
- **Passing Element objects from page.evaluate():** Elements are not serializable. page.evaluate() can only return JSON-serializable values. Always mark the element and return a selector string.
- **Using page.addScriptTag() for resolver injection:** addScriptTag does NOT persist across page navigations. After page.goto(), the resolver would be gone. Use page.addInitScript() which re-injects on every navigation.
- **Bundling at runtime:** Don't call esbuild at runtime. Build the resolver bundle at compile time and include it as a string constant. This eliminates esbuild as a runtime dependency.
- **Trying to share module state between page.evaluate() calls:** Each page.evaluate() runs in isolation from the Node.js process. Global state must live on `window` inside the page.
- **Calling chrome.storage or chrome.runtime from injected resolver:** These APIs don't exist in normal page context (only in extension content scripts). The CLI resolver must not depend on them.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-file TS -> single JS string | Manual concatenation | esbuild bundle with `write: false` | Import resolution, tree-shaking, TypeScript stripping, handles circular deps |
| Node.js function callable from page | Custom messaging/polling | `page.exposeFunction()` | Built into Playwright, survives navigations, handles serialization, returns Promises |
| Script persistence across navigations | Re-inject on every navigation event | `page.addInitScript()` | Built into Playwright, auto-executes on every navigation and frame attachment |
| Element reference bridge (page -> Node) | ElementHandle chains | Data attribute marking | Unique `data-*` attribute is a simple, reliable CSS selector; no handle lifecycle issues |
| Screenshot timing | Manual page.screenshot triggers | Centralized catch block in BSLRunner | Single place, consistent naming, guaranteed on every failure type |
| JSON extraction from LLM | Simple JSON.parse | 3-tier extraction (direct, code block, regex) | Already proven in microPromptRouter.ts; LLMs wrap JSON in markdown |

**Key insight:** The cascade resolver's DOM-querying logic (querySelectorAll, getAttribute, getBoundingClientRect, closest, etc.) works identically in Playwright page context as it does in extension content scripts -- all standard DOM APIs. The ONLY extension-specific parts are `chrome.runtime.sendMessage` and `chrome.storage.local`, which are cleanly isolated in `sendMicroPrompt()` and `HintStabilityTracker`.

## Common Pitfalls

### Pitfall 1: page.evaluate() Closure Capture
**What goes wrong:** Passing a function to page.evaluate() that references variables from the outer Node.js scope -- they're undefined in page context.
**Why it happens:** page.evaluate() serializes the function body and runs it in an isolated browser context. Closures don't cross the bridge.
**How to avoid:** Pass all needed data as the second argument to page.evaluate(). Use `page.evaluate((data) => { ... }, data)` pattern.
**Warning signs:** `ReferenceError: variableName is not defined` in page.evaluate() callbacks.

### Pitfall 2: Resolver Bundle Stale After Code Changes
**What goes wrong:** Developer modifies semanticResolver.ts but the CLI uses the old bundled version.
**Why it happens:** Build-time bundling means the IIFE string is generated once during `npm run build`, not live-updated.
**How to avoid:** Add the bundle generation to the build script pipeline. Include it in the `prebuild` or `build` npm script. Document that resolver changes require rebuild.
**Warning signs:** Tests pass in extension but fail in CLI with different scoring behavior.

### Pitfall 3: window.getComputedStyle Unavailable in JSDOM/Tests
**What goes wrong:** Unit tests for the resolver fail because JSDOM doesn't implement getComputedStyle fully.
**Why it happens:** The resolver uses `window.getComputedStyle(el)` for visibility checks (isElementVisible). JSDOM has limited CSS support.
**How to avoid:** For unit tests, mock getComputedStyle. For integration tests, use actual Playwright pages where the full DOM API is available. This is a strong argument for integration testing the resolver against real HTML pages.
**Warning signs:** Tests pass locally but fail in CI, or visibility checks always return true.

### Pitfall 4: addInitScript Timing with SPAs
**What goes wrong:** The resolver script runs before the SPA framework has rendered the DOM, so resolution finds zero candidates.
**Why it happens:** addInitScript runs "after document creation but before any page scripts." The DOM is nearly empty at that point.
**How to avoid:** addInitScript only INJECTS the resolver code (defines functions on window). The actual RESOLUTION call happens later via page.evaluate(), after page.waitForLoadState() or similar wait. The injection is separate from the execution.
**Warning signs:** Resolver finds zero candidates on SPA pages but works on static HTML.

### Pitfall 5: Serialization Limits on page.evaluate Arguments
**What goes wrong:** Passing large hint arrays or complex objects to page.evaluate() causes silent failures or truncation.
**Why it happens:** Playwright serializes arguments as JSON. Very large objects or objects with circular references fail.
**How to avoid:** SemanticHint[] is small and fully JSON-serializable (strings and simple objects). This should not be a problem in practice. But avoid passing DOM elements or functions as arguments.
**Warning signs:** page.evaluate() resolves to undefined unexpectedly.

### Pitfall 6: Screenshot Path Conflicts on Repeated Failures
**What goes wrong:** Multiple failed steps overwrite each other's screenshots.
**Why it happens:** Using generic filenames like "failure.png" instead of step-specific names.
**How to avoid:** Include step index and action in the filename: `fail-003-click-Submit.png`. Sanitize special characters from step names.
**Warning signs:** Output directory has fewer screenshots than failed steps.

### Pitfall 7: LLM Bridge Function Not Available After Navigation
**What goes wrong:** LLM micro-prompt call fails after navigating to a new page.
**Why it happens:** This should NOT happen -- `page.exposeFunction()` survives navigations per Playwright docs. But if using `page.evaluate()` to define the bridge instead, it would be lost.
**How to avoid:** Always use `page.exposeFunction()` (not `page.evaluate()` with manual window assignment) for the LLM bridge. Verify in integration tests that resolution works after page.goto().
**Warning signs:** Stage 3-5 resolution works on first page but fails after navigation.

## Code Examples

Verified patterns from official sources:

### page.addInitScript with Content String
```typescript
// Source: https://playwright.dev/docs/api/class-page#page-add-init-script
// Injects resolver code that persists across navigations
await page.addInitScript({ content: RESOLVER_BUNDLE_STRING });

// The resolver is now available on every page load:
const result = await page.evaluate(() => {
  return (window as any).__browserletResolver.resolveElementDeterministic(hints);
});
```

### page.exposeFunction for LLM Bridge
```typescript
// Source: https://playwright.dev/docs/api/class-page#page-expose-function
// Exposed functions survive navigations and support async
await page.exposeFunction('__browserlet_microPrompt', async (inputJson: string) => {
  // This runs in Node.js context -- full access to APIs, filesystem, SDK
  const input = JSON.parse(inputJson);
  const response = await anthropicClient.messages.create({ ... });
  return JSON.stringify(response);
});

// From page context (inside page.evaluate or injected script):
// const result = await window.__browserlet_microPrompt(JSON.stringify(input));
```

### page.screenshot on Failure
```typescript
// Source: https://playwright.dev/docs/screenshots
// Capture viewport screenshot (not fullPage -- shows what was visible during failure)
await page.screenshot({
  path: 'output/fail-003-click-Submit.png',
  type: 'png',
  fullPage: false,  // Viewport only -- more useful for debugging than full page
  timeout: 5000,    // Don't let screenshot hang if browser is crashing
});
```

### esbuild Bundle to String (Build-Time)
```typescript
// Source: https://esbuild.github.io/api/
import * as esbuild from 'esbuild';

const result = await esbuild.build({
  entryPoints: ['resolver-bundle/entry.ts'],
  bundle: true,
  write: false,          // Output to memory, not disk
  format: 'iife',        // Immediately-invoked function expression
  globalName: '__browserletResolver',  // window.__browserletResolver
  platform: 'browser',   // Target browser APIs (document, window)
  target: 'es2020',
  // Resolve @browserlet/core imports
  alias: {
    '@browserlet/core/types': './resolver-bundle/types.ts',
  },
});

const bundleString = new TextDecoder().decode(result.outputFiles[0].contents);
```

### Data Attribute Marking for Element Bridge
```typescript
// Inside page.evaluate():
const element = resolver.resolveElement(hints);
if (element.element) {
  // Mark with unique attribute so Playwright can find it
  const uid = `__brl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  element.element.setAttribute('data-browserlet-resolved', uid);

  // Return selector string (serializable)
  return `[data-browserlet-resolved="${uid}"]`;
}
```

### StepReporter Enhancement for Screenshot Path
```typescript
// Enhanced stepFail method showing screenshot location
stepFail(error: string, screenshotPath?: string): void {
  if (this.spinner) {
    let message = this.spinner.text + pc.red(` -- ${error}`);
    if (screenshotPath) {
      message += '\n' + pc.dim(`    Screenshot: ${screenshotPath}`);
    }
    this.spinner.fail(message);
    this.spinner = null;
  }
}
```

## Dependency Analysis: What Needs Porting

### cascadeResolver.ts Dependencies (Full Map)

| Dependency | File | Browser-Only? | Porting Strategy |
|-----------|------|--------------|-----------------|
| `resolveElement` | semanticResolver.ts | No (pure DOM) | Bundle directly |
| `isElementInteractable` | semanticResolver.ts | No (pure DOM) | Bundle directly |
| `extractDOMContext` | domContextExtractor.ts | No (pure DOM) | Bundle directly |
| `computeStructuralBoost` | structuralScorer.ts | No (pure DOM) | Bundle directly |
| `HintStabilityTracker` | hintStabilityTracker.ts | YES (chrome.storage.local) | Skip for MVP; stability data not available in CLI context |
| `sendMicroPrompt` | cascadeResolver.ts | YES (chrome.runtime.sendMessage) | Replace with page.exposeFunction bridge |
| `getMicroPromptsEnabled` | cascadeResolver.ts | YES (chrome.storage.local) | Replace with CLI config option |
| `normalizeText` | utils/hints/text.ts | No (pure string) | Bundle directly |
| `getElementRole` | utils/hints/dom.ts | No (pure DOM) | Bundle directly |
| `isElementVisible` | utils/hints/dom.ts | No (pure DOM, uses getComputedStyle) | Bundle directly |
| `findAssociatedLabel` | utils/hints/dom.ts | No (pure DOM) | Bundle directly |
| `SemanticHint`, `HintType` | @browserlet/core/types | No (types only) | Types stripped by esbuild, HINT_WEIGHTS inlined |
| `HINT_WEIGHTS` | @browserlet/core/types | No (constant object) | Bundle directly |
| `MicroPromptInput` types | @browserlet/core/prompts | No (types only) | Types stripped by esbuild |

**Key finding:** 80%+ of the cascade resolver is pure DOM logic with zero browser extension dependencies. Only 3 functions need replacement: `sendMicroPrompt`, `getMicroPromptsEnabled`, and `HintStabilityTracker.load/save`.

### Porting Decision: Skip vs Adapt

| Feature | Decision | Rationale |
|---------|----------|-----------|
| Stages 1-2 (deterministic) | Bundle and inject | Pure DOM logic, works identically in Playwright page context |
| Stage 3 (hint_suggester) | Adapt via LLM bridge | Replace chrome.runtime.sendMessage with page.exposeFunction |
| Stage 4 (disambiguator) | Adapt via LLM bridge | Same bridge pattern |
| Stage 5 (confidence_booster) | Adapt via LLM bridge | Same bridge pattern |
| HintStabilityTracker | Skip for v1.6 | No chrome.storage.local in CLI; stability data requires multiple runs. Deferred. |
| CSS fallback (Stage 6) | Keep SimpleResolver | SimpleResolver already handles this in CLI; cascade resolves to it on failure |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| page.evaluate() with inline functions | page.addInitScript() for persistent injection | Playwright v1.0 (core feature) | Code persists across navigations, no re-injection needed |
| ElementHandle for cross-context references | Data attribute marking + CSS selector | Community pattern ~2023 | Avoids handle lifecycle issues, simpler serialization |
| Manual LLM HTTP calls from page context | page.exposeFunction() bridge to Node.js | Playwright v1.8 (feature) | Clean separation, async support, survives navigations |
| Concatenating .js files manually | esbuild bundle with write: false | esbuild 0.8+ (2020) | Handles imports, tree-shaking, TypeScript, sourcemaps |

**Deprecated/outdated:**
- **page.$eval / page.$$eval for complex logic**: Use page.evaluate() with pre-injected resolver code instead. $eval is for simple one-liners.
- **ElementHandle as primary pattern**: Playwright docs now recommend Locators. For resolver bridge, data-attribute marking is cleaner than handle chains.

## Open Questions

1. **Should the CLI resolver support LLM micro-prompts in v1.6?**
   - What we know: The extension uses micro-prompts (Stages 3-5) for ~15% of resolutions. The CLI could use the same `@anthropic-ai/sdk` or Ollama already in the project.
   - What's unclear: Do CLI users want/need LLM-assisted resolution? It adds latency and API cost. The Phase 25 requirements say "cascade resolver at 0.85 then 0.70 thresholds" which implies both stages.
   - Recommendation: Implement the bridge architecture (page.exposeFunction) but make LLM stages **opt-in** via a `--llm` or `--micro-prompts` flag. Default to deterministic-only (Stages 1-2 + CSS fallback). This satisfies the requirement while keeping default execution fast and free.

2. **Where should the resolver bundle entry point source files live?**
   - What we know: The resolver logic currently lives in `entrypoints/content/playback/`. The CLI needs its own adapted versions that don't import from `../../../utils/`.
   - What's unclear: Should we copy files to `packages/cli/resolver-bundle/` or should Phase 23's monorepo extraction move these to `@browserlet/core`?
   - Recommendation: Check Phase 23 scope. If the DOM utilities (normalizeText, getElementRole, findAssociatedLabel) are already being extracted to @browserlet/core, import from there. If not, copy the needed files into `packages/cli/resolver-bundle/` with a comment noting the source. The resolver logic itself (semanticResolver, domContextExtractor, structuralScorer) stays in the bundle entry point since it's browser-DOM-specific and only needed for page.evaluate().

3. **Build-time vs runtime bundling tradeoff?**
   - What we know: Build-time is simpler (esbuild is devDependency only). Runtime is more flexible (always uses latest code).
   - What's unclear: How often will resolver code change? If frequently during development, rebuild friction matters.
   - Recommendation: Build-time bundling. Add `build-resolver` to the npm build script. Use `--watch` mode during development. The resolver code is mature (Phase 17-22 completed) and unlikely to change frequently.

4. **How to handle the output directory for failure screenshots?**
   - What we know: BSLRunner needs a path for screenshots. The extension doesn't have this concept.
   - What's unclear: Should it default to `.` (cwd), a `browserlet-output/` directory, or the script's directory?
   - Recommendation: Default to `./browserlet-output/` (created if not exists). Support `--output-dir` CLI flag. Screenshot filenames: `fail-{NNN}-{action}-{sanitized-target}.png`.

## Sources

### Primary (HIGH confidence)
- [Playwright Evaluating JavaScript](https://playwright.dev/docs/evaluating) - page.evaluate() serialization, addInitScript persistence
- [Playwright page.addInitScript API](https://playwright.dev/docs/api/class-page#page-add-init-script) - Injection timing, persistence across navigations, parameter options
- [Playwright page.exposeFunction API](https://playwright.dev/docs/api/class-page#page-expose-function) - Node.js bridge, navigation survival, async support
- [Playwright page.addScriptTag API](https://playwright.dev/docs/api/class-page#page-add-script-tag) - One-time injection (NOT used -- does not persist)
- [Playwright Screenshots](https://playwright.dev/docs/screenshots) - page.screenshot options (path, fullPage, type)
- [esbuild API Documentation](https://esbuild.github.io/api/) - bundle, write: false, format: iife, globalName, platform

### Secondary (MEDIUM confidence)
- [Apify Playwright Code Injection Guide](https://docs.apify.com/academy/puppeteer-playwright/executing-scripts/injecting-code) - Practical injection patterns
- [BrowserStack Playwright Evaluate](https://www.browserstack.com/guide/playwright-evaluate) - page.evaluate() patterns and limitations
- [Programmable Browser - Load Scripts in Playwright](https://www.programmablebrowser.com/posts/add-script-playwright/) - addScriptTag vs addInitScript comparison

### Codebase (HIGH confidence - direct source analysis)
- `entrypoints/content/playback/cascadeResolver.ts` - 616 lines, 6 stages, 3 browser-extension-only dependencies
- `entrypoints/content/playback/semanticResolver.ts` - Pure DOM hint matching, no extension deps
- `entrypoints/content/playback/domContextExtractor.ts` - Pure DOM traversal, imports only `utils/hints/*`
- `entrypoints/content/playback/structuralScorer.ts` - Pure computation, imports only types + normalizeText
- `entrypoints/content/playback/hintStabilityTracker.ts` - Uses `chrome.storage.local` (SKIP for CLI)
- `utils/hints/text.ts` - Pure string normalization (normalizeText)
- `utils/hints/dom.ts` - Pure DOM utilities (getElementRole, isElementVisible, findAssociatedLabel)
- `packages/cli/src/runner.ts` - BSLRunner with step loop, reporter integration
- `packages/cli/src/output.ts` - StepReporter with spinner + pass/fail
- `packages/cli/src/resolver.ts` - SimpleResolver (Phase 24 placeholder)
- `packages/cli/src/executor.ts` - PlaywrightExecutor (unchanged for Phase 25)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Playwright APIs (addInitScript, exposeFunction, screenshot) are well-documented core features; esbuild is mature and widely used
- Architecture (bundling approach): HIGH - esbuild IIFE bundling is a proven pattern; addInitScript persistence is documented behavior
- Architecture (LLM bridge): MEDIUM - page.exposeFunction is documented but the async LLM bridge pattern is less common; needs integration testing
- Dependency analysis: HIGH - Direct source code analysis of all 7 resolver files, identified exactly which deps are browser-only
- Pitfalls: MEDIUM - Based on Playwright documentation + community patterns; some pitfalls from experience may be missing

**Research date:** 2026-02-14
**Valid until:** 2026-03-14 (30 days - Playwright and esbuild are stable, resolver code is mature from Phase 17-22)

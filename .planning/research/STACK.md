# Technology Stack

**Project:** Browserlet
**Domain:** Chrome Extension - Semantic Web Automation
**Researched:** 2026-01-29
**Overall Confidence:** HIGH

---

## Executive Summary

The 2026 Chrome extension ecosystem has standardized on **Manifest V3**, **Vite 7** as the build tool of choice, and **TypeScript 5.9** for type safety. For Browserlet's specific requirements (lightweight UI, offline execution, semantic DOM manipulation), the recommended stack balances bundle size, developer experience, and Chrome extension compatibility.

**Key Decision:** Use **WXT framework** over manual Vite configuration or CRXJS. WXT provides superior developer experience with built-in Manifest V3 support, HMR for content scripts, and framework-agnostic architecture while avoiding CRXJS's maintenance uncertainty.

---

## Recommended Stack

### Core Framework & Build System

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **WXT** | `^0.19.x` | Chrome Extension Framework | **HIGH confidence.** Vite-based framework purpose-built for extensions. Provides HMR for content scripts, auto-generates manifest, file-based project structure, and cross-browser support. Actively maintained, unlike CRXJS (archived June 2025). More comprehensive than manual Vite setup with less boilerplate. |
| **Vite** | `^7.3.1` | Build Tool | **HIGH confidence.** Latest major version (7.x). 100x faster dev builds than Webpack. Native ESM, sub-second HMR. WXT is built on Vite, inheriting all performance benefits. Vite 7 changes default target to 'baseline-widely-available'. |
| **TypeScript** | `^5.9.3` | Type System | **HIGH confidence.** Latest stable version. Provides type safety for Chrome APIs via `@types/chrome`. Essential for maintaining BSL parser and Semantic Resolver logic. 5.9 is current release (Jan 2026). |
| **@types/chrome** | `^0.0.290+` | Chrome API Types | **HIGH confidence.** TypeScript definitions for Chrome extension APIs. Critical for service worker, content script, and Side Panel API type safety. |

**Rationale for WXT over alternatives:**
- **vs CRXJS:** CRXJS repository archived June 2025 after failing to find maintainers. WXT is actively maintained with recent releases.
- **vs Plasmo:** Plasmo uses Parcel (technical debt), WXT uses Vite (modern, faster). WXT is framework-agnostic, Plasmo is React-focused.
- **vs Manual Vite:** WXT eliminates boilerplate for extension-specific concerns (manifest generation, content script bundling, web-accessible resources). Saves ~100-200 LOC of configuration.

### UI Framework & Styling

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Preact** | `^10.28.2` | UI Framework | **HIGH confidence.** 3KB bundle (vs React's 35KB). Critical for extension bundle size constraints. API-compatible with React via `preact/compat`. New projects should use Preact 10.x (Preact 11 beta not production-ready). PRD specifies Preact + Tailwind. |
| **preact/signals** | `^1.3.x` | State Management | **MEDIUM confidence.** Official Preact state solution. More performant than React's state model for fine-grained reactivity. Zero dependencies, 1.5KB. Consider if complex state beyond useState. |
| **Tailwind CSS** | `^4.1.x` | Styling | **HIGH confidence.** Utility-first CSS with JIT compilation. Bundle size optimized via purging (3.75MB dev → ~12KB production with proper config). PRD specifies Tailwind. Integrates seamlessly with Vite via PostCSS. |
| **PostCSS** | `^8.5.x` | CSS Processing | **HIGH confidence.** Required for Tailwind. WXT includes PostCSS support out of the box. |

**Bundle size justification:**
- **Preact:** Browserlet popup/side panel must load quickly. 3KB vs 35KB is 10x reduction. With Monaco Editor (~1MB), every KB elsewhere counts.
- **Tailwind JIT:** Only generates CSS for classes actually used. Configure `content: ['./entrypoints/**/*.{js,ts,tsx}']` in `tailwind.config.js` to ensure proper purging.

### Code Editor

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Monaco Editor** | `^0.55.1` | YAML Editor | **HIGH confidence.** VS Code's editor. PRD requires Monaco for BSL (YAML) editing with syntax highlighting, auto-complete. Latest version 0.55.1 (Nov 2025). Proven integration in Chrome extensions (Monaco TextField Editor, GitHub Monaco). ~1MB bundle, but essential for DX. |
| **@monaco-editor/react** | `^4.6.x` | React/Preact Wrapper | **MEDIUM confidence.** Official React wrapper works with Preact via `preact/compat`. Simplifies Monaco integration (handles worker loading, lifecycle). Alternative: Use Monaco directly for smaller bundle (~50KB savings), but more setup. |

**Monaco Editor integration notes:**
- Monaco requires web workers for language services (YAML syntax, validation). WXT handles `web_accessible_resources` manifest entries automatically.
- For YAML: Configure custom language with `monaco.languages.register({ id: 'bsl' })` for BSL-specific syntax.
- Consider lazy loading Monaco (only when side panel opens) to reduce initial popup load time.

### YAML Parsing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **yaml** (eemeli/yaml) | `^2.8.2` | BSL Parser | **HIGH confidence.** Modern YAML 1.1/1.2 parser with full TypeScript support. Zero dependencies, runs in browser. More actively maintained than `js-yaml` (last publish 2 years ago). Provides AST access for advanced BSL parsing (comments, custom tags). 10,746 projects use it. |

**Why `yaml` over `js-yaml`:**
- **Maintenance:** `yaml` actively developed, `js-yaml` last publish ~2 years ago.
- **TypeScript:** `yaml` designed for TypeScript, `js-yaml` requires `@types/js-yaml`.
- **Features:** `yaml` provides streaming parser (useful for large BSL scripts), AST manipulation (needed if BSL evolves to support variables/functions).
- **Performance:** Similar performance, but `yaml` has lower memory overhead for large documents.

### Testing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Vitest** | `^4.0.17` | Unit Testing | **HIGH confidence.** 10-20x faster than Jest in watch mode. Native Vite integration (reuses WXT's Vite config). ESM-native, zero config for TypeScript. Vitest 4.0 stable (Jan 2026) with Browser Mode stable. 17M weekly downloads. |
| **@vitest/ui** | `^4.0.x` | Test UI | **MEDIUM confidence.** Browser-based test runner UI. Useful for debugging complex BSL parser logic or Semantic Resolver matching. Optional but valuable for DX. |
| **Playwright** | `^1.57.0` | E2E Testing | **HIGH confidence.** Official Chrome extension support via `launchPersistentContext`. Tests popup, side panel, content scripts, service worker. PRD specifies Playwright. 1.57+ uses Chrome for Testing (not Chromium) for better compatibility. |
| **@playwright/test** | `^1.57.0` | Playwright Test Runner | **HIGH confidence.** Built-in fixtures for extension testing. Parallel execution, video recording, trace viewer for debugging flaky tests. |

**Testing strategy:**
- **Vitest:** BSL parser unit tests, Semantic Resolver logic, state management.
- **Playwright:** Full extension flows (create script, execute script, observe DOM changes, verify side panel state).
- **Playwright Chrome extension fixture:**
  ```typescript
  // Load extension with persistent context
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });
  ```

### DOM Manipulation & Observation

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **MutationObserver** (Web API) | Native | DOM Change Detection | **HIGH confidence.** Native browser API for observing DOM changes. Critical for Semantic Resolver to detect dynamic content. Zero bundle cost. Modern API with broad support. |
| **IntersectionObserver** (Web API) | Native | Viewport Detection | **MEDIUM confidence.** Detect when elements enter/leave viewport. Useful for optimizing Semantic Resolver performance (only process visible elements). Zero bundle cost. |

**DOM observation patterns for Browserlet:**
- **Semantic Resolver:** Use `MutationObserver` to re-run selectors when page structure changes (SPA navigation, lazy-loaded content).
- **Performance:** Debounce MutationObserver callbacks (e.g., 100ms) to avoid thrashing on rapid DOM changes.
- **Service Worker limitation:** Content scripts run in page context, service workers cannot access DOM. Architecture must use message passing.

### Development Tools

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **ESLint** | `^9.x` | Linting | **HIGH confidence.** ESLint 9 flat config (2026 standard). TypeScript support via `typescript-eslint`. Catches common Chrome extension pitfalls (e.g., using `window` in service worker). |
| **typescript-eslint** | `^8.x` | TypeScript Linting | **HIGH confidence.** Official TypeScript ESLint plugin. Enforces type-aware rules. |
| **Prettier** | `^3.x` | Code Formatting | **HIGH confidence.** Opinionated formatter. Use `eslint-config-prettier` to disable conflicting ESLint rules. |
| **eslint-plugin-chrome-extensions** | `^1.x` (if available) | Extension-Specific Linting | **LOW confidence.** Check if exists for Manifest V3 rules. Manually enforce best practices otherwise (e.g., no `eval()`, proper CSP). |

---

## Chrome Extension Architecture Components

### Manifest V3 Architecture

| Component | Runtime | Purpose | API Access |
|-----------|---------|---------|------------|
| **Service Worker** | Background | Message routing, storage, API calls | All Chrome APIs, NO DOM access |
| **Content Script** | Page Context | DOM manipulation, Semantic Resolver execution | DOM access, limited Chrome APIs (storage, runtime) |
| **Side Panel** | Extension Page | BSL editor (Monaco), script library, execution controls | All Chrome APIs, own DOM only |
| **Popup** | Extension Page | Quick actions, status display | All Chrome APIs, own DOM only |

**Communication pattern:**
```
Side Panel (create BSL script)
    ↓ chrome.runtime.sendMessage()
Service Worker (store script, route to content script)
    ↓ chrome.tabs.sendMessage()
Content Script (execute BSL via Semantic Resolver, manipulate DOM)
    ↓ chrome.runtime.sendMessage()
Service Worker (relay results)
    ↓ chrome.runtime.sendMessage()
Side Panel (display execution results)
```

### Side Panel API (Chrome 114+)

The Chrome Side Panel API allows persistent UI alongside web content. Key features for Browserlet:

- **Persistent across tabs:** `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`
- **Tab-specific panels:** Show different scripts for different domains
- **Layout detection (Chrome 140+):** `chrome.sidePanel.getLayout()` for RTL support
- **Monaco Editor integration:** Full access to Chrome APIs, can load large editor bundle without popup size constraints

**Use Side Panel for:**
- Monaco Editor (BSL script creation/editing)
- Script library (saved scripts, templates)
- Execution results (verbose output, DOM change logs)

**Use Popup for:**
- Quick script execution (one-click run saved script)
- Extension status (enabled/disabled)
- Settings shortcut

---

## Installation Guide

### 1. Initialize WXT Project

```bash
# Create new WXT project
npm create wxt@latest

# Select options:
# - Package manager: npm
# - Template: preact-ts
# - Install dependencies: Yes
```

### 2. Install Core Dependencies

```bash
# UI & Styling
npm install preact @preact/signals
npm install -D tailwindcss postcss autoprefixer

# Monaco Editor
npm install monaco-editor @monaco-editor/react

# YAML Parsing
npm install yaml

# Chrome Extension Types
npm install -D @types/chrome
```

### 3. Install Dev Dependencies

```bash
# Testing
npm install -D vitest @vitest/ui @playwright/test

# Linting & Formatting
npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
npm install -D prettier eslint-config-prettier eslint-plugin-prettier
```

### 4. Configure Tailwind CSS

```bash
# Initialize Tailwind
npx tailwindcss init -p
```

**tailwind.config.js:**
```javascript
export default {
  content: [
    './entrypoints/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

### 5. Configure Vitest

**vitest.config.ts:**
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom', // For DOM testing
  },
});
```

### 6. Configure Playwright

```bash
# Initialize Playwright
npx playwright install
```

**playwright.config.ts:**
```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    headless: false, // Chrome extensions require headed mode
  },
});
```

---

## Alternatives Considered

### Build Tool: Vite vs Webpack

| Aspect | Vite (Recommended) | Webpack | Winner |
|--------|-------------------|---------|--------|
| **Dev startup** | 0.4s | 45s (large projects) | **Vite** (100x faster) |
| **HMR** | Sub-second | Seconds | **Vite** |
| **Config complexity** | Low (zero-config with WXT) | High (100-200 LOC for extensions) | **Vite** |
| **Production build** | Fast (Rollup-based) | Comparable (with caching) | Tie |
| **Chrome extension DX** | Excellent (WXT, CRXJS) | Good (boilerplates available) | **Vite** |
| **Ecosystem maturity** | Modern, growing | Mature, extensive | **Webpack** (but gap closing) |

**Verdict:** Vite for Browserlet. Development speed critical for iteration on Semantic Resolver logic.

### Framework: WXT vs CRXJS vs Manual Vite

| Aspect | WXT (Recommended) | CRXJS | Manual Vite | Winner |
|--------|------------------|-------|-------------|--------|
| **Maintenance** | Active (2026+) | Archived (June 2025) | N/A | **WXT** |
| **DX** | Excellent (HMR for content scripts) | Excellent | Good (manual setup) | **WXT/CRXJS** |
| **Manifest generation** | Auto (file-based) | Auto | Manual | **WXT/CRXJS** |
| **Framework support** | Preact, React, Vue, Svelte | React, Preact | Any | **WXT** |
| **Bundle size overhead** | Minimal | Minimal | None | **Manual** (marginal) |
| **Learning curve** | Low (Next.js-like patterns) | Low | Medium (Vite + extension config) | **WXT** |

**Verdict:** WXT for Browserlet. CRXJS maintenance risk unacceptable. WXT's file-based structure (Next.js-style) reduces boilerplate.

### UI Framework: Preact vs React

| Aspect | Preact (Recommended) | React | Winner |
|--------|---------------------|-------|--------|
| **Bundle size** | 3KB | 35KB | **Preact** (10x smaller) |
| **API compatibility** | 95%+ via preact/compat | Native | **React** (100% compatible with itself) |
| **Performance** | Signals faster than React state | Good (but improving) | **Preact** |
| **Ecosystem** | Smaller (but React libs work via compat) | Massive | **React** |
| **DX** | Excellent (same API as React) | Excellent | Tie |
| **Chrome extension fit** | Ideal (bundle size critical) | Acceptable | **Preact** |

**Verdict:** Preact for Browserlet. PRD specifies Preact. Bundle size matters for extensions. Monaco Editor already adds ~1MB, so UI framework must be minimal.

### YAML Parser: yaml vs js-yaml

| Aspect | yaml (Recommended) | js-yaml | Winner |
|--------|-------------------|---------|--------|
| **Maintenance** | Active (2 months since last publish) | Stale (2 years since last publish) | **yaml** |
| **TypeScript support** | Native | Via @types/js-yaml | **yaml** |
| **Bundle size** | Similar (~30KB) | Similar (~30KB) | Tie |
| **Features** | AST, streaming, YAML 1.1/1.2 | YAML 1.1/1.2 | **yaml** (AST useful for BSL) |
| **Dependencies** | Zero | Zero | Tie |
| **Performance** | Comparable | Comparable | Tie |

**Verdict:** `yaml` for Browserlet. Better TypeScript support, active maintenance, AST access for potential BSL extensions (variables, functions, custom directives).

### Testing: Vitest vs Jest

| Aspect | Vitest (Recommended) | Jest | Winner |
|--------|---------------------|------|--------|
| **Speed (watch mode)** | 10-20x faster | Baseline | **Vitest** |
| **Vite integration** | Native (reuses config) | Requires `vite-jest` | **Vitest** |
| **ESM support** | Native | Experimental (Jest 30) | **Vitest** |
| **TypeScript** | Zero-config | Requires `ts-jest` | **Vitest** |
| **Memory usage** | 800MB (50K LOC project) | 1.2GB (50K LOC project) | **Vitest** |
| **Ecosystem** | Growing | Massive (maturity advantage) | **Jest** |
| **Chrome extension support** | Same as Jest | Well-documented | Tie |

**Verdict:** Vitest for Browserlet. WXT uses Vite, so Vitest integration is seamless. Speed advantage critical for TDD on BSL parser.

---

## Anti-Patterns to Avoid

### 1. Using Remotely Hosted Code
**Problem:** Manifest V3 prohibits remotely hosted code (CSP: `script-src 'self'`).
**Impact:** Extension store rejection.
**Solution:** Bundle all JavaScript, including libraries. No CDN-loaded scripts.

### 2. Using `window` in Service Worker
**Problem:** Service workers have no `window` or `document` global.
**Impact:** Runtime errors (e.g., `window is not defined`).
**Solution:** Use content scripts for DOM access. Service workers only for storage, messaging, background tasks.

### 3. Synchronous XHR in Content Scripts
**Problem:** Blocks rendering thread.
**Impact:** Poor UX, potential Chrome Web Store rejection.
**Solution:** Use `fetch()` (async). For BSL script execution, use `async`/`await` for all I/O.

### 4. Over-requesting Permissions
**Problem:** Requesting `<all_urls>` when only specific domains needed.
**Impact:** #1 reason for Chrome Web Store rejection. Users distrust extensions with broad permissions.
**Solution:** Use `host_permissions` with specific domains. For Browserlet: Consider `activeTab` permission (user grants access on-demand).

### 5. Not Handling Service Worker Termination
**Problem:** Service workers can be terminated anytime (5 minutes idle timeout).
**Impact:** Lost state, incomplete operations.
**Solution:**
- Persist state to `chrome.storage.local` (not in-memory variables).
- Use `chrome.alarms` for scheduled tasks (persists across worker restarts).
- Make all operations idempotent (can be safely retried).

### 6. Large Bundles in Popup
**Problem:** Loading Monaco Editor (~1MB) in popup.
**Impact:** Popup opens slowly (bad UX).
**Solution:** Use Side Panel for Monaco Editor. Popup only for quick actions (<100KB total bundle).

### 7. Not Purging Tailwind CSS
**Problem:** Including full 3.75MB Tailwind stylesheet.
**Impact:** Violates Chrome Web Store size limits, slow load times.
**Solution:** Configure `content` paths in `tailwind.config.js`. Verify production CSS is <50KB.

### 8. Ignoring Content Security Policy
**Problem:** Using `eval()`, `new Function()`, inline scripts.
**Impact:** CSP violations, extension rejection.
**Solution:**
- No `eval()` or `new Function()` (even for BSL script execution).
- Parse BSL to AST, then execute via traversal (not `eval()`).
- Externalize all scripts (no inline `<script>`).

---

## Bundle Size Targets

Based on Chrome Web Store best practices and user expectations:

| Component | Target | Limit | Notes |
|-----------|--------|-------|-------|
| **Popup** | <50KB | 100KB | Fast open (<200ms). Minimal UI only. |
| **Side Panel** | <1.2MB | 2MB | Monaco Editor ~1MB. Lazy load if possible. |
| **Content Script** | <150KB | 300KB | Injected into every page. Includes Semantic Resolver, BSL interpreter. |
| **Service Worker** | <100KB | 200KB | Messaging logic, storage management. |
| **CSS (production)** | <20KB | 50KB | Tailwind purged. Side Panel may have more. |

**Measurement:**
```bash
# Build extension
npm run build

# Check bundle sizes
ls -lh .output/chrome-mv3/
```

**If over budget:**
- **Popup:** Move features to Side Panel.
- **Side Panel:** Lazy load Monaco (dynamic `import()`).
- **Content Script:** Split Semantic Resolver into separate script, inject only when needed.
- **CSS:** Verify Tailwind purge config, remove unused utilities.

---

## Manifest V3 Key Concepts

### Permissions Model

**Browserlet likely needs:**
- `storage`: Save BSL scripts to `chrome.storage.local`.
- `activeTab`: Access DOM of current tab when user triggers script.
- `sidePanel`: Use Side Panel API.
- `scripting`: Inject content scripts programmatically.

**Avoid:**
- `<all_urls>`: Over-broad. Use `activeTab` instead (user grants per-use).
- `tabs`: Exposes sensitive data (URL, title). Only if truly needed.

**manifest.json example:**
```json
{
  "manifest_version": 3,
  "name": "Browserlet",
  "version": "0.1.0",
  "permissions": ["storage", "activeTab", "sidePanel", "scripting"],
  "background": {
    "service_worker": "background.js"
  },
  "side_panel": {
    "default_path": "sidepanel.html"
  },
  "action": {
    "default_popup": "popup.html"
  }
}
```

### Service Worker Lifecycle

**Critical for Browserlet:**
- **Ephemeral:** Starts on event (message, alarm, extension icon click), stops after 5 minutes idle.
- **No DOM:** Cannot access page DOM. Must use content scripts.
- **Storage:** Use `chrome.storage.local` (persists), not global variables (lost on termination).

**Debugging:**
```javascript
// In service worker
chrome.runtime.onStartup.addListener(() => {
  console.log('Service worker started');
});

chrome.runtime.onSuspend.addListener(() => {
  console.log('Service worker suspending');
  // Save critical state here
});
```

### Content Script Isolation

**Key constraints:**
- **Isolated world:** Content scripts run in isolated JavaScript context. Cannot access page's JavaScript variables.
- **Shared DOM:** Can read/modify DOM (Semantic Resolver executes here).
- **Limited APIs:** Cannot use most Chrome APIs. Must message service worker for `chrome.storage`, `chrome.tabs`, etc.

**For Semantic Resolver:**
- Content script injects BSL interpreter + Semantic Resolver.
- Observes DOM via `MutationObserver`.
- Sends results to service worker → side panel.

---

## Performance Optimization Checklist

- [ ] **Tailwind purging enabled** (`content` paths in config)
- [ ] **Monaco Editor lazy loaded** (dynamic import in Side Panel)
- [ ] **Content script code-split** (inject Semantic Resolver only when needed)
- [ ] **Service worker state persisted** (use `chrome.storage.local`, not variables)
- [ ] **MutationObserver debounced** (100ms delay to avoid thrashing)
- [ ] **Vite production build** (`vite build` minifies, tree-shakes)
- [ ] **Chrome DevTools Performance tab** (verify popup opens <200ms)
- [ ] **Extension size** (<5MB total for Chrome Web Store)

---

## Confidence Assessment

| Area | Confidence | Rationale |
|------|------------|-----------|
| **Build Tool (Vite)** | HIGH | Vite 7.x latest stable. Broad adoption (17M weekly downloads). WXT proven for extensions. |
| **Framework (WXT)** | HIGH | Active maintenance, superior to archived CRXJS. Multiple sources confirm 2025-2026 leadership. |
| **UI (Preact)** | HIGH | Version 10.28.2 stable. PRD specifies Preact. Bundle size critical, well-documented. |
| **Editor (Monaco)** | HIGH | Version 0.55.1 latest. Proven in Chrome extensions. Official docs + community examples. |
| **YAML Parser** | HIGH | `yaml` 2.8.2 actively maintained, TypeScript-native. Preferred over stale `js-yaml`. |
| **Testing (Vitest)** | HIGH | 4.0.17 stable. 10-20x faster than Jest. Native Vite integration. |
| **E2E (Playwright)** | HIGH | 1.57.0 official extension support. BrowserStack 2026 guide confirms current best practice. |
| **Side Panel API** | HIGH | Chrome 114+ stable. Official docs, Chrome 140 adds layout detection. |
| **Architecture (MV3)** | HIGH | Manifest V3 mandatory since 2024. Service worker patterns well-documented. |

**Overall confidence: HIGH** — All recommendations verified via official docs (Chrome for Developers, npm registries) and recent 2025-2026 community sources.

---

## Sources

### Official Documentation
- [Chrome Extensions Manifest V3 | Chrome for Developers](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
- [chrome.sidePanel API | Chrome for Developers](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
- [Playwright Chrome Extensions](https://playwright.dev/docs/chrome-extensions)
- [Vite 7.0 Release](https://vite.dev/blog/announcing-vite7)
- [Vitest 4.0 Release](https://vitest.dev/blog/vitest-4)
- [TypeScript 5.9 Release Notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-9.html)
- [Preact Official Site](https://preactjs.com/)
- [Monaco Editor](https://microsoft.github.io/monaco-editor/)

### npm Packages
- [@crxjs/vite-plugin - npm](https://www.npmjs.com/package/@crxjs/vite-plugin)
- [yaml - npm](https://www.npmjs.com/package/yaml)
- [preact - npm](https://www.npmjs.com/package/preact)
- [monaco-editor - npm](https://www.npmjs.com/package/monaco-editor)
- [vitest - npm](https://www.npmjs.com/package/vitest)
- [@playwright/test - npm](https://www.npmjs.com/package/@playwright/test)

### Framework & Tooling Comparisons
- [WXT - Next-gen Web Extension Framework](https://wxt.dev/)
- [The 2025 State of Browser Extension Frameworks: Plasmo, WXT, CRXJS](https://redreamality.com/blog/the-2025-state-of-browser-extension-frameworks-a-comparative-analysis-of-plasmo-wxt-and-crxjs/)
- [Vite vs. Webpack in 2026: Performance Analysis](https://dev.to/pockit_tools/vite-vs-webpack-in-2026-a-complete-migration-guide-and-deep-performance-analysis-5ej5)
- [Vitest vs Jest 30: Why 2026 is the Year of Browser-Native Testing](https://dev.to/dataformathub/vitest-vs-jest-30-why-2026-is-the-year-of-browser-native-testing-2fgb)
- [Preact vs React: A Comprehensive Comparison for 2026](https://www.alphabold.com/preact-vs-react/)

### Community Guides
- [Chrome Extension Development: Complete System Architecture Guide for 2026](https://jinlow.medium.com/chrome-extension-development-the-complete-system-architecture-guide-for-2026-9ae81415f93e)
- [How to Automate Tests for a Chrome Extension using Playwright | BrowserStack](https://www.browserstack.com/guide/playwright-chrome-extension)
- [Building Chrome Extension with Vite](https://dev.to/rgolawski/building-chrome-extension-with-vite-47bh)
- [Linting and formatting TypeScript in Chrome extension (2024)](https://victoronsoftware.com/posts/linting-and-formatting-typescript/)

---

**Next Steps:**
1. Initialize WXT project with Preact-TypeScript template
2. Configure Tailwind CSS with purging
3. Set up Vitest for BSL parser unit tests
4. Integrate Monaco Editor in Side Panel
5. Configure Playwright for E2E extension testing
6. Implement service worker → content script messaging architecture

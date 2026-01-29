# Project Research Summary

**Project:** Browserlet
**Domain:** Chrome Extension - Semantic Web Automation
**Researched:** 2026-01-29
**Confidence:** HIGH

## Executive Summary

Browserlet is a Chrome extension that enables deterministic web automation through AI-assisted semantic selectors. The research confirms this occupies a unique market position between brittle traditional tools (Selenium IDE, Katalon) and expensive non-deterministic AI agents (Skyvern). The recommended approach combines AI at script creation time with 100% deterministic execution, avoiding runtime AI costs and hallucination risks while achieving resilience superior to CSS/XPath selectors.

The technical foundation is solid: WXT framework over Vite 7 provides modern Chrome extension DX, Preact minimizes bundle size (critical for extensions), Monaco Editor delivers professional BSL editing, and the eemeli/yaml parser offers TypeScript-native YAML handling. The 2026 ecosystem has standardized on Manifest V3 with clear architectural patterns (service worker hub, content script isolation, side panel UI).

Critical risks center on service worker lifecycle management (30-second termination), cross-origin iframe access for legacy ERPs, and LLM API key security. Mitigation requires architecture decisions from day one: chrome.storage.local as source of truth, all_frames content script injection, and user-owned API keys. The research identifies a strict build order (service worker → content script → side panel → LLM integration) that must be followed to avoid architectural debt.

## Key Findings

### Recommended Stack

The 2026 Chrome extension ecosystem converges on **WXT framework** (Vite-based), **Preact 10** (3KB vs React's 35KB), and **Monaco Editor** for code editing. Key decision: WXT over CRXJS (archived June 2025) and manual Vite (100-200 LOC boilerplate savings). The stack balances developer experience, bundle size constraints, and Manifest V3 compatibility.

**Core technologies:**
- **WXT 0.19.x**: Chrome extension framework — Vite-based with HMR for content scripts, auto-manifest generation, actively maintained unlike CRXJS
- **Preact 10.28.2**: UI framework — 3KB bundle (10x smaller than React), API-compatible via preact/compat, critical for extension size limits
- **Monaco Editor 0.55.1**: YAML editor — VS Code's editor, required for BSL editing with syntax highlighting, proven in extensions despite ~1MB bundle
- **eemeli/yaml 2.8.2**: BSL parser — Modern TypeScript-native YAML parser, actively maintained (js-yaml stale 2+ years), AST access for BSL evolution
- **Vitest 4.0.17**: Unit testing — 10-20x faster than Jest, native Vite integration, ESM-native, zero TypeScript config
- **Playwright 1.57.0**: E2E testing — Official Chrome extension support via launchPersistentContext, Chrome for Testing (not Chromium) for better compatibility

**Critical version notes:**
- TypeScript 5.9.3 (latest stable, essential for Chrome API types)
- Vite 7.3.1 (latest, 100x faster dev builds than Webpack)
- Tailwind 4.1.x with JIT (3.75MB dev → 12KB production with proper purging)

### Expected Features

Browser automation extensions in 2026 have clear table stakes and competitive differentiators. Browserlet's unique position is **AI-assisted semantic selectors with deterministic execution** — avoiding brittleness of traditional tools and non-determinism of AI agents.

**Must have (table stakes):**
- Record & playback (industry standard since Selenium IDE)
- Script storage (local, with import/export JSON)
- Basic execution feedback (visual progress, success/fail indicators)
- Form filling + element clicking + navigation (core automation primitives)
- Error handling (clear messages, element highlighting)
- Wait mechanisms (handle dynamic content loading)

**Should have (competitive differentiators):**
- Semantic selectors with AI-assisted creation (Browserlet's core differentiator)
- Audit trail (critical for enterprise decision makers, compliance)
- Version control (rollback capability, treat scripts as software)
- Session persistence (reduce auth friction, cookie/storage injection)
- Visual execution replay (debugging aid, time-travel debugging)

**Defer (v2+):**
- Self-healing locators (expensive to build, semantic selectors reduce need)
- Multi-browser support (Chrome-only acceptable for MVP, market dominates enterprise)
- Debugging breakpoints (nice-to-have, console logs sufficient initially)
- Multi-user collaboration (complex, single-user workflows first)
- Scheduled/triggered execution (valuable but not essential for MVP)

### Architecture Approach

Manifest V3 enforces a three-component architecture with strict boundaries: **Service Worker** (orchestration hub, no DOM access), **Content Script** (DOM access, limited APIs), and **Side Panel** (UI with full API access). The critical architectural constraint is service worker ephemeral lifecycle (30s inactivity timeout, 5min max execution, no global state persistence).

**Major components:**
1. **Service Worker** — Central message router, BSL parser, state manager, LLM integration proxy. Must persist all state to chrome.storage.local immediately (not in-memory). Event listeners MUST register at top level (synchronous, before any async initialization).
2. **Content Script** — DOM observation via MutationObserver, event capture during recording, semantic target resolution execution, element highlighting. Isolated from page JavaScript but shares DOM. Reloaded on navigation.
3. **Side Panel** — Monaco Editor for BSL editing, script library UI, execution controls, results visualization. Persistent across tabs, full Chrome API access. Lazy-load Monaco (only when panel opens) to avoid initial load cost.

**Communication pattern:** All messages route through Service Worker. Content Scripts cannot directly message Side Panel. Use chrome.storage.onChanged for broadcast state updates across all components.

**Build order (strictly sequential):**
1. Service Worker + chrome.storage schema (foundation for all communication)
2. Content Script + message passing (data source for recording, executor for playback)
3. Side Panel + UI (consumes state, sends commands)
4. LLM integration + BSL parser (builds on recording/playback foundation)

### Critical Pitfalls

The research identified 14 pitfalls categorized by severity. Top 5 require architectural decisions from day one:

1. **Service Worker State Loss** — 30-second inactivity termination wipes all global variables. Use chrome.storage.local as source of truth, implement "save on every change" pattern. Detection: users report "stopped working after inactivity". Phase 1 blocker.

2. **Extension Context Invalidation During Updates** — Auto-updates orphan content scripts, all chrome.runtime calls fail with "Extension context invalidated". Implement connection health checks, display "Extension updated, refresh page" banner. Phase 1 blocker.

3. **Cross-Origin iframe Access Blocked** — Cannot access cross-origin iframe content, legacy ERPs use iframes extensively. Use `"all_frames": true` in manifest, detect iframes with `window !== window.top`, build iframe-aware selectors. Phase 2 blocker for ERP target market.

4. **Remote Code Execution Violations (CSP)** — Manifest V3 prohibits eval(), new Function(), remote scripts. Store LLM prompts as JSON data (not code), test with strict CSP locally. Extension store rejection risk. Phase 1 blocker.

5. **LLM API Key Exposure** — API keys in extension code are readable on user machines. NEVER bundle keys, require user-owned credentials or proxy through backend server. Store user keys encrypted in chrome.storage.local. Recent 2025/2026 security incidents validate criticality. Phase 5 blocker.

## Implications for Roadmap

Based on research, the architecture enforces a strict dependency chain. The service worker is the orchestration hub — it must exist before other components can communicate. Content scripts provide data sources and executors. Side panel consumes state. LLM integration builds on top of working recording/playback.

### Phase 1: Foundation (Service Worker + Storage)
**Rationale:** Service worker is the message routing hub. Must establish storage patterns and lifecycle handling before any other components. All communication depends on this foundation.

**Delivers:** Working service worker with message router, chrome.storage schema, state manager with cache-backed-by-storage pattern, event listener registration (top-level, synchronous).

**Addresses:**
- Table stakes: Script storage foundation
- Stack: WXT project initialization, TypeScript configuration
- Pitfalls: Service worker state loss, context invalidation handling, CSP compliance

**Avoids:** Building on unstable foundation, adding state management later (architectural debt)

**Research flag:** STANDARD - well-documented Manifest V3 patterns available

### Phase 2: Recording (Content Script + DOM Observation)
**Rationale:** Content script is the data source. Needs service worker to send captured data to. Must solve iframe access and selector strategy before building UI.

**Delivers:** Content script injection (all_frames), MutationObserver for DOM changes, event capture system (clicks, form fills, navigation), semantic selector generation with multi-hint strategy (aria-label + data-attribute + position + fallback CSS/XPath), message sending to service worker.

**Addresses:**
- Table stakes: Record & playback (recording half), element clicking, form filling, navigation
- Features: Semantic selector differentiation
- Pitfalls: iframe cross-origin access, selector collisions, MutationObserver performance

**Uses:**
- Stack: eemeli/yaml for BSL generation, Vitest for selector logic testing
- Architecture: Content script component, message passing patterns

**Research flag:** MODERATE - Need real legacy ERP testing for iframe patterns, selector validation

### Phase 3: UI (Side Panel + Monaco Editor)
**Rationale:** UI consumes state from service worker and displays scripts. Needs working recording/playback to have meaningful data. Monaco Editor integration is complex (~1MB bundle, web workers, lazy loading).

**Delivers:** Side panel HTML/CSS/JS with Preact, Monaco Editor integration (lazy-loaded, YAML syntax, BSL custom language mode), script library display, execution controls, real-time progress UI via chrome.storage.onChanged.

**Addresses:**
- Table stakes: Basic execution feedback, import/export (JSON)
- Stack: Preact + Tailwind integration, Monaco Editor, PostCSS for Tailwind JIT
- Architecture: Side panel component, storage-based reactivity

**Uses:**
- Monaco Editor 0.55.1 with @monaco-editor/react wrapper
- Tailwind CSS with purging configured (target <20KB production CSS)
- Preact signals for state management

**Research flag:** STANDARD - Monaco integration well-documented, Preact patterns established

### Phase 4: Playback (Execution Engine)
**Rationale:** Builds on recording infrastructure. Requires semantic selector resolution, smart waiting, error handling. Must implement humanization to avoid bot detection.

**Delivers:** BSL parser in service worker, execution coordinator (step-by-step with acknowledgment), semantic target resolver in content script (multi-hint matching), smart waiting (condition-based, not fixed delays), error handling with element highlighting, humanization layer (random delays, mouse simulation).

**Addresses:**
- Table stakes: Playback half of record/playback, wait mechanisms, error handling
- Features: Deterministic execution (vs AI agents)
- Pitfalls: Bot detection triggers, dynamic content timing, race conditions

**Uses:**
- eemeli/yaml parser for BSL
- MutationObserver for element availability detection
- Execution state persisted to chrome.storage.local (survives service worker restarts)

**Research flag:** MODERATE - Bot detection landscape for legacy ERP target market unclear (likely minimal for internal apps)

### Phase 5: LLM Integration (Semantic Analysis)
**Rationale:** Final layer that enhances selector generation. Requires all communication patterns working. API key security and rate limiting must be architected correctly from start.

**Delivers:** LLM client in service worker (with retry/backoff), semantic element analysis (DOM context → LLM → selector hints), BSL script enhancement (aria-label, data-attribute suggestions), user-owned API key management (encrypted chrome.storage), rate limiting with exponential backoff.

**Addresses:**
- Features: AI-assisted semantic selector creation (core differentiator)
- Pitfalls: API key exposure, rate limiting without backoff

**Uses:**
- User-provided API keys (OpenAI, Anthropic, or local models)
- Request queue with rate limiter (max 3 req/sec)
- Cache for identical queries
- Fallback to non-LLM selectors if API unavailable

**Research flag:** HIGH - Need phase-specific research on LLM provider comparison (rate limits, accuracy, cost), prompt engineering for selector hints

### Phase 6: Enterprise Features (Audit + Versioning)
**Rationale:** Competitive differentiators for decision makers. Builds on stable recording/playback foundation. Enables team adoption.

**Delivers:** Audit trail (who ran what when, with results), version control (rollback capability, changelog), script parameterization (avoid hard-coded data), visual execution replay (screenshots/video for debugging).

**Addresses:**
- Features: Audit trail (enterprise differentiator), version control, session persistence
- Pitfalls: Permission escalation on update (plan permissions ahead)

**Research flag:** STANDARD - Well-understood patterns from BrowserStack, Katalon examples

### Phase Ordering Rationale

**Why this order:**
- **Phase 1 before all:** Service worker is message hub, nothing works without it. Storage patterns must be established before building features that need state.
- **Phase 2 before 3:** Content script provides data, UI displays it. Recording must work before UI has something to show.
- **Phase 3 before 4:** Need UI to trigger playback, display results. Monaco Editor complexity justifies dedicated phase.
- **Phase 4 before 5:** LLM enhances existing selectors. Must have baseline selector generation working first.
- **Phase 5 before 6:** Core automation must be reliable before adding enterprise features.

**Why this grouping:**
- Each phase delivers a complete component (service worker, content script, side panel, execution engine, LLM layer, enterprise layer)
- Phases 1-4 deliver MVP (semantic recording and playback)
- Phase 5 adds AI differentiation
- Phase 6 adds enterprise credibility

**How this avoids pitfalls:**
- Phase 1 forces storage pattern decisions (avoids state loss pitfall)
- Phase 2 includes iframe handling from start (avoids accessibility pitfall)
- Phase 4 includes humanization from start (avoids bot detection pitfall)
- Phase 5 requires key security architecture first (avoids exposure pitfall)

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 2 (Recording):** Legacy ERP iframe patterns, selector validation with real target apps, MutationObserver performance profiling
- **Phase 4 (Playback):** Bot detection landscape for target market (legacy internal ERPs likely have minimal protection)
- **Phase 5 (LLM Integration):** Provider comparison (OpenAI vs Anthropic vs DeepSeek vs local models), rate limits, prompt engineering for selector hints, cost analysis

**Phases with standard patterns (research optional):**
- **Phase 1 (Foundation):** Well-documented Manifest V3 service worker patterns, WXT documentation comprehensive
- **Phase 3 (UI):** Monaco Editor integration documented, Preact patterns established, Tailwind standard
- **Phase 6 (Enterprise):** Audit trail and versioning are solved problems, examples from BrowserStack/Katalon available

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All recommendations verified via official docs (Chrome for Developers, npm registries, Vite/WXT/Preact docs). Version numbers current for Jan 2026. WXT vs CRXJS confirmed via multiple 2025-2026 sources. |
| Features | MEDIUM | Table stakes confirmed via competitive analysis (Selenium IDE, Katalon, Axiom.ai, Skyvern). Semantic selector differentiation validated by market trend toward role-based locators. Persona priorities inferred from UiPath/RPA research. |
| Architecture | HIGH | Manifest V3 architecture verified via official Chrome documentation. Service worker lifecycle, message passing, storage patterns all documented with code examples. Build order derived from component dependencies (logical analysis). |
| Pitfalls | HIGH | Service worker termination timings verified (30s inactivity, 5min max, official docs). Context invalidation confirmed via multiple developer reports + official docs. CSP requirements official Manifest V3 policy. API key exposure validated by Jan 2026 security incidents. |

**Overall confidence:** HIGH

Research converges on stable recommendations. Stack choices verified via official sources and 2026 ecosystem data. Architecture patterns are well-documented Manifest V3 standards. Pitfalls confirmed via official Chrome docs + recent security incidents. Only medium-confidence area is feature prioritization (inferred from market research, needs user validation).

### Gaps to Address

**Gaps requiring validation during implementation:**

1. **Legacy ERP Compatibility:** Research focused on general web automation. Target market (legacy ERP/SIRH systems like Workday, SAP SuccessFactors, Oracle HCM) may have unique iframe patterns, non-standard HTML, or session behaviors. Need hands-on testing with real systems during Phase 2.

2. **Selector Strategy Validation:** POC demonstrated multi-hint approach (aria-label + data-attribute + position + fallback). Research confirms this is sound, but exact hint priority and fallback logic need validation against real legacy ERP pages during Phase 2.

3. **Bot Detection Applicability:** Research documents modern anti-bot systems (Cloudflare, Akamai), but target market is internal legacy ERPs. Likely minimal bot detection for internal apps, but unknown until Phase 4 testing.

4. **LLM Provider Performance:** Rate limits documented generally (OpenAI, Anthropic), but specific selector hint generation performance (accuracy, latency, cost per selector) unknown until Phase 5 implementation. May need provider-specific research.

5. **Bundle Size Reality Check:** Targets set (popup <50KB, side panel <1.2MB, content script <150KB) based on best practices. Actual bundle sizes with Monaco Editor, Preact, and BSL parser need validation during Phase 3 build.

6. **Performance at Scale:** Unknown how extension performs with 100+ recorded steps, complex workflows, or high-frequency automation. Load testing needed post-MVP.

**How to handle gaps:**
- **Phase 2:** Allocate time for real legacy ERP testing (Workday demo, SAP trial access)
- **Phase 4:** Profile against common legacy app patterns, measure actual timing
- **Phase 5:** Run comparative LLM provider tests before committing to default
- **All phases:** Measure bundle sizes continuously, optimize if approaching limits

## Sources

### Primary (HIGH confidence)

**Chrome Official Documentation:**
- [Extension Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) — Service worker termination timings, lifecycle patterns
- [Message Passing](https://developer.chrome.com/docs/extensions/develop/concepts/messaging) — Communication patterns, port connections
- [chrome.sidePanel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel) — Side panel configuration, per-tab panels
- [chrome.storage API](https://developer.chrome.com/docs/extensions/reference/api/storage) — Storage types, size limits
- [Content Scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) — Injection patterns, isolation
- [Manifest V3 Migration Guide](https://developer.chrome.com/docs/extensions/mv3/mv3-migration/) — CSP requirements, permission model

**Framework & Library Documentation:**
- [WXT Framework](https://wxt.dev/) — Chrome extension framework, file-based structure
- [Vite 7.0 Release](https://vite.dev/blog/announcing-vite7) — Version confirmation, performance benchmarks
- [Vitest 4.0 Release](https://vitest.dev/blog/vitest-4) — Testing framework updates
- [Playwright Chrome Extensions](https://playwright.dev/docs/chrome-extensions) — E2E testing patterns
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) — API reference, worker configuration
- [Preact Official Site](https://preactjs.com/) — API compatibility, bundle size
- [eemeli/yaml npm](https://www.npmjs.com/package/yaml) — Parser API, TypeScript support

### Secondary (MEDIUM confidence)

**Ecosystem Comparisons:**
- [The 2025 State of Browser Extension Frameworks](https://redreamality.com/blog/the-2025-state-of-browser-extension-frameworks-a-comparative-analysis-of-plasmo-wxt-and-crxjs/) — WXT vs CRXJS vs Plasmo comparison
- [Vite vs Webpack in 2026](https://dev.to/pockit_tools/vite-vs-webpack-in-2026-a-complete-migration-guide-and-deep-performance-analysis-5ej5) — Build tool performance analysis
- [Vitest vs Jest 30: Why 2026 is the Year of Browser-Native Testing](https://dev.to/dataformathub/vitest-vs-jest-30-why-2026-is-the-year-of-browser-native-testing-2fgb) — Testing framework comparison

**Architecture Guides:**
- [Chrome Extension Development: Complete System Architecture Guide for 2026](https://jinlow.medium.com/chrome-extension-development-the-complete-system-architecture-guide-for-2026-9ae81415f93e) — Component boundaries, message patterns
- [Understanding Chrome Extensions: Developer's Guide to Manifest V3](https://dev.to/javediqbal8381/understanding-chrome-extensions-a-developers-guide-to-manifest-v3-233l) — Service worker patterns
- [Effective State Management in Chrome Extensions](https://reintech.io/blog/effective-state-management-chrome-extensions) — Storage strategies

**Feature Research:**
- [Browser Automation Tools Comparison 2026](https://www.firecrawl.dev/blog/browser-automation-tools-comparison-2025) — Competitive landscape
- [2026 AI Browser Automation Outlook](https://www.browserless.io/blog/state-of-ai-browser-automation-2026) — Market trends, semantic selectors
- [Playwright Locator Best Practices 2026](https://www.browserstack.com/guide/playwright-locator) — Selector strategies
- [UiPath Semantic Selectors](https://docs.uipath.com/activities/other/latest/ui-automation/about-semantic-selectors) — Semantic selector patterns

**Pitfalls Research:**
- [Extension Context Invalidated Issues](https://github.com/crxjs/chrome-extension-tools/issues/673) — Developer reports on context invalidation
- [Chrome Extension API Key Security](https://dev.to/notearthian/how-to-secure-api-keys-in-chrome-extension-3f19) — Key management patterns
- [Chrome Extensions Vulnerability Leaks API Keys](https://cyberpress.org/chrome-extensions-vulnerability/) — 2025 security incident
- [Malicious Chrome Extension Steals API Keys (Jan 2026)](https://thehackernews.com/2026/01/malicious-chrome-extension-steals-mexc.html) — Recent security incident
- [Bypass Bot Detection 2026](https://www.zenrows.com/blog/bypass-bot-detection) — Anti-bot techniques
- [LLM API Rate Limiting Best Practices 2026](https://orq.ai/blog/api-rate-limit) — Rate limit handling
- [Tackling Rate Limiting for LLM Apps](https://portkey.ai/blog/tackling-rate-limiting-for-llm-apps/) — Retry strategies
- [Browser Automation Session Management 2026](https://www.skyvern.com/blog/browser-automation-session-management/) — Session persistence patterns

### Tertiary (LOW confidence)

- [Shadow DOM Access Proposal](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/JaHhogJuBOk) — Proposal not implemented, shadow DOM limitations remain

---
*Research completed: 2026-01-29*
*Ready for roadmap: YES*

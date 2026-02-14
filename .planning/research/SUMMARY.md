# Project Research Summary

**Project:** Browserlet v1.7 CLI Completion & Batch Testing
**Domain:** Browser automation testing with AI-assisted resilience
**Researched:** 2026-02-14
**Confidence:** HIGH

## Executive Summary

Browserlet v1.7 adds batch testing capabilities to an existing, working CLI test runner (v1.6). The milestone adds four new capabilities: batch test runner with parallel execution, AI auto-repair via LLM hint regeneration, credential vault wiring, and LLM micro-prompt bridging for cascade resolver stages 3-5. This is not a greenfield project—it's enhancing proven infrastructure that already handles single-script execution with 85% success rate using deterministic cascade resolution.

The recommended approach prioritizes determinism with opt-in AI assistance. Unlike commercial AI testing tools (Mabl, testRigor) that hide their AI in black boxes, Browserlet makes AI transparent, opt-in, and cost-controlled. The critical architectural insight: **AI should prevent failures (hint enrichment) not repair them post-facto (selector fixing)**. v1.4's removed self-healing feature taught this lesson—the v1.5 cascade resolver (prevention) works better than v1.4 repair. v1.7 auto-repair regenerates HINTS not selectors, making it fundamentally safer, but still requires strict quality gates to avoid repeating v1.4's failures.

Key risks center on parallel execution isolation, AI retry loop token explosion, and page.exposeFunction bridge timing. All risks have concrete prevention strategies and are mapped to specific roadmap phases. The existing codebase provides 90% of needed infrastructure—only 5 focused additions required: junit-report-builder, password-prompt, fast-glob, native template literals for HTML reports, and page.exposeFunction (already in Playwright 1.58). Most work is integration, not new features.

## Key Findings

### Recommended Stack

The existing stack (Commander.js 14, Playwright 1.58, TypeScript, esbuild, Anthropic SDK, Ollama SDK) provides the foundation. Research identified only 5 focused additions needed for v1.7's four new capabilities. The guiding principle: use what exists, add minimal targeted dependencies.

**Core technologies:**
- **junit-report-builder ^3.2.1**: Generate JUnit XML reports for CI/CD integration — framework-agnostic builder API, no coupling to test runners, 200+ dependent packages
- **password-prompt ^1.1.3**: Secure CLI master password input for vault unlocking — cross-platform, zero dependencies, Promise-based, hides input properly
- **fast-glob ^3.3.3**: Recursive .bsl file discovery for batch testing — 10-20% faster than node-glob, supports Node 18+, 14M+ weekly downloads
- **Native template literals (ES6)**: Generate HTML test reports — zero dependencies, full control, sufficient for static reports without templating engine bloat
- **Playwright page.exposeFunction()**: Bridge LLM calls from page context to Node.js — already available in Playwright 1.58.2, standard pattern for browser-to-Node communication

**Critical finding:** The LLM service infrastructure (ClaudeProvider, OllamaProvider, OpenAIProvider) already exists in extension background code. v1.7 will vendor this to @browserlet/core for CLI reuse—no new LLM integration needed.

### Expected Features

Research reveals a clear division between table stakes (users expect in any batch test runner), differentiators (competitive advantage), and anti-features (commonly requested but problematic).

**Must have (table stakes):**
- **Glob pattern test discovery**: Industry standard (\*\*/\*.bsl), users expect file discovery without manual listing
- **Exit code aggregation**: CI/CD requires single exit code (0=all pass, 1=any fail, 2=any error)
- **Test isolation**: Fresh browser context per script, failures don't cascade
- **Continue-on-failure**: Run full suite, don't abort on first fail (Playwright --bail pattern)
- **Summary report**: Terminal output with pass/fail/total counts, duration
- **Opt-in AI repair flag**: --repair enables LLM auto-repair, default=false for determinism
- **Circuit breaker**: Max 3 retry attempts per step, prevents infinite loops
- **Credential vault integration**: Wire existing v1.6 vault to runner, master password prompt

**Should have (competitive differentiators):**
- **Deterministic-first philosophy**: Unlike Mabl/testRigor (always-on AI), Browserlet guarantees determinism unless --repair enabled
- **LLM provider choice**: User picks Claude, Ollama, or OpenAI (competitors lock to proprietary LLMs)
- **Repair transparency**: Every AI suggestion logged with before/after (competitors hide AI decisions)
- **Cost visibility**: Token tracking, budget limits (competitors bill opaquely)
- **JUnit XML / JSON reports**: CI/CD tool integration (Jenkins, GitHub Actions)
- **Local-first execution**: No cloud dependency (competitors require cloud)

**Defer to v1.8+:**
- Parallel execution (--workers=N): adds complexity, v1.7 focuses on batch correctness first
- HTML report with timeline: nice-to-have, JUnit XML covers CI integration
- Screenshot diff on repair: enhances repair transparency but not critical
- Batch retry failed-only (--last-failed): requires persistent state, defer until batch proven

**Anti-features identified (don't build):**
- Automatic AI repair without opt-in: v1.4 failure mode, creates non-determinism
- Unlimited repair retries: token explosion, cost nightmare
- Real-time LLM streaming output: adds latency, cognitive overload, users don't need to see prompt engineering
- AI-suggested test generation: out of scope, separate product

### Architecture Approach

The architecture builds on proven v1.6 infrastructure (BSLRunner, CascadeCLIResolver, PlaywrightExecutor) by adding four new components and wiring existing credential infrastructure. The key pattern: wrap, don't replace—preserve deterministic execution path, add AI as optional layer.

**Major components:**

1. **BatchTestRunner** — Discovers .bsl files via fast-glob, distributes to worker pool, aggregates results, writes multi-format reports. Uses workerpool library (247k weekly downloads) or custom worker_threads implementation. Integrates with existing BSLRunner for per-test execution.

2. **RepairLoop** — Wraps PlaywrightExecutor with retry logic. On StepError with SELECTOR_NOT_FOUND, calls LLMBridge to regenerate hints (not selectors), retries with new hints up to 3 times (circuit breaker). Only invoked when --repair flag enabled. Preserves original error if repair fails.

3. **LLMBridge (CLI adapter)** — Provides LLM micro-prompt routing for CLI context. Exposes LLM calls to page context via page.exposeFunction('__browserletLLM'). Bridges cascade resolver stages 3-5 from browser JavaScript to Node.js LLM providers. Uses existing provider abstractions from extension (will vendor to @browserlet/core).

4. **CredentialWiring** — NOT a new file, just ~20 lines of integration in BSLRunner.constructor. Instantiates CLIPasswordStorage if vault password provided, calls substituteCredentials() before step execution (wiring already-built components). All infrastructure exists, just needs connection.

**Critical architectural decisions:**
- **page.exposeFunction bridge pattern**: Enables cascade resolver stages 3-5 to call LLM from page context without serialization overhead. Functions persist across navigation, must check if already exposed before re-exposing.
- **Worker pool isolation**: One browser instance per worker, fresh context per test. Never share browser contexts across workers (storage isolation pitfall).
- **Circuit breaker mandatory**: Built into RepairLoop from day one, not added later. Prevents v1.4 self-healing token explosion.
- **Multi-format reporters (Observer pattern)**: Reporters subscribe to test events (testSuiteStart, testEnd), produce console/JUnit/HTML formats independently.

### Critical Pitfalls

Research identified 10 pitfalls with concrete prevention strategies. Top 5 by severity:

1. **AI Retry Loop Token Explosion Without Circuit Breaker** — Without max-retry limits, LLM auto-repair burns thousands of tokens on unfixable failures. A broken page element can cost $5+ in 30 seconds. **Prevention:** Strict circuit breaker (max 3 attempts per step), exponential backoff (1s, 3s, 9s), per-script token budget (abort if >10k tokens). Track consecutive failures: if 3 steps fail in a row, abort script (page changed fundamentally). **v1.4 lesson:** Removed self-healing had no bounds, wasted tokens on doomed repairs.

2. **Shared Browser Context Storage Leaks Between Parallel Tests** — Parallel tests using persistent contexts share cookies/localStorage, causing Script A's credentials to appear in Script B. **Prevention:** Always create fresh, non-persistent contexts per test (browser.newContext() with no storageState). Use credential substitution instead of browser storage state. Assign unique temp directories if persistent contexts required. **Warning signs:** Flaky tests that pass individually but fail in batch, "already logged in" when expecting login page.

3. **page.exposeFunction Name Conflicts Across Navigations** — Exposed functions survive navigation. Re-exposing same function after navigation throws "Function already registered" error. **Prevention:** Expose once per session, use namespaced names (__browserlet_generateHints_${sessionId}), check if exists before exposing (page.evaluate(() => typeof window.__browserletLLM !== 'undefined')). Alternative: fresh context per script (cleaner isolation).

4. **Credential Substitution Not Wired Despite Complete Infrastructure** — All components work in isolation (CLIPasswordStorage, substituteCredentials function, 10 passing tests), but runner.ts only imports CREDENTIAL_PATTERN for detection, logs warning instead of substituting. **Prevention:** Import substituteCredentials in runner.ts, call at same point as variable substitution (~20 line fix). Add E2E integration test verifying browserlet run uses credentials.

5. **AI Auto-Repair Masks Real Page Bugs Instead of Detecting Them** — Developer removes button, AI silently finds different "similar" element, test passes with false positive. Regression undetected until production. **Prevention:** Make --repair opt-in (not default), log all repairs prominently ("WARNING: Step 3 auto-repaired"), fail if confidence <0.70, track repair rate (fail entire run if >30% of steps needed repair). Write repair events to JUnit XML as warnings.

**v1.4 failure pattern to avoid:** The removed self-healing feature (Phase 15, deleted in Phase 17) tried to fix broken selectors without bounds, wasted tokens on fundamentally changed pages, created false positives. v1.7 regenerates HINTS not selectors (safer), but still needs strict quality gates to prevent hiding bugs.

## Implications for Roadmap

Based on research, suggested phase structure follows dependency order: foundation infrastructure first (no dependencies), then LLM bridge (enables repair), then repair loop (depends on bridge), finally batch runner (integrates everything).

### Phase 27: Credential Wiring
**Rationale:** Zero dependencies on v1.7 features, wires existing components, clears v1.6 tech debt
**Delivers:** BSLRunner substitutes {{credential:alias}} using CLI vault
**Implementation:** Import substituteCredentials in runner.ts, instantiate CLIPasswordStorage if vault password provided, call substitution before step execution (~20 lines)
**Addresses:** Credential wiring (expected feature), clears "credential substitution deferred" tech debt from v1.6 audit
**Avoids:** "Complete infrastructure but not wired" pitfall (runner only detects credentials, doesn't substitute)
**Research needed:** None—standard integration of existing components

### Phase 28: Batch Test Runner Foundation
**Rationale:** Establishes test discovery, isolation patterns before adding parallel execution
**Delivers:** browserlet test <dir> command, glob discovery, serial execution, console summary
**Uses:** fast-glob (file discovery), fresh browser contexts (isolation)
**Addresses:** Table stakes features (glob discovery, test isolation, summary report)
**Avoids:** Storage leakage pitfall (enforces fresh context per test), cross-platform glob issues (fast-glob handles path normalization)
**Research needed:** Minimal—test discovery is well-documented pattern, focus on cross-platform verification

### Phase 29: Parallel Execution Engine
**Rationale:** Builds on serial batch runner, adds worker pool for performance
**Delivers:** --workers=N flag, parallel test execution, resource-aware defaults
**Uses:** workerpool library or custom worker_threads
**Addresses:** Performance requirement (CI/CD wants <5min test runs)
**Avoids:** Resource overload pitfall (default workers=cpus/2, document hardware limits)
**Research needed:** Worker pool tuning—test various worker counts, measure memory usage, establish safe defaults

### Phase 30: AI Auto-Repair Loop
**Rationale:** Depends on LLMBridge (Phase 31), adds optional repair capability
**Delivers:** --repair flag, RepairLoop wrapper, circuit breaker, hint regeneration
**Uses:** LLMBridge.callMicroPrompt(), hint_suggester micro-prompt
**Addresses:** Differentiator (deterministic-first with opt-in AI), repair transparency
**Avoids:** Token explosion (circuit breaker), bug masking (opt-in flag, quality gates), flakiness (temperature=0)
**Research needed:** Medium—repair quality thresholds need tuning, circuit breaker parameters need validation

### Phase 31: LLM Micro-Prompt Bridge
**Rationale:** Foundation for Phase 30 (repair) and enables cascade stages 3-5
**Delivers:** page.exposeFunction('__browserletLLM'), LLMBridge CLI adapter, stages 3-5 enabled
**Uses:** Playwright page.exposeFunction, existing LLM providers from extension (vendor to @browserlet/core)
**Addresses:** Cascade resolver completeness (stages 3-5 deferred in v1.6)
**Avoids:** Function naming conflicts (namespace, check before exposing), timing races (readiness polling), crashes on LLM timeout (try-catch with fallback)
**Research needed:** High—page.exposeFunction timing needs headed/headless testing, error handling for LLM failures needs validation

### Phase 32: JUnit/HTML Reporters
**Rationale:** Depends on batch runner, adds CI/CD integration and visibility
**Delivers:** --junit <path> flag, JUnit XML output, HTML summary report
**Uses:** junit-report-builder, native template literals
**Addresses:** Differentiator (CI/CD tool integration), repair transparency (metrics in reports)
**Avoids:** Repair metrics not exposed pitfall (include repair count, rate, confidence)
**Research needed:** None—JUnit XML is standard format, template literals are straightforward

### Phase Ordering Rationale

**Why this sequence:**
- Phase 27 first: Clears v1.6 tech debt, has zero dependencies, simple integration
- Phase 28 before 29: Serial batch runner proves test discovery and isolation before adding parallel complexity
- Phase 31 before 30: LLMBridge must exist before RepairLoop can call it
- Phase 30 before 32: Repair metrics need to exist before reporters can expose them

**Dependency chain:**
```
Phase 27 (Credential Wiring) ────┐
                                 │
Phase 28 (Batch Foundation) ─────┼──> Phase 32 (Reporters)
                                 │         ↑
Phase 31 (LLM Bridge) ───> Phase 30 (Repair Loop) ─┘
                                 │
Phase 29 (Parallel Execution) ───┘
```

**Why Phase 29 can happen in parallel with 30/31:** Parallel execution is independent of AI repair. Can be developed concurrently if resources allow, but serial execution (Phase 28) must complete first.

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 30 (AI Auto-Repair Loop):** Repair quality thresholds (what confidence score = acceptable repair?), circuit breaker tuning (3 retries optimal or should vary by failure type?), hint caching strategy (DOM context hash collision rate?)
- **Phase 31 (LLM Micro-Prompt Bridge):** page.exposeFunction timing in headed vs headless mode (needs empirical testing), error recovery strategy when LLM unavailable (what's graceful degradation path?), function namespace collision prevention (session ID sufficient?)
- **Phase 29 (Parallel Execution Engine):** Worker pool sizing (what's formula for safe worker count given RAM/CPU?), resource monitoring (how to detect overload and suggest reducing workers?)

**Phases with standard patterns (skip research-phase):**
- **Phase 27 (Credential Wiring):** Straightforward integration of existing components, well-documented substitution pattern
- **Phase 28 (Batch Test Runner Foundation):** Test discovery is industry-standard pattern, fast-glob documentation is comprehensive
- **Phase 32 (JUnit/HTML Reporters):** JUnit XML schema is standardized, junit-report-builder has clear examples, template literals are native JavaScript

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All proposed libraries have 100k+ weekly downloads, active maintenance, comprehensive docs. Playwright 1.58 page.exposeFunction confirmed working in Playwright official docs. |
| Features | MEDIUM-HIGH | Table stakes features validated against Playwright Test, Cypress patterns (HIGH confidence). AI repair features researched via academic papers and competitor analysis (MEDIUM confidence—less established patterns). |
| Architecture | HIGH | All integration points verified against existing v1.6 codebase. Component boundaries tested in isolation (credential infrastructure, LLM providers). v1.6 milestone audit explicitly documented what's deferred (credentials, LLM bridge). |
| Pitfalls | HIGH | Top pitfalls sourced from Playwright GitHub issues (storage isolation, exposeFunction conflicts), project history (v1.4 self-healing removal), and LLM resilience research papers. All pitfalls have concrete warning signs and prevention strategies. |

**Overall confidence:** HIGH

Research is comprehensive across all four dimensions. Stack recommendations are conservative (proven libraries, minimal additions). Architecture leverages 90% existing infrastructure. Pitfalls learned from v1.4 failure (self-healing removal) provide strong guidance for v1.7 auto-repair quality gates.

### Gaps to Address

**During Phase 30 planning (AI Auto-Repair):**
- **Repair quality threshold:** Research recommends confidence >0.70 but optimal threshold needs empirical validation. Plan to test with controlled page changes (move element, rename element, remove element) and measure false positive rate at various thresholds.
- **Circuit breaker tuning:** Max 3 retries per step is industry standard, but research doesn't specify if this should vary by failure type (SELECTOR_NOT_FOUND vs TIMEOUT). Consider tighter limits (1 retry) for certain error codes.
- **Hint caching strategy:** Research suggests caching by DOM context hash, but collision rate unknown. Need to prototype hashing function and validate uniqueness across real-world pages.

**During Phase 31 planning (LLM Bridge):**
- **Headless vs headed timing:** Research identifies timing race in headed mode but doesn't specify exact polling interval for readiness check. Need empirical testing to determine safe timeout values.
- **Graceful degradation path:** Research says "fall back to deterministic stages" when LLM unavailable, but doesn't specify how to detect "LLM will never recover" vs "transient timeout." Consider exponential backoff with circuit breaker for LLM calls themselves.

**During Phase 29 planning (Parallel Execution):**
- **Worker sizing formula:** Research suggests cpus/2 default but doesn't provide RAM-based formula. Need to measure actual browser memory usage (headless vs headed) and derive formula like `min(cpus/2, floor(availableRAM / 400MB))`.

## Sources

### Primary (HIGH confidence)

**Official Documentation:**
- [Playwright API: page.exposeFunction](https://playwright.dev/docs/api/class-page#page-expose-function) — Confirmed function persistence across navigation, async bridge pattern
- [Playwright: Test Parallelism](https://playwright.dev/docs/test-parallel) — Resource overload warnings, worker pool patterns
- [Playwright: Browser Contexts](https://playwright.dev/docs/browser-contexts) — Storage isolation guarantees
- [Playwright: Test Retries](https://playwright.dev/docs/test-retries) — Retry mechanism patterns
- [JUnit XML Format Guide (Gaffer)](https://gaffer.sh/blog/junit-xml-format-guide/) — Standard schema reference

**Project-Specific:**
- `.planning/milestones/v1.6-MILESTONE-AUDIT.md` — Documented tech debt: credential wiring deferred, LLM bridge deferred
- `.planning/phases/17/17-01-SUMMARY.md` — Self-healing removal (3,228 lines), failure analysis
- `.planning/milestones/v1.5-REQUIREMENTS.md` — Cascade resolver as replacement for self-healing

**npm Libraries:**
- [junit-report-builder (npm)](https://www.npmjs.com/package/junit-report-builder) — Builder API docs, 200+ dependents
- [password-prompt (npm)](https://www.npmjs.com/package/password-prompt) — Promise-based API, 85+ dependents
- [fast-glob (npm)](https://www.npmjs.com/package/fast-glob) — Performance benchmarks, 14M+ weekly downloads
- [workerpool (npm)](https://www.npmjs.com/package/workerpool) — Worker thread pool, 247k weekly downloads

### Secondary (MEDIUM confidence)

**LLM Integration Patterns:**
- [Portkey: Retries, fallbacks, and circuit breakers in LLM apps](https://portkey.ai/blog/retries-fallbacks-and-circuit-breakers-in-llm-apps/) — Circuit breaker patterns for LLM retry logic
- [Medium: Circuit Breaker for LLM with Retry and Backoff (TypeScript)](https://medium.com/@spacholski99/circuit-breaker-for-llm-with-retry-and-backoff-anthropic-api-example-typescript-1f99a0a0cf87) — Anthropic API implementation examples

**Test Automation Patterns:**
- [BrowserStack: Batch Testing Guide](https://www.browserstack.com/guide/what-is-batch-testing) — Industry patterns for batch test runners
- [BrowserStack: Playwright Test Reports](https://www.browserstack.com/guide/playwright-test-report) — Multi-format reporter patterns

**AI Test Flakiness Research:**
- [arXiv: On the Flakiness of LLM-Generated Tests](https://arxiv.org/html/2601.08998) — "LLMs transferred flakiness via prompt context," empirical study on LLM non-determinism
- [arXiv: Can We Classify Flaky Tests Using Only Test Code?](https://arxiv.org/abs/2602.05465) — "Even with greedy decoding at temperature 0, non-determinism across repeated executions"

### Tertiary (LOW confidence)

**Playwright GitHub Issues (specific edge cases):**
- [Issue #32564: exposeFunction() not exposing as expected](https://github.com/microsoft/playwright/issues/32564) — Function naming conflicts
- [Issue #31668: removeExposedFunction feature request](https://github.com/microsoft/playwright/issues/31668) — No built-in removal method
- [Issue #13637: exposeFunction stuck in headful mode](https://github.com/microsoft/playwright/issues/13637) — Timing race in headed mode

---

*Research completed: 2026-02-14*
*Ready for roadmap: YES*
*Total research files synthesized: 4 (STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md)*

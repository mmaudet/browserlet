---
phase: 25-semantic-resolver-reporting
plan: 02
subsystem: resolver
tags: [playwright, page-evaluate, cascade-resolver, screenshot-on-failure, cli]

# Dependency graph
requires:
  - phase: 25-semantic-resolver-reporting
    plan: 01
    provides: "RESOLVER_BUNDLE string constant (43KB IIFE) for page.evaluate() injection"
  - phase: 24-cli-runner-playwright-actions
    provides: "BSLRunner, SimpleResolver, StepReporter, PlaywrightExecutor CLI infrastructure"
provides:
  - "CascadeCLIResolver class with Playwright injection (addInitScript + evaluate) and data-attribute element bridge"
  - "BSLRunner cascade-with-fallback resolution: CascadeCLIResolver -> SimpleResolver"
  - "Screenshot-on-failure: PNG capture to output directory on any step failure"
  - "--output-dir CLI flag for configurable screenshot output location"
affects: [cli-runner, future-micro-prompts-flag]

# Tech tracking
tech-stack:
  added: []
  patterns: [cascade-with-fallback-resolution, data-attribute-element-bridge, screenshot-on-failure]

key-files:
  created:
    - packages/cli/src/cascadeResolver.ts
  modified:
    - packages/cli/src/runner.ts
    - packages/cli/src/output.ts
    - packages/cli/src/index.ts
    - tests/cli/runner.test.ts

key-decisions:
  - "Data-attribute marking pattern: page.evaluate sets data-browserlet-resolved=__brl_{timestamp}_{random} on matched element, returns CSS attribute selector for Playwright"
  - "Cascade-with-fallback: try CascadeCLIResolver first, catch errors and fall back to SimpleResolver (CSS/text selectors)"
  - "Dual injection: addInitScript for future navigations + page.evaluate for immediate availability on current page"
  - "Screenshot timeout 5000ms with silent catch: if screenshot itself fails (browser crashed), continue with failure reporting"
  - "outputDir is required in BSLRunnerOptions (no default in runner); CLI index.ts provides default 'browserlet-output'"

patterns-established:
  - "Cascade-with-fallback resolution: try semantic cascade resolver, catch and fall back to simple CSS/text resolver"
  - "Data-attribute element bridge: mark element in page context with unique attribute, return attribute selector for Playwright actions"
  - "Screenshot-on-failure: capture PNG in catch block before reporting, display path in terminal output"

# Metrics
duration: 3min
completed: 2026-02-14
---

# Phase 25 Plan 02: CascadeCLIResolver Integration Summary

**CascadeCLIResolver injected via Playwright page.addInitScript/evaluate with data-attribute element bridge, SimpleResolver fallback, and PNG screenshot-on-failure to configurable --output-dir**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-14T14:31:44Z
- **Completed:** 2026-02-14T14:34:47Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- CascadeCLIResolver class injects 43KB resolver bundle into Playwright page context and resolves elements via page.evaluate with data-attribute bridge
- BSLRunner uses cascade resolver as primary with automatic SimpleResolver fallback on cascade failure
- Step failures capture PNG screenshots to output directory with step-specific filenames (fail-{stepName}.png)
- StepReporter displays screenshot file path below failure message in terminal
- CLI --output-dir flag defaults to "browserlet-output", directory created automatically

## Task Commits

Each task was committed atomically:

1. **Task 1: Create CascadeCLIResolver with Playwright injection and element bridge** - `9bbed7b` (feat)
2. **Task 2: Integrate cascade resolver into BSLRunner with screenshot-on-failure and fallback** - `233c953` (feat)

**Plan metadata:** (pending)

## Files Created/Modified
- `packages/cli/src/cascadeResolver.ts` - CascadeCLIResolver class with inject() and resolve() methods, data-attribute element bridge
- `packages/cli/src/runner.ts` - BSLRunner with cascade-with-fallback resolution and screenshot-on-failure in catch block
- `packages/cli/src/output.ts` - StepReporter.stepFail() accepts optional screenshotPath parameter
- `packages/cli/src/index.ts` - Added --output-dir CLI option, CascadeCLIResolver re-export, outputDir wired to BSLRunner
- `tests/cli/runner.test.ts` - Updated all BSLRunner instantiations with required outputDir option

## Decisions Made
- **Data-attribute element bridge:** Inside page.evaluate, the resolved element is marked with `data-browserlet-resolved="__brl_{timestamp}_{random}"`. The unique attribute selector is returned to Playwright for targeting. This avoids serializing Element objects across the page boundary.
- **Cascade-with-fallback:** CascadeCLIResolver is tried first in a try/catch. On any error (no hints, low confidence, resolver bundle missing), SimpleResolver handles resolution. This guarantees backward compatibility with Phase 24 scripts.
- **Dual injection strategy:** `page.addInitScript({ content: RESOLVER_BUNDLE })` registers for future navigations. `page.evaluate(RESOLVER_BUNDLE)` makes the resolver available immediately on the current page. Both are needed because addInitScript only runs on future navigations.
- **Screenshot silent catch:** If page.screenshot() itself fails (browser crashed, page closed), the error is silently caught and failure reporting continues without a screenshot path.
- **outputDir required in BSLRunnerOptions:** The CLI entry point provides the default value ('browserlet-output'), keeping BSLRunner explicit about where screenshots go.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated runner tests to include required outputDir option**
- **Found during:** Task 2 (BSLRunner integration)
- **Issue:** Adding `outputDir` as required to BSLRunnerOptions caused all 5 runner tests to fail with TypeError (fs.mkdirSync received undefined)
- **Fix:** Added `outputDir: path.join(os.tmpdir(), 'browserlet-test-output')` to all BSLRunner constructor calls in tests
- **Files modified:** tests/cli/runner.test.ts
- **Verification:** All 102 tests pass (7 test files)
- **Committed in:** 233c953 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Test fix necessary for correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Full CLI pipeline operational: BSL script -> cascade resolution -> Playwright execution -> screenshot-on-failure
- LLM micro-prompt integration deferred (window.__browserlet_microPrompt bridge wiring) -- can be added with a `--micro-prompts` flag in a future phase
- Phase 25 complete: resolver bundle (25-01) and CLI integration (25-02) both shipped

## Self-Check: PASSED

All files verified present:
- packages/cli/src/cascadeResolver.ts: FOUND
- packages/cli/src/runner.ts: FOUND (modified)
- packages/cli/src/output.ts: FOUND (modified)
- packages/cli/src/index.ts: FOUND (modified)
- tests/cli/runner.test.ts: FOUND (modified)

Both task commits verified in git log:
- 9bbed7b: FOUND
- 233c953: FOUND

---
*Phase: 25-semantic-resolver-reporting*
*Completed: 2026-02-14*

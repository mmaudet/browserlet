---
phase: 25-semantic-resolver-reporting
plan: 01
subsystem: resolver
tags: [esbuild, iife, cascade-resolver, page-evaluate, playwright]

# Dependency graph
requires:
  - phase: 23-core-extraction
    provides: "@browserlet/core types (SemanticHint, HintType, HINT_WEIGHTS)"
  - phase: 24-cli-runner-playwright-actions
    provides: "CLI runner infrastructure (executor, resolver, package.json)"
provides:
  - "Self-contained resolver-bundle source files (7 files) adapted for browser page context"
  - "esbuild script producing IIFE string constant (RESOLVER_BUNDLE)"
  - "resolverBundleCode.ts auto-generated 43KB bundle for page.evaluate() injection"
affects: [25-02, cli-runner]

# Tech tracking
tech-stack:
  added: [esbuild, tsx]
  patterns: [iife-bundle-for-page-evaluate, window-bridge-for-extension-api-replacement, no-op-stub-for-unavailable-storage]

key-files:
  created:
    - packages/cli/resolver-bundle/types.ts
    - packages/cli/resolver-bundle/domUtils.ts
    - packages/cli/resolver-bundle/semanticResolver.ts
    - packages/cli/resolver-bundle/domContextExtractor.ts
    - packages/cli/resolver-bundle/structuralScorer.ts
    - packages/cli/resolver-bundle/cascadeResolver.ts
    - packages/cli/resolver-bundle/entry.ts
    - packages/cli/scripts/build-resolver.ts
    - packages/cli/src/resolverBundleCode.ts
  modified:
    - packages/cli/package.json

key-decisions:
  - "window.__browserlet_microPrompt bridge replaces chrome.runtime.sendMessage for LLM micro-prompt stages"
  - "HintStabilityTracker replaced with no-op stubs (getStabilityBoost returns 0) -- CLI has no chrome.storage.local"
  - "getMicroPromptsEnabled checks typeof window.__browserlet_microPrompt === 'function' instead of chrome.storage.local config"
  - "Inlined types from @browserlet/core into local types.ts to avoid esbuild needing workspace resolution"
  - "esbuild IIFE format with globalName __browserletResolver for page.evaluate() injection"
  - "Build pipeline: build:resolver runs before tsc --build to ensure resolverBundleCode.ts exists"

patterns-established:
  - "IIFE bundle pattern: resolver-bundle/ source -> esbuild -> src/resolverBundleCode.ts string constant"
  - "Extension-to-CLI adapter pattern: replace chrome.* with window bridges, replace storage with no-ops"

# Metrics
duration: 6min
completed: 2026-02-14
---

# Phase 25 Plan 01: Resolver Bundle Summary

**Cascade resolver (Stages 1-5) adapted from extension to self-contained esbuild IIFE bundle (43KB) with window.__browserlet_microPrompt bridge and no-op stability tracker**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-14T14:22:21Z
- **Completed:** 2026-02-14T14:29:05Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- 7 resolver-bundle source files adapted from extension with all chrome.* API references eliminated
- sendMicroPrompt bridges to window.__browserlet_microPrompt (page.exposeFunction) for LLM stages
- HintStabilityTracker replaced with no-op stubs (returns 0 boost, no-op record)
- esbuild produces 43KB IIFE bundle string constant exported as RESOLVER_BUNDLE
- Build pipeline chains resolver bundle generation before TypeScript compilation

## Task Commits

Each task was committed atomically:

1. **Task 1: Create resolver-bundle source files adapted from extension** - `b70d8ad` (feat)
2. **Task 2: Create esbuild script and generate resolver bundle string** - `33a59b8` (feat)

**Plan metadata:** (pending)

## Files Created/Modified
- `packages/cli/resolver-bundle/types.ts` - Inlined HintType, SemanticHint, HINT_WEIGHTS, micro-prompt types from @browserlet/core
- `packages/cli/resolver-bundle/domUtils.ts` - normalizeText, getElementRole, isElementVisible, findAssociatedLabel from utils/hints/*
- `packages/cli/resolver-bundle/semanticResolver.ts` - Multi-hint weighted scoring resolver (resolveElement, isElementInteractable, waitForElement)
- `packages/cli/resolver-bundle/domContextExtractor.ts` - Enriched DOM context extraction (fieldset, labels, landmarks, headings)
- `packages/cli/resolver-bundle/structuralScorer.ts` - Structural confidence boosts for Stage 2 disambiguation
- `packages/cli/resolver-bundle/cascadeResolver.ts` - Main 5-stage cascade resolver with bridge-based micro-prompts
- `packages/cli/resolver-bundle/entry.ts` - esbuild entry point exposing __browserletResolver on globalThis
- `packages/cli/scripts/build-resolver.ts` - esbuild script producing IIFE bundle as TypeScript string constant
- `packages/cli/src/resolverBundleCode.ts` - Auto-generated 43KB RESOLVER_BUNDLE constant
- `packages/cli/package.json` - Added build:resolver script, esbuild/tsx devDependencies

## Decisions Made
- **window.__browserlet_microPrompt bridge:** Replaces chrome.runtime.sendMessage. Bridge function is installed via page.exposeFunction in Plan 25-02. If undefined, micro-prompt stages gracefully degrade (return null).
- **No-op HintStabilityTracker:** getStabilityBoost always returns 0, recordSuccess/recordFailure are no-ops. CLI has no persistence store across runs. Per research: "Skip for v1.6."
- **getMicroPromptsEnabled synchronous:** Returns typeof check on window function instead of async chrome.storage.local lookup. Simplifies cascade flow.
- **Inlined types:** Copied SemanticHint, HintType, HINT_WEIGHTS, and micro-prompt I/O types directly into types.ts rather than importing from @browserlet/core to avoid esbuild needing workspace resolution at bundle time.
- **Non-minified bundle:** Keep readable for debugging (43KB vs ~20KB minified). Can minify later if bundle size matters.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- RESOLVER_BUNDLE string constant ready for import in Plan 25-02
- Plan 25-02 will integrate bundle into CLI executor via page.evaluate(RESOLVER_BUNDLE)
- Bridge function (window.__browserlet_microPrompt) wiring via page.exposeFunction is Plan 25-02's responsibility

## Self-Check: PASSED

All 9 created files verified present. Both task commits (b70d8ad, 33a59b8) verified in git log.

---
*Phase: 25-semantic-resolver-reporting*
*Completed: 2026-02-14*

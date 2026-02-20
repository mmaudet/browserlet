---
phase: 039-repair-workflow
plan: 02
subsystem: content-script
tags: [dom-scanning, semantic-hints, chrome-extension, repair, content-script, element-resolution]

# Dependency graph
requires:
  - phase: 039-repair-workflow
    provides: RepairTarget types, repair store with DOM_HINT_SUGGEST messaging, DiagnosticRepairPanel UI
  - phase: 038-failure-diagnostics
    provides: PartialFailureDiagnostic payload with originalHints and stepIntent
provides:
  - suggestHintsFromDOM function scanning live page for candidate elements and returning ranked SemanticHint[][] sets
  - DOM_HINT_SUGGEST message handler in content script completing the sidepanel-to-content round-trip
affects: [039-repair-workflow, content-script, extension-playback]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dynamic import for domHintSuggester in message handler (lazy loading, keeps content script lean)"
    - "Bounded DOM scan pattern: max 300 candidates with visibility filter for <100ms execution"
    - "Stability filters for auto-generated IDs and hashed class names"

key-files:
  created:
    - entrypoints/content/playback/domHintSuggester.ts
  modified:
    - entrypoints/content/index.ts

key-decisions:
  - "Reused matchHintSimple logic from cascadeResolver for consistent hint matching across resolution and repair"
  - "Stability filters reject UUID-pattern IDs, pure numeric IDs, and long alphanumeric class names to avoid fragile hints"
  - "Dynamic import pattern keeps domHintSuggester out of initial content script bundle (only loaded on repair)"
  - "Graceful empty response on error (success: true, suggestions: []) to keep repair UX non-blocking"

patterns-established:
  - "DOM hint extraction: extract all available semantic attributes from element as SemanticHint array"
  - "Intent bonus scoring: +0.1 score when element textContent matches step intent"

requirements-completed: [REP-02, REP-03]

# Metrics
duration: 3min
completed: 2026-02-20
---

# Phase 039 Plan 02: Content Script DOM Hint Suggester Summary

**DOM scanner returning ranked SemanticHint[][] from live page candidates, wired into content script message handler for repair panel round-trip**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-20T07:21:44Z
- **Completed:** 2026-02-20T07:24:38Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- suggestHintsFromDOM function scanning live page for interactable elements, scoring against original hints, and extracting semantic attributes from top 5 candidates
- DOM_HINT_SUGGEST message handler in content script with dynamic import and graceful error handling
- Full repair round-trip connected: sidepanel sends DOM_HINT_SUGGEST -> content script scans DOM -> responds with SemanticHint[][] -> repair panel renders suggestion cards

## Task Commits

Each task was committed atomically:

1. **Task 1: domHintSuggester -- DOM-based hint set generator** - `dd8e73a` (feat)
2. **Task 2: Wire DOM_HINT_SUGGEST into content script message handler** - `42bcb30` (feat)

## Files Created/Modified
- `entrypoints/content/playback/domHintSuggester.ts` - DOM scanner: gathers interactable candidates, scores against original hints, extracts semantic attributes as hint sets
- `entrypoints/content/index.ts` - DOM_HINT_SUGGEST case in handleServiceWorkerMessage with dynamic import and payload validation

## Decisions Made
- Reused matchHintSimple-equivalent logic from cascadeResolver for consistent hint matching between resolution and repair paths
- Applied stability filters (UUID, pure numeric, long alphanumeric) to reject fragile auto-generated IDs and class names from extracted hints
- Used dynamic import for domHintSuggester to keep initial content script bundle lean (only loads on repair)
- Returns graceful empty suggestions on error rather than failing, keeping repair UX non-blocking

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Full repair workflow is now connected end-to-end: diagnostic payload -> repair panel -> DOM suggestions -> apply hint -> re-run
- All 524 tests pass with no regressions
- Extension builds successfully

## Self-Check: PASSED

All 2 files verified present. All 2 task commits verified in git log.

---
*Phase: 039-repair-workflow*
*Completed: 2026-02-20*

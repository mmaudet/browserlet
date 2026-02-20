---
phase: 037-generation-quality
plan: 03
subsystem: llm
tags: [prompt-engineering, layout-detection, legacy-table, spa, bsl-generation]

# Dependency graph
requires:
  - phase: 036-structural-context
    provides: "landmark_context hint type and DOM context extractor"
  - phase: 037-01
    provides: "sortHintsByWeight, hint preservation rules 16-17, 14 hint types in prompt"
provides:
  - "detectLayoutType() function classifying actions as legacy-table, spa-component, or generic"
  - "Layout-adaptive prompt sections in buildBSLPrompt and buildCompactBSLPrompt"
  - "Unit tests for layout detection and prompt injection (21 tests)"
affects: [bsl-generation, prompt-builder, playback-quality]

# Tech tracking
tech-stack:
  added: []
  patterns: ["signal-counting layout detection with threshold >= 2 for classification"]

key-files:
  created:
    - tests/background/llm/promptBuilder.test.ts
  modified:
    - entrypoints/background/llm/promptBuilder.ts

key-decisions:
  - "Table signal threshold: >= 2 role hints (cell/columnheader/rowheader/row) to classify as legacy-table"
  - "SPA signal threshold: >= 2 signals from data-component/data-slot/data-radix/data-react/data-v-/React IDs; section_context contributes 0.5 (weaker)"
  - "Generic layout produces no extra prompt section (zero token overhead for common case)"
  - "Compact prompt uses single-line layout note vs full guidance section in standard prompt"

patterns-established:
  - "Layout detection via hint-pattern analysis: count domain-specific signals across all actions, require >= 2 for classification"
  - "Conditional prompt injection: layout guidance inserted between Rules and Examples sections, empty string for generic"

requirements-completed: [GEN-04]

# Metrics
duration: 3min
completed: 2026-02-20
---

# Phase 037 Plan 03: Layout-Aware Generation Summary

**Layout-type detection (legacy-table vs SPA vs generic) with conditional prompt guidance in both standard and compact BSL prompt builders**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-20T06:45:47Z
- **Completed:** 2026-02-20T06:49:22Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added `detectLayoutType()` function that analyzes hint patterns across recorded actions to classify pages as legacy HTML table-based UIs, modern SPA component structures, or generic
- Injected layout-specific prompt guidance in `buildBSLPrompt` (full section with OBM table rules or SPA component rules) and `buildCompactBSLPrompt` (single-line note)
- Created comprehensive test suite with 21 tests covering all detection paths, prompt injection, and edge cases

## Task Commits

Each task was committed atomically:

1. **Task 1: Add detectLayoutType and layout-adaptive prompt sections** - `8e61f5f` (feat)
2. **Task 2: Unit tests for detectLayoutType and layout-adaptive prompt** - `d7265c3` (feat)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified
- `entrypoints/background/llm/promptBuilder.ts` - Added LayoutType union, detectLayoutType(), buildLayoutGuidance(), and layout injection in both prompt builders
- `tests/background/llm/promptBuilder.test.ts` - 21 unit tests: 14 for detectLayoutType, 4 for buildBSLPrompt layout guidance, 3 for buildCompactBSLPrompt layout note, 1 sortHintsByWeight smoke test

## Decisions Made
- **Signal counting with threshold >= 2:** Requires at least 2 clear signals to classify, avoiding false positives from a single table cell or SPA attribute
- **section_context as weak SPA signal (0.5):** Section context hints appear in both table-based and SPA pages, so they contribute less weight -- 4 section_context hints needed to reach SPA threshold alone
- **Generic produces empty string:** No extra prompt section for generic layout, keeping token count unchanged for the common case
- **Auto-generated ID regex:** `/^(:r|ember|vue|ng-|__)/i` detects React/Vue/Ember/Angular auto-generated IDs without importing content-layer functions

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Layout-aware generation complete for Phase 037
- All 3 plans in Phase 037 (Generation Quality) now complete
- Pre-existing test failure in `tests/content/playback/semanticResolver.test.ts` (expects 13 hint types, 14 exist) remains from Phase 036 -- documented in deferred-items.md

## Self-Check: PASSED

All files and commits verified:
- entrypoints/background/llm/promptBuilder.ts: FOUND
- tests/background/llm/promptBuilder.test.ts: FOUND
- 037-03-SUMMARY.md: FOUND
- Commit 8e61f5f (Task 1): FOUND
- Commit d7265c3 (Task 2): FOUND

---
*Phase: 037-generation-quality*
*Completed: 2026-02-20*

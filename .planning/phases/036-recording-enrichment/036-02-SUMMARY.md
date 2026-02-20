---
phase: 036-recording-enrichment
plan: 02
subsystem: recording
tags: [hints, position-context, spa-detection, react, vue, angular, disambiguation]

# Dependency graph
requires:
  - phase: 036-01
    provides: landmark_context hint type (14th), domContextExtractor landmark detection
provides:
  - position_context hint type (15th) for repeated element disambiguation
  - SPAContext type and spa_context field on CapturedAction
  - detectSPAContext() for React/Vue/Angular framework detection
  - generatePositionContext() for row N of M / item N of M hints
  - SPA context rule (rule 18) and position context guidance in promptBuilder
affects: [037-generation-quality, playback, semantic-resolver]

# Tech tracking
tech-stack:
  added: []
  patterns: [position-disambiguation, spa-framework-detection, global-hook-sniffing]

key-files:
  created: []
  modified:
    - packages/core/src/types/hints.ts
    - packages/core/src/types/weights.ts
    - entrypoints/content/recording/types.ts
    - entrypoints/content/recording/hintGenerator.ts
    - entrypoints/content/recording/eventCapture.ts
    - entrypoints/background/llm/promptBuilder.ts
    - tests/content/recording/hintGenerator.test.ts
    - tests/content/playback/semanticResolver.test.ts

key-decisions:
  - "position_context weight = 0.55 (above class_contains 0.5, below near_label 0.6) -- fragile if rows reorder but critical for table row disambiguation"
  - "detectSPAContext returns undefined for non-SPA pages (unknown framework) to avoid false positives"
  - "Position disambiguation requires both role + text_contains hints to avoid noise on structural-only elements"
  - "Table context uses row-based format (row N of M) while flat lists use item-based format (item N of M)"

patterns-established:
  - "SPA detection via window globals (__REACT_DEVTOOLS_GLOBAL_HOOK__, __VUE__, ng) -- ordered by signal strength"
  - "Position disambiguation capped at 200 candidates to avoid expensive full-DOM scans"

requirements-completed: [REC-03, REC-04]

# Metrics
duration: 5min
completed: 2026-02-20
---

# Phase 036 Plan 02: Position Context + SPA Detection Summary

**position_context hint (15th type) for repeated element disambiguation and SPAContext metadata with React/Vue/Angular framework detection**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-20T06:52:13Z
- **Completed:** 2026-02-20T06:57:38Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Added position_context as 15th HintType for disambiguating repeated identical elements (e.g., 5 "Edit" buttons in a table)
- Added SPAFramework, SPAContext types and spa_context field on CapturedAction for React/Vue/Angular detection
- Wired detectSPAContext into eventCapture.ts createAction() flow
- Updated promptBuilder.ts with SPA context rule (rule 18), position context explanation block, and YAML example
- Added 8 new tests covering position_context (unique, duplicate, table rows, no-text) and SPA detection (plain HTML, React, Vue, component)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add position_context hint type and SPA context types** - `9a64fd8` (feat)
2. **Task 2: Wire SPA detection into EventCapture and update tests + promptBuilder** - `34e63e7` (feat)

## Files Created/Modified
- `packages/core/src/types/hints.ts` - Added position_context as 15th HintType
- `packages/core/src/types/weights.ts` - Added position_context weight 0.55
- `entrypoints/content/recording/types.ts` - Added SPAFramework type, SPAContext interface, spa_context field on CapturedAction
- `entrypoints/content/recording/hintGenerator.ts` - Added generatePositionContext(), detectSPAContext(), detectFramework(), detectComponent(), detectDynamicZone()
- `entrypoints/content/recording/eventCapture.ts` - Wired detectSPAContext into createAction()
- `entrypoints/background/llm/promptBuilder.ts` - Added position_context to hint lists, SPA context rule 18, position context explanation block with YAML example
- `tests/content/recording/hintGenerator.test.ts` - Added 8 new tests for position_context and detectSPAContext
- `tests/content/playback/semanticResolver.test.ts` - Updated hint count assertion from 13 to 15

## Decisions Made
- position_context weight = 0.55: above class_contains (0.5) because positional hints are more semantically meaningful for table disambiguation, but below near_label (0.6) because positions are fragile when rows are reordered
- detectSPAContext returns undefined (not { framework: 'unknown' }) for non-SPA pages to avoid polluting CapturedAction with noise
- Position disambiguation requires both role + text_contains hints -- elements with only structural hints (no visible text) are not disambiguated to avoid false positives
- Table context detected via closest('tr') and formats as "row N of M"; flat lists format as "item N of M" for clearer LLM interpretation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated semanticResolver test hint count assertion**
- **Found during:** Task 2 (test suite run)
- **Issue:** semanticResolver.test.ts asserted exactly 13 hint types but we now have 15 (landmark_context from 036-01 + position_context from 036-02)
- **Fix:** Updated assertion from 13 to 15
- **Files modified:** tests/content/playback/semanticResolver.test.ts
- **Verification:** npm test passes with 511 tests, 0 failures
- **Committed in:** 34e63e7 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Pre-existing test needed updating due to cumulative hint type additions. No scope creep.

## Issues Encountered
- Core package dist needed rebuilding after adding position_context to HintType -- the compiled .d.ts files were stale. Ran `npm run build` in packages/core/ to regenerate.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 036 (Recording Enrichment) is now complete with all 15 hint types
- Position context and SPA detection ready for use by generation quality phases (037+)
- All 511 tests pass

---
*Phase: 036-recording-enrichment*
*Completed: 2026-02-20*

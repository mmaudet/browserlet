---
phase: 21-bsl-recording
plan: 02
subsystem: llm
tags: [bsl, prompts, fallback, structural-hints, form-disambiguation]

requires:
  - phase: 21-bsl-recording
    provides: "Extended HintType with fieldset_context, associated_label, section_context"
provides:
  - "LLM BSL prompt with structural hint documentation and disambiguation example"
  - "Fallback BSL generator with structural hints in filterHints priority"
  - "Dynamic maxHints (5 when structural hints present) to prevent disambiguation loss"
affects: [bsl-generation, playback-resolution]

tech-stack:
  added: []
  patterns:
    - "Dynamic hint limit based on hint type presence (structural = 5, default = 4)"

key-files:
  created: []
  modified:
    - "entrypoints/background/llm/promptBuilder.ts"
    - "entrypoints/background/llm/fallback.ts"

key-decisions:
  - "Structural hints ranked priority 8-10 in fallback, above near_label (11) but below aria_label (7)"
  - "maxHints raised to 5 only when fieldset_context or section_context present"

patterns-established:
  - "BSL prompts include disambiguation examples for form-heavy pages"

duration: 4min
completed: 2026-02-12
---

# Phase 21 Plan 02: BSL Generation Prompt Updates Summary

**Updated LLM and fallback BSL generators with structural hint documentation, disambiguation examples, and dynamic hint limits for form section context**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-12T21:27:00Z
- **Completed:** 2026-02-12T21:31:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- LLM BSL prompt (buildBSLPrompt) now documents fieldset_context, associated_label, section_context with priority ranking and disambiguation example
- Compact BSL prompt (buildCompactBSLPrompt) updated with structural hint types and preservation rule
- Fallback filterHints includes all 3 structural types with priorities 8-10, near_label moved to 11
- Dynamic maxHints allows 5 hints when structural context is present (prevents disambiguation loss)

## Task Commits

Each task was committed atomically:

1. **Task 1+2: Prompt + fallback updates** - `74a272d` (feat)

## Files Created/Modified
- `entrypoints/background/llm/promptBuilder.ts` - Added structural hint types to hint list, disambiguation example, Rule 15, compact prompt updates
- `entrypoints/background/llm/fallback.ts` - Updated filterHints priority map with 3 new types, dynamic maxHints (5 when structural hints present)

## Decisions Made
- Structural hints ranked at priority 8-10 in fallback, placing them above near_label but below aria_label
- maxHints only raised to 5 when fieldset_context or section_context is present (not for associated_label alone, as it's less critical for disambiguation)

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 21 complete: recording captures structural context, BSL generation preserves it
- Structural hints flow end-to-end: recording -> BSL generation (LLM or fallback) -> playback resolution

---
*Phase: 21-bsl-recording*
*Completed: 2026-02-12*

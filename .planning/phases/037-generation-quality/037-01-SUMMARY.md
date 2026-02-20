---
phase: 037-generation-quality
plan: 01
subsystem: llm
tags: [hint-weights, prompt-engineering, audit, bsl-generation]

# Dependency graph
requires:
  - phase: 036-recording-enrichment
    provides: "HINT_WEIGHTS with 14 hint types including landmark_context"
provides:
  - "auditHintPreservation() function for post-generation hint loss detection"
  - "HintPreservationReport and HintLoss types"
  - "sortHintsByWeight() helper for weight-based hint ordering"
  - "LLM prompt rules 16-17 forbidding high-weight hint dropping"
affects: [037-generation-quality, bsl-generation-pipeline, llm-prompts]

# Tech tracking
tech-stack:
  added: []
  patterns: ["weight-threshold audit pattern (>= 0.7)", "pre-sort inputs before LLM prompt"]

key-files:
  created:
    - entrypoints/background/llm/hintPreservationAudit.ts
    - tests/background/llm/hintPreservationAudit.test.ts
  modified:
    - entrypoints/background/llm/promptBuilder.ts

key-decisions:
  - "MEANINGFUL_HINT_WEIGHT_THRESHOLD = 0.7 covering data_attribute, role, type, aria_label, name, text_contains, placeholder_contains, fieldset_context, associated_label"
  - "Audit pairs actions/steps by filtered index (after removing navigate/screenshot) rather than by matching heuristics"
  - "sortHintsByWeight applied in both buildBSLPrompt and buildCompactBSLPrompt for consistency"

patterns-established:
  - "Post-generation audit pattern: compare recorded inputs vs generated outputs, return report object (never throw)"
  - "Weight-sorted hint ordering: always sort by HINT_WEIGHTS descending before feeding to LLM"

requirements-completed: [GEN-01, GEN-02]

# Metrics
duration: 4min
completed: 2026-02-20
---

# Phase 037 Plan 01: Hint Preservation Audit Summary

**Post-generation hint preservation audit with weight-sorted hint ordering and LLM prompt rules forbidding high-weight hint dropping**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-20T06:38:51Z
- **Completed:** 2026-02-20T06:42:51Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Created `auditHintPreservation()` function that compares recorded CapturedAction hints against generated ParsedScript steps and reports any high-weight (>= 0.7) hints silently dropped by the LLM
- Added `sortHintsByWeight()` helper that pre-sorts hints by descending HINT_WEIGHTS before building LLM prompts, ensuring the most stable hints appear first
- Strengthened LLM prompt with rules 16 (HINT PRESERVATION: forbids dropping high-weight hints) and 17 (HINT ORDER: enforces stability-based ordering)
- 13 unit tests covering audit loss detection, low-weight filtering, navigate/screenshot skipping, data_attribute matching, and sort correctness

## Task Commits

Each task was committed atomically:

1. **Task 1: Create hintPreservationAudit module** - `46ba4da` (feat)
2. **Task 2: Weight-sort hints in prompt builder + strengthen preservation rules** - `a931963` (feat)
3. **Task 3: Unit tests for hintPreservationAudit and sortHintsByWeight** - `ecd5b30` (feat)

## Files Created/Modified
- `entrypoints/background/llm/hintPreservationAudit.ts` - Audit module: HintLoss, HintPreservationReport types and auditHintPreservation() function
- `entrypoints/background/llm/promptBuilder.ts` - Added sortHintsByWeight(), hint sorting in both prompt builders, rules 16-17
- `tests/background/llm/hintPreservationAudit.test.ts` - 13 unit tests (9 audit + 4 sort)

## Key Technical Details

### HintPreservationReport interface
```typescript
interface HintPreservationReport {
  losses: HintLoss[];     // High-weight hints missing from generated BSL
  auditedSteps: number;   // Steps compared (excludes navigate/screenshot)
  lossCount: number;      // losses.length
  hasLoss: boolean;       // losses.length > 0
}
```

### MEANINGFUL_HINT_WEIGHT_THRESHOLD = 0.7
Hint types above threshold (audited for preservation):
- data_attribute (1.0), role (1.0), type (1.0)
- aria_label (0.9), name (0.9)
- text_contains (0.8)
- placeholder_contains (0.7), fieldset_context (0.7), associated_label (0.7)

Hint types below threshold (not audited):
- landmark_context (0.65), section_context (0.6), near_label (0.6), class_contains (0.5)

### Import path
HINT_WEIGHTS is imported from `@browserlet/core/types` (already re-exported from `packages/core/src/types/index.ts`).

## Decisions Made
- Set MEANINGFUL_HINT_WEIGHT_THRESHOLD at 0.7 to cover all hints critical for reliable element identification while excluding contextual hints (section_context, landmark_context, near_label) that provide disambiguation value but are not essential for finding the element
- Paired actions and steps by index after filtering navigate/screenshot rather than attempting fuzzy matching -- simpler, deterministic, and aligns with the 1:1 action-to-step generation assumption
- Applied sortHintsByWeight in both buildBSLPrompt and buildCompactBSLPrompt to ensure consistent hint ordering regardless of which prompt style is used

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Pre-existing test failure in `tests/content/playback/semanticResolver.test.ts` (expects 13 hint types but Phase 036 added landmark_context as 14th). Not caused by 037-01 changes. Logged to `deferred-items.md`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Audit function ready for integration into BSL generation pipeline (callers can invoke after generation)
- Weight-sorted hints and preservation rules active in both prompt builders
- Plan 037-03 can build on this foundation for additional generation quality improvements

## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 037-generation-quality*
*Completed: 2026-02-20*

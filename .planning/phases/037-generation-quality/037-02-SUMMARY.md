---
phase: 037-generation-quality
plan: 02
subsystem: llm
tags: [validation, dom-snapshot, bsl-generation, semantic-hints]

# Dependency graph
requires:
  - phase: 037-generation-quality
    provides: "Phase context for generation quality improvements"
provides:
  - "validateGeneratedBSL() function for post-generation hint verification"
  - "DOMSnapshot type for recording-time DOM state capture"
  - "GenerationValidationReport and StepValidationResult typed report objects"
affects: [037-generation-quality, recording-enrichment, llm-generation]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Pure validation function returning typed report (never throws)", "DOMSnapshot as forward-compatible minimal format"]

key-files:
  created:
    - entrypoints/background/llm/generationValidator.ts
    - tests/background/llm/generationValidator.test.ts
  modified: []

key-decisions:
  - "DOMSnapshot uses minimal format (observedValues map + observedDataAttributes array) for forward compatibility with Phase 36"
  - "Validator returns report object (never throws) so callers can display warnings without blocking script use"
  - "Navigate and screenshot steps are excluded from validation as they have no target hints"
  - "data_attribute hints support both structured {name, value} and plain string forms"

patterns-established:
  - "Post-generation validation: pure function taking ParsedScript + snapshot, returning typed report"
  - "DOMSnapshot: minimal serializable type with no DOM API dependencies"

requirements-completed: [GEN-03]

# Metrics
duration: 5min
completed: 2026-02-20
---

# Phase 037 Plan 02: Post-Generation DOM Validation Summary

**validateGeneratedBSL() module comparing generated BSL hint values against recording-time DOM snapshot with typed mismatch reports**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-20T06:30:23Z
- **Completed:** 2026-02-20T06:35:22Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments
- Created standalone validation module that compares generated BSL hints against DOM snapshot
- Defined DOMSnapshot type as forward-compatible minimal format for recording-time DOM state
- Implemented 15 unit tests covering null snapshot, clean match, mismatches, data_attribute handling, and report shape
- All 469 tests in full suite pass with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Create DOMSnapshot type and generationValidator module** - `eb803ec` (feat)
2. **Task 2: Unit tests for generationValidator** - `fc3e6ad` (feat)

## Files Created/Modified

- `entrypoints/background/llm/generationValidator.ts` - Post-generation validation module with DOMSnapshot, StepValidationResult, GenerationValidationReport types and validateGeneratedBSL() function
- `tests/background/llm/generationValidator.test.ts` - 15 Vitest unit tests covering all validation scenarios

## Type Shapes

### DOMSnapshot
Minimal serializable snapshot captured during recording. Maps hint types to observed values:
- `url: string` - page URL when snapshot was taken
- `observedValues: Partial<Record<HintType, string[]>>` - flat string sets per hint type
- `observedDataAttributes?: Array<{ attrName: string; attrValue: string }>` - data attribute entries

### StepValidationResult
Per-step validation output:
- `stepIndex`, `action`, `hintsChecked` - step metadata
- `mismatches` - array of `{ hintType, hintValue, reason: 'value_not_in_snapshot' }`
- `valid` - true when no mismatches

### GenerationValidationReport
Top-level report:
- `validated` - false when no snapshot available (not an error)
- `stepResults` - per-step results array
- `invalidStepCount`, `totalStepsChecked`, `hasIssues` - summary metrics

## Integration Pattern

Callers invoke after `generateBSL()`:

```ts
import { validateGeneratedBSL } from './generationValidator';

const report = validateGeneratedBSL(parsedScript, domSnapshot);
if (report.hasIssues) {
  // Display warnings to user; script is still usable
}
```

The DOMSnapshot will be populated by Phase 36 (Recording Enrichment) during recording and stored alongside the RecordingSession.

## Decisions Made
- DOMSnapshot uses minimal format (observedValues map + observedDataAttributes array) for forward compatibility with Phase 36 richer snapshots
- Validator returns report object (never throws) so callers can display warnings without blocking script use
- Navigate and screenshot steps excluded from validation (no target hints)
- data_attribute hints support both structured `{name, value}` and plain string forms

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript strict array indexing**
- **Found during:** Task 1 (generationValidator module)
- **Issue:** `script.steps[i]` flagged as possibly undefined under strict mode noUncheckedIndexedAccess
- **Fix:** Added non-null assertion `script.steps[i]!` (safe because loop bounds check)
- **Files modified:** entrypoints/background/llm/generationValidator.ts
- **Verification:** `npx tsc --noEmit` passes with no errors
- **Committed in:** eb803ec (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Trivial TypeScript strict mode fix. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- generationValidator.ts ready for integration with LLM generation pipeline
- DOMSnapshot type ready for Phase 36 recording enrichment to populate
- Report type ready for UI consumption in future phases

## Self-Check: PASSED

- All 2 created files exist on disk
- Both task commits (eb803ec, fc3e6ad) verified in git log
- 15/15 unit tests pass
- 469/469 full suite tests pass

---
*Phase: 037-generation-quality*
*Completed: 2026-02-20*

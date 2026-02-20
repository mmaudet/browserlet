---
phase: 038-failure-diagnostics
plan: 01
subsystem: diagnostics
tags: [failure-diagnostics, cascade-resolver, cli, typescript, suggester, formatter]

requires:
  - phase: 036-structural-context
    provides: "15 hint types with structural context (landmark_context, position_context)"
  - phase: 018-cascade-resolver
    provides: "CascadeResolver multi-stage resolution with gatherCompetitors and structural scoring"
provides:
  - "FailureDiagnostic shared type (core + CLI) with per-candidate scoring breakdown"
  - "DiagnosticError class thrown by CascadeCLIResolver on failure with full diagnostic data"
  - "DiagnosticSuggester pure function (4 fix suggestion scenarios)"
  - "DiagnosticFormatter for human-readable text (stderr) and machine-readable JSON (stdout)"
  - "--diagnostic-json CLI flag for piping structured failure data"
affects: [repair-engine, bsl-runner, cli-output]

tech-stack:
  added: []
  patterns: ["PartialFailureDiagnostic in-browser -> FailureDiagnostic assembled CLI-side", "DiagnosticError extends Error with structured payload", "stderr for text diagnostics, stdout for JSON piping"]

key-files:
  created:
    - packages/core/src/types/diagnostic.ts
    - packages/cli/src/diagnostic/types.ts
    - packages/cli/src/diagnostic/suggester.ts
    - packages/cli/src/diagnostic/formatter.ts
    - tests/cli/diagnostic/suggester.test.ts
    - tests/cli/diagnostic/formatter.test.ts
  modified:
    - packages/core/src/types/index.ts
    - packages/cli/resolver-bundle/types.ts
    - packages/cli/resolver-bundle/cascadeResolver.ts
    - packages/cli/src/cascadeResolver.ts
    - packages/cli/src/resolverBundleCode.ts
    - packages/cli/src/output.ts
    - packages/cli/src/runner.ts
    - packages/cli/src/index.ts
    - packages/cli/src/batchRunner.ts

key-decisions:
  - "PartialFailureDiagnostic assembled in-browser (no stepId/pageUrl), completed CLI-side with Node.js context"
  - "DiagnosticError.message preserves matched=[]/failed=[] format for RepairEngine backward compatibility"
  - "Text diagnostics written to stderr, JSON diagnostics to stdout for clean piping"
  - "Resolver bundle types.ts updated with missing landmark_context and position_context hint types"

patterns-established:
  - "Diagnostic pipeline: in-browser scoring -> serialized diagnostic -> CLI assembly -> suggest -> format"
  - "buildCandidateScoringRow captures per-hint matched/weight/contribution for each candidate"

requirements-completed: [DIAG-01, DIAG-02, DIAG-03, DIAG-04, DIAG-05]

duration: 8min
completed: 2026-02-20
---

# Phase 038 Plan 01: Full Failure Diagnostics Pipeline Summary

**Per-candidate hint scoring matrix, expected-vs-found side-by-side, confidence gap display, deterministic fix suggestions, and --diagnostic-json CLI flag for structured failure output**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-20T07:00:32Z
- **Completed:** 2026-02-20T07:09:00Z
- **Tasks:** 3
- **Files modified:** 15

## Accomplishments
- Defined FailureDiagnostic shared type with per-candidate hint scoring breakdown (DiagnosticHintScore, CandidateDescriptor, CandidateScoringRow) shared between in-browser resolver bundle and CLI
- Extended resolver bundle cascadeResolver to collect diagnostic scoring data on all failure paths (no-candidates and low-confidence) with up to 5 top candidates
- Built DiagnosticSuggester with 4 deterministic fix suggestion cases: no-candidates, large gap (high-weight hints failed), moderate gap (ambiguous elements), small gap (near threshold)
- Built DiagnosticFormatter rendering human-readable text (scoring matrix, expected-vs-found, confidence gap, suggestion) and machine-readable JSON
- Wired diagnostic pipeline into BSLRunner catch block and StepReporter, added --diagnostic-json CLI flag to both run and test commands
- Added 13 unit tests covering all suggester scenarios and formatter output formats

## Task Commits

Each task was committed atomically:

1. **Task 1: Define FailureDiagnostic type, extend resolver bundle, expose structured diagnostics** - `45b2d40` (feat)
2. **Task 2: Build DiagnosticFormatter/Suggester, wire into BSLRunner, add --diagnostic-json flag** - `899e021` (feat)
3. **Task 3: Add unit tests for DiagnosticSuggester and DiagnosticFormatter** - `f240457` (feat)

## Files Created/Modified
- `packages/core/src/types/diagnostic.ts` - FailureDiagnostic, CandidateScoringRow, CandidateDescriptor, DiagnosticHintScore shared types
- `packages/core/src/types/index.ts` - Re-export diagnostic types
- `packages/cli/resolver-bundle/types.ts` - PartialFailureDiagnostic + copied diagnostic sub-types, fixed missing landmark_context/position_context
- `packages/cli/resolver-bundle/cascadeResolver.ts` - buildCandidateScoringRow, buildCandidateDescriptor, diagnostic field on failure results
- `packages/cli/src/resolverBundleCode.ts` - Regenerated IIFE bundle with diagnostic collection
- `packages/cli/src/cascadeResolver.ts` - DiagnosticError class, throws structured diagnostic on failure
- `packages/cli/src/diagnostic/types.ts` - DiagnosticReport type (diagnostic + suggestion)
- `packages/cli/src/diagnostic/suggester.ts` - suggestFix() pure function with 4 scenario paths
- `packages/cli/src/diagnostic/formatter.ts` - formatDiagnosticText() and formatDiagnosticJSON()
- `packages/cli/src/output.ts` - StepReporter.stepFail accepts DiagnosticReport, writes text to stderr
- `packages/cli/src/runner.ts` - BSLRunner catches DiagnosticError, builds report, outputs JSON in --diagnostic-json mode
- `packages/cli/src/index.ts` - --diagnostic-json flag on run/test commands, re-exports
- `packages/cli/src/batchRunner.ts` - diagnosticJson option passthrough
- `tests/cli/diagnostic/suggester.test.ts` - 6 test cases for suggestFix scenarios
- `tests/cli/diagnostic/formatter.test.ts` - 7 test cases for text and JSON formatter output

## Decisions Made
- PartialFailureDiagnostic is assembled in-browser (no stepId/pageUrl since those require Node.js context), then completed CLI-side by CascadeCLIResolver which adds stepId, pageUrl, searchedHints, timestamp
- DiagnosticError.message preserves the `matched=[]/failed=[]` string format so RepairEngine's regex parsing continues to work unchanged
- Text diagnostics are written to stderr (via StepReporter) while JSON diagnostics go to stdout, allowing clean piping with `--diagnostic-json | jq`
- Fixed pre-existing issue: resolver-bundle/types.ts was missing landmark_context and position_context hint types (added by phases 036)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed missing landmark_context and position_context in resolver-bundle/types.ts**
- **Found during:** Task 1 (Step C: adding diagnostic types to resolver bundle)
- **Issue:** HintType union in resolver-bundle/types.ts only had 13 hint types, missing landmark_context and position_context added in Phase 036. Also missing corresponding HINT_WEIGHTS entries.
- **Fix:** Added landmark_context (0.65) and position_context (0.55) to both the HintType union and HINT_WEIGHTS record
- **Files modified:** packages/cli/resolver-bundle/types.ts
- **Verification:** TypeScript compiles without errors, resolver bundle rebuilds successfully
- **Committed in:** 45b2d40 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Pre-existing sync issue fixed. Essential for diagnostic types to include all 15 hint types. No scope creep.

## Issues Encountered
- Core package dist needed rebuilding before CLI could compile (diagnostic.d.ts not yet generated). Ran `npx tsc` in packages/core before proceeding.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Failure diagnostics pipeline is fully functional and tested
- 524 total tests pass (272 existing + 13 new diagnostic tests + 239 other)
- Ready for integration testing with real failing BSL scripts
- RepairEngine backward compatibility preserved via message format

## Self-Check: PASSED

All 16 claimed files verified present. All 3 task commit hashes (45b2d40, 899e021, f240457) found in git log.

---
*Phase: 038-failure-diagnostics*
*Completed: 2026-02-20*

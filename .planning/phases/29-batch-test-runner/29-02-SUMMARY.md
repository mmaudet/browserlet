---
phase: 29-batch-test-runner
plan: 02
subsystem: testing
tags: [batch-runner, parallel-workers, bail, cli, worker-pool]

# Dependency graph
requires:
  - phase: 29-batch-test-runner
    plan: 01
    provides: BatchRunner, TestReporter, test command
provides:
  - --bail flag for early termination on first failure
  - --workers N flag for parallel script execution
  - Worker pool pattern with Promise.all and shared index counter
affects: [30-ai-auto-repair, 31-final-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [worker-pool-with-shared-index, bail-flag-across-workers]

key-files:
  created: []
  modified:
    - packages/cli/src/batchRunner.ts
    - packages/cli/src/index.ts

key-decisions:
  - "bail/workers made optional in BatchRunnerOptions (defaults: false/1) for backward compatibility"
  - "Worker pool uses nextIndex++ shared counter (safe in single-threaded Node.js)"
  - "Results stored by original index to maintain script order regardless of completion order"
  - "workerCount capped at min(workers, scriptPaths.length) to avoid empty workers"

patterns-established:
  - "Worker pool pattern: shared queue index + Promise.all for N async workers"
  - "Bail propagation: shared bailed flag checked before each script start"

# Metrics
duration: 3min
completed: 2026-02-15
---

# Phase 29 Plan 02: Parallel Workers + Bail Summary

**--bail early termination and --workers N parallel execution via worker pool with fresh browser isolation per script**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-14T23:25:00Z
- **Completed:** 2026-02-14T23:28:09Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- BatchRunner now supports --bail flag: stops after first failure, marks remaining scripts as skipped (exitCode -1)
- BatchRunner now supports --workers N: concurrent script execution via worker pool with fresh browser per script
- Worker pool uses Promise.all with shared index counter -- safe in single-threaded Node.js
- Results maintain original script order regardless of worker completion order
- Default behavior (workers=1, bail=false) identical to plan 29-01 sequential execution
- Invalid --workers values (0, negative, non-numeric) rejected with clear error and exit code 2

## Task Commits

Each task was committed atomically:

1. **Task 1: Add bail and parallel workers to BatchRunner** - `5fa1ea0` (feat)
2. **Task 2: Wire --bail and --workers flags in CLI** - `e4a8d60` (feat, co-committed with 30-02 changes)

## Files Created/Modified
- `packages/cli/src/batchRunner.ts` - Added optional bail/workers to BatchRunnerOptions, extracted runScript() method, replaced sequential loop with worker pool pattern
- `packages/cli/src/index.ts` - Added --bail and --workers options to test command, workers validation, pass options to BatchRunner

## Decisions Made
- Made bail and workers optional in BatchRunnerOptions with defaults (false and 1) to maintain backward compatibility with plan 29-01 usage
- Worker pool uses `nextIndex++` shared counter -- safe because Node.js is single-threaded; the increment is synchronous while browser operations yield to event loop
- Results stored in pre-allocated array by original index, not pushed in completion order
- workerCount capped at `min(workers, scriptPaths.length)` to avoid spawning empty workers

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Batch test runner is complete with all features: sequential execution, parallel workers, bail-on-failure
- Ready for Phase 30 (AI Auto-Repair) integration
- BatchRunner can be extended with additional options as needed

## Self-Check: PASSED

All files verified present, all commit hashes verified in git log.

---
*Phase: 29-batch-test-runner*
*Completed: 2026-02-15*

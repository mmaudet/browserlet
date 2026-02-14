---
phase: 19-enriched-resolver
plan: 03
subsystem: playback
tags: [storage, stability, learning, per-site, chrome-storage]

requires:
  - phase: 18-analysis
    provides: stability tracking design and boost threshold recommendations
provides:
  - HintStabilityTracker class for per-site hint reliability tracking
  - HintStabilityData interface for storage schema
  - hintToKey() utility for hint key normalization
affects: [19-04-cascade-resolver]

tech-stack:
  added: []
  patterns: [aggregated-counters, session-cache, bounded-storage, counter-decay]

key-files:
  created:
    - entrypoints/content/playback/hintStabilityTracker.ts
  modified: []

key-decisions:
  - "Flat +0.2 boost (not per-hint) to prevent inflation from many stable hints"
  - "Minimum 5 attempts before stability boost applies (prevents premature boosting)"
  - "Max 200 hint keys per site bounds storage to ~10KB per site"
  - "30-day counter decay halves all counters to prevent stale data dominance"
  - "Session-level caching avoids repeated storage reads during playback"

patterns-established:
  - "Aggregated counters: successes/failures per hint key, not individual events"
  - "Bounded storage: max keys + time decay prevents unbounded growth"
  - "browserCompat polyfill: storage import resolves to browser.storage on Firefox"

duration: 1min
completed: 2026-02-12
---

# Phase 19 Plan 03: HintStabilityTracker Summary

**Per-site hint stability tracker with aggregated counters, +0.2 flat boost for >90% success rate hints, bounded to 200 keys/site with 30-day decay**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-12T21:10:25Z
- **Completed:** 2026-02-12T21:11:25Z
- **Tasks:** 1
- **Files created:** 1

## Accomplishments
- HintStabilityTracker class with session-level caching and async storage
- Per-site storage key: `browserlet_hint_stability_{hostname}`
- Aggregated counters (successes/failures) per hint key (RSLV-11)
- +0.2 flat stability boost for hints with >90% success rate and >= 5 attempts (RSLV-12)
- Bounded growth: max 200 hint keys per site, 30-day counter decay
- Firefox compatible via browserCompat polyfill
- recordSuccess/recordFailure for learning loop (RSLV-10)

## Task Commits

1. **Task 1: Create HintStabilityTracker with storage and boost logic** - `07e4d4b` (feat)

## Files Created/Modified
- `entrypoints/content/playback/hintStabilityTracker.ts` - Class with storage, caching, boost computation, pruning, and decay

## Decisions Made
- Session cache populated on first load() call, avoiding repeated storage reads during a single playback
- Pruning runs before every write (not on a timer) to ensure bounds are always enforced
- Counter decay uses integer division (Math.floor) to avoid fractional counts

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- HintStabilityTracker ready for import by CascadeResolver (Plan 19-04)
- Stability boost integrates at both Stage 1 and Stage 2 of the cascade

---
*Phase: 19-enriched-resolver, Plan: 03*
*Completed: 2026-02-12*

---
phase: 035-bsl-integration-validation
plan: 02
subsystem: cli-session
tags: [cli, session-persistence, bsl, auto-capture, auto-restore, playwright]
dependency_graph:
  requires:
    - phase: 035-01
      provides: SessionPersistenceConfig type, parseSessionPersistence parser, ParsedScript.sessionPersistence field
    - phase: 034-02
      provides: saveSessionSnapshot, loadSessionWithMeta, generateSessionId, validateProtocolMatch, --session-restore flag
  provides:
    - CLI auto-capture from BSL session_persistence declaration
    - CLI auto-restore from BSL session_persistence snapshot
    - Three-path session handling (manual restore > auto-restore > default random)
  affects: [cli-runner, cli-entry, session-storage]
tech_stack:
  added: []
  patterns: [bsl-metadata-driven-behavior, three-path-session-handling]
key_files:
  created: []
  modified:
    - packages/cli/src/runner.ts
    - packages/cli/src/index.ts
    - tests/cli/runner.test.ts
decisions:
  - "Auto-capture uses snapshot_id directly as sessionId (not prefixed with session-) for stable file names"
  - "Three-path session handling: manual --session-restore > BSL auto-restore > default random ID"
  - "Auto-restore skips protocol validation (happens implicitly during navigation)"
  - "Manual --session-restore takes precedence over BSL session_persistence declaration"
patterns_established:
  - "BSL metadata driving runtime CLI behavior via parsed sessionPersistence field"
  - "Pre-parse BSL script in index.ts to extract metadata before runner execution"
metrics:
  duration: 145
  tasks_completed: 2
  files_modified: 3
  commits: 3
  tests_added: 0
  completed_date: 2026-02-16
---

# Phase 035 Plan 02: CLI Auto-Capture/Restore from BSL session_persistence Summary

**CLI runner auto-captures sessions after successful runs and auto-restores before execution when BSL script declares session_persistence.enabled=true, using snapshot_id for stable file names**

## Performance

- **Duration:** 2 min 25 sec
- **Started:** 2026-02-16T17:14:18Z
- **Completed:** 2026-02-16T17:17:23Z
- **Tasks:** 2/2
- **Files modified:** 3

## Accomplishments
- BSL scripts with `session_persistence: {enabled: true}` auto-capture session state after successful CLI run
- BSL scripts with existing session snapshot auto-restore before execution (no manual `--session-restore` needed)
- Manual `--session-restore` flag takes precedence over BSL declaration
- Scripts without session_persistence work exactly as before (random session ID, implicit capture)
- `snapshot_id` field produces stable, meaningful session file names instead of random IDs

## Task Commits

Each task was committed atomically:

1. **Task 1: CLI auto-capture from parsed session_persistence** - `196e2a2` (feat)
2. **Task 2: CLI auto-restore from parsed session_persistence** - `1a8ae43` (feat)
3. **Fix: Missing context parameter in BSLRunner test instantiations** - `d422a43` (fix, deviation Rule 3)

## Files Created/Modified
- `packages/cli/src/runner.ts` - Added auto-capture logic: reads script.sessionPersistence after parsing, sets options.sessionId when enabled=true, uses snapshot_id or scriptBaseName as stable ID
- `packages/cli/src/index.ts` - Added three-path session handling: pre-parses BSL script for session_persistence, auto-restores from snapshot if exists, falls back to random ID for scripts without declaration
- `tests/cli/runner.test.ts` - Fixed BSLRunner constructor calls to include required context parameter (5 instantiations updated)

## Decisions Made
- **snapshot_id as direct sessionId**: Uses snapshot_id directly (not prefixed with "session-") so repeated runs overwrite the same session file, which is the desired behavior for session persistence
- **Three-path session handling priority**: Manual `--session-restore` > BSL `session_persistence` auto-restore > default random ID generation. This ensures explicit user intent always wins over declarative configuration
- **Auto-restore skips explicit protocol validation**: Protocol validation is complex before execution since the target URL comes from the first navigate step. Auto-restored sessions rely on implicit protocol matching during navigation. Manual `--session-restore` still does explicit protocol validation
- **Pre-parse in index.ts**: The BSL script is parsed once in index.ts before runner creation to extract session_persistence metadata for the auto-restore decision. The runner parses again for execution (acceptable overhead for clean separation of concerns)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed BSLRunner test instantiations missing context parameter**
- **Found during:** Task 2 verification
- **Issue:** BSLRunner constructor signature changed from `(page, options)` to `(page, context, options)` when session support was added in Phase 34. The 5 test instantiations in runner.test.ts still used the old 2-parameter form, causing TypeScript compilation failure
- **Fix:** Added `context` parameter to all 5 `new BSLRunner(page, context, {...})` calls in the test file
- **Files modified:** tests/cli/runner.test.ts
- **Verification:** `npx tsc --noEmit -p packages/cli/tsconfig.json` passes, all 5 runner tests pass
- **Committed in:** d422a43

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix necessary for test compilation. No scope creep.

## Issues Encountered
None - implementation followed plan specification.

## User Setup Required
None - no external service configuration required.

## Verification Results

1. `npx tsc --noEmit -p packages/cli/tsconfig.json` -- passes (no errors)
2. `cd packages/cli && npm run build` -- passes (resolver bundle + tsc)
3. `npx vitest run` -- 444 tests passing across 24 test files
4. `node packages/cli/dist/index.js run --help` -- CLI starts, shows all options including --session-restore

## Next Phase Readiness
- Phase 035 (BSL Integration & Validation) is now complete: both plans (parser + CLI integration) executed
- All v1.8 success criteria for Phase 35 are met:
  - BSL scripts with session_persistence parse without errors (Plan 01)
  - Session auto-captured after successful execution (Plan 02, Task 1)
  - Session auto-restored before execution (Plan 02, Task 2)
  - Scripts without session_persistence work unchanged (verified by 444 passing tests)
- v1.8 milestone ready for final validation/shipping

## Self-Check: PASSED

**Verified modified files:**
- [x] packages/cli/src/runner.ts (modified, auto-capture logic at lines 106-111)
- [x] packages/cli/src/index.ts (modified, three-path session handling at lines 164-225)
- [x] tests/cli/runner.test.ts (modified, context parameter added to 5 instantiations)

**Verified commits:**
- [x] 196e2a2: feat(035-02): CLI auto-capture from parsed session_persistence
- [x] 1a8ae43: feat(035-02): CLI auto-restore from parsed session_persistence
- [x] d422a43: fix(035-02): add missing context parameter to BSLRunner test instantiations

**Verified test results:**
- [x] 444 tests passing (24 test files)
- [x] TypeScript compilation: no errors
- [x] CLI build: success
- [x] CLI help: starts without errors

---
*Phase: 035-bsl-integration-validation*
*Completed: 2026-02-16*

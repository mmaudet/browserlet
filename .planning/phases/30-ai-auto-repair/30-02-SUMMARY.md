---
phase: 30-ai-auto-repair
plan: 02
subsystem: cli
tags: [auto-repair, interactive, cli-flags, bsl-updater, repair-history, runner]

requires:
  - phase: 30-ai-auto-repair
    provides: "RepairEngine, RepairContext, captureDOMContext, repair types"
  - phase: 28-llm-micro-prompt-bridge
    provides: "LLM provider infrastructure, ClaudeProvider, OllamaProvider"
provides:
  - "--auto-repair CLI flag for automatic high-confidence repair (>= 0.70)"
  - "--interactive CLI flag for user-approved repair suggestions"
  - "BSL file updater via applyRepair using core parser updateStepHints"
  - "Repair history audit trail in .browserlet-repair-history.json"
  - "Full repair pipeline integration in BSLRunner step loop"
affects: [batch-runner, testing, documentation]

tech-stack:
  added: []
  patterns:
    - "Repair engine created per-run alongside LLM provider (not singleton)"
    - "Repair only triggers when BOTH cascade AND simple resolver fail"
    - "Interactive mode uses readline for y/n prompts with picocolors formatting"

key-files:
  created:
    - packages/cli/src/repair/repairApplier.ts
    - packages/cli/src/repair/repairHistory.ts
  modified:
    - packages/cli/src/runner.ts
    - packages/cli/src/index.ts

key-decisions:
  - "Auto-repair threshold set at 0.70 confidence (matches cascade resolver threshold)"
  - "Repair flags are mutually exclusive (--auto-repair vs --interactive)"
  - "Repair implicitly enables LLM config from environment if not already set by --micro-prompts"
  - "BSL file updated on disk immediately after repair accepted, before re-resolution attempt"

patterns-established:
  - "Repair applier delegates to core parser updateStepHints for YAML manipulation"
  - "History logger is non-fatal: write failures logged but don't block execution"

duration: 5min
completed: 2026-02-15
---

# Phase 30 Plan 02: CLI Integration Summary

**--auto-repair and --interactive CLI flags wired into BSLRunner with BSL file updater, repair history logging, and full cascade-failure-to-LLM-repair pipeline**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-14T23:25:00Z
- **Completed:** 2026-02-14T23:30:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added --auto-repair flag that applies repairs with >= 0.70 confidence automatically
- Added --interactive flag that prompts user to approve/reject each repair suggestion
- Integrated RepairEngine into BSLRunner step loop: triggers on cascade + simple resolver failure
- BSL file updated on disk with new hints when repair accepted, then re-resolution attempted
- Repair history appended to .browserlet-repair-history.json for audit trail

## Task Commits

Each task was committed atomically:

1. **Task 1: Create BSL file updater and repair history logger** - `69fd249` (feat)
2. **Task 2: Wire repair into BSLRunner and add CLI flags** - `e4a8d60` (feat)

## Files Created/Modified
- `packages/cli/src/repair/repairApplier.ts` - BSL file updater using updateStepHints from core parser
- `packages/cli/src/repair/repairHistory.ts` - Repair history logger (JSON file, same dir as script)
- `packages/cli/src/runner.ts` - RepairEngine integration in step loop, promptRepairApproval helper
- `packages/cli/src/index.ts` - --auto-repair and --interactive CLI flags with validation

## Decisions Made
- Auto-repair confidence threshold: 0.70 (same as cascade resolver, empirically validated)
- --auto-repair and --interactive are mutually exclusive with clear error message
- Repair flags implicitly enable LLM config from environment (ANTHROPIC_API_KEY) if not set by --micro-prompts
- BSL file written to disk before re-resolution attempt (fail-safe: file reflects latest state)
- Interactive prompt uses picocolors for readability (consistent with existing CLI output)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Full auto-repair pipeline operational: cascade failure -> DOM capture -> LLM repair -> BSL update
- All 5 ARPR requirements satisfied (ARPR-01 through ARPR-05)
- Ready for Phase 31 or additional testing/documentation

---
*Phase: 30-ai-auto-repair*
*Completed: 2026-02-15*

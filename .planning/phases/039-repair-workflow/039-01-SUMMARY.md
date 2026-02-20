---
phase: 039-repair-workflow
plan: 01
subsystem: ui
tags: [preact, signals, chrome-extension, repair, diagnostics, audit-trail]

# Dependency graph
requires:
  - phase: 038-failure-diagnostics
    provides: FailureDiagnostic types and diagnostic payload from EXECUTION_FAILED
  - phase: 030-repair-engine
    provides: CLI repair types (RepairContext, RepairSuggestion, RepairHistoryEntry) as reference model
provides:
  - RepairTarget and RepairAuditEntry shared types in @browserlet/core
  - Repair store with state signals, DOM suggestion fetching, hint application, and audit persistence
  - DiagnosticRepairPanel overlay component for inline script repair from sidepanel
  - hint_repairer registered in extension microPromptRouter VALID_PROMPT_TYPES
affects: [039-repair-workflow, sidepanel, extension-playback]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dynamic import for repair store in execution message handler (lazy loading)"
    - "Overlay panel pattern with fixed positioning and z-index layering above CompletionModal"
    - "Chrome storage audit trail with browserlet_repair_history key"

key-files:
  created:
    - packages/core/src/types/repair.ts
    - entrypoints/sidepanel/stores/repair.ts
    - entrypoints/sidepanel/components/DiagnosticRepairPanel.tsx
  modified:
    - packages/core/src/types/index.ts
    - entrypoints/background/llm/microPromptRouter.ts
    - entrypoints/sidepanel/stores/execution.ts
    - entrypoints/sidepanel/main.tsx

key-decisions:
  - "Dynamic import pattern for repair store in EXECUTION_FAILED handler to avoid circular dependencies and lazy-load repair code"
  - "Bottom-sheet overlay style (borderRadius 12px 12px 0 0) matching mobile UX patterns for panel"
  - "Re-run uses latest script from scriptsState to pick up applied repairs"

patterns-established:
  - "Overlay component pattern: fixed position, z-index 10001, backdrop click to close"
  - "Audit trail to chrome.storage.local with non-fatal error handling"

requirements-completed: [REP-01, REP-02, REP-03, REP-04]

# Metrics
duration: 4min
completed: 2026-02-20
---

# Phase 039 Plan 01: Repair Workflow UI Summary

**Repair panel overlay with DOM suggestion fetching, hint rewriting via updateStepHints, audit trail to chrome.storage.local, and auto-open on diagnostic failure**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-20T07:14:49Z
- **Completed:** 2026-02-20T07:19:20Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- Shared RepairTarget and RepairAuditEntry types in @browserlet/core for extension and future CLI consumers
- Repair store with Preact signals managing repair lifecycle, DOM_HINT_SUGGEST messaging, applySuggestion via updateStepHints + saveScript, and audit persistence
- DiagnosticRepairPanel overlay with failed/matched hint badges, DOM suggestion cards with Apply buttons, and Re-run action
- Execution store wiring to auto-open repair panel when EXECUTION_FAILED includes diagnostic payload

## Task Commits

Each task was committed atomically:

1. **Task 1: Shared repair types + hint_repairer registration** - `7dd8048` (feat)
2. **Task 2: Repair store (state, apply, audit)** - `1ea7231` (feat)
3. **Task 3: DiagnosticRepairPanel UI + execution store wiring** - `f22b484` (feat)

## Files Created/Modified
- `packages/core/src/types/repair.ts` - RepairTarget and RepairAuditEntry shared interfaces
- `packages/core/src/types/index.ts` - Re-export repair types
- `entrypoints/background/llm/microPromptRouter.ts` - Added hint_repairer to VALID_PROMPT_TYPES
- `entrypoints/sidepanel/stores/repair.ts` - Repair state signals + openRepair/closeRepair/fetchDOMSuggestions/applySuggestion/saveRepairAudit
- `entrypoints/sidepanel/components/DiagnosticRepairPanel.tsx` - Overlay panel with failure info, hint badges, suggestion cards, apply/re-run actions
- `entrypoints/sidepanel/stores/execution.ts` - EXECUTION_FAILED handler wired to auto-open repair panel
- `entrypoints/sidepanel/main.tsx` - DiagnosticRepairPanel rendered when repairTarget is set

## Decisions Made
- Used dynamic `import()` for repair store in EXECUTION_FAILED handler to avoid circular dependencies and lazy-load repair code path
- Bottom-sheet overlay style (slides up from bottom with rounded top corners) for mobile-friendly UX
- Re-run button fetches latest script from scriptsState (not the stale repairTarget copy) to ensure applied repairs are picked up
- Updated repairTarget.scriptContent after successful apply so the target reflects current state

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 039-02 will implement the content script DOM_HINT_SUGGEST message handler that fetchDOMSuggestions sends to
- The repair store gracefully handles missing content script handler (returns empty suggestions)
- All 524 tests pass with no regressions

## Self-Check: PASSED

All 8 files verified present. All 3 task commits verified in git log.

---
*Phase: 039-repair-workflow*
*Completed: 2026-02-20*

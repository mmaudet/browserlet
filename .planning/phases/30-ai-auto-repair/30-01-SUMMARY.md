---
phase: 30-ai-auto-repair
plan: 01
subsystem: repair
tags: [llm, micro-prompts, dom-capture, repair-engine, cascade-resolver]

requires:
  - phase: 28-llm-micro-prompt-bridge
    provides: "LLM provider abstraction, routeMicroPrompt, micro-prompt infrastructure"
provides:
  - "RepairEngine class for LLM-powered hint repair on cascade failure"
  - "hint_repairer micro-prompt type with build/validate functions"
  - "captureDOMContext utility for 600-char DOM excerpts"
  - "Repair data model types (RepairContext, RepairSuggestion, RepairResult, RepairHistoryEntry)"
affects: [30-02-cli-integration, batch-runner, testing]

tech-stack:
  added: []
  patterns:
    - "RepairEngine wraps routeMicroPrompt with hint_repairer type for repair-specific LLM calls"
    - "DOM capture via page.evaluate with landmark-based context extraction"

key-files:
  created:
    - packages/cli/src/repair/types.ts
    - packages/cli/src/repair/domCapture.ts
    - packages/cli/src/repair/repairEngine.ts
  modified:
    - packages/core/src/prompts/microPrompts.ts
    - packages/core/src/prompts/index.ts
    - packages/cli/src/llm/microPromptRouter.ts

key-decisions:
  - "hint_repairer budget set higher than hint_suggester (750 vs 600 roundtrip) because repair needs more DOM context"
  - "RepairEngine never throws -- returns empty suggestions for graceful degradation"
  - "DOM capture uses landmark-based search (form, section, main, fieldset) before body fallback"

patterns-established:
  - "Repair types separated from engine for clean import boundaries"
  - "DOM capture as standalone utility for reuse in future repair strategies"

duration: 4min
completed: 2026-02-15
---

# Phase 30 Plan 01: Repair Engine Summary

**hint_repairer micro-prompt type with DOM context capture and RepairEngine class that produces ranked repair suggestions via LLM**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-14T23:20:54Z
- **Completed:** 2026-02-14T23:25:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Added hint_repairer to the micro-prompt system with build, validate, and budget functions
- Created DOM context capture utility that extracts 600-char page excerpts via page.evaluate with landmark search
- Built RepairEngine class that orchestrates failure context -> LLM prompt -> ranked suggestions pipeline
- Defined complete repair data model: RepairContext, RepairSuggestion, RepairResult, RepairHistoryEntry

## Task Commits

Each task was committed atomically:

1. **Task 1: Add hint_repairer micro-prompt type and DOM context capture** - `dda3767` (feat)
2. **Task 2: Create RepairEngine class** - `300788d` (feat)

## Files Created/Modified
- `packages/cli/src/repair/types.ts` - Repair data model types (RepairContext, RepairSuggestion, RepairResult, RepairHistoryEntry)
- `packages/cli/src/repair/domCapture.ts` - DOM context capture via page.evaluate with landmark-based search
- `packages/cli/src/repair/repairEngine.ts` - RepairEngine class: context -> prompt -> LLM -> ranked suggestions
- `packages/core/src/prompts/microPrompts.ts` - Added hint_repairer type, input/output interfaces, build/validate functions, budget
- `packages/core/src/prompts/index.ts` - Exported new hint_repairer types and validator
- `packages/cli/src/llm/microPromptRouter.ts` - Added hint_repairer to VALID_PROMPT_TYPES

## Decisions Made
- hint_repairer token budget set to 350/400/750 (higher than hint_suggester's 250/350/600) because repair needs more DOM context for accurate suggestions
- RepairEngine designed to never throw: returns empty suggestions array on any error, letting the caller decide next steps
- DOM capture uses structural landmarks (form, section, main, fieldset, nav, header) to find relevant context before falling back to document.body

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- RepairEngine ready for CLI integration in Plan 30-02
- All types exported and available for BSLRunner wiring
- hint_repairer micro-prompt registered in both core and CLI

---
*Phase: 30-ai-auto-repair*
*Completed: 2026-02-15*

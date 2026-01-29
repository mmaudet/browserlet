---
phase: 06-contextual-triggers
plan: 01
subsystem: triggers
tags: [typescript, chrome-storage, vanjs, semantic-hints, reactive-state]

# Dependency graph
requires:
  - phase: 02-recording
    provides: SemanticHint types for element identification
  - phase: 03-sidepanel
    provides: VanJS reactive store patterns
provides:
  - TriggerConfig type system with URL patterns and element conditions
  - Chrome storage layer for trigger CRUD and per-site overrides
  - VanJS reactive store for trigger state management
affects: [06-02-detection-engine, 06-03-ui-triggers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-domain override pattern with {prefix}_{id}_{domain} keys"
    - "TriggerCondition with url_pattern and element presence/absence checks"

key-files:
  created:
    - utils/triggers/types.ts
    - utils/storage/triggers.ts
    - entrypoints/sidepanel/stores/triggers.ts
  modified: []

key-decisions:
  - "Trigger mode: suggest (show in sidepanel) vs auto_execute (run immediately)"
  - "Cooldown default 300000ms (5 min) for auto_execute spam prevention"
  - "Per-site overrides stored with domain-keyed pattern for granular control"
  - "All trigger conditions use AND logic (all must match)"
  - "Reuse SemanticHint from recording for element detection consistency"

patterns-established:
  - "ElementCondition: hints + required flag pattern for flexible matching"
  - "ContextState: detection result with matches/reason/matchedTriggers"
  - "SiteOverride: domain + enabled + timestamp for audit trail"

# Metrics
duration: 1.7min
completed: 2026-01-29
---

# Phase 6 Plan 1: Trigger Types & Storage Summary

**Type system for contextual triggers with URL patterns, element conditions, suggest/auto-execute modes, and chrome.storage persistence**

## Performance

- **Duration:** 1m 41s
- **Started:** 2026-01-29T19:58:28Z
- **Completed:** 2026-01-29T20:00:09Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Comprehensive trigger type system with mode (suggest/auto_execute), conditions (URL + element), and per-site overrides
- Chrome storage utilities following existing scripts.ts patterns with CRUD operations
- VanJS reactive store with cross-context sync via storage change listener

## Task Commits

Each task was committed atomically:

1. **Task 1: Create trigger type definitions** - `71211ce` (feat)
2. **Task 2: Implement trigger storage utilities** - `055365b` (feat)
3. **Task 3: Create VanJS reactive trigger store** - `22d86bf` (feat)

## Files Created/Modified
- `utils/triggers/types.ts` - TriggerMode, TriggerCondition, TriggerConfig, SiteOverride, ContextState types
- `utils/storage/triggers.ts` - getTriggers, saveTrigger, deleteTrigger, getSiteOverride, setSiteOverride, clearSiteOverride
- `entrypoints/sidepanel/stores/triggers.ts` - triggersState, suggestedScriptIds, currentContext reactive stores with loadTriggers and sync

## Decisions Made

**1. Trigger mode enum (suggest vs auto_execute)**
- **Rationale:** Clear separation between passive suggestions (user chooses) and autonomous execution (script runs automatically)
- **Impact:** Enables safety-first approach where users can test triggers in suggest mode before enabling auto_execute

**2. Default cooldown 300000ms (5 minutes) for auto_execute**
- **Rationale:** Prevent spam when trigger conditions rapidly toggle (e.g., element appears/disappears in SPA)
- **Impact:** Scripts won't auto-execute more than once per 5 minutes by default

**3. Per-site overrides with domain-keyed storage**
- **Rationale:** Users may want triggers enabled globally but disabled on specific domains (or vice versa)
- **Pattern:** `trigger_override_{scriptId}_{domain}` allows independent control per script+domain
- **Impact:** Granular control without polluting main triggers array

**4. All conditions use AND logic**
- **Rationale:** Explicit AND is simpler than supporting AND/OR combinations in v1
- **Impact:** Complex trigger logic requires multiple TriggerConfig entries (one per condition set)

**5. Reuse SemanticHint from recording**
- **Rationale:** Element detection should use same hint system as recording for consistency
- **Impact:** Element conditions leverage existing semantic matching (role, id, text_contains, etc.)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**Pre-existing TypeScript errors in Phase 5 LLM code**
- **Issue:** `npx tsc --noEmit` shows 7 errors in entrypoints/background/llm/providers (claude.ts, ollama.ts), tests, and utils/crypto/encryption.ts
- **Resolution:** Confirmed trigger-specific files compile cleanly. Pre-existing errors are out of scope for this plan.
- **Impact:** None on trigger implementation. Phase 5 errors need separate resolution.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for 06-02 (Detection Engine):**
- TriggerConfig type complete with all necessary fields
- getAllTriggers() available for engine to load active triggers
- ContextState type ready for detection results

**Ready for 06-03 (Trigger UI):**
- VanJS store pattern established with reactive state
- Storage utilities ready for UI CRUD operations
- Per-site override API available for domain-specific controls

**No blockers.**

---
*Phase: 06-contextual-triggers*
*Completed: 2026-01-29*

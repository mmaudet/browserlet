---
phase: 02-recording
plan: 01
subsystem: recording
tags: [typescript, dom, semantic-hints, type-definitions]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: WXT extension scaffold, utils/types.ts messaging foundation
provides:
  - CapturedAction, RecordingState, SemanticHint type definitions
  - Semantic hint generator extracting 10 hint types from DOM elements
  - DOM and text utilities for hint extraction
affects: [02-02-visual-feedback, 02-03-event-capture, 02-04-state-management, 03-playback]

# Tech tracking
tech-stack:
  added: []
  patterns: [semantic-hints-over-selectors, type-driven-recording]

key-files:
  created:
    - entrypoints/content/recording/types.ts
    - entrypoints/content/recording/hintGenerator.ts
    - utils/hints/dom.ts
    - utils/hints/text.ts
  modified:
    - utils/types.ts

key-decisions:
  - "10 semantic hint types: role, id, text_contains, type, name, aria_label, placeholder_contains, near_label, class_contains, data_attribute"
  - "Filter auto-generated IDs (UUIDs, framework prefixes) to avoid capturing unstable identifiers"
  - "Skip utility classes (Tailwind patterns) to focus on semantic class names"
  - "Normalize text with accent removal for resilient matching across locales"

patterns-established:
  - "Semantic hints stored as type+value pairs, data_attribute uses object structure"
  - "Recording types separate from playback types (recording captures raw data, playback resolves elements)"
  - "Hint generation is synchronous and fast (<50ms target) for responsive recording"

# Metrics
duration: 4min
completed: 2026-01-29
---

# Phase 2 Plan 1: Recording Infrastructure Summary

**Semantic hint extraction from DOM elements using 10 hint types, with auto-generated ID filtering and utility class skipping**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-29T09:53:37Z
- **Completed:** 2026-01-29T09:58:06Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Recording type definitions established (CapturedAction, RecordingState, SemanticHint, RecordingSession)
- Message types extended for recording communication (START_RECORDING, STOP_RECORDING, RECORDING_STATE_CHANGED, ACTION_CAPTURED)
- Semantic hint generator extracts 10 hint types from DOM elements
- DOM utilities ported from POC (role detection, label finding, visibility checks, nearby text)
- Text utilities ported from POC (normalization, visible text extraction, text containment checks)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create recording types and extend message types** - `e85da48` (feat)
2. **Task 2: Port hint utilities from POC** - `77c513d` (feat)
3. **Task 3: Create hint generator** - `85e627c` (feat)

## Files Created/Modified
- `utils/types.ts` - Added recording message types (START_RECORDING, STOP_RECORDING, RECORDING_STATE_CHANGED, ACTION_CAPTURED), extended AppState with recordingState and recordedActions
- `entrypoints/content/recording/types.ts` - Recording type definitions (CapturedAction, RecordingState, SemanticHint, RecordingSession, HintType, ActionType)
- `entrypoints/content/recording/hintGenerator.ts` - generateHints function extracting 10 semantic hint types from DOM elements
- `utils/hints/dom.ts` - DOM utilities (getElementRole, isElementVisible, findAssociatedLabel, getNearbyText)
- `utils/hints/text.ts` - Text utilities (normalizeText, getVisibleText, getTextPreview, containsText)

## Decisions Made

**1. Use 10 semantic hint types for robust element identification**
- Rationale: Balance between richness (many signals) and performance (fast extraction)
- Types: role, id, text_contains, type, name, aria_label, placeholder_contains, near_label, class_contains, data_attribute
- Provides multiple fallback signals when some attributes are missing

**2. Filter auto-generated IDs to avoid capturing unstable identifiers**
- Rationale: React/Vue/Ember generate random IDs that change across sessions
- Detection patterns: UUIDs, long alphanumeric strings, framework prefixes (ember, react, vue, ng-, :r, __)
- Ensures captured hints remain valid across application reloads

**3. Skip utility classes (Tailwind patterns) in class_contains hints**
- Rationale: Utility classes describe styling, not semantics
- Skip patterns: layout (flex, grid), spacing (p-, m-, w-, h-), styling (text-, font-, bg-, border-), states (hover:, focus:), responsive (sm:, md:, lg:, xl:)
- Focuses on semantic class names that indicate component purpose

**4. Normalize text with accent removal for locale resilience**
- Rationale: Text hints should match across different text encodings and locale variations
- Normalization: trim, lowercase, collapse whitespace, optionally remove accents
- Improves hint stability in multilingual applications

## Deviations from Plan

**1. [Rule 2 - Missing Critical] Fixed TypeScript strict null checking for semantic class extraction**
- **Found during:** Task 3 (hint generator implementation)
- **Issue:** TypeScript couldn't infer that `semanticClasses[0]` is non-undefined after `semanticClasses.length > 0` check
- **Fix:** Extracted first class to variable with explicit undefined check
- **Files modified:** entrypoints/content/recording/hintGenerator.ts
- **Verification:** `npx tsc --noEmit` passes without errors
- **Committed in:** 85e627c (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 type safety)
**Impact on plan:** Type safety fix necessary for strict TypeScript compilation. No scope creep.

## Issues Encountered

**Issue:** Recording types file already existed in repository
- **Context:** entrypoints/content/recording/types.ts was already committed with correct structure
- **Resolution:** Verified file content matches plan specification, no changes needed
- **Impact:** Saved time, file was already in correct state

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for next phase (02-02: Visual Feedback):**
- Recording types fully defined and exported
- Hint generator ready to be called by event capture logic
- DOM and text utilities available for all recording tasks
- Message types ready for state synchronization

**No blockers.**

**Minor concern:**
- Hint generation performance (<50ms) not yet measured - will be validated during actual recording in 02-03

---
*Phase: 02-recording*
*Completed: 2026-01-29*

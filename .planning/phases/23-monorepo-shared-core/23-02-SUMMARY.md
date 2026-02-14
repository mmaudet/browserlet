---
phase: 23-monorepo-shared-core
plan: 02
subsystem: infra
tags: [monorepo, parser, micro-prompts, substitution, adapter-pattern, hint-weights]

# Dependency graph
requires:
  - phase: 23-01
    provides: "@browserlet/core package scaffolding with shared types (HintType, SemanticHint, BSLStep, etc.)"
provides:
  - "BSL parser (parseSteps, parseTimeout, validateStep, updateStepHints) in @browserlet/core/parser"
  - "Micro-prompt builders (buildMicroPrompt, validators) in @browserlet/core/prompts"
  - "HINT_WEIGHTS constant (13 weights) in @browserlet/core/types"
  - "Variable substitution (substituteVariables, extractVariableRefs) in @browserlet/core/substitution"
  - "Credential substitution with PasswordStorage adapter interface in @browserlet/core/substitution"
affects: [23-03, 24-cli-runner, 25-resolver-reporting]

# Tech tracking
tech-stack:
  added: []
  patterns: [adapter-pattern-for-browser-decoupling, barrel-re-exports]

key-files:
  created:
    - packages/core/src/types/weights.ts
    - packages/core/src/parser/stepParser.ts
    - packages/core/src/prompts/microPrompts.ts
    - packages/core/src/substitution/variables.ts
    - packages/core/src/substitution/credentials.ts
  modified:
    - packages/core/src/types/index.ts
    - packages/core/src/parser/index.ts
    - packages/core/src/prompts/index.ts
    - packages/core/src/substitution/index.ts

key-decisions:
  - "PasswordStorage adapter interface decouples credential resolution from chrome.storage -- extension and CLI provide their own backends"
  - "Variable substitution created in Task 1 (not Task 2) because stepParser.ts depends on extractVariableRefs (blocking dependency)"
  - "TransformType cast added in stepParser.ts for strict TypeScript compatibility (original extension code was less strict)"

patterns-established:
  - "Adapter pattern: browser-dependent functionality exposed as interface, implementations injected by consumer"
  - "Logic extraction: copy source with only import path changes, preserving identical behavior"

# Metrics
duration: 4min
completed: 2026-02-14
---

# Phase 23 Plan 02: Logic Extraction to @browserlet/core Summary

**BSL parser, micro-prompt builders, HINT_WEIGHTS, variable substitution, and credential substitution (with PasswordStorage adapter) extracted to @browserlet/core with zero browser dependencies**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-14T11:42:00Z
- **Completed:** 2026-02-14T11:46:38Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Complete BSL parser extracted (parseSteps, parseTimeout, validateStep, updateStepHints) with all internal imports pointing to @browserlet/core
- Micro-prompt builders extracted (buildMicroPrompt + 3 validators + types) for LLM-assisted element resolution
- HINT_WEIGHTS constant (13 weights from data_attribute:1.0 to class_contains:0.5) extracted to shared types
- Variable and credential substitution extracted with PasswordStorage adapter pattern removing chrome.storage dependency
- TypeScript compiles packages/core independently; extension build verified unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract HINT_WEIGHTS, BSL parser, and micro-prompt builders** - `445af38` (feat)
2. **Task 2: Extract credential substitution with adapter pattern** - `aa3b4b5` (feat)

## Files Created/Modified
- `packages/core/src/types/weights.ts` - HINT_WEIGHTS constant (13 hint type weights for semantic scoring)
- `packages/core/src/types/index.ts` - Added HINT_WEIGHTS re-export
- `packages/core/src/parser/stepParser.ts` - BSL YAML parser extracted from utils/yaml/stepParser.ts
- `packages/core/src/parser/index.ts` - Parser barrel exports (parseSteps, parseTimeout, validateStep, updateStepHints)
- `packages/core/src/prompts/microPrompts.ts` - Micro-prompt builders extracted from entrypoints/background/llm/microPromptBuilder.ts
- `packages/core/src/prompts/index.ts` - Prompts barrel exports (builders, validators, types)
- `packages/core/src/substitution/variables.ts` - Variable substitution extracted from entrypoints/content/playback/variableSubstitution.ts
- `packages/core/src/substitution/credentials.ts` - Credential substitution with PasswordStorage adapter interface
- `packages/core/src/substitution/index.ts` - Substitution barrel exports (variables + credentials)

## Decisions Made
- PasswordStorage adapter interface decouples credential resolution from chrome.storage -- extension and CLI each provide their own backend implementations
- Variable substitution was pulled into Task 1 (not Task 2) because the BSL parser imports extractVariableRefs, creating a blocking dependency (Rule 3)
- Added TransformType cast in stepParser.ts for strict TypeScript mode (original extension code relied on looser type checking)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Variable substitution created in Task 1 instead of Task 2**
- **Found during:** Task 1 (parser extraction)
- **Issue:** stepParser.ts imports extractVariableRefs from ../substitution/variables -- file must exist for TypeScript to compile
- **Fix:** Created variables.ts in Task 1 alongside parser, updated substitution barrel to export it
- **Files modified:** packages/core/src/substitution/variables.ts, packages/core/src/substitution/index.ts
- **Verification:** `npx tsc --noEmit -p packages/core/tsconfig.json` passes
- **Committed in:** 445af38 (Task 1 commit)

**2. [Rule 1 - Bug] TransformType cast in stepParser.ts**
- **Found during:** Task 1 (parser extraction)
- **Issue:** `output.transform = output.transform` assigns string to TransformType, TypeScript strict mode rejects
- **Fix:** Added `as TransformType` cast and imported TransformType
- **Files modified:** packages/core/src/parser/stepParser.ts
- **Verification:** `npx tsc --noEmit -p packages/core/tsconfig.json` passes
- **Committed in:** 445af38 (Task 1 commit)

**3. [Rule 1 - Bug] Regex capture group type safety in credentials.ts**
- **Found during:** Task 2 (credential extraction)
- **Issue:** `match[1]` is `string | undefined` in strict mode, but assigned to `name: string`
- **Fix:** Added null guard `if (match[1])` around the push
- **Files modified:** packages/core/src/substitution/credentials.ts
- **Verification:** `npx tsc --noEmit -p packages/core/tsconfig.json` passes
- **Committed in:** aa3b4b5 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking dependency, 2 type safety bugs)
**Impact on plan:** All auto-fixes necessary for TypeScript strict compilation. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All shared logic modules complete in @browserlet/core: parser, prompts, types/weights, substitution (variable + credential)
- Plan 03 will rewire extension imports from local paths to @browserlet/core
- Extension builds unchanged -- original files still in place alongside shared copies
- PasswordStorage adapter ready for extension implementation (wrapping chrome.storage) and future CLI implementation

## Self-Check: PASSED

All 10 created/modified files verified on disk. Both task commits (445af38, aa3b4b5) verified in git log.

---
*Phase: 23-monorepo-shared-core*
*Completed: 2026-02-14*

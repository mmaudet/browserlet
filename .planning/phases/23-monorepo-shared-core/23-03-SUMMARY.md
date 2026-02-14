---
phase: 23-monorepo-shared-core
plan: 03
subsystem: infra
tags: [monorepo, import-rewiring, re-export-shims, adapter-pattern, esm, node-standalone]

# Dependency graph
requires:
  - phase: 23-01
    provides: "@browserlet/core package with npm workspaces and shared types"
  - phase: 23-02
    provides: "BSL parser, micro-prompt builders, HINT_WEIGHTS, substitution with PasswordStorage adapter in @browserlet/core"
provides:
  - "Extension fully rewired to @browserlet/core (18 imports across 11 entrypoints files)"
  - "Original source files converted to thin re-export shims for backward compatibility"
  - "PasswordStorage adapter wrapper in utils/passwords/substitution.ts bridging browser storage to @browserlet/core interface"
  - "Node.js standalone import: parseSteps callable from Node.js without browser context"
  - "All 326 existing tests passing through @browserlet/core imports"
affects: [24-cli-runner, 25-resolver-reporting, 26-security]

# Tech tracking
tech-stack:
  added: []
  patterns: [re-export-shim-for-migration, nodenext-module-resolution, esm-js-extensions]

key-files:
  modified:
    - entrypoints/content/recording/types.ts
    - entrypoints/content/playback/types.ts
    - entrypoints/content/playback/variableSubstitution.ts
    - entrypoints/content/playback/semanticResolver.ts
    - entrypoints/content/playback/cascadeResolver.ts
    - entrypoints/content/playback/structuralScorer.ts
    - entrypoints/content/playback/hintStabilityTracker.ts
    - entrypoints/content/playback/actionExecutor.ts
    - entrypoints/content/playback/index.ts
    - entrypoints/background/llm/microPromptBuilder.ts
    - entrypoints/sidepanel/stores/execution.ts
    - utils/yaml/stepParser.ts
    - utils/passwords/substitution.ts
    - utils/triggers/types.ts
    - packages/core/tsconfig.json
    - packages/core/src/index.ts
    - packages/core/src/types/index.ts
    - packages/core/src/types/bsl.ts
    - packages/core/src/types/weights.ts
    - packages/core/src/parser/index.ts
    - packages/core/src/parser/stepParser.ts
    - packages/core/src/prompts/index.ts
    - packages/core/src/prompts/microPrompts.ts
    - packages/core/src/substitution/index.ts
    - tests/utils/yaml/stepParser.test.ts
    - tests/background/llm/microPromptBuilder.test.ts
    - tests/content/playback/semanticResolver.test.ts
    - tests/content/playback/cascadeResolver.test.ts
    - tests/content/playback/structuralScorer.test.ts
    - tests/content/playback/hintStabilityTracker.test.ts
    - tests/content/playback/sessionDetector.test.ts
    - tests/content/transforms.test.ts

key-decisions:
  - "Re-export shim pattern: original files forward to @browserlet/core, preserving all existing import paths"
  - "NodeNext module resolution for @browserlet/core package, enabling Node.js standalone ESM imports with .js extensions"
  - "PasswordStorage adapter wrapper kept in utils/passwords/substitution.ts to preserve backward-compatible (text, passwords[]) call signature"

patterns-established:
  - "Re-export shim migration: convert original to thin forwarder, then update consumers incrementally"
  - "Dual resolution: @browserlet/core uses NodeNext for Node.js ESM, extension uses bundler resolution via Vite alias"

# Metrics
duration: 7min
completed: 2026-02-14
---

# Phase 23 Plan 03: Import Rewiring to @browserlet/core Summary

**Extension fully rewired to @browserlet/core with 7 re-export shims, 18 direct imports across 11 files, PasswordStorage adapter, and Node.js standalone parseSteps verified -- all 326 tests passing unchanged**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-14T11:48:53Z
- **Completed:** 2026-02-14T11:56:19Z
- **Tasks:** 2
- **Files modified:** 33

## Accomplishments
- All original source files (recording/types, playback/types, variableSubstitution, stepParser, microPromptBuilder, semanticResolver, passwords/substitution) converted to thin re-export shims forwarding to @browserlet/core
- 11 extension consumer files updated to import directly from @browserlet/core (types, parser, prompts, substitution)
- 8 test files updated to import types/functions from @browserlet/core
- PasswordStorage adapter wrapper preserves backward-compatible `substituteCredentials(text, passwords[])` call signature
- Node.js standalone import verified: `import { parseSteps } from './packages/core/dist/parser/index.js'` works
- Zero behavior change: all 326 tests pass, extension builds identically (5.2 MB)

## Task Commits

Each task was committed atomically:

1. **Task 1: Convert original source files to re-export shims** - `d740c58` (feat)
2. **Task 2: Update remaining consumers, tests, and verify full test suite** - `b8d0949` (feat)

## Files Created/Modified
- `entrypoints/content/recording/types.ts` - Re-export shim: SemanticHint, HintType from @browserlet/core/types
- `entrypoints/content/playback/types.ts` - Re-export shim: all shared BSL types from @browserlet/core/types
- `entrypoints/content/playback/variableSubstitution.ts` - Re-export shim: from @browserlet/core/substitution
- `utils/yaml/stepParser.ts` - Re-export shim: from @browserlet/core/parser
- `entrypoints/background/llm/microPromptBuilder.ts` - Re-export shim: from @browserlet/core/prompts
- `entrypoints/content/playback/semanticResolver.ts` - HINT_WEIGHTS from @browserlet/core/types (re-export + import)
- `utils/passwords/substitution.ts` - Re-export shim + PasswordStorage adapter wrapper
- `entrypoints/content/playback/cascadeResolver.ts` - Direct import from @browserlet/core/types
- `entrypoints/content/playback/structuralScorer.ts` - Direct import from @browserlet/core/types
- `entrypoints/content/playback/hintStabilityTracker.ts` - Direct import from @browserlet/core/types
- `entrypoints/content/playback/actionExecutor.ts` - Direct import from @browserlet/core/substitution
- `entrypoints/content/playback/index.ts` - Direct import from @browserlet/core/parser and substitution
- `entrypoints/sidepanel/stores/execution.ts` - Direct import from @browserlet/core/parser
- `utils/triggers/types.ts` - Direct import from @browserlet/core/types
- `packages/core/tsconfig.json` - Added NodeNext module/moduleResolution for ESM
- `packages/core/src/**/*.ts` - Added .js extensions to all relative imports for ESM
- `tests/**/*.test.ts` (8 files) - Updated imports to @browserlet/core

## Decisions Made
- Re-export shim pattern chosen to preserve all existing relative import paths without breaking any code
- NodeNext module resolution added to packages/core/tsconfig.json to enable standalone Node.js ESM imports (requires .js extensions in source imports)
- PasswordStorage adapter wrapper kept in utils/passwords/substitution.ts to preserve the backward-compatible `(text, StoredPassword[])` signature used by the background service worker

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added NodeNext module resolution and .js extensions for Node.js ESM**
- **Found during:** Task 2 (Node.js standalone import verification)
- **Issue:** `node -e "import { parseSteps } from './packages/core/dist/parser/index.js'"` failed because compiled JS used extensionless imports (`from './stepParser'`) which Node.js ESM cannot resolve
- **Fix:** Changed packages/core/tsconfig.json to use `module: "NodeNext"` and `moduleResolution: "nodenext"`, then added `.js` extensions to all relative imports in packages/core/src/ (10 files)
- **Files modified:** packages/core/tsconfig.json, packages/core/src/{index,types/index,types/bsl,types/weights,parser/index,parser/stepParser,prompts/index,prompts/microPrompts,substitution/index}.ts
- **Verification:** `node --input-type=module -e "import { parseSteps } from './packages/core/dist/parser/index.js'; ..."` outputs `test 1`
- **Committed in:** b8d0949 (Task 2 commit)

**2. [Rule 2 - Missing Critical] Added packages/core/dist/ to .gitignore**
- **Found during:** Task 2 (pre-commit review)
- **Issue:** Build artifacts (packages/core/dist/, packages/core/tsconfig.tsbuildinfo) would be tracked by git
- **Fix:** Added entries to .gitignore
- **Files modified:** .gitignore
- **Committed in:** b8d0949 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking ESM resolution, 1 missing .gitignore entry)
**Impact on plan:** Both fixes necessary for Node.js standalone usage and clean repository. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 23 (Monorepo & Shared Core) is fully complete
- @browserlet/core exports: types, parser, prompts, substitution -- all importable from both browser and Node.js
- Requirements satisfied: CORE-01 (Node.js parser), CORE-02 (shared types), CORE-03 (micro-prompts), CORE-04 (PasswordStorage adapter), CORE-05 (zero behavior change), CORE-06 (npm install succeeds)
- Phase 24 (CLI Runner) can now import `@browserlet/core` to execute BSL scripts from the command line
- Phase 25 (Resolver Reporting) has all shared types available for serialized cascade resolution

## Self-Check: PASSED

All 33 modified files verified on disk. Both task commits (d740c58, b8d0949) verified in git log.

---
*Phase: 23-monorepo-shared-core*
*Completed: 2026-02-14*

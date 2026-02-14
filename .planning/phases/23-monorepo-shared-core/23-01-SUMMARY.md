---
phase: 23-monorepo-shared-core
plan: 01
subsystem: infra
tags: [monorepo, npm-workspaces, typescript, project-references, vite-alias]

# Dependency graph
requires: []
provides:
  - "@browserlet/core package with npm workspaces monorepo structure"
  - "Shared type definitions: SemanticHint, HintType, BSLStep, ParsedScript, ActionType, TransformType, OutputConfig, SessionCheckConfig, TableExtractionResult"
  - "TypeScript project references and paths for @browserlet/core"
  - "Vite resolve alias for bundler-time @browserlet/core resolution"
affects: [23-02, 23-03, 24-cli-runner, 25-resolver-reporting]

# Tech tracking
tech-stack:
  added: [npm-workspaces]
  patterns: [monorepo-workspace, typescript-project-references, vite-resolve-alias]

key-files:
  created:
    - packages/core/package.json
    - packages/core/tsconfig.json
    - packages/core/src/index.ts
    - packages/core/src/types/index.ts
    - packages/core/src/types/hints.ts
    - packages/core/src/types/bsl.ts
    - tsconfig.base.json
  modified:
    - package.json
    - tsconfig.json
    - wxt.config.ts

key-decisions:
  - "npm workspaces over pnpm/yarn for zero-config workspace protocol support"
  - "TypeScript project references with composite: true for independent compilation"
  - "Vite resolve alias alongside TS paths for dual bundler+IDE resolution"

patterns-established:
  - "Monorepo layout: packages/<name>/src/ with barrel exports"
  - "Shared tsconfig.base.json extended by all workspace packages"
  - "Type-only re-exports using 'export type' for zero-runtime overhead"

# Metrics
duration: 2min
completed: 2026-02-14
---

# Phase 23 Plan 01: Monorepo Scaffolding & Type Extraction Summary

**npm workspaces monorepo with @browserlet/core package containing 9 shared BSL type definitions (HintType, SemanticHint, ActionType, TransformType, BSLStep, ParsedScript, OutputConfig, SessionCheckConfig, TableExtractionResult)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-14T11:37:26Z
- **Completed:** 2026-02-14T11:39:51Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- npm workspaces monorepo with `@browserlet/core` package bootstrapped and symlinked
- All 9 shared BSL/hint types extracted to packages/core/src/types/ with zero browser dependencies
- TypeScript project references, paths, and Vite alias configured for triple resolution (IDE, tsc, Vite)
- Extension build verified unchanged -- no existing imports modified

## Task Commits

Each task was committed atomically:

1. **Task 1: Create monorepo scaffolding and shared package structure** - `f7ac80a` (feat)
2. **Task 2: Extract type definitions to shared package** - `2446366` (feat)

## Files Created/Modified
- `packages/core/package.json` - @browserlet/core package with exports field and TypeScript build
- `packages/core/tsconfig.json` - Composite TypeScript config extending tsconfig.base.json
- `packages/core/src/index.ts` - Barrel export re-exporting types, parser, prompts, substitution
- `packages/core/src/types/index.ts` - Type barrel re-exporting SemanticHint, HintType, BSLStep, etc.
- `packages/core/src/types/hints.ts` - HintType (13 types) and SemanticHint interface
- `packages/core/src/types/bsl.ts` - BSL types: ActionType (10 types), TransformType, BSLStep, ParsedScript, OutputConfig, SessionCheckConfig, TableExtractionResult
- `packages/core/src/parser/index.ts` - Placeholder for parser exports (Plan 02)
- `packages/core/src/prompts/index.ts` - Placeholder for prompt exports (Plan 02)
- `packages/core/src/substitution/index.ts` - Placeholder for substitution exports (Plan 02)
- `tsconfig.base.json` - Shared TypeScript settings for all workspaces
- `package.json` - Added workspaces field and @browserlet/core workspace dependency
- `tsconfig.json` - Added paths and project references for @browserlet/core
- `wxt.config.ts` - Added Vite resolve alias for @browserlet/core

## Decisions Made
- Used npm workspaces (native, zero-config) rather than pnpm/yarn workspaces
- TypeScript project references with `composite: true` for independent package compilation
- Vite resolve alias configured alongside TS paths for dual bundler+IDE resolution
- Recording-specific types (RecordingState, CapturedAction, RecordingSession) kept in extension, not shared
- Playback-runtime types (PlaybackState, ExecutionResult, ResolverResult, PersistedExecutionState) kept in extension

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- @browserlet/core package ready for logic extraction in Plan 02 (parser, prompts, substitution)
- Plan 03 will rewire extension imports from local paths to @browserlet/core
- All placeholder barrel exports in place for Plan 02 population

## Self-Check: PASSED

All 11 created files verified on disk. Both task commits (f7ac80a, 2446366) verified in git log.

---
*Phase: 23-monorepo-shared-core*
*Completed: 2026-02-14*

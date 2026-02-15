---
phase: 31-documentation-examples
plan: 01
subsystem: documentation
tags: [bsl, cli, readme, examples, migration-guide, troubleshooting]

# Dependency graph
requires:
  - phase: 27-credential-wiring
    provides: Vault encryption and credential substitution
  - phase: 28-llm-integration
    provides: LLM provider abstraction and micro-prompt bridge
  - phase: 29-batch-runner
    provides: Batch test runner with workers and bail
  - phase: 30-ai-auto-repair
    provides: Repair engine with auto-repair and interactive modes
provides:
  - Complete CLI README.md with command reference, BSL format spec, and migration guide
  - 14 BSL example scripts covering all 10 action types and key features
  - Troubleshooting reference with 15 common error messages and solutions
affects: [end-users, onboarding, ci-cd-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - BSL example scripts use semantic hints with fallback_selectors
    - Documentation references actual source code flags and defaults

key-files:
  created:
    - packages/cli/README.md
    - packages/cli/examples/01-navigate-and-verify.bsl
    - packages/cli/examples/02-form-login.bsl
    - packages/cli/examples/03-extract-text.bsl
    - packages/cli/examples/04-table-extract.bsl
    - packages/cli/examples/05-screenshot-on-demand.bsl
    - packages/cli/examples/06-credential-vault-login.bsl
    - packages/cli/examples/07-multi-step-workflow.bsl
    - packages/cli/examples/08-dropdown-select.bsl
    - packages/cli/examples/09-wait-for-dynamic-content.bsl
    - packages/cli/examples/10-hover-and-scroll.bsl
    - packages/cli/examples/11-variable-substitution.bsl
    - packages/cli/examples/12-batch-test-suite/login.bsl
    - packages/cli/examples/12-batch-test-suite/search.bsl
    - packages/cli/examples/12-batch-test-suite/navigation.bsl
  modified: []

key-decisions:
  - "Examples use real public sites (example.com, httpbin.org, books.toscrape.com, quotes.toscrape.com) and data: URIs for self-contained demos"
  - "README structured in 12 sections matching all DOCS requirements (DOCS-01 through DOCS-04)"
  - "Troubleshooting table covers all error paths from index.ts, runner.ts, and batchRunner.ts"

patterns-established:
  - "BSL examples follow consistent format: YAML comment header, name, steps with semantic hints and fallback_selectors"
  - "README documents flags and defaults by referencing actual Commander.js definitions in index.ts"

# Metrics
duration: 5min
completed: 2026-02-15
---

# Phase 31 Plan 01: Documentation & Examples Summary

**705-line CLI README with full command reference, migration guide, troubleshooting, and 14 BSL example scripts covering all action types**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-15T07:19:33Z
- **Completed:** 2026-02-15T07:24:19Z
- **Tasks:** 2
- **Files created:** 15

## Accomplishments
- 14 BSL example scripts demonstrating all 10 action types, credential vault, variable substitution, batch testing, and dynamic content
- 705-line README with command reference documenting all 9 CLI flags and 4 environment variables
- Extension-to-CLI migration guide with feature parity comparison table
- Troubleshooting section with 15 common errors mapped to solutions
- Programmatic API documentation with BSLRunner and BatchRunner import examples

## Task Commits

Each task was committed atomically:

1. **Task 1: Create 12 example BSL scripts** - `0680837` (docs)
2. **Task 2: Write comprehensive CLI README.md** - `ca10a3f` (docs)

## Files Created/Modified
- `packages/cli/README.md` - Complete CLI documentation (705 lines): BSL format, command reference, credential vault, LLM micro-prompts, auto-repair, batch testing, migration guide, troubleshooting
- `packages/cli/examples/01-navigate-and-verify.bsl` - Navigate + wait_for with role/text_contains hints
- `packages/cli/examples/02-form-login.bsl` - Form filling with type/click using name/placeholder_contains hints
- `packages/cli/examples/03-extract-text.bsl` - Text extraction with output.variable
- `packages/cli/examples/04-table-extract.bsl` - Structured table_extract from data: URL
- `packages/cli/examples/05-screenshot-on-demand.bsl` - Page screenshot to file path
- `packages/cli/examples/06-credential-vault-login.bsl` - Credential vault {{credential:alias}} syntax
- `packages/cli/examples/07-multi-step-workflow.bsl` - Multi-page workflow with click navigation and extraction
- `packages/cli/examples/08-dropdown-select.bsl` - Dropdown select action with data: URL
- `packages/cli/examples/09-wait-for-dynamic-content.bsl` - Dynamic content wait with timeout override
- `packages/cli/examples/10-hover-and-scroll.bsl` - Hover and scroll actions with data: URL
- `packages/cli/examples/11-variable-substitution.bsl` - Extract-then-substitute variable flow
- `packages/cli/examples/12-batch-test-suite/login.bsl` - Batch test: form accessibility check
- `packages/cli/examples/12-batch-test-suite/search.bsl` - Batch test: book catalog extraction
- `packages/cli/examples/12-batch-test-suite/navigation.bsl` - Batch test: page navigation and link click

## Decisions Made
- Examples use real public sites (example.com, httpbin.org, books.toscrape.com, quotes.toscrape.com) and data: URIs for self-contained demos -- no mock servers needed
- README structured as 12 sections covering all DOCS requirements (DOCS-01 through DOCS-04)
- Troubleshooting table derived from actual error messages in source code (index.ts, runner.ts, batchRunner.ts)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 31 is the final phase of milestone v1.7 (CLI Completion & Batch Testing)
- All DOCS requirements satisfied: DOCS-01 (command reference), DOCS-02 (examples), DOCS-03 (migration guide), DOCS-04 (troubleshooting)
- v1.7 milestone is now complete

## Self-Check: PASSED

- All 15 created files verified on disk
- Commit 0680837 (Task 1) verified in git log
- Commit ca10a3f (Task 2) verified in git log

---
*Phase: 31-documentation-examples*
*Completed: 2026-02-15*

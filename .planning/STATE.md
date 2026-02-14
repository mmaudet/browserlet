# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-14)

**Core value:** Automatisation web resiliente pour applications legacy, sans cout recurrent d'IA
**Current focus:** v1.6 CLI Runner & Automated Testing -- Phase 25 (Semantic Resolver & Reporting)

## Current Position

Milestone: v1.6 CLI Runner & Automated Testing
Phase: 25 of 26 (Semantic Resolver & Reporting)
Plan: 2 of 2 (Phase 25)
Status: Phase 23 complete, Phase 24 complete (3/3 plans), Phase 25 complete (2/2 plans), Phase 26 complete (3/3 plans)
Last activity: 2026-02-14 -- Completed 25-02 (CascadeCLIResolver integration, screenshot-on-failure)

Progress: [██████████] 91%

## Performance Metrics

**v1.0 Velocity:**
- Total plans completed: 33
- Phases: 6 | Timeline: 3 days (2026-01-29 -> 2026-01-31)

**v1.1 Velocity:**
- Total plans completed: 16
- Phases: 4 | Timeline: 1 day (2026-01-31)

**v1.2 Velocity:**
- Total plans completed: 5
- Phases: 2 | Timeline: 2 days (2026-01-31 -> 2026-02-01)

**v1.3 Velocity:**
- Total plans completed: 3
- Phases: 1 | Timeline: 1 day (2026-02-01)

**v1.4 Velocity:**
- Total plans completed: 12
- Phases: 3 | Timeline: 2 days (2026-02-01 -> 2026-02-02)

**v1.5 Velocity:**
- Total plans completed: 14
- Phases: 6 (17-22) | Timeline: 2 days (2026-02-12 -> 2026-02-13)
- 57 files changed, +6,012 / -3,331 lines

## Completed Milestones

### v1.5 Resolver Redesign & Firefox
- **Shipped:** 2026-02-13
- **Archive:** [milestones/v1.5-ROADMAP.md](milestones/v1.5-ROADMAP.md)

### v1.4 Self-Healing & Data Extraction
- **Shipped:** 2026-02-12
- **Archive:** [milestones/v1.4-ROADMAP.md](milestones/v1.4-ROADMAP.md)

### v1.3 UX Sidepanel Refactoring
- **Shipped:** 2026-02-01
- **Archive:** [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md)

### v1.2 Persistent Credentials
- **Shipped:** 2026-02-01
- **Archive:** [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md)

### v1.1 Security & Stability
- **Shipped:** 2026-01-31
- **Archive:** [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)

### v1.0 MVP
- **Shipped:** 2026-01-31
- **Archive:** [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

## Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 006 | Modernize UI with Lucide icons and macOS-style buttons | 2026-02-01 | 22cd310 | [006-modernize-ui](./quick/006-modernize-ui-with-lucide-icons-and-macos/) |
| 007 | Refactor script list UX with icon-based actions | 2026-02-01 | 679c8ff | [007-refactor-script-list](./quick/007-refactor-script-list-ux-with-inline-rena/) |
| 008 | Add navigate action at script start with startUrl | 2026-02-04 | 037d651 | [008-add-navigate-action](./quick/008-add-navigate-action-at-script-start-with/) |
| 009 | Add screenshot button during recording | 2026-02-04 | 9e3fe1e | [009-add-screenshot-button](./quick/009-add-screenshot-button-during-recording-t/) |

## Accumulated Context

### Decisions

- Phase 23-26: Split EXEC requirements into two phases (24: runner+actions, 25: resolver+reporting) because page.evaluate() serialization for the cascade resolver is the riskiest technical decision and warrants its own phase boundary
- v1.6: AI auto-repair deferred to v1.7 per research recommendation -- core execution validation first
- 23-01: npm workspaces over pnpm/yarn for zero-config workspace protocol support
- 23-01: TypeScript project references with composite: true for independent compilation
- 23-01: Vite resolve alias alongside TS paths for dual bundler+IDE @browserlet/core resolution
- 23-02: PasswordStorage adapter interface decouples credential resolution from chrome.storage for extension+CLI backends
- 23-02: Logic extraction is copy-with-import-changes only, preserving identical behavior
- 23-03: Re-export shim pattern for migration: original files forward to @browserlet/core, preserving all existing import paths
- 23-03: NodeNext module resolution for @browserlet/core enables Node.js standalone ESM imports
- 23-03: PasswordStorage adapter wrapper in utils/passwords/substitution.ts preserves backward-compatible call signature
- 24-01: Merged CLI package.json with Phase 26 -- added playwright/commander/picocolors/ora alongside existing env-paths
- 24-01: Used '*' over 'workspace:*' for @browserlet/core -- npm 10 does not support workspace: protocol natively
- 24-01: Exhaustive switch with never type guard for ActionType compile-time coverage
- 24-01: page.fill() over page.type() for type action (faster, clears field first)
- 24-01: StepError classification: TIMEOUT (exit 2) vs STEP_FAILURE (exit 1) for proper CLI exit codes
- 24-02: SimpleResolver uses locator.count() existence checks for hint-chain resolution
- 24-02: BSLRunner mutates step.value in-place for variable substitution before execution
- 24-02: CLI index.ts dual purpose: re-exports modules and runs program.parse() for bin entry
- 24-02: Credential substitution deferred to Phase 26 with console.warn on detection
- 26-01: Buffer.from().toString('base64') for Node.js base64 -- identical output to extension's btoa(String.fromCharCode(...bytes))
- 26-01: globalThis.crypto.subtle over node:crypto legacy API for parameter-level compatibility with extension
- 26-01: Extractable keys (exportable: true) to allow JWK comparison in tests and future caching
- 26-03: Map.get() + immediate delete for one-time tokens -- 256-bit entropy makes timing attacks irrelevant
- 26-03: 127.0.0.1 string literal over 'localhost' to prevent IPv6 ::1 resolution on dual-stack systems
- 26-02: env-paths('browserlet', { suffix: '' }) for cross-platform vault path (~/.config/browserlet on Linux, ~/Library/Preferences/browserlet on macOS)
- 26-02: Credential ID format cred-{timestamp}-{randomHex} for uniqueness without UUID dependency
- 26-02: split+join for value redaction instead of regex to handle special characters in passwords
- 26-02: Longest-first value sorting in redactCredentialValues to prevent partial match corruption
- 26-03: Map.get() + immediate delete for one-time tokens -- 256-bit entropy makes timing attacks irrelevant
- 26-03: 127.0.0.1 string literal over 'localhost' to prevent IPv6 ::1 resolution on dual-stack systems
- 26-03: Callback injection (getDecryptedCredential) decouples bridge from vault storage for standalone and extension modes
- 25-01: window.__browserlet_microPrompt bridge replaces chrome.runtime.sendMessage for LLM micro-prompt stages in CLI
- 25-01: HintStabilityTracker replaced with no-op stubs (returns 0 boost) -- CLI has no chrome.storage.local
- 25-01: Inlined types from @browserlet/core into resolver-bundle/types.ts to avoid esbuild needing workspace resolution
- 25-01: esbuild IIFE format with globalName __browserletResolver for page.evaluate() injection
- 25-01: Build pipeline chains build:resolver before tsc --build to ensure resolverBundleCode.ts exists
- 25-02: Data-attribute marking pattern (data-browserlet-resolved) bridges page.evaluate element resolution to Playwright selectors
- 25-02: Cascade-with-fallback: CascadeCLIResolver first, SimpleResolver on error for backward compatibility
- 25-02: Dual injection: addInitScript for future navigations + page.evaluate for immediate availability
- 25-02: outputDir required in BSLRunnerOptions; CLI provides default 'browserlet-output'

### Pending Todos

None.

### Blockers/Concerns

- Research flags page.evaluate() serialization as high risk -- RESOLVED in 25-01: esbuild IIFE bundle eliminates serialization concern
- Cross-platform Web Crypto compatibility (Node.js vs browser) -- VALIDATED in 26-01: globalThis.crypto.subtle works in Node.js v15+, BufferSource cast needed for TypeScript strict mode

## Session Continuity

Last session: 2026-02-14
Stopped at: Completed 25-02-PLAN.md (CascadeCLIResolver integration, screenshot-on-failure)
Resume file: None
Next action: Phase 25 complete. All v1.6 phases (23-26) complete.

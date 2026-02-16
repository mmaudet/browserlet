---
phase: 034-cli-session-persistence
plan: 02
subsystem: cli-session
tags: [session, restore, playwright, cli, protocol-validation]
dependency_graph:
  requires:
    - session/storage.ts (saveSessionSnapshot, loadSessionWithMeta, validateProtocolMatch, generateSessionId, cleanupExpiredSessions)
    - vault/cache.ts (cleanupExpiredCache)
    - playwright (BrowserContext, storageState API)
  provides:
    - BSLRunner session capture on successful script completion
    - CLI --session-restore flag for session restoration
    - Protocol validation during session restore
    - Startup cleanup of expired sessions
  affects:
    - packages/cli/src/runner.ts (constructor signature change)
    - packages/cli/src/index.ts (new flag, session restore flow)
    - packages/cli/src/batchRunner.ts (BSLRunner constructor update)
    - packages/cli/src/session/storage.ts (new loadSessionWithMeta helper)
tech_stack:
  added: []
  patterns:
    - Non-fatal session capture (try/catch around storageState)
    - Protocol validation before browser launch
    - Auto-generated session IDs for implicit capture
    - Startup housekeeping (cleanupExpiredSessions at CLI boot)
key_files:
  created: []
  modified:
    - packages/cli/src/runner.ts
    - packages/cli/src/index.ts
    - packages/cli/src/batchRunner.ts
    - packages/cli/src/session/storage.ts
decisions:
  - Session capture only on exitCode 0 (partial/failed runs do not overwrite sessions)
  - Session capture is non-fatal (script success not affected by capture failure)
  - Auto-generate sessionId for all runs (implicit capture without user config)
  - No session capture when restoring (--session-restore disables auto-capture to avoid overwriting)
  - Protocol validation reads script file to find first navigate URL
  - HTTPS->HTTP blocked with exit code 2, HTTP->HTTPS allowed with warning
  - Added loadSessionWithMeta to storage module for URL access during protocol validation (Rule 3 deviation)
metrics:
  duration: 187 seconds
  completed: 2026-02-16
  tasks_completed: 3
  tasks_total: 3
  files_created: 0
  files_modified: 4
  commits: 2
---

# Phase 34 Plan 02: CLI Session Integration Summary

Wire BSLRunner session capture via Playwright storageState API and --session-restore CLI flag with encrypted snapshot restore and protocol validation.

## What Was Done

### Task 1: Session Capture in BSLRunner

Updated `BSLRunner` class to accept `BrowserContext` as a constructor parameter and capture session state after successful script completion:

- Added `BrowserContext` import from Playwright and `saveSessionSnapshot`, `generateSessionId`, `PlaywrightStorageState` imports from session storage module
- Added `sessionId?: string` field to `BSLRunnerOptions` interface
- Changed constructor signature from `(page, options)` to `(page, context, options)` to store context reference
- After all steps succeed (before `reporter.scriptPass()`), calls `context.storageState()` and `saveSessionSnapshot()` when `sessionId` is provided
- Capture failures are non-fatal -- wrapped in try/catch so script success is never affected

### Task 2: --session-restore Flag and Session Restore Logic

Added `--session-restore <sessionId>` option to the `run` command in CLI entry point:

- Imports `loadSessionWithMeta`, `cleanupExpiredSessions`, `validateProtocolMatch`, `generateSessionId` from session storage
- Before browser launch: loads encrypted snapshot via `loadSessionWithMeta()`, exits with code 2 if session not found
- Creates browser context with `storageState` when restoring: `browser.newContext({ storageState: snapshotData.state })`
- Auto-generates `sessionId` for new runs (implicit capture); disables capture when restoring (`sessionId: undefined`)
- Added `cleanupExpiredSessions()` at CLI startup alongside existing `cleanupExpiredCache()`
- Updated BSLRunner constructor calls in both `run` command and `batchRunner.ts` to pass `context`

### Task 3: Protocol Validation During Session Restore

Added protocol compatibility checking before browser launch:

- Reads script file content to find first `navigate` action URL via regex
- Calls `validateProtocolMatch(sessionUrl, targetUrl)` from storage module
- HTTPS session to HTTP target: exits with error code 2 (security risk -- cookies may leak)
- HTTP session to HTTPS target: shows yellow warning, continues execution
- Displays session origin URL in green during successful restore

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added loadSessionWithMeta to storage module**
- **Found during:** Task 2
- **Issue:** `loadSessionSnapshot()` returns only `PlaywrightStorageState` (decrypted state), but protocol validation needs the session URL from `SessionSnapshot`. No function existed to return both state and URL.
- **Fix:** Added `loadSessionWithMeta()` function that returns `{ state: PlaywrightStorageState; url: string }` by reading the raw snapshot, decrypting, and returning both.
- **Files modified:** packages/cli/src/session/storage.ts
- **Commit:** 46e321b

**2. [Rule 3 - Blocking] Updated BSLRunner constructor in batchRunner.ts**
- **Found during:** Task 2
- **Issue:** Changing BSLRunner constructor from `(page, options)` to `(page, context, options)` broke batchRunner.ts which also instantiates BSLRunner.
- **Fix:** Updated `new BSLRunner(page, {...})` to `new BSLRunner(page, context, {...})` in batchRunner's `runScript()` method.
- **Files modified:** packages/cli/src/batchRunner.ts
- **Commit:** 46e321b

## User Experience Flow

```bash
# First run: authenticate and auto-capture session
$ browserlet run login.bsl
[BSLRunner] Running deterministic-only (stages 1-2)
... steps execute ...
[Session] Captured session: session-1708112345678-a3f2c1d4

# Second run: restore session, skip authentication
$ browserlet run dashboard.bsl --session-restore session-1708112345678-a3f2c1d4
[Session] Restoring session from: https://example.com
... steps execute without login prompts ...

# Protocol mismatch: HTTPS session to HTTP target
$ browserlet run http-app.bsl --session-restore session-1708112345678-a3f2c1d4
[Session] Cannot restore HTTPS session to HTTP URL (security risk)
Session cannot be restored. Run without --session-restore to re-authenticate.
```

## Commits

| Hash | Message |
|------|---------|
| bbada90 | feat(034-02): add session capture to BSLRunner after successful execution |
| 46e321b | feat(034-02): add --session-restore flag with protocol validation to CLI |

## Verification Results

- TypeScript compilation: PASS (`npx tsc --noEmit`)
- CLI build: PASS (`npm run build -w packages/cli`)
- --session-restore flag in help: PASS
- Session capture code in runner.ts: PASS
- Protocol validation in index.ts: PASS
- Cleanup at startup: PASS

## Self-Check: PASSED

All 5 modified/created files verified on disk. Both commits (bbada90, 46e321b) verified in git log.

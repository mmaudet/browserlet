---
phase: 033-extension-session-persistence
plan: 01
subsystem: auth
tags: [chrome-cookies, aes-gcm, session-persistence, chrome-extension, mv3]

# Dependency graph
requires:
  - phase: 032-vault-unlock-cache
    provides: "Vault encryption infrastructure (encryptApiKey, getOrCreateSessionKey)"
provides:
  - "SessionStorage module (captureSession, getSessionStatus, clearSession, cleanupExpiredSessions)"
  - "CAPTURE_SESSION, GET_SESSION_STATUS, CLEAR_SESSION message handlers"
  - "Startup cleanup of expired session snapshots"
  - "cookies permission in manifest"
affects: [033-02, 033-03, 034-cli-session-persistence]

# Tech tracking
tech-stack:
  added: [chrome.cookies API]
  patterns: [encrypted-session-snapshots, ttl-based-expiration, browserlet_session_prefix]

key-files:
  created:
    - "entrypoints/background/sessions.ts"
  modified:
    - "entrypoints/background/messaging.ts"
    - "entrypoints/background/index.ts"
    - "utils/types.ts"
    - "wxt.config.ts"

key-decisions:
  - "Use encryptApiKey() directly (not encryptWithKey + manual key) for consistent vault key selection"
  - "Add cookies permission to manifest base permissions (required for chrome.cookies.getAll)"
  - "Non-fatal capture failures (console.warn, not throw) to avoid breaking script execution"
  - "TTL metadata stored unencrypted alongside encrypted snapshot for efficient expiry checks"

patterns-established:
  - "Session key prefix: browserlet_session_{scriptId}_{domain}"
  - "Stored snapshot separates encrypted payload from TTL metadata"
  - "Startup cleanup pattern: iterate storage keys, check TTL, batch remove expired"

# Metrics
duration: 5min
completed: 2026-02-16
---

# Phase 33 Plan 01: Session Capture Infrastructure Summary

**Cookie capture via chrome.cookies.getAll with AES-GCM encryption and chrome.storage.local persistence**

## Performance

- **Duration:** 5 min (315 seconds)
- **Started:** 2026-02-16T13:42:06Z
- **Completed:** 2026-02-16T13:47:21Z
- **Tasks:** 2/2 completed
- **Files created:** 1
- **Files modified:** 4

## Accomplishments
- SessionStorage module with full cookie capture including HttpOnly cookies via privileged chrome.cookies API
- Encrypted session snapshots using vault encryption (AES-GCM via encryptApiKey)
- Background message handlers for CAPTURE_SESSION, GET_SESSION_STATUS, CLEAR_SESSION
- Startup cleanup of expired session snapshots with TTL-based expiration
- Added cookies permission to extension manifest

## Task Commits

Each task was committed atomically:

1. **Task 1: Create session storage module with cookie capture and encryption** - `57a5e41` (feat)
2. **Task 2: Add session message handlers and startup cleanup** - `4971072` (feat)

## Files Created/Modified
- `entrypoints/background/sessions.ts` - SessionStorage module: captureSession, getSessionStatus, clearSession, cleanupExpiredSessions (246 lines)
- `entrypoints/background/messaging.ts` - Added CAPTURE_SESSION, GET_SESSION_STATUS, CLEAR_SESSION handlers with import from sessions
- `entrypoints/background/index.ts` - Added cleanupExpiredSessions() call on service worker startup
- `utils/types.ts` - Added CAPTURE_SESSION, GET_SESSION_STATUS, CLEAR_SESSION message types
- `wxt.config.ts` - Added cookies permission to basePermissions array

## Decisions Made

1. **encryptApiKey() over encryptWithKey()**: Plan specified `encryptApiKey(json, key)` with manual key retrieval, but the actual function signature is `encryptApiKey(json)` which internally handles vault key vs session key selection. Used the actual API for correct behavior.

2. **cookies permission added to manifest**: chrome.cookies.getAll requires the `cookies` permission. This was not in the manifest. Added to basePermissions (shared by Chrome and Firefox) since session persistence works on both platforms.

3. **Non-fatal capture failures**: captureSession wraps all logic in try/catch with console.warn rather than throwing, ensuring script execution continues even if session capture fails.

4. **TTL metadata stored unencrypted**: capturedAt and ttl are stored alongside the encrypted payload so that cleanup and status checks can evaluate expiration without decrypting the full snapshot.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed encryptApiKey function signature**
- **Found during:** Task 1 (session storage module)
- **Issue:** Plan specified `encryptApiKey(json, key)` with a CryptoKey parameter, but the actual function signature is `encryptApiKey(apiKey: string)` with internal key selection
- **Fix:** Used `encryptApiKey(json)` matching the actual API
- **Files modified:** entrypoints/background/sessions.ts
- **Verification:** TypeScript compiles without errors
- **Committed in:** 57a5e41

**2. [Rule 1 - Bug] Fixed SameSiteStatus type mismatch**
- **Found during:** Task 1 (session storage module)
- **Issue:** Initial mapSameSite parameter typed as `chrome.cookies.SameSiteStatus | undefined` (enum type), but cookie.sameSite is a template literal string type
- **Fix:** Changed parameter to `string` with runtime normalization via switch statement
- **Files modified:** entrypoints/background/sessions.ts
- **Verification:** TypeScript compiles without errors
- **Committed in:** 57a5e41

**3. [Rule 3 - Blocking] Added cookies permission to manifest**
- **Found during:** Task 1 (session storage module)
- **Issue:** chrome.cookies.getAll requires the `cookies` permission which was not in the extension manifest
- **Fix:** Added `'cookies'` to basePermissions array in wxt.config.ts
- **Files modified:** wxt.config.ts
- **Verification:** Permission present in both Chrome and Firefox permission arrays
- **Committed in:** 57a5e41

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep.

## Issues Encountered

- External parallel work (033-02 commits) modified sessions.ts to add localStorage capture and SessionSnapshot.localStorage field. These changes were compatible and required no adjustments to Task 2.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Session capture infrastructure complete and ready for 033-02 (wire into script execution flow)
- CAPTURE_SESSION message can be sent from content script during script playback
- GET_SESSION_STATUS enables checking for existing sessions before re-authentication
- Session restore infrastructure (033-02 RESTORE_SESSION) already wired in parallel

## Self-Check: PASSED

- All 6 files verified present on disk
- Both task commits (57a5e41, 4971072) verified in git history
- TypeScript compilation: zero new errors in plan files
- sessions.ts: 246 lines (>150 min), 7.1KB (>5KB min)
- All 4 exported functions present: captureSession, getSessionStatus, clearSession, cleanupExpiredSessions
- chrome.cookies.getAll usage confirmed
- encryptApiKey usage confirmed
- browserlet_session_ prefix confirmed
- All 3 message types in messaging.ts confirmed (6 matches)

---
*Phase: 033-extension-session-persistence*
*Completed: 2026-02-16*

---
phase: 033-extension-session-persistence
plan: 02
subsystem: extension-sessions
tags:
  - session-persistence
  - cookies
  - localStorage
  - content-script
  - security
dependency_graph:
  requires:
    - entrypoints/background/sessions.ts (captureSession, CookieSnapshot, StoredSessionSnapshot types)
    - utils/crypto/encryption.ts (decryptApiKey for snapshot decryption)
    - utils/storage/browserCompat.ts (chrome.storage.local access)
  provides:
    - session-restoration (restoreSession function with chrome.cookies.set)
    - localStorage-bridge (captureLocalStorage/restoreLocalStorage from content script)
    - RESTORE_SESSION message handler (background messaging)
  affects:
    - entrypoints/background/sessions.ts (added localStorage field to SessionSnapshot)
    - entrypoints/background/messaging.ts (added RESTORE_SESSION handler)
    - entrypoints/content/index.ts (added CAPTURE/RESTORE_LOCALSTORAGE handlers)
    - utils/types.ts (added session persistence message types)
tech_stack:
  added: []
  patterns:
    - chrome.cookies.set for browser-level cookie restoration (supports HttpOnly)
    - Content script localStorage bridge for page-context storage access
    - Individual-error-tolerant restoration (cookie/localStorage failures non-fatal)
    - SameSite direct mapping to chrome.cookies.SameSiteStatus enum
    - Protocol-aware URL construction (https for Secure cookies, http otherwise)
key_files:
  created:
    - entrypoints/background/sessionRestore.ts
    - entrypoints/content/localStorageBridge.ts
  modified:
    - entrypoints/background/sessions.ts
    - entrypoints/background/messaging.ts
    - entrypoints/content/index.ts
    - utils/types.ts
decisions:
  - Use decryptApiKey (not raw key) for symmetric encryption/decryption with encryptApiKey in sessions.ts
  - Create separate sessionRestore.ts instead of adding to sessions.ts (parallel execution with 033-01)
  - localStorage field is optional in RestoredSessionSnapshot (backward compatible with snapshots without localStorage)
  - QuotaExceededError stops further localStorage restoration (prevent infinite retry on full storage)
  - Individual cookie set failures are non-fatal (graceful degradation per Pitfall 3)
metrics:
  duration_seconds: 282
  tasks_completed: 2
  files_created: 2
  files_modified: 4
  commits: 2
  completed_date: 2026-02-16
---

# Phase 33 Plan 02: Session Restoration Infrastructure Summary

**One-liner:** Cookie restoration via chrome.cookies.set with full metadata (HttpOnly, SameSite, Secure) and localStorage bridge via content script injection

## Objective

Build the session restoration infrastructure that restores cookies via chrome.cookies.set API and restores localStorage via content script injection, enabling authenticated sessions to be reused across script executions.

## What Was Built

### 1. Session Restoration Module (sessionRestore.ts)

**Core function: `restoreSession(scriptId, domain, tabId): Promise<boolean>`**

Complete session restoration flow:
1. Read encrypted snapshot from `chrome.storage.local` using composite key
2. Validate TTL expiration (delete if expired, return false)
3. Decrypt snapshot using `decryptApiKey` (symmetric with `encryptApiKey` used during capture)
4. Restore each cookie via `chrome.cookies.set` with full metadata
5. Send `RESTORE_LOCALSTORAGE` message to content script with localStorage data
6. Return `true` if restoration was attempted

**Cookie restoration handles all pitfalls from research:**

- **Pitfall 1 (HttpOnly):** Uses `chrome.cookies.set` which operates at browser level, supporting HttpOnly cookies that `document.cookie` cannot set
- **Pitfall 2 (SameSite):** Maps sameSite values directly to `chrome.cookies.SameSiteStatus` enum (`no_restriction`, `lax`, `strict`, `unspecified`)
- **Pitfall 3 (Secure flag):** Individual cookie errors are caught and logged, allowing partial restoration when Secure cookies fail on HTTP contexts
- **Pitfall 4 (TTL):** Validates snapshot age against TTL before attempting restoration

**URL construction for chrome.cookies.set:**
```typescript
// Uses https:// for Secure cookies, http:// for non-Secure
const protocol = cookie.secure ? 'https' : 'http';
const host = cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain;
return `${protocol}://${host}${cookie.path}`;
```

### 2. LocalStorage Bridge (localStorageBridge.ts)

**Two exported functions for page-context localStorage access:**

**`captureLocalStorage(): Record<string, string>`**
- Iterates all localStorage keys via `localStorage.length` + `localStorage.key(i)`
- Builds serializable key-value object
- Handles SecurityError (file://, data:, cross-origin iframes)
- Returns empty object on error (graceful degradation)

**`restoreLocalStorage(data: Record<string, string>): void`**
- Sets each key-value pair via `localStorage.setItem(key, value)`
- Individual setItem errors logged but don't abort restoration
- QuotaExceededError stops further entries (prevents infinite loop)
- SecurityError handled at outer level (access denied on protected pages)

File is 118 lines, 3.4KB (exceeds 80-line minimum requirement).

### 3. Content Script Message Handlers

**Added to `entrypoints/content/index.ts`:**

```typescript
case 'CAPTURE_LOCALSTORAGE': {
  const data = captureLocalStorage();
  return { success: true, data };
}

case 'RESTORE_LOCALSTORAGE': {
  const { data } = (message.payload as { data: Record<string, string> }) || {};
  restoreLocalStorage(data);
  return { success: true };
}
```

### 4. SessionSnapshot localStorage Integration

**Updated `sessions.ts` SessionSnapshot interface:**
```typescript
export interface SessionSnapshot {
  cookies: CookieSnapshot[];
  localStorage: Record<string, string>;  // NEW
  capturedAt: number;
  ttl: number;
}
```

**Updated `captureSession` to capture localStorage via content script:**
```typescript
let localStorageData: Record<string, string> = {};
try {
  const response = await chrome.tabs.sendMessage(tabId, {
    type: 'CAPTURE_LOCALSTORAGE',
  });
  if (response?.success && response.data) {
    localStorageData = response.data as Record<string, string>;
  }
} catch (error) {
  console.warn('[Browserlet] Could not capture localStorage:', error);
}
```

### 5. Message Type Registration

**Added to `utils/types.ts` MessageType union:**
- `RESTORE_SESSION` -- Background: restore cookies + localStorage from snapshot
- `CAPTURE_LOCALSTORAGE` -- Background -> Content: capture page localStorage
- `RESTORE_LOCALSTORAGE` -- Background -> Content: restore page localStorage

**Added RESTORE_SESSION handler in `messaging.ts`:**
- Payload: `{ scriptId, domain, tabId }`
- Calls `restoreSession()` from sessionRestore.ts
- Returns `{ success: true, data: { restored: boolean } }`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created separate sessionRestore.ts instead of extending sessions.ts**
- **Found during:** Task 1
- **Issue:** Plan specified adding restoreSession to sessions.ts, but 033-01 was creating sessions.ts concurrently. Per instructions, created a separate sessionRestore.ts to avoid merge conflicts.
- **Fix:** Created `entrypoints/background/sessionRestore.ts` with restoreSession function, imports types from sessions.ts
- **Files created:** entrypoints/background/sessionRestore.ts
- **Commit:** 372e017

**2. [Rule 1 - Bug] Fixed noUncheckedIndexedAccess error in localStorageBridge.ts**
- **Found during:** Task 2 verification
- **Issue:** `data[key]` could be `string | undefined` with `noUncheckedIndexedAccess: true` in tsconfig
- **Fix:** Added explicit undefined check before `localStorage.setItem(key, value)`
- **Files modified:** entrypoints/content/localStorageBridge.ts
- **Commit:** 7701abf

**3. [Rule 2 - Missing functionality] Used decryptApiKey instead of raw key manipulation**
- **Found during:** Task 1
- **Issue:** Initial implementation used `getOrCreateSessionKey` + `decryptWithKey`, but sessions.ts uses `encryptApiKey` which auto-selects master password key or session key. Decryption must use the symmetric `decryptApiKey`.
- **Fix:** Switched to `decryptApiKey(stored.encrypted)` for correct key selection
- **Files modified:** entrypoints/background/sessionRestore.ts
- **Commit:** 372e017

## Verification Results

All verification checks passed:

1. **TypeScript compilation:** Zero new errors in plan files (pre-existing errors in other files unrelated)
2. **File exists:** `entrypoints/content/localStorageBridge.ts` (118 lines, 3.4KB > 2KB minimum)
3. **Cookie restoration API:** `chrome.cookies.set` appears 6 times in sessionRestore.ts
4. **LocalStorage access:** `localStorage.getItem` and `localStorage.setItem` both present
5. **Message handlers:** CAPTURE_LOCALSTORAGE and RESTORE_LOCALSTORAGE in content/index.ts
6. **SessionSnapshot structure:** `localStorage: Record<string, string>` field added
7. **Export verification:** `export async function restoreSession` exists in sessionRestore.ts

## Success Criteria Met

- [x] restoreSession function exists and uses chrome.cookies.set API
- [x] Cookie restoration includes full metadata (HttpOnly, SameSite, Secure, domain, path, expiry)
- [x] LocalStorage bridge captures and restores page localStorage from content script context
- [x] Content script message handlers route CAPTURE_LOCALSTORAGE and RESTORE_LOCALSTORAGE
- [x] SessionSnapshot interface includes both cookies and localStorage fields
- [x] Error handling is graceful (individual failures don't break restoration)
- [x] Pitfalls from research addressed (HttpOnly via chrome.cookies.set, SameSite mapping, Secure flag errors)
- [x] TypeScript compilation passes with zero new errors

## Task Completion

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add restoreSession function with chrome.cookies.set API | 372e017 | entrypoints/background/sessionRestore.ts, entrypoints/background/messaging.ts, entrypoints/background/sessions.ts, utils/types.ts |
| 2 | Create localStorage bridge module in content script | 7701abf | entrypoints/content/localStorageBridge.ts, entrypoints/content/index.ts |

## Next Steps

Plan 033-03 will wire session capture/restore into the script execution flow, making sessions automatically captured after successful authentication and restored before script playback begins.

## Self-Check

Verification of created artifacts:

**Files created:**
- [x] entrypoints/background/sessionRestore.ts exists
- [x] entrypoints/content/localStorageBridge.ts exists

**Files modified:**
- [x] entrypoints/background/sessions.ts has localStorage field in SessionSnapshot
- [x] entrypoints/background/messaging.ts has RESTORE_SESSION handler
- [x] entrypoints/content/index.ts has CAPTURE_LOCALSTORAGE and RESTORE_LOCALSTORAGE handlers
- [x] utils/types.ts has session persistence message types

**Commits exist:**
- [x] 372e017: feat(033-02): add session restoration with chrome.cookies.set API
- [x] 7701abf: feat(033-02): create localStorage bridge and content script message handlers

**TypeScript compilation:**
- [x] Zero new errors in plan files

## Self-Check: PASSED

All files, commits, and compilation checks verified successfully.

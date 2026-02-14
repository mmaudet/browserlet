---
phase: 26-credential-bridge-security
plan: 03
subsystem: auth
tags: [http-bridge, one-time-tokens, bearer-auth, localhost-binding, node-http, crypto-randomBytes]

# Dependency graph
requires:
  - phase: 26-credential-bridge-security
    plan: 01
    provides: encryption module (decrypt callback pattern)
provides:
  - HTTP bridge server bound to 127.0.0.1 with one-time bearer tokens
  - BridgeClient for credential retrieval from CLI
  - createBridgeServer factory with injected getDecryptedCredential callback
  - 23 security tests covering token lifecycle, auth enforcement, binding
affects: [cli-runner, extension-cli-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [node:http createServer with 127.0.0.1 binding, crypto.randomBytes(32) hex tokens, callback injection for vault decoupling]

key-files:
  created:
    - packages/cli/src/vault/bridge.ts
    - packages/cli/src/vault/bridgeClient.ts
    - tests/cli/vault/bridge.test.ts
  modified: []

key-decisions:
  - "Map.get() + immediate delete for one-time tokens -- 256-bit entropy makes timing attacks irrelevant, timingSafeEqual unnecessary for token lookup"
  - "127.0.0.1 string literal over 'localhost' to prevent IPv6 ::1 resolution on dual-stack systems"
  - "Callback injection (getDecryptedCredential) decouples bridge from vault storage, enabling standalone and extension-backed modes"
  - "configurable expiresInMs parameter on generateToken() for testability (default 60s)"

patterns-established:
  - "Bridge server error responses NEVER include credential values or stack traces -- generic 500 { error: 'Failed to retrieve credential' }"
  - "One-time token pattern: Map.set on generate, Map.delete on first validation, expiry check after delete"
  - "Random high port (49152+) in tests to avoid CI port conflicts"

# Metrics
duration: 3min
completed: 2026-02-14
---

# Phase 26 Plan 03: HTTP Bridge Server with One-Time Token Auth Summary

**HTTP bridge server on 127.0.0.1 with one-time 256-bit bearer tokens, 60-second expiry, and bridge client for CLI credential retrieval**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-14T12:27:28Z
- **Completed:** 2026-02-14T12:30:01Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- HTTP bridge server (BridgeServer class) binding exclusively to 127.0.0.1, with one-time bearer token authentication using crypto.randomBytes(32) hex tokens
- BridgeClient class using global fetch() for credential retrieval and health checking
- 23 security tests covering: token lifecycle (generation, single-use, uniqueness), authentication enforcement (missing/empty/invalid/expired tokens), server binding verification, credential retrieval with error sanitization, health check, client integration, and routing
- All 56 CLI tests pass (15 encryption + 18 storage + 23 bridge)

## Task Commits

Each task was committed atomically:

1. **Task 1: HTTP bridge server with one-time token authentication** - `d725cb6` (feat)
2. **Task 2: Bridge security tests** - `b887fde` (test)

## Files Created/Modified
- `packages/cli/src/vault/bridge.ts` - BridgeServer class with one-time token auth, 127.0.0.1 binding, token cleanup, CORS headers, health/credential/404 routes
- `packages/cli/src/vault/bridgeClient.ts` - BridgeClient class with fetchCredential() and healthCheck() using global fetch()
- `tests/cli/vault/bridge.test.ts` - 23 security tests across 8 describe blocks (283 lines)

## Decisions Made
- Used Map.get() + immediate delete for one-time token validation. The 256-bit random token (32 bytes hex) makes brute-force timing attacks infeasible, so timingSafeEqual on the lookup is unnecessary. Defense-in-depth comes from the token being deleted before any other processing.
- Used string literal '127.0.0.1' instead of 'localhost' because 'localhost' can resolve to IPv6 ::1 on dual-stack systems, which would bypass the intent of localhost-only binding.
- Injected getDecryptedCredential callback into BridgeServer constructor rather than importing vault/encryption directly. This decouples the bridge protocol from storage implementation, allowing extension-backed and standalone modes.
- Added configurable expiresInMs parameter to generateToken() (defaults to 60000ms) to enable testing token expiry without waiting 60 real seconds.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Bridge server and client ready for integration with CLI runner (Phase 24)
- getDecryptedCredential callback pattern enables plugging in vault storage (Phase 26-02) or extension relay
- All security properties verified: localhost-only, single-use tokens, auth enforcement, no credential leaks

## Self-Check: PASSED

- FOUND: packages/cli/src/vault/bridge.ts
- FOUND: packages/cli/src/vault/bridgeClient.ts
- FOUND: tests/cli/vault/bridge.test.ts
- FOUND: 26-03-SUMMARY.md
- FOUND: d725cb6 (Task 1 commit)
- FOUND: b887fde (Task 2 commit)

---
*Phase: 26-credential-bridge-security*
*Completed: 2026-02-14*

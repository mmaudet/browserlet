# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-16)

**Core value:** Automatisation web résiliente pour applications legacy, sans coût récurrent d'IA
**Current focus:** v1.8 Session Persistence & Vault UX - Phases 33+34 (Extension + CLI Session Persistence)

## Current Position

Milestone: v1.8 Session Persistence & Vault UX
Phase: 35 of 35 (BSL Integration & Validation)
Plan: 035-01 complete. Additional plans TBD.
Status: Phase 35 in progress. BSL parser integration complete.
Last activity: 2026-02-16 — Phase 35 Plan 01 executed (BSL session_persistence parser)

Progress: [█████████████████████░░░░░░░░░░] 68%

## Performance Metrics

**Overall Velocity (v1.0-v1.7):**
- Total plans completed: 113
- Total phases completed: 32
- 8 milestones shipped
- Quick tasks completed: 2 (quick-10, quick-11)

**v1.8 Progress:**
- Total plans completed: 8 (032×2 + 033×3 + 034×2 + 035×1)
- Total phases completed: 3 (Phase 32, 33, 34)
- Coverage: 12/12 requirements mapped (100%)

**Latest Execution (035-01):**
- Duration: 181 seconds
- Tasks: 2/2 completed
- Files created: 0
- Files modified: 5 (bsl.ts, index.ts, stepParser.ts, stepParser.test.ts, parser.ts)
- Commits: 2 (bac111a, 3528810)

## Accumulated Context

### Decisions

See PROJECT.md Key Decisions table for full list.

Recent decisions for v1.8:
- Playwright storageState for CLI sessions (native JSON format, proven)
- Encrypted temp file for vault cache (secure 0600 perms, TTL-based, no daemon)
- chrome.cookies API for extension snapshots (native MV3 API, no headless browser)
- Device key is random (not password-derived) to avoid PBKDF2 overhead on cache operations (032-01)
- Cache TTL set to 15 minutes as balanced security/UX tradeoff (032-01)
- Delete-before-write pattern ensures 0600 permissions apply to cache files (032-01)
- Cache write failures are non-fatal (graceful degradation - user just prompted again next time) (032-02)
- vault lock command requires no password (cache clearing is non-destructive operation) (032-02)
- Sessions stored in env-paths data directory (persistent across reboots, not temp) (034-01)
- Reuse device key from vault for session encryption (no new key management) (034-01)
- Protocol validation is permissive for HTTP->HTTPS with warning (034-01)
- Separate sessionRestore.ts from sessions.ts for parallel plan execution (033-02)
- decryptApiKey used for session decryption (symmetric with encryptApiKey capture) (033-02)
- Individual cookie/localStorage failures are non-fatal during restoration (033-02)
- Use encryptApiKey() directly for session encryption (internal key selection) (033-01)
- cookies permission added to manifest for chrome.cookies.getAll access (033-01)
- Non-fatal capture failures to avoid breaking script execution (033-01)
- TTL metadata stored unencrypted alongside encrypted snapshot for efficient expiry checks (033-01)
- Session capture only on exitCode 0 to avoid overwriting valid sessions with partial state (034-02)
- Auto-generate sessionId for all runs for implicit capture (034-02)
- No session capture when restoring (avoid overwriting source session) (034-02)
- Added loadSessionWithMeta helper for URL access during protocol validation (034-02)
- Session integration in execution.ts store (ScriptExecutor.tsx does not exist) (033-03)
- Module-level signal for session status map for cross-component reactivity (033-03)
- Non-fatal try/catch for session restore/capture to never break execution (033-03)
- SessionPersistenceConfig validated at parse-time with enabled boolean required (035-01)
- Extension Script.sessionPersistence uses different format than ParsedScript (035-01)
- Import bridge maps enabled directly but not max_age to ttl (extension uses default) (035-01)
- Syntactic validation only for max_age string format in parser (no ms library call) (035-01)

### Pending Todos

None.

### Blockers/Concerns

None.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 10 | Ajouter les commandes vault del et vault reset | 2026-02-16 | 58d04e4 | [10-ajouter-les-commandes-vault-del-et-vault](./quick/10-ajouter-les-commandes-vault-del-et-vault/) |
| 11 | Ajouter un délai de 2s avant le screenshot | 2026-02-16 | eab43f3 | [11-ajouter-un-d-lai-de-2s-avant-le-screensh](./quick/11-ajouter-un-d-lai-de-2s-avant-le-screensh/) |

## Session Continuity

Last session: 2026-02-16
Stopped at: Completed 035-01-PLAN.md (BSL session_persistence parser integration)
Resume with: Continue Phase 35 if additional BSL integration plans exist, or move to next phase/milestone

---
*Created: 2026-02-14*
*Last updated: 2026-02-16 after completing 035-01-PLAN.md tasks 1-2*

# Project Research Summary

**Project:** v1.8 Session Persistence & Vault Caching
**Domain:** Browser automation state management with secure credential handling
**Researched:** 2026-02-16
**Confidence:** HIGH

## Executive Summary

v1.8 adds session persistence (cookies + localStorage snapshots) and vault unlock caching to reduce authentication friction in browser automation workflows. Research shows this is a **zero-dependency enhancement** — all capabilities exist in the current stack via native Chrome APIs (chrome.cookies, chrome.storage.session), Playwright's storageState API, and Node.js crypto/fs modules. The architecture requires dual implementation patterns: extension uses chrome.storage.local + content script injection for localStorage access, CLI uses Playwright's storageState with encrypted file persistence.

The recommended approach leverages existing vault encryption (AES-GCM 256-bit, PBKDF2 600k) for session snapshots, making security a solved problem rather than a new risk. Critical finding: session snapshots MUST have TTL validation (72hr max) and automatic expiry detection via existing `session_check` mechanisms to prevent silent failures from stale server-side sessions. The vault cache implementation differs by platform (extension: chrome.storage.session in-memory, CLI: encrypted temp files with 0600 permissions) but shares 15-minute TTL matching industry standards.

Key risk mitigation: HttpOnly cookie handling requires platform-specific APIs (chrome.cookies.set for extension, context.addCookies for CLI), SameSite restrictions require domain validation before restoration, and Secure flag enforcement requires HTTPS-only restoration. All pitfalls have concrete prevention strategies mapped to implementation phases.

## Key Findings

### Recommended Stack

**Zero new production dependencies required.** All session persistence and vault caching capabilities are provided by existing technologies:

**Core technologies:**
- **chrome.cookies API (Manifest V3)**: Capture/restore HTTP cookies with HttpOnly access — already permitted via WXT '<all_urls>' host permissions
- **Playwright storageState API (1.58.2)**: CLI cookie + localStorage persistence — native Playwright feature, no version upgrade needed
- **Web Crypto API (Node 18+)**: AES-GCM encryption for session snapshots and vault cache — reuses existing `packages/cli/src/vault/encryption.ts` module
- **env-paths (3.0.0)**: Platform-specific cache/data directories — already used for vault.json, reuse for session files
- **chrome.storage.session (MV3)**: Extension vault cache with automatic browser-close cleanup — native API, no additional permissions

**Optional dev dependency:**
- **@types/tmp (0.2.6)**: TypeScript types for temp file cleanup patterns (reference only, actual implementation uses native fs APIs)

### Expected Features

Research identified clear table stakes vs differentiators in the session management domain.

**Must have (table stakes):**
- Cookie persistence across runs — standard in Playwright/Puppeteer, users expect this
- localStorage capture — bundled with cookie management in modern tools, critical for SPAs
- TTL validation on restore — security best practice, sessions expire server-side
- Master password timeout (15-30min) — all password managers have this, matches existing extension behavior

**Should have (competitive advantage):**
- Automatic session expiry detection — use existing `session_check` mechanism to detect stale sessions
- Encrypted session snapshots — leverage existing vault encryption (Playwright/Puppeteer store plaintext)
- Multi-level fallback strategy — try restore → validate → re-auth automatically (competitors require manual retry)
- BSL declaration for session_persistence — makes behavior explicit per script

**Defer (v2+):**
- Session snapshot metadata tracking — adds list/inspect commands, triggered when users ask "what sessions do I have?"
- Configurable vault unlock cache TTL — triggered when teams have different security policies
- Session snapshot sync to server — complex multi-user sync, encryption key management, defer until PMF

### Architecture Approach

Dual-environment implementation: extension uses chrome APIs + content script injection, CLI uses Playwright storageState with encrypted file persistence.

**Major components:**
1. **SessionManager (Extension)** — Coordinate capture/restore, delegate to SessionStorage + LocalStorageBridge content script
2. **CLISessionManager (CLI)** — Wrapper around Playwright storageState API with encryption via existing vault module
3. **VaultCache (Shared)** — TTL-based CryptoKey caching: extension uses chrome.storage.session, CLI uses encrypted temp files (0600 permissions)
4. **SessionStorage (Extension)** — chrome.cookies API + chrome.storage.local for encrypted snapshots
5. **SessionPersistence (CLI)** — Encrypt/decrypt Playwright storageState JSON to `~/.browserlet/sessions/` with TTL validation

**Integration points:**
- Modify ScriptExecutor (extension) and BSLRunner (CLI) to call sessionManager before/after auth
- Add `session_persistence: boolean` to BSL SessionCheckConfig type
- Add background message handlers: CAPTURE_SESSION, RESTORE_SESSION, CLEAR_SESSION
- Reuse existing vault encryption module (no new crypto code)

### Critical Pitfalls

1. **HttpOnly Cookie Serialization Asymmetry** — Extension can capture HttpOnly cookies via chrome.cookies.getAll(), but must restore via chrome.cookies.set() (not document.cookie). CLI must use context.addCookies() (not page.evaluate). Using wrong API causes silent session token loss. **Prevention:** Use platform-specific privileged APIs, validate cookie count before/after restoration.

2. **SameSite Cookie Restoration Breaks Cross-Site Navigation** — Cookies saved with SameSite=Lax (Chrome default since 2020) are dropped when navigating to different subdomains. **Prevention:** Capture full cookie metadata including sameSite attribute, validate target URL matches cookie domain before restoration.

3. **Secure-Flag Cookie Rejection on HTTP** — Session snapshots from production (HTTPS) include Secure cookies that browser silently rejects when restoring to http://localhost. **Prevention:** Detect protocol mismatch, provide --allow-insecure-cookies flag with warning, or require HTTPS via ngrok/cloudflared tunnel.

4. **Session Cookie Expiry Ambiguity** — Session cookies (no explicit expiry) appear "valid" in snapshot but server may have invalidated them (15-30min timeout). **Prevention:** Add capturedAt timestamp to snapshot, enforce 15-minute max age, run session_check validation after restore.

5. **Vault Unlock Cache Temp File World-Readable** — Node.js default umask creates 0644 files, exposing encrypted cache to local attackers. **Prevention:** Set mode: 0o600 on writeFile(), validate permissions after creation.

## Implications for Roadmap

Based on research, suggested phase structure follows dependency order: vault cache first (needed by both platforms), then parallel extension/CLI session persistence, finally integration.

### Phase 1: Vault Cache Foundation
**Rationale:** Session persistence requires vault unlock to encrypt/decrypt snapshots. Vault cache reduces password prompts. Must be implemented first as both extension and CLI session persistence depend on it.
**Delivers:** VaultCache module (shared), 15-minute TTL, JWK serialization pattern
**Addresses:** Must-have feature (master password timeout), prevents repeated prompts during batch execution
**Avoids:** Pitfall #5 (temp file permissions) via explicit 0600 mode, Pitfall #7 (CryptoKey memory leak) via auto-lock timeout
**Research flag:** STANDARD PATTERN — Web Crypto JWK export/import is well-documented, chrome.storage.session has clear examples

### Phase 2: Extension Session Persistence
**Rationale:** Extension is the primary user interface, session persistence here validates the encryption/TTL patterns before CLI implementation.
**Delivers:** SessionManager, SessionStorage, LocalStorageBridge (content script), background message handlers
**Uses:** chrome.cookies API (getAll/set), chrome.storage.local, existing vault encryption module
**Implements:** Architecture components 1 + 4, BSL session_persistence config parsing
**Avoids:** Pitfall #1 (HttpOnly asymmetry) via chrome.cookies.set (not document.cookie), Pitfall #2 (SameSite) via domain validation
**Research flag:** NEEDS RESEARCH — Content script message passing patterns for localStorage access (security validation, error handling)

### Phase 3: CLI Session Persistence
**Rationale:** CLI is independent of extension, can be implemented in parallel with Phase 2 once Phase 1 complete.
**Delivers:** CLISessionManager, SessionPersistence, Playwright storageState integration, encrypted file storage
**Uses:** Playwright storageState API, env-paths for session directory, existing vault encryption
**Implements:** Architecture components 2 + 5, --session-restore CLI flag
**Avoids:** Pitfall #1 (HttpOnly) via context.addCookies(), Pitfall #3 (Secure flag) via protocol detection, Pitfall #4 (TTL) via timestamp validation
**Research flag:** STANDARD PATTERN — Playwright storageState is well-documented with BrowserStack guides

### Phase 4: BSL Integration
**Rationale:** Both extension and CLI session persistence must be complete before adding BSL parser integration.
**Delivers:** session_persistence field in SessionCheckConfig, parser tests, auto-enable based on BSL declaration
**Addresses:** Should-have feature (BSL declaration makes behavior explicit per script)
**Implements:** Modify @browserlet/core types, update parser validation
**Research flag:** STANDARD PATTERN — TypeScript interface extension, existing parser already handles session_check

### Phase 5: TTL & Staleness Detection
**Rationale:** Session snapshots without TTL validation cause silent failures. Must detect expired sessions and trigger re-auth.
**Delivers:** Multi-level fallback strategy (restore → session_check → re-auth), configurable max snapshot age
**Addresses:** Must-have feature (TTL validation), should-have feature (automatic session expiry detection)
**Implements:** Integration with existing session_check mechanism (logged_in_indicator, session_expired_indicator)
**Avoids:** Pitfall #4 (session cookie expiry ambiguity) via timestamp checks and session_check validation
**Research flag:** NEEDS RESEARCH — Interaction between session restoration and existing auth flow (race conditions, fallback order)

### Phase 6: Cleanup & Maintenance
**Rationale:** Storage quota management and user control over sessions. Can be deferred to later iterations if time-constrained.
**Delivers:** Storage quota monitoring, FIFO eviction, manual cleanup commands (browserlet sessions clean)
**Addresses:** Defer feature (session snapshot metadata tracking), UX improvements
**Avoids:** Performance trap (extension crashes with 100+ snapshots) via lazy loading
**Research flag:** STANDARD PATTERN — chrome.storage quota APIs documented, standard FIFO eviction

### Phase Ordering Rationale

- **Phase 1 first (Vault Cache):** Both extension and CLI session persistence require vault unlock for encryption. Must be implemented before either platform's session persistence.
- **Phases 2-3 parallel (Extension + CLI):** Session persistence implementations are independent after Phase 1. Can be developed concurrently by different developers.
- **Phase 4 after 2-3 (BSL Integration):** Parser integration requires both platforms complete to validate behavior is consistent.
- **Phase 5 after 4 (TTL Detection):** Depends on session restoration working, integrates with existing auth flow which could have complex interactions.
- **Phase 6 last (Cleanup):** Nice-to-have features, not required for MVP validation.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Extension Session Persistence):** Content script security (message sender validation, localStorage injection timing), chrome.storage.local quota handling when approaching limits
- **Phase 5 (TTL & Staleness Detection):** Race conditions between session restoration and auth flow execution, fallback strategy edge cases

Phases with standard patterns (skip research-phase):
- **Phase 1 (Vault Cache):** Web Crypto JWK export/import pattern well-documented, chrome.storage.session examples available
- **Phase 3 (CLI Session Persistence):** Playwright storageState API has comprehensive docs, BrowserStack guides cover edge cases
- **Phase 4 (BSL Integration):** TypeScript interface extension is standard, existing parser provides pattern
- **Phase 6 (Cleanup):** chrome.storage quota management and FIFO eviction are solved problems

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All required APIs verified in official docs or existing codebase. Zero new dependencies. |
| Features | HIGH | Clear table stakes vs differentiators based on Playwright/Puppeteer patterns and OWASP standards. |
| Architecture | HIGH | Integration points identified in existing codebase. Dual-platform pattern follows Browserlet's established extension/CLI separation. |
| Pitfalls | HIGH | All pitfalls have concrete examples from GitHub issues, official docs, or security guidelines. Prevention strategies tested in wild. |

**Overall confidence:** HIGH

### Gaps to Address

**Session restoration sequencing:** Research shows cookie restoration before navigation is correct, but interaction with existing auth flow execution order needs validation during Phase 5 implementation. Specifically: when session_check runs AFTER restoration but BEFORE auth, does it correctly detect restored vs fresh sessions?

**Extension service worker restart handling:** chrome.storage.session clears on browser restart but unclear if it also clears on service worker restart (which happens frequently in MV3). If it does, vault cache will be cleared more often than intended. Validate behavior during Phase 1 implementation.

**Playwright context lifecycle with storageState:** Research confirms context.addCookies() works but unclear if subsequent context.storageState() call includes those cookies or only cookies set via navigation. CLI implementation (Phase 3) must validate that captured state includes both restored and newly-acquired cookies.

**BSL session_persistence scope:** Research assumes session_persistence is per-script boolean, but unclear if it should support per-target_app isolation (different sessions for different domains within same script). Defer to Phase 4 BSL design, can add later if needed.

## Sources

### Primary (HIGH confidence)
- [Chrome Cookies API | Chrome for Developers](https://developer.chrome.com/docs/extensions/reference/api/cookies) — Manifest V3 cookie access with host permissions, HttpOnly support
- [Playwright BrowserContext API](https://playwright.dev/docs/api/class-browsercontext) — storageState() capture/restore, addCookies() API
- [BrowserStack Playwright Storage State Guide](https://www.browserstack.com/guide/playwright-storage-state) — storageState usage patterns and edge cases
- [Web Crypto API - SubtleCrypto exportKey](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/exportKey) — JWK serialization for CryptoKey caching
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) — Session timeout recommendations (15-30 minutes)
- [env-paths npm package](https://www.npmjs.com/package/env-paths) — Platform-specific cache/data directories
- Existing codebase: `packages/cli/src/vault/encryption.ts` (AES-GCM implementation), `packages/core/dist/types/bsl.d.ts` (SessionCheckConfig type)

### Secondary (MEDIUM confidence)
- [Mastering Persistent Sessions in Playwright | Medium](https://medium.com/@Gayathri_krish/mastering-persistent-sessions-in-playwright-keep-your-logins-alive-8e4e0fd52751) — Session cookie TTL ambiguity, stale server-side sessions
- [SameSite FAQ | Chromium](https://www.chromium.org/updates/same-site/faq/) — SameSite=Lax default behavior, cross-site restrictions
- [Secure Tempfiles in Node.js | Advanced Web Machinery](https://advancedweb.hu/secure-tempfiles-in-nodejs-without-dependencies/) — File permissions (0600) and cleanup strategies
- [VMware Snapshot Best Practices | Broadcom](https://knowledge.broadcom.com/external/article/318825/best-practices-for-using-vmware-snapshot.html) — 72-hour max snapshot age recommendation
- [Zoho Vault Browser Extension](https://www.zoho.com/vault/features/password-manager-browser-extension.html) — 8-hour auto-lock timeout (industry reference)

### Tertiary (LOW confidence)
- [Race condition with cookie altering requests | next-auth Issue #8897](https://github.com/nextauthjs/next-auth/issues/8897) — Cookie restoration race conditions (framework-specific, may not apply to Playwright)
- [Chrome Extensions Leak API Keys | CyberMaterial](https://cybermaterial.com/chrome-extensions-leak-data-and-api-keys/) — Extension security risks (general, not session-specific)

---
*Research completed: 2026-02-16*
*Ready for roadmap: yes*

# Browserlet Development Roadmap

**Last updated:** 2026-02-16

---

## Milestones

- ✅ **v1.0 MVP** — Phases 1-6 (shipped 2026-01-31)
- ✅ **v1.1 Security & Stability** — Phases 7-10 (shipped 2026-01-31)
- ✅ **v1.2 Persistent Credentials** — Phases 11-12 (shipped 2026-02-01)
- ✅ **v1.3 UX Sidepanel** — Phase 13 (shipped 2026-02-01)
- ✅ **v1.4 Data Extraction & Screenshots** — Phases 14-16 (shipped 2026-02-12)
- ✅ **v1.5 Resolver Redesign & Firefox** — Phases 17-22 (shipped 2026-02-13)
- ✅ **v1.6 CLI Runner & Automated Testing** — Phases 23-26 (shipped 2026-02-14)
- ✅ **v1.7 CLI Completion & Batch Testing** — Phases 27-31 (shipped 2026-02-15) → [archive](milestones/v1.7-ROADMAP.md)
- 🚧 **v1.8 Session Persistence & Vault UX** — Phases 32-35 (in progress)

---

## 🚧 v1.8 Session Persistence & Vault UX (In Progress)

**Milestone Goal:** Add session persistence (cookies + localStorage snapshots) for extension and CLI to eliminate repeated authentication in automation workflows, plus vault unlock caching to reduce password prompts during batch execution.

**Overview:** The roadmap follows dependency-driven structure starting from vault unlock caching (phase 32) which enables encrypted session snapshots for both platforms. Extension uses chrome.cookies API with content script localStorage injection (phase 33), CLI uses Playwright storageState with encrypted file persistence (phase 34), and BSL integration exposes session_persistence declarations (phase 35).

## Phases

**Phase Numbering:**
- Integer phases (32, 33, 34, 35): Planned milestone work
- Decimal phases (32.1, 32.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 32: Vault Unlock Cache** - CLI caches derived key for 15 minutes to avoid repeated master password prompts (completed 2026-02-16)
- [ ] **Phase 33: Extension Session Persistence** - Capture/restore cookies and localStorage via chrome.cookies API and content scripts
- [ ] **Phase 34: CLI Session Persistence** - Capture/restore session state via Playwright storageState with encrypted file storage
- [ ] **Phase 35: BSL Integration & Validation** - session_persistence BSL declaration, parser validation, auto-capture after successful runs

## Phase Details

### Phase 32: Vault Unlock Cache
**Goal**: CLI users unlock vault once and run multiple commands without repeated master password prompts for 15 minutes
**Depends on**: Nothing (first phase of v1.8)
**Requirements**: VULT-01, VULT-02, VULT-03
**Success Criteria** (what must be TRUE):
  1. User runs `browserlet run` with vault credentials and is prompted for master password only once
  2. User runs second `browserlet run` within 15 minutes and is NOT prompted for master password
  3. User runs `browserlet run` after 15 minutes and IS prompted for master password again
  4. User runs `browserlet vault lock` and immediately triggered master password prompt on next vault access
  5. Vault cache file has 0600 permissions (owner read/write only) preventing local privilege escalation
**Plans:** 2 plans

Plans:
- [ ] 032-01-PLAN.md -- Vault cache module with encrypted key storage and device key infrastructure
- [ ] 032-02-PLAN.md -- CLI integration (run/test cache-aware unlock, vault lock command, startup cleanup)

### Phase 33: Extension Session Persistence
**Goal**: Extension users capture session cookies and localStorage after successful authentication, restore them before script execution to skip re-authentication
**Depends on**: Phase 32 (vault encryption for session snapshots)
**Requirements**: SEXT-01, SEXT-02, SEXT-03
**Success Criteria** (what must be TRUE):
  1. User runs script with successful authentication, then closes browser
  2. User reopens browser, runs same script, and is NOT prompted to log in again
  3. Extension captures all cookie metadata (HttpOnly, SameSite, Secure, domain, path, expiry) during snapshot
  4. User views session snapshot in chrome.storage.local and sees encrypted blob (not plaintext cookies)
**Plans**: TBD

Plans:
- [ ] 33-01: TBD
- [ ] 33-02: TBD

### Phase 34: CLI Session Persistence
**Goal**: CLI users capture session state (cookies + localStorage) after script execution and restore before subsequent runs via --session-restore flag
**Depends on**: Phase 32 (vault encryption for session files)
**Requirements**: SCLI-01, SCLI-02, SCLI-03
**Success Criteria** (what must be TRUE):
  1. User runs `browserlet run script.bsl` with successful authentication
  2. User runs `browserlet run script.bsl --session-restore` and is NOT prompted to log in again
  3. Session state files are stored in platform-specific directory (~/.browserlet/sessions/ on macOS/Linux, %APPDATA%/browserlet/sessions/ on Windows)
  4. User views session file and sees encrypted JSON (not plaintext cookies)
  5. CLI validates protocol match (HTTPS session cannot restore to HTTP) and warns user
**Plans**: TBD

Plans:
- [ ] 34-01: TBD
- [ ] 34-02: TBD

### Phase 35: BSL Integration & Validation
**Goal**: Users declare session_persistence in BSL metadata block to control auto-capture behavior per script
**Depends on**: Phase 33 (extension session persistence), Phase 34 (CLI session persistence)
**Requirements**: BSL-01, BSL-02, BSL-03
**Success Criteria** (what must be TRUE):
  1. User writes BSL script with `session_persistence: {enabled: true, max_age: 72h, snapshot_id: "myapp"}` and BSL parser validates syntax without errors
  2. User runs script with session_persistence enabled, and session snapshot is automatically captured after successful execution (no manual command)
  3. User runs same script second time, and session is automatically restored before first step (no manual --session-restore flag)
  4. User runs script with session_persistence disabled, and NO session snapshot is captured or restored
**Plans**: TBD

Plans:
- [ ] 35-01: TBD
- [ ] 35-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 32 → 33 → 34 → 35

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 32. Vault Unlock Cache | 2/2 | Complete | 2026-02-16 |
| 33. Extension Session Persistence | 0/0 | Not started | - |
| 34. CLI Session Persistence | 0/0 | Not started | - |
| 35. BSL Integration & Validation | 0/0 | Not started | - |

---
*Roadmap created: 2026-02-16*

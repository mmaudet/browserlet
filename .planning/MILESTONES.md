# Project Milestones: Browserlet

## v1.7 CLI Completion & Batch Testing (Shipped: 2026-02-15)

**Delivered:** Full CLI feature parity with extension (credentials, LLM micro-prompts), batch test runner for CI/CD, AI auto-repair on step failures, and comprehensive documentation with real-world E2E validation.

**Phases completed:** 27-31 (9 plans total)

**Key accomplishments:**

- Credential wiring: `--vault` flag with `{{credential:alias}}` resolution and master password prompt
- LLM micro-prompt bridge: Claude/Ollama via `page.exposeFunction` for cascade resolver stages 3-5
- Batch test runner: `browserlet test <dir>` with `--workers N` parallel execution and `--bail` flag
- AI auto-repair: `--auto-repair` and `--interactive` flags with hint_repairer micro-prompt and BSL file update
- CLI documentation: 705-line README with command reference, migration guide, troubleshooting + 14 BSL examples
- Vault management: `vault init`, `vault add`, `vault list`, `vault import-from-extension` commands
- Real-world E2E hardening: Unicode char stripping, type fallback for wrapper divs, resolver cascade improvements

**Stats:**

- ~37,000 lines of TypeScript (up from ~35,000)
- 5 phases, 9 plans
- 2 days (2026-02-14 → 2026-02-15)
- 59 files changed, +5,924 / -239 lines
- 38 commits

**Git range:** `49de711` → `dd7dfd4`

**What's next:** v1.8 with script version control, scheduling, and advanced reporting

---

## v1.6 CLI Runner & Automated Testing (Shipped: 2026-02-14)

**Delivered:** CLI tool (`browserlet run`) executing BSL scripts via Playwright with cascade semantic resolver, failure screenshots, and secure credential vault with extension bridge.

**Phases completed:** 23-26 (11 plans total)

**Key accomplishments:**

- Monorepo with @browserlet/core shared package (types, parser, prompts, substitution) usable by extension and CLI
- CLI runner: `browserlet run script.bsl` with Playwright headless/headed, --timeout, --output-dir flags
- Cascade semantic resolver injected via esbuild IIFE bundle (43KB) into page.evaluate() with SimpleResolver fallback
- Screenshot-on-failure capturing PNG to output directory with step-specific filenames
- Colored terminal reporting with ora spinners, pass/fail per step with duration
- Local credential vault (AES-GCM, PBKDF2 600k) with CLIPasswordStorage adapter
- HTTP bridge server (127.0.0.1, one-time bearer tokens) for extension-CLI credential sharing
- Credential sanitizer ensuring zero plaintext exposure in logs

**Stats:**

- ~35,000 lines of TypeScript (up from ~28,000)
- 4 phases, 11 plans
- 1 day (2026-02-14)
- 76 files changed, +7,002 / -1,135 lines
- 428 tests passing (326 extension + 102 CLI)

**Git range:** `f7ac80a` → `c0c738c`

**What's next:** v1.7 with credential wiring, batch testing, AI auto-repair

---

## v1.4 Self-Healing & Data Extraction (Shipped: 2026-02-12)

**Delivered:** Data extraction with locale-aware transforms, self-healing selectors with LLM-assisted repair, and screenshot capture for debugging and documentation.

**Phases completed:** 14-16 (12 plans total)

**Key accomplishments:**

- Data extraction engine with 7 locale-aware transforms and `extract:`/`table_extract:` BSL actions
- Variable substitution via `{{extracted.name}}` syntax for multi-step workflows
- AI-assisted extraction suggestions during recording with LLM page analysis
- Self-healing selectors with detect/propose/test/approve workflow (0.7 confidence threshold)
- Healing audit trail with undo capability and per-script history (100 records cap)
- Screenshot capture (PNG lossless) with auto-capture on failure, FIFO (20/script), 7-day cleanup
- Screenshot gallery with thumbnail grid, full-size modal, and ZIP export with manifest
- JSON/CSV data export with locale-aware delimiter detection

**Stats:**

- 27,736 lines of TypeScript (up from 19,216)
- 3 phases, 12 plans
- 2 days (2026-02-01 -> 2026-02-02)
- 50 files changed, +7,303 lines

**Git range:** `3f9fff9` -> `19057b0`

**What's next:** User testing on real legacy ERPs, v1.5 planning

---

## v1.3 UX Sidepanel Refactoring (Shipped: 2026-02-01)

**Delivered:** Simplified sidepanel layout with context-first design, bottom action bar, and per-script execution history.

**Phases completed:** 13 (3 plans total)

**Key accomplishments:**

- Layout restructured: context zone at top, scripts as main view, bottom action bar
- Header branding removed for more content space
- BottomActionBar with Record, Credentials, Settings buttons
- Import button relocated to ScriptList toolbar (compact icon)
- ScriptHistoryModal for per-script execution history access
- Router cleaned: removed 'execution' view type

**Stats:**

- 19,216 lines of TypeScript (up from 18,239)
- 1 phase, 3 plans
- 1 day (2026-02-01)

**What's next:** User testing, potential v1.4 with dark mode and keyboard shortcuts

---

## v1.2 Persistent Credentials (Shipped: 2026-02-01)

**Delivered:** Master password encryption for credential persistence across browser restarts with PBKDF2 key derivation.

**Phases completed:** 11-12 (5 plans total)

**Key accomplishments:**

- Master password system with PBKDF2 key derivation (600k iterations, SHA-256)
- Persistent credential encryption that survives browser restart
- Vault unlock/setup flow with French translations
- Credential migration from session-based to master-password encryption
- Onboarding UX forcing master password creation on first install
- Extension branding with {B} icon

**Stats:**

- 18,239 lines of TypeScript (up from 12,603)
- 2 phases, 5 plans + 7 additional UAT fixes
- 2 days (2026-01-31 → 2026-02-01)

**What's next:** User testing validation, potential v1.3 with self-healing selectors

---

## v1.1 Security & Stability (Shipped: 2026-01-31)

**Delivered:** Secure password management and stable Preact-based UI framework.

**Phases completed:** 7-10 (16 plans total)

**Key accomplishments:**

- Preact migration (VanJS removed, predictable state management)
- SPA-aware password field detection with MutationObserver
- AES-GCM 256-bit encrypted credential storage
- `{{credential:name}}` substitution syntax in BSL
- Vault auto-lock after 15 minutes inactivity
- Credential Manager UI with CRUD and usage tracking

**Stats:**

- 4 phases, 16 plans
- 1 day (2026-01-31)

---

## v1.0 MVP (Shipped: 2026-01-31)

**Delivered:** Complete Chrome extension for semantic web automation with recording, playback, LLM integration, and contextual triggers.

**Phases completed:** 1-6 (33 plans total)

**Key accomplishments:**

- Chrome extension (Manifest V3) with WXT framework and service worker architecture
- Recording system capturing clicks, inputs, navigation with 10 semantic hint types
- Professional Side Panel UI with Monaco Editor, script management, i18n (FR/EN)
- Deterministic BSL playback with weighted semantic resolver (0.7 confidence threshold)
- LLM integration (Claude API + Ollama) with encrypted API key storage
- Contextual triggers with suggest mode (badge + suggestions) and auto-execute (in-page notifications)

**Stats:**

- 161 files created/modified
- 12,603 lines of TypeScript
- 6 phases, 33 plans
- 3 days from start to ship (2026-01-29 → 2026-01-31)

**Git range:** `d8bcd1d` → `1bcddd9`

**What's next:** User testing on real legacy ERPs, potential v1.1 with self-healing selectors

---


## v1.5 Resolver Redesign & Firefox (Shipped: 2026-02-13)

**Delivered:** Deterministic-first cascade resolver replacing monolithic LLM prompt, micro-prompts for edge cases, enriched recording with structural DOM context, and Firefox MV3 cross-browser support.

**Phases completed:** 17-22 (14 plans total)

**Key accomplishments:**

- Deleted all self-healing code (6 files, 3,228 lines removed) + storage migration for existing users
- Cascade resolver architecture: 3-stage deterministic-first resolution (80%+ without LLM)
- 3 micro-prompts (<600 tokens each) replacing monolithic 5,000-token prompt (88-92% cost reduction)
- 13 semantic hint types with structural DOM context (fieldset, label, proximity)
- HintStabilityTracker for per-site hint reliability with +0.2 confidence boost
- Firefox MV3 cross-browser support with GitHub Actions CI for dual-browser builds

**Stats:**

- ~28,000 lines of TypeScript
- 6 phases, 14 plans
- 2 days (2026-02-12 → 2026-02-13)
- 57 files changed, +6,012 / -3,331 lines
- 25 commits

**Git range:** `0e97080` → `5609830`

**What's next:** v1.6 CLI Runner & Automated Testing

---


## v1.8 Session Persistence & Vault UX (Shipped: 2026-02-19)

**Delivered:** Session persistence (cookies + localStorage snapshots) for extension and CLI to eliminate repeated authentication, vault unlock caching for batch execution, and BSL `session_persistence` declaration for per-script auto-capture/restore.

**Phases completed:** 32-35 (9 plans total)

**Key accomplishments:**

- Vault unlock cache: encrypted temp file with device key, 15min TTL, 0600 permissions, `vault lock`/`vault del`/`vault reset` commands
- Extension session capture: chrome.cookies API snapshot with encrypted chrome.storage.local persistence and TTL metadata
- Extension session restore: chrome.cookies.set API restoration with localStorage bridge via content script injection
- Session persistence UI: per-script "Memoriser la connexion" checkbox, status badges, session management in execution flow
- CLI session storage: Playwright storageState encrypted snapshots in platform-specific data directory (env-paths)
- CLI session integration: `--session-restore` flag with protocol validation, auto-capture on exit code 0
- BSL `session_persistence` declaration: parser validation (enabled, max_age, snapshot_id), auto-capture/restore without manual flags

**Stats:**

- ~38,800 lines of TypeScript (up from ~37,000)
- 4 phases, 9 plans
- 1 day (2026-02-16)
- 40 files changed, +5,396 / -68 lines
- 444 tests passing (342 extension + 102 CLI)

**Git range:** `08ffdc3` → `bbcdf18`

**What's next:** v1.9 with script version control, scheduling, JUnit XML reporting

---


## v1.9 Reliability & Diagnostics (Shipped: 2026-02-20)

**Delivered:** Pipeline reliability improvements achieving >90% first-try success rate with enriched recording (15 hint types), layout-aware generation, structured failure diagnostics, and in-browser repair workflow.

**Phases completed:** 36-40 (9 plans total)

**Key accomplishments:**

- Recording enrichment: `landmark_context` (14th) and `position_context` (15th) hint types, SPA framework detection (React/Vue/Angular), expanded Vue/Angular artifact filtering
- Generation quality: hint preservation audit catching silent LLM hint loss, weight-sorted hints in prompts, layout-aware generation (legacy-table vs SPA-component vs generic)
- Post-generation validation: DOMSnapshot comparison catches LLM-invented hints before script execution
- Failure diagnostics: per-candidate scoring matrix, confidence gap reporting, deterministic fix suggestions, `--diagnostic-json` for CLI automation
- Repair workflow: DiagnosticRepairPanel overlay in sidepanel, DOM hint suggester scanning live page for alternatives (no LLM), repair audit trail in chrome.storage.local
- Pipeline validation: OBM legacy + TodoMVC SPA validation scripts; discovered and fixed MutationObserver null-body bug during SSO redirects

**Stats:**

- ~40,000 lines of TypeScript (up from ~38,800)
- 5 phases, 9 plans
- 1 day (2026-02-20)
- 51 files changed, +5,309 / -143 lines
- 29 commits
- 524 tests passing (up from 444)

**Git range:** `1789005` → `cef1691`

**What's next:** v2.0 with JUnit reporting, scheduling, script version control

---


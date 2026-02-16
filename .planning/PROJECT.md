# Browserlet

## What This Is

Browserlet est une extension Chrome/Firefox et un outil CLI qui permettent d'automatiser des interactions avec des applications web legacy (sans API) de manière déterministe, résiliente et maintenable. Contrairement aux solutions full-IA qui consomment des tokens à chaque exécution, Browserlet utilise l'IA uniquement en phase de création pour générer des scripts d'automatisation dans un méta-langage sémantique (BSL). L'exécution est ensuite 100% déterministe, rapide et sans coût récurrent. Le CLI (`browserlet run`) permet d'exécuter les scripts via Playwright en dehors du navigateur, pour l'intégration CI/CD.

## Core Value

**Automatisation web résiliente pour applications legacy, sans coût récurrent d'IA** — Les sélecteurs sémantiques ciblent l'intention ("le bouton de validation") plutôt que la structure DOM fragile (`#btn-submit-x7`), rendant les scripts maintenables quand l'UI évolue.

## Current Milestone: v1.8 Session Persistence & Vault UX

**Goal:** Ajouter la persistance de session entre exécutions (extension + CLI) et améliorer l'UX du vault CLI avec un cache de déverrouillage.

**Target features:**
- Session snapshot capture/restore (cookies + localStorage) dans l'extension via chrome.cookies API
- Session persistence CLI via Playwright storageState natif
- Déclaration BSL `auth.session_persistence` (capture, ttl, on_invalid, encryption)
- Validation de session avec TTL configurable et fallback automatique
- Vault unlock cache CLI — fichier temp chiffré avec TTL 15min par défaut

## Current State (v1.7 Shipped)

**Shipped:** 2026-02-15
**Codebase:** ~37,000 LOC TypeScript
**Tech Stack:** WXT, Preact, Monaco Editor, Chrome/Firefox Manifest V3, Playwright, Commander.js, esbuild
**Tests:** 428 (326 extension + 102 CLI)

**What's Working:**
- Recording with 13 semantic hint types (10 original + 3 structural context)
- BSL playback with cascade resolver (deterministic-first + micro-prompts)
- LLM integration (Claude API + Ollama + OpenAI Compatible) with encrypted keys
- Contextual triggers (suggest + auto-execute modes)
- Side Panel UI with i18n (FR/EN)
- Cross-page navigation support
- Secure credential storage with master password (PBKDF2 600k iterations)
- Credentials persist across browser restarts
- Vault auto-lock after 15 minutes inactivity
- Streamlined sidepanel layout (context at top, bottom action bar)
- Per-script execution history with modal access
- Data extraction with `extract:` and `table_extract:` BSL actions
- 7 locale-aware transforms (trim, lowercase, uppercase, parse_currency, parse_date, parse_number, extract_number)
- Variable substitution via `{{extracted.name}}` syntax
- AI-assisted extraction suggestions during recording
- JSON/CSV data export with locale-aware delimiter
- Screenshot capture (PNG lossless) with `screenshot:` BSL action
- Auto-screenshot on step failure
- Screenshot gallery with ZIP export
- Firefox MV3 cross-browser support
- CSS Module hashed class filtering in recording hints
- **CLI runner:** `browserlet run script.bsl` via Playwright (headless/headed, --timeout, --output-dir)
- **Cascade resolver in CLI:** 44KB esbuild IIFE bundle injected via page.evaluate() with SimpleResolver fallback
- **CLI credential vault:** AES-GCM encrypted local vault with CLIPasswordStorage adapter, vault import from extension
- **HTTP credential bridge:** localhost-only server with one-time bearer tokens for extension-CLI communication
- **Credential sanitizer:** zero plaintext exposure in logs (pattern + value redaction)
- **LLM micro-prompt bridge:** `--micro-prompts` flag for cascade stages 3-5 via page.exposeFunction
- **Batch test runner:** `browserlet test <dir>` with --workers N, --bail, aggregated reporting
- **AI auto-repair:** `--auto-repair` and `--interactive` flags for LLM-guided hint repair on failure
- **Vault CLI:** `vault init`, `vault add`, `vault list`, `vault del`, `vault reset`, `vault import-from-extension` commands
- **Monorepo:** @browserlet/core shared package (types, parser, prompts, substitution)

## Requirements

### Validated

**v1.0:**
- ✓ Mode Recording — capture actions, generate BSL via LLM
- ✓ Génération BSL — Claude API + Ollama
- ✓ Execution Engine — deterministic BSL playback
- ✓ Semantic Resolver — 10 hint types, 0.7 threshold
- ✓ Side Panel UI — Monaco Editor, script list, results
- ✓ Triggers contextuels — suggest mode, auto-execute
- ✓ Gestion auth basique — session check, manual prompt
- ✓ Stockage local — chrome.storage.local
- ✓ Import/Export YAML — js-yaml, file-saver
- ✓ Actions BSL — all 8 actions
- ✓ Interface FR + EN — chrome.i18n

**v1.1:**
- ✓ Preact migration — hooks, predictable state, VanJS removed
- ✓ Password field detection — SPA-aware, MutationObserver
- ✓ Encrypted credential storage — AES-GCM 256-bit
- ✓ Credential substitution — `{{credential:name}}` syntax
- ✓ Vault auto-lock — chrome.alarms, 15 min timeout
- ✓ Credential Manager UI — list, edit, delete, usage tracking

**v1.2:**
- ✓ Master password system — PBKDF2 key derivation (600k iterations)
- ✓ Persistent credentials — survive browser restart
- ✓ Credential migration — session-based to master-password encryption
- ✓ Onboarding UX — first-time master password setup
- ✓ Extension branding — {B} icon

**v1.3:**
- ✓ Sidepanel layout — context at top, bottom action bar, no header branding
- ✓ Scripts as primary view — removed NavTabs, execution tab
- ✓ Per-script history — modal with date, status, duration
- ✓ Import button relocation — compact icon in script toolbar

**v1.4:**
- ✓ Data extraction action — `extract:` and `table_extract:` BSL actions with AI-assisted selector definition
- ✓ Screenshot action — `screenshot:` BSL action with auto-capture on failure
- ✓ Extraction results UI — ExtractedDataModal with table/JSON views
- ✓ Export extracted data — JSON/CSV with locale-aware delimiter, PNG/ZIP screenshots
- ~~Self-healing selectors~~ — shipped but non-functional in real conditions, removed in v1.5

**v1.5:**
- ✓ Delete self-healing — removed all Phase 15 code
- ✓ Enriched deterministic resolver — cascade architecture, DOM structural context, hint stability tracking
- ✓ LLM micro-prompts — hint_suggester, disambiguator, confidence_booster (<600 tokens)
- ✓ BSL generation redesign — 13 hint types, structural context, CSS Module filtering
- ✓ Firefox MV3 support — cross-browser Chrome + Firefox

**v1.6:**
- ✓ Monorepo @browserlet/core — shared types, parser, prompts, substitution (npm workspaces)
- ✓ CLI BSL runner — `browserlet run script.bsl` via Playwright with exit codes 0/1/2
- ✓ Cascade resolver in CLI — esbuild IIFE bundle injected via page.evaluate() with SimpleResolver fallback
- ✓ Screenshot-on-failure — PNG capture to --output-dir with step-specific filenames
- ✓ CLI credential vault — AES-GCM encrypted local vault, CLIPasswordStorage adapter
- ✓ HTTP credential bridge — localhost-only with one-time bearer tokens
- ✓ Credential sanitizer — zero plaintext in logs, pattern + value redaction

**v1.7:**
- ✓ Credential wiring — `--vault` flag, `{{credential:alias}}` substitution, master password prompt
- ✓ LLM micro-prompt bridge — `--micro-prompts` flag, page.exposeFunction for stages 3-5
- ✓ Batch test runner — `browserlet test <dir>` with --workers N, --bail, summary report
- ✓ AI auto-repair — `--auto-repair`, `--interactive` flags, hint_repairer micro-prompt
- ✓ CLI documentation — 705-line README + 14 BSL example scripts
- ✓ Vault management — init, add, list, import-from-extension commands
- ✓ Real-world E2E hardening — Unicode stripping, type fallback, resolver improvements

### Active (v1.8)

- [ ] Session snapshot capture/restore — extension (chrome.cookies + localStorage)
- [ ] Session snapshot capture/restore — CLI (Playwright storageState)
- [ ] BSL `auth.session_persistence` declaration — capture, ttl, on_invalid, encryption
- [ ] Session validation with TTL and semantic indicators
- [ ] Fallback behavior on expired/invalid session (login, prompt, abort)
- [ ] Vault unlock cache CLI — encrypted temp file, 15min TTL default, configurable

### Future (v1.9+)

- [ ] Script version control
- [ ] Scheduling (exécution programmée)
- [ ] JUnit XML / HTML report for CI/CD
- [ ] `--last-failed` flag for re-running failures
- [ ] Screenshot diff on repair
- [ ] Intent semantic resolution documentation

### Out of Scope

- Serveur central — v2, après validation terrain
- SSO complet (SAML, CAS, OIDC) — future version
- MFA automatique — future version
- Scheduling (exécution programmée) — v2
- Webhooks — v2
- Version SaaS hébergée — AGPL-3.0 pur
- General-purpose password manager — only automation-scoped credentials
- Browser-wide autofill — security risk, only inject during playback
- Cloud sync for passwords — security risk, local-only storage

## Context

**Origine :** Projet LINAGORA pour automatiser des tâches répétitives sur applications métier legacy (ERP, SIRH) sans API exposée.

**Validated On:**
- Real legacy ERP (OBM - extranet.linagora.com)
- Nibelis SIRH (nibelis.net) - login automation with credentials
- Google, GitHub, Wikipedia for semantic resolver
- macOS Chrome for cross-platform notification fix

**Personas cibles :**
- Marie (gestionnaire) : exécute des scripts pré-configurés
- Thomas (intégrateur IT) : crée et maintient les scripts
- Sophie (DSI) : valide les cas d'usage, suit l'adoption

## Constraints

- **Plateforme** : Chrome + Firefox Extension (Manifest V3) + CLI (Node.js + Playwright)
- **Licence** : AGPL-3.0 — copyleft fort
- **Offline-first** : fonctionne sans serveur
- **Performance** : résolution < 50ms, step < 100ms
- **Sécurité** : Credentials chiffrés AES-GCM, master password PBKDF2 600k
- **Stack** : TypeScript, WXT, Preact, Monaco Editor, Playwright, Commander.js, esbuild

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| IA en création uniquement | Évite coût récurrent, exécution déterministe | ✓ Good |
| YAML pour BSL | Lisible par non-dev, standard, commentable | ✓ Good |
| Chrome + Firefox | Firefox MV3 ajouté en v1.5 avec CI dual-browser | ✓ Good |
| Claude API + Ollama | Flexibilité cloud/local | ✓ Good |
| Pas de serveur v1 | Valider extension seule d'abord | ✓ Good |
| WXT framework | Auto-manifest, HMR, conventions | ✓ Good |
| VanJS → Preact migration | VanJS cross-module state unreliable | ✓ Good |
| In-page notifications | Chrome buttons don't work on macOS | ✓ Good |
| 13 semantic hint types | 10 original + 3 structural (fieldset, label, section) | ✓ Good |
| Cascade resolver (0.85/0.70 thresholds) | Deterministic-first, 80%+ without LLM | ✓ Good |
| PBKDF2 600k iterations | OWASP 2025/2026 recommendation | ✓ Good |
| Validation by decryption | No hash storage, more secure | ✓ Good |
| 4-state CredentialManager | Clear flow: setup → migration → unlock → list | ✓ Good |
| Forced master password onboarding | UX clarity, no empty state | ✓ Good |
| ~~Self-healing post-failure repair~~ | Detect/propose/approve broken selectors | ✗ Removed — non-functional in real conditions, replaced by enriched resolver |
| Intl.NumberFormat for locale detection | Native API, no bundle impact, all locales | ✓ Good |
| "extracted." prefix for variables | Namespace isolation prevents collisions | ✓ Good |
| PNG lossless for screenshots | Quality over compression per user preference | ✓ Good |
| FIFO 20/script + 7-day cleanup | Balances storage with history retention | ✓ Good |
| JSZip for batch export | Lightweight, browser-compatible ZIP generation | ✓ Good |
| Micro-prompts (<600 tokens) | Remplace prompt monolithique 5000 tokens, -88% coût LLM | ✓ Good |
| CascadeResolver wraps semanticResolver | Backward compatible, semanticResolver.ts inchangé | ✓ Good |
| HintStabilityTracker per-site | +0.2 boost pour hints >90% success rate, bounded storage | ✓ Good |
| npm workspaces monorepo | Zero-config workspace protocol, @browserlet/core shared package | ✓ Good |
| esbuild IIFE for resolver bundle | 43KB self-contained bundle for page.evaluate() injection | ✓ Good |
| Data-attribute element bridge | data-browserlet-resolved marker for page→Playwright selector crossing | ✓ Good |
| globalThis.crypto.subtle for CLI | Parameter-level compatibility with extension's Web Crypto API | ✓ Good |
| 127.0.0.1 over localhost | Prevents IPv6 ::1 resolution on dual-stack systems | ✓ Good |
| One-time bearer tokens | Map.get()+delete for bridge auth, 256-bit entropy | ✓ Good |
| page.exposeFunction for LLM bridge | In-page cascade calls Node.js LLM providers | ✓ Good |
| Fresh chromium per batch script | Full test isolation, no state leaks | ✓ Good |
| RepairEngine graceful degradation | Never throws, returns empty suggestions | ✓ Good |
| Auto-repair threshold 0.70 | Matches cascade resolver confidence threshold | ✓ Good |
| normalizeText strips invisible Unicode | Fixes LTR mark / zero-width char comparison failures | ✓ Good |
| class_contains as scoring signal only | Not hard filter in gatherCompetitors fallback | ✓ Good |

| Playwright storageState for CLI sessions | Native JSON format, proven, no custom serialization | — Pending |
| Encrypted temp file for vault cache | Secure (0600 perms), TTL-based, no daemon needed | — Pending |
| chrome.cookies API for extension snapshots | Native MV3 API, no headless browser needed | — Pending |

---
*Last updated: 2026-02-16 after v1.8 milestone start*

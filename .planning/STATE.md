# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-29)

**Core value:** Automatisation web résiliente pour applications legacy, sans coût récurrent d'IA
**Current focus:** Phase 3 - Side Panel

## Current Position

Phase: 3 of 6 (Side Panel)
Plan: 1 of TBD in current phase
Status: In progress
Last activity: 2026-01-29 — Completed 03-01-PLAN.md (Dependencies and Monaco Setup)

Progress: [███░░░░░░░] 33% (2 of 6 phases complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 6
- Average duration: 2.9 min
- Total execution time: 0.34 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 3 | 8 min | 2.7 min |
| 02-recording | 5 | ~15 min | 3 min |

**Recent Trend:**
- Last 5 plans: 01-03 (3 min), 02-01 (4 min), 02-03 (2.4 min), 02-04 (4.7 min)
- Trend: Consistent

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- IA en création uniquement: Évite coût récurrent, exécution déterministe et rapide
- YAML pour BSL: Lisible par non-dev, standard, commentable
- Chrome uniquement: Focus sur Manifest V3 stable, évite fragmentation
- Claude API + Ollama: Flexibilité cloud/local pour qualité et privacy
- Pas de serveur v1: Valider l'extension seule avant d'ajouter complexité
- Auth basique v1: Session existante + prompt suffisant pour valider le concept

**Phase 1 decisions (completed):**
- WXT framework for Chrome extension scaffolding (auto-manifest, HMR, file-based conventions)
- Vanilla TypeScript template - UI framework deferred to Phase 3
- chrome.storage.local as single source of truth - service worker is stateless router
- Top-level synchronous listener registration for service worker reliability
- chrome.runtime?.id check for context validation
- Exponential backoff 100/200/400ms for retry
- WxtVitest plugin for automatic fake-browser setup

**Phase 2 decisions (completed):**
- 10 semantic hint types for element identification (role, id, text_contains, type, name, aria_label, placeholder_contains, near_label, class_contains, data_attribute)
- Filter auto-generated IDs (UUIDs, React/Vue/Ember prefixes) to avoid unstable identifiers
- Skip utility classes (Tailwind patterns) to focus on semantic class names
- Normalize text with accent removal for locale-resilient matching
- Use capture phase for event interception (before target handlers run)
- Debounce input events at 500ms to capture final values, not keystrokes
- Mask password field values as [MASKED] for security
- Monkey-patch History API to detect SPA navigations
- Broadcast START/STOP_RECORDING to all tabs for multi-tab support
- Resume recording on page refresh by checking state on load
- Clear previous actions when starting new recording for clean sessions
- Show last 20 actions in reverse order (most recent first) for usability

**Phase 3 decisions (in progress):**
- ESM/CJS interop for vite-plugin-monaco-editor using fallback pattern
- i18n files in public/ directory for WXT static asset copying
- Comprehensive i18n keys for all Phase 3 UI strings upfront
- crypto.randomUUID() for script/history ID generation (browser-native)
- Per-script history keying with browserlet_history_{scriptId} prefix
- Prepend new records and slice to enforce 50-entry history cap

### Pending Todos

None.

### Blockers/Concerns

**Phase 2 (Recording):** ✅ RESOLVED
- ~~Need real legacy ERP testing for iframe patterns validation~~ - Tested on OBM
- ~~Selector validation with real target apps required~~ - Semantic hints working
- MutationObserver: Not needed for recording (only for playback element resolution)

**Phase 4 (Playback):**
- Bot detection landscape for legacy internal ERPs unknown
- Need validation during testing phase

**Phase 5 (LLM Integration):**
- Provider comparison needed (rate limits, accuracy, cost per selector)
- Prompt engineering for selector hints to be validated

## Completed Phases

### Phase 1: Foundation ✅
- **Completed:** 2026-01-29
- **Plans:** 3/3
- **Duration:** 8 min total
- **Commits:** 6 (e22f1d5, fbbaec4, c3cb4a5, be98ad0, c5549bc, af27a76, 1d0c4a2)
- **E2E Verification:** APPROVED

**Deliverables:**
- WXT-based Chrome extension (Manifest V3)
- Service worker with PING/GET_STATE/SET_STATE message routing
- Content script with context invalidation detection
- Side panel with real-time state display
- Unit test suite (20 tests passing)

### Phase 2: Recording ✅
- **Completed:** 2026-01-29
- **Plans:** 5/5
- **Duration:** ~15 min total
- **E2E Verification:** APPROVED (all 6 test scenarios passed)

**Deliverables:**
- Recording types and SemanticHint interface (10 hint types)
- Hint generator extracting semantic identifiers from DOM elements
- Visual feedback system (HighlightOverlay + RecordingIndicator)
- Event capture (clicks, inputs, form submits with debouncing)
- Navigation capture (History API patching for SPA support)
- RecordingManager state machine orchestrator
- Side Panel recording controls with action list display
- iframe injection via allFrames: true
- Recording persistence across page refresh

**Verified on:** Real legacy ERP (OBM - extranet.linagora.com)

## Session Continuity

Last session: 2026-01-29T12:09:00Z
Stopped at: Completed 03-01-PLAN.md
Resume file: None - clean state

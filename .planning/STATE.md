# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-29)

**Core value:** Automatisation web résiliente pour applications legacy, sans coût récurrent d'IA
**Current focus:** Phase 2 - Recording

## Current Position

Phase: 2 of 6 (Recording)
Plan: 1 of TBD in current phase
Status: In progress
Last activity: 2026-01-29 — Completed 02-01-PLAN.md (Recording Infrastructure)

Progress: [██░░░░░░░░] 17% (1 of 6 phases complete, 1 plan in Phase 2)

## Performance Metrics

**Velocity:**
- Total plans completed: 4
- Average duration: 2.8 min
- Total execution time: 0.20 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 3 | 8 min | 2.7 min |
| 02-recording | 1 | 4 min | 4.0 min |

**Recent Trend:**
- Last 5 plans: 01-01 (3 min), 01-02 (2 min), 01-03 (3 min), 02-01 (4 min)
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

**Phase 2 decisions (in progress):**
- 10 semantic hint types for element identification (role, id, text_contains, type, name, aria_label, placeholder_contains, near_label, class_contains, data_attribute)
- Filter auto-generated IDs (UUIDs, React/Vue/Ember prefixes) to avoid unstable identifiers
- Skip utility classes (Tailwind patterns) to focus on semantic class names
- Normalize text with accent removal for locale-resilient matching

### Pending Todos

None.

### Blockers/Concerns

**Phase 2 (Recording - Next):**
- Need real legacy ERP testing for iframe patterns validation
- Selector validation with real target apps required
- MutationObserver performance profiling needed

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

## Session Continuity

Last session: 2026-01-29T09:58:06Z
Stopped at: Completed 02-01-PLAN.md (Recording Infrastructure)
Resume file: None - clean state

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-20)

**Core value:** Automatisation web resiliente pour applications legacy, sans cout recurrent d'IA
**Current focus:** v1.9 Reliability & Diagnostics -- Phase 38: Failure Diagnostics

## Current Position

Milestone: v1.9 Reliability & Diagnostics
Phase: 38 of 40 (Failure Diagnostics)
Plan: 1 of 1 complete
Status: Phase 038 Complete
Last activity: 2026-02-20 -- Completed 038-01 (Full failure diagnostics pipeline)

Progress: [████░░░░░░] 15%

## Performance Metrics

**Overall Velocity (v1.0-v1.8):**
- Total plans completed: 122 (113 v1.0-v1.7 + 9 v1.8)
- Total phases completed: 35
- 9 milestones shipped
- Quick tasks completed: 2 (quick-10, quick-11)

## Accumulated Context

### Decisions

See PROJECT.md Key Decisions table for full list.

- [037-01] MEANINGFUL_HINT_WEIGHT_THRESHOLD = 0.7 covers data_attribute, role, type, aria_label, name, text_contains, placeholder_contains, fieldset_context, associated_label
- [037-01] Audit pairs actions/steps by filtered index (after removing navigate/screenshot) for deterministic comparison
- [037-01] sortHintsByWeight applied in both buildBSLPrompt and buildCompactBSLPrompt for consistency
- [037-02] DOMSnapshot uses minimal forward-compatible format (observedValues map + observedDataAttributes array)
- [037-02] Validator returns report object (never throws) for non-blocking warnings
- [037-03] detectLayoutType uses signal-counting with threshold >= 2 to classify legacy-table vs spa-component vs generic
- [037-03] section_context contributes 0.5 SPA signal (weaker than data_attribute signals at 1.0)
- [037-03] Generic layout produces empty string guidance (zero token overhead for common case)
- [Phase 036]: landmark_context weight set to 0.65 (between section_context 0.6 and fieldset_context 0.7)
- [Phase 036]: Added role='search' to domContextExtractor for search landmark detection
- [036-02] position_context weight = 0.55 (above class_contains, below near_label) -- fragile if rows reorder but critical for table disambiguation
- [036-02] detectSPAContext returns undefined for non-SPA pages to avoid false positives
- [036-02] Position disambiguation requires both role + text_contains hints to avoid noise
- [Phase 038]: PartialFailureDiagnostic assembled in-browser, completed CLI-side with Node.js context (stepId, pageUrl, searchedHints, timestamp)
- [Phase 038]: DiagnosticError.message preserves matched=[]/failed=[] format for RepairEngine backward compatibility
- [Phase 038]: Text diagnostics to stderr, JSON diagnostics to stdout for clean piping with --diagnostic-json

### Pending Todos

None.

### Blockers/Concerns

None.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 10 | Ajouter les commandes vault del et vault reset | 2026-02-16 | 58d04e4 | [10-ajouter-les-commandes-vault-del-et-vault](./quick/10-ajouter-les-commandes-vault-del-et-vault/) |
| 11 | Ajouter un delai de 2s avant le screenshot | 2026-02-16 | eab43f3 | [11-ajouter-un-d-lai-de-2s-avant-le-screensh](./quick/11-ajouter-un-d-lai-de-2s-avant-le-screensh/) |
| Phase 036 P01 | 5min | 2 tasks | 6 files |
| Phase 037 P01 | 4min | 3 tasks | 3 files |
| Phase 036 P02 | 5min | 2 tasks | 8 files |
| Phase 037 P03 | 3min | 2 tasks | 2 files |
| Phase 038 P01 | 8min | 3 tasks | 15 files |

## Session Continuity

Last session: 2026-02-20
Stopped at: Completed 038-01-PLAN.md (Full failure diagnostics pipeline -- Phase 038 complete)
Resume with: /gsd:execute-phase 039

---
*Created: 2026-02-14*
*Last updated: 2026-02-20 after 038-01 completion*

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-14)

**Core value:** Automatisation web résiliente pour applications legacy, sans coût récurrent d'IA
**Current focus:** Phase 28 - LLM Micro-Prompt Bridge

## Current Position

Milestone: v1.7 CLI Completion & Batch Testing
Phase: 28 of 31 (LLM Micro-Prompt Bridge)
Plan: 1 of 3 in current phase
Status: In progress
Last activity: 2026-02-14 — Completed plan 28-01 (LLM provider abstraction)

Progress: [████████████████████░░░░░░░░░░] 84% (phases 1-26 complete, phase 28 in progress)

## Performance Metrics

**Overall Velocity (v1.0-v1.6):**
- Total plans completed: 95
- Total phases completed: 26
- 7 milestones shipped

**Recent Milestones:**
- v1.6: 4 phases, 11 plans, 1 day (2026-02-14)
- v1.5: 6 phases, 14 plans, 2 days (2026-02-12 → 2026-02-13)
- v1.4: 3 phases, 12 plans, 2 days (2026-02-01 → 2026-02-02)

**v1.7 Status:**
- Phases: 5 planned (27-31), Phase 28 in progress
- Plans completed: 1 (28-01)
- Requirements: 21 total, 100% mapped to phases

**Recent Plans:**
- 28-01: LLM provider abstraction (2 min, 2 tasks, 4 files) - 2026-02-14

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting v1.7 work:

- **28-01**: Provider passed as parameter (not singleton) — CLI creates provider per run, no service worker pattern
- **28-01**: Simple availability checks (no network calls) — avoid latency, fail fast on generate()
- **28-01**: No dangerouslyAllowBrowser flag — server-side Node.js execution
- **v1.6**: esbuild IIFE for resolver bundle — 43KB self-contained bundle for page.evaluate() injection
- **v1.6**: globalThis.crypto.subtle for CLI — parameter-level compatibility with extension's Web Crypto API
- **v1.6**: One-time bearer tokens — Map.get()+delete for bridge auth, 256-bit entropy
- **v1.5**: Cascade resolver architecture — deterministic-first (80%+ without LLM), micro-prompts for edge cases
- **v1.5**: Micro-prompts (<600 tokens) — replace monolithic 5000-token prompt, -88% LLM cost

### Pending Todos

None.

### Blockers/Concerns

**Research flags identified for phase planning:**

**Phase 28 (LLM Bridge):**
- page.exposeFunction timing in headed vs headless mode needs empirical testing
- Error recovery strategy when LLM unavailable needs validation
- Function namespace collision prevention (session ID sufficient?)

**Phase 29 (Batch Runner):**
- Worker pool sizing formula needs RAM-based calculation
- Resource monitoring (how to detect overload and suggest reducing workers?)

**Phase 30 (AI Auto-Repair):**
- Repair quality threshold (>0.70 confidence) needs empirical validation with controlled page changes
- Circuit breaker tuning (3 retries optimal or vary by failure type?)
- Hint caching strategy (DOM context hash collision rate?)

These are flagged in research/SUMMARY.md and will be addressed during phase planning.

## Session Continuity

Last session: 2026-02-14
Stopped at: Completed plan 28-01 (LLM provider abstraction for CLI)
Resume with: Execute plan 28-02 (Bridge integration)

---
*Created: 2026-02-14*
*Last updated: 2026-02-14 after completing plan 28-01*

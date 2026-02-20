# Roadmap: Browserlet v1.9 Reliability & Diagnostics

## Overview

v1.9 fiabilises the record-generate-execute pipeline to achieve >90% first-try success rate. The milestone progresses from enriching what the recorder captures, through improving LLM generation quality, to providing clear failure diagnostics and a repair workflow that eliminates full re-recording. Validation against real legacy and modern apps closes the milestone.

## Milestones

- [x] **v1.0 MVP** - Phases 1-6 (shipped 2026-01-31)
- [x] **v1.1 Security & Stability** - Phases 7-10 (shipped 2026-01-31)
- [x] **v1.2 Persistent Credentials** - Phases 11-12 (shipped 2026-02-01)
- [x] **v1.3 UX Sidepanel** - Phase 13 (shipped 2026-02-01)
- [x] **v1.4 Self-Healing & Data Extraction** - Phases 14-16 (shipped 2026-02-12)
- [x] **v1.5 Resolver Redesign & Firefox** - Phases 17-22 (shipped 2026-02-13)
- [x] **v1.6 CLI Runner** - Phases 23-26 (shipped 2026-02-14)
- [x] **v1.7 CLI Completion & Batch Testing** - Phases 27-31 (shipped 2026-02-15)
- [x] **v1.8 Session Persistence & Vault UX** - Phases 32-35 (shipped 2026-02-19)
- [ ] **v1.9 Reliability & Diagnostics** - Phases 36-40 (in progress)

## Phases

**Phase Numbering:**
- Integer phases (36, 37, 38...): Planned milestone work
- Decimal phases (36.1, 36.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 36: Recording Enrichment** - Capture richer DOM context and filter unstable artifacts for higher-quality input to LLM generation
- [ ] **Phase 37: Generation Quality** - Improve LLM BSL output to preserve recorded hints, select optimal combinations, and handle diverse page structures
- [ ] **Phase 38: Failure Diagnostics** - Provide actionable failure reports showing what was searched, what was found, and what to fix
- [ ] **Phase 39: Repair Workflow** - Enable targeted hint repair from diagnostic output without re-recording entire scripts
- [ ] **Phase 40: Pipeline Validation** - Validate the full record-generate-execute pipeline at >90% first-try success on legacy and modern apps

## Phase Details

### Phase 36: Recording Enrichment
**Goal**: Recording captures rich, stable, disambiguated DOM context that gives the LLM everything it needs to generate resilient BSL
**Depends on**: Nothing (first phase of v1.9)
**Requirements**: REC-01, REC-02, REC-03, REC-04
**Success Criteria** (what must be TRUE):
  1. When user records a click on a form field, the captured context includes parent landmarks, fieldset legend, nearby label, and section heading
  2. When user records on a page with CSS Module hashed classes or React-generated IDs, those unstable hints are filtered out before reaching the LLM
  3. When user records on a React/Vue SPA, the recording annotates component boundaries and dynamic content zones in the captured context
  4. When user records a click and multiple similar elements exist (e.g., 5 "Edit" buttons in a table), the recording captures enough disambiguation context to distinguish the target from its siblings
**Plans**: TBD

Plans:
- [ ] 036-01: TBD
- [ ] 036-02: TBD

### Phase 37: Generation Quality
**Goal**: LLM generates BSL that faithfully preserves recorded context, selects the most stable hint combinations, and can be validated against the original page
**Depends on**: Phase 36
**Requirements**: GEN-01, GEN-02, GEN-03, GEN-04
**Success Criteria** (what must be TRUE):
  1. When LLM generates BSL from enriched recording, all meaningful hints from the recorded context appear in the output (no silent hint loss)
  2. Generated BSL steps favor high-weight, stable hints (landmarks, labels, fieldset legends) over low-weight, fragile hints (class names, DOM position)
  3. After generation, a validation pass compares generated BSL hints against the recorded DOM snapshot and flags mismatches before the user runs the script
  4. LLM correctly generates BSL for both legacy HTML table-based layouts (e.g., OBM) and modern SPA component structures (e.g., React/Vue)
**Plans**: TBD

Plans:
- [ ] 037-01: TBD
- [ ] 037-02: TBD

### Phase 38: Failure Diagnostics
**Goal**: When a BSL step fails, the user gets a clear, actionable report explaining why the element was not found and what to do about it
**Depends on**: Phase 37
**Requirements**: DIAG-01, DIAG-02, DIAG-03, DIAG-04, DIAG-05
**Success Criteria** (what must be TRUE):
  1. When a step fails, the diagnostic output lists every hint that was searched and the individual score each candidate element received for each hint
  2. When a step fails, the report shows a side-by-side of the expected element description vs the actual top candidates found on the page with their structural context
  3. When a step fails, the report shows the confidence threshold, the best candidate's score, and the gap between them
  4. When a step fails, the diagnostic output includes a suggested fix (e.g., "try changing hint X to Y" or "add hint Z for disambiguation")
  5. Diagnostic reports are available as structured JSON (for CLI piping and automation) and as human-readable text (for extension side panel display)
**Plans**: TBD

Plans:
- [ ] 038-01: TBD
- [ ] 038-02: TBD

### Phase 39: Repair Workflow
**Goal**: User can fix a broken BSL script by editing specific hints from the diagnostic output, get alternative suggestions from the live page, re-validate immediately, and track what changed
**Depends on**: Phase 38
**Requirements**: REP-01, REP-02, REP-03, REP-04
**Success Criteria** (what must be TRUE):
  1. User can click a failed step in the diagnostic output and edit its hints directly, without re-recording the entire script
  2. When repairing a hint, the repair engine analyzes the current page DOM and suggests alternative hints that would match the intended element
  3. After repairing hints, user can re-run the script immediately against the target page to verify the fix works
  4. Each repair is tracked with before/after hint values, creating an audit trail visible in the script history
**Plans**: TBD

Plans:
- [ ] 039-01: TBD
- [ ] 039-02: TBD

### Phase 40: Pipeline Validation
**Goal**: The full record-generate-execute pipeline demonstrably succeeds at >90% first-try rate on both legacy and modern applications, with diagnostics that correctly identify root causes of remaining failures
**Depends on**: Phase 39
**Requirements**: VAL-01, VAL-02, VAL-03
**Success Criteria** (what must be TRUE):
  1. Recording, generating, and executing a 10+ step BSL script on OBM (legacy HTML/table-based) succeeds on the first try at least 9 out of 10 times
  2. Recording, generating, and executing a 10+ step BSL script on a modern SPA (React or Vue) succeeds on the first try at least 9 out of 10 times
  3. For every step that fails across validation runs, the diagnostic report correctly identifies the root cause (wrong hint, missing disambiguation, SPA timing, etc.)
**Plans**: 1 plan

Plans:
- [ ] 040-01-PLAN.md — Create and execute OBM legacy + modern SPA validation scripts (10x each), document success rates and root causes

## Progress

**Execution Order:**
Phases execute in numeric order: 36 -> 37 -> 38 -> 39 -> 40

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 36. Recording Enrichment | 0/? | Not started | - |
| 37. Generation Quality | 0/? | Not started | - |
| 38. Failure Diagnostics | 0/? | Not started | - |
| 39. Repair Workflow | 0/? | Not started | - |
| 40. Pipeline Validation | 0/? | Not started | - |

---
*Roadmap created: 2026-02-20*
*Last updated: 2026-02-20*

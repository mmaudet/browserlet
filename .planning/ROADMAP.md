# Roadmap: Browserlet

## Milestones

- [v1.0 MVP](milestones/v1.0-ROADMAP.md) - Phases 1-6 (shipped 2026-01-31)
- [v1.1 Security & Stability](milestones/v1.1-ROADMAP.md) - Phases 7-10 (shipped 2026-01-31)
- [v1.2 Persistent Credentials](milestones/v1.2-ROADMAP.md) - Phases 11-12 (shipped 2026-02-01)
- [v1.3 UX Sidepanel Refactoring](milestones/v1.3-ROADMAP.md) - Phase 13 (shipped 2026-02-01)
- [v1.4 Self-Healing & Data Extraction](milestones/v1.4-ROADMAP.md) - Phases 14-16 (shipped 2026-02-12)
- [v1.5 Resolver Redesign & Firefox](milestones/v1.5-ROADMAP.md) - Phases 17-22 (shipped 2026-02-13)
- [v1.6 CLI Runner & Automated Testing](milestones/v1.6-ROADMAP.md) - Phases 23-26 (shipped 2026-02-14)
- **v1.7 CLI Completion & Batch Testing** - Phases 27-31 (in progress)

## v1.7 CLI Completion & Batch Testing

**Goal:** Complete CLI runner with credential substitution, LLM micro-prompt bridge, batch test runner, and AI auto-repair for production-ready CI/CD automation tool.

**Execution order:**
1. Phase 27 + Phase 28 (parallel — independent)
2. Phase 29 (after Phase 27)
3. Phase 30 (after Phase 28)
4. Phase 31 (after Phase 29)

- [ ] **Phase 27: Credential Wiring** — Wire existing vault to CLI runner
- [ ] **Phase 28: LLM Micro-Prompt Bridge** — Cascade stages 3-5 via page.exposeFunction ‖ Phase 27
- [ ] **Phase 29: Batch Test Runner** — `browserlet test dossier/` with isolation
- [ ] **Phase 30: AI Auto-Repair** — `--repair` flag with circuit breaker
- [ ] **Phase 31: HTML Report** — Visual timeline with embedded screenshots

## Phase Details

### Phase 27: Credential Wiring
**Goal**: CLI runner substitutes credentials in BSL scripts using encrypted vault with master password protection
**Depends on**: Nothing (closes v1.6 tech debt)
**Requirements**: CRED-09, CRED-10, CRED-11
**Success Criteria** (what must be TRUE):
  1. User can run CLI scripts containing {{credential:alias}} syntax with --vault flag
  2. User is prompted once per session for master password to unlock vault
  3. Credentials are substituted into scripts before execution with zero plaintext in logs
**Plans:** 1 plan

Plans:
- [ ] 27-01-PLAN.md — Wire --vault flag, master password prompt, and credential substitution into BSLRunner

### Phase 28: LLM Micro-Prompt Bridge
**Goal**: Cascade resolver stages 3-5 work in CLI via LLM call bridge from page context to Node.js
**Depends on**: Nothing (independent capability)
**Requirements**: LLMB-01, LLMB-02, LLMB-03, LLMB-04, LLMB-05
**Success Criteria** (what must be TRUE):
  1. User can enable micro-prompts in CLI with --micro-prompts flag
  2. Cascade resolver stages 3-5 successfully call LLM from page context via exposed bridge function
  3. LLM provider abstraction supports Claude API, Ollama, and OpenAI Compatible endpoints
  4. DOM context extraction around failure points respects token budgets
  5. Structured LLM responses are validated before use to prevent malformed output errors
**Plans:** TBD

### Phase 29: Batch Test Runner
**Goal**: Users can run entire directories of BSL test scripts with aggregated reporting
**Depends on**: Phase 27 (credential wiring for scripts with credentials)
**Requirements**: BTST-01, BTST-02, BTST-03, BTST-04, BTST-05, BTST-06
**Success Criteria** (what must be TRUE):
  1. User can run all .bsl files in a directory with browserlet test command
  2. Exit code aggregates results (0=all pass, 1=any fail, 2=any error)
  3. Tests continue on failure by default, --bail flag stops on first failure
  4. Each script runs in fresh browser context for isolation
  5. Terminal displays batch summary with pass/fail/total counts and duration
  6. Progress indicator shows current script and overall completion percentage
**Plans:** TBD

### Phase 30: AI Auto-Repair
**Goal**: Failed steps can automatically retry with LLM-regenerated hints when --repair flag enabled
**Depends on**: Phase 28 (LLM bridge for hint regeneration)
**Requirements**: REPR-01, REPR-02, REPR-03, REPR-04, REPR-05
**Success Criteria** (what must be TRUE):
  1. User can enable auto-repair with --repair flag (opt-in, default disabled)
  2. Circuit breaker limits repair to max 3 retries per step and aborts script after 3 consecutive failures
  3. SELECTOR_NOT_FOUND errors trigger repair attempts, TIMEOUT/NETWORK errors abort immediately
  4. Repair attempts are logged with before/after context showing what changed
  5. Token cost is tracked and displayed in summary report
**Plans:** TBD

### Phase 31: HTML Report
**Goal**: Batch test runs produce visual HTML reports with step-by-step timeline and embedded screenshots
**Depends on**: Phase 29 (batch runner to aggregate results)
**Requirements**: REPT-01, REPT-02
**Success Criteria** (what must be TRUE):
  1. HTML report shows step-by-step timeline with duration and status for each script
  2. Report is generated to --output-dir after batch execution completes
  3. Failure screenshots are embedded inline at the relevant step
**Plans:** TBD

## Progress

| Phase | Milestone | Plans | Status | Shipped |
|-------|-----------|-------|--------|---------|
| 1-6 | v1.0 MVP | 34 | Complete | 2026-01-31 |
| 7-10 | v1.1 Security | 16 | Complete | 2026-01-31 |
| 11-12 | v1.2 Credentials | 5 | Complete | 2026-02-01 |
| 13 | v1.3 UX Refactoring | 3 | Complete | 2026-02-01 |
| 14-16 | v1.4 Data Extraction & Screenshots | 12 | Complete | 2026-02-12 |
| 17-22 | v1.5 Resolver Redesign & Firefox | 14 | Complete | 2026-02-13 |
| 23-26 | v1.6 CLI Runner & Automated Testing | 11 | Complete | 2026-02-14 |
| 27-31 | v1.7 CLI Completion & Batch Testing | 1/TBD | In progress | - |

**Total:** 26 phases shipped (95 plans) across 7 milestones, 5 phases planned for v1.7

---

*Roadmap updated: 2026-02-14 -- Phase 27 plan created (1 plan)*

# Requirements: Browserlet v1.7

**Defined:** 2026-02-14
**Core Value:** Automatisation web resiliente pour applications legacy, sans cout recurrent d'IA

## v1.7 Requirements

Requirements for CLI Completion & Batch Testing. Each maps to roadmap phases.

### Credential Wiring (CRED)

- [ ] **CRED-09**: User can use `{{credential:name}}` in CLI-executed scripts with `--vault` flag
- [ ] **CRED-10**: CLI prompts for master password once per session to unlock vault
- [ ] **CRED-11**: Credentials substituted before step execution with zero plaintext in logs

### LLM Micro-Prompt Bridge (LLMB)

- [ ] **LLMB-01**: Cascade resolver stages 3-5 work in CLI via `page.exposeFunction` bridge
- [ ] **LLMB-02**: LLM provider abstraction supports Claude API, Ollama, and OpenAI Compatible
- [ ] **LLMB-03**: `--micro-prompts` flag enables LLM stages (default: deterministic-only)
- [ ] **LLMB-04**: DOM context extracted around failure point (token-budget aware)
- [ ] **LLMB-05**: Structured output parsing validates LLM responses before use

### Batch Test Runner (BTST)

- [ ] **BTST-01**: `browserlet test dossier/` discovers and runs all `.bsl` files via glob
- [ ] **BTST-02**: Exit code aggregation (any 2→2, else any 1→1, else 0)
- [ ] **BTST-03**: Continue-on-failure by default, `--bail` flag to stop on first failure
- [ ] **BTST-04**: Fresh browser context per script for test isolation
- [ ] **BTST-05**: Batch summary report in terminal (pass/fail/total with duration)
- [ ] **BTST-06**: Progress indicator showing current script and overall progress

### AI Auto-Repair (REPR)

- [ ] **REPR-01**: `--repair` flag enables LLM retry on step failure (opt-in, default off)
- [ ] **REPR-02**: Circuit breaker: max 3 retries per step, 3 consecutive failures abort script
- [ ] **REPR-03**: Failure classification: SELECTOR_NOT_FOUND → repair, TIMEOUT/NETWORK → abort
- [ ] **REPR-04**: Repair attempts logged with before/after context
- [ ] **REPR-05**: Token cost tracked and displayed in summary

### Reporting (REPT)

- [ ] **REPT-01**: HTML report with step-by-step timeline, duration, and embedded failure screenshots
- [ ] **REPT-02**: Report generated to `--output-dir` after batch execution

## Future Requirements (v1.8+)

### Batch Enhancements
- **BTST-07**: Parallel execution with `--workers=N` flag
- **BTST-08**: `--last-failed` flag to re-run only failed tests from previous batch
- **BTST-09**: Test filtering with `--grep pattern`

### Report Formats
- **REPT-03**: JUnit XML output for CI/CD integration (Jenkins, GitHub Actions)
- **REPT-04**: JSON report output for programmatic analysis

### AI Enhancements
- **REPR-06**: Screenshot diff on repair (before/after visual comparison)
- **REPR-07**: Repair audit trail (git-trackable JSON logs)
- **REPR-08**: Repair success metrics and statistics

## Out of Scope

| Feature | Reason |
|---------|--------|
| Auto-repair without opt-in | Breaks deterministic execution promise, cost explosion |
| Unlimited repair retries | Infinite loops, 3-attempt circuit breaker is industry standard |
| AI test generation | Out of scope — test creation != test repair |
| Real-time LLM streaming | Adds latency/complexity, concise logs after completion sufficient |
| Credential auto-discovery from browser | Security nightmare, breaks vault isolation |
| Multi-browser batch (Chromium+Firefox+WebKit) | Playwright supports but scope explosion, defer to v2 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CRED-09 | Pending | Pending |
| CRED-10 | Pending | Pending |
| CRED-11 | Pending | Pending |
| LLMB-01 | Pending | Pending |
| LLMB-02 | Pending | Pending |
| LLMB-03 | Pending | Pending |
| LLMB-04 | Pending | Pending |
| LLMB-05 | Pending | Pending |
| BTST-01 | Pending | Pending |
| BTST-02 | Pending | Pending |
| BTST-03 | Pending | Pending |
| BTST-04 | Pending | Pending |
| BTST-05 | Pending | Pending |
| BTST-06 | Pending | Pending |
| REPR-01 | Pending | Pending |
| REPR-02 | Pending | Pending |
| REPR-03 | Pending | Pending |
| REPR-04 | Pending | Pending |
| REPR-05 | Pending | Pending |
| REPT-01 | Pending | Pending |
| REPT-02 | Pending | Pending |

**Coverage:**
- v1.7 requirements: 21 total
- Mapped to phases: 0
- Unmapped: 21 (pending roadmap creation)

---
*Requirements defined: 2026-02-14*
*Last updated: 2026-02-14 after initial definition*

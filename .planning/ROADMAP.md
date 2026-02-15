# Browserlet Development Roadmap

**Milestone:** v1.7 CLI Completion & Batch Testing
**Status:** In progress
**Phases:** 27-31
**Last updated:** 2026-02-15

---

## v1.7 CLI Completion & Batch Testing

**Goal:** Complete CLI feature parity with extension (credentials, LLM micro-prompts) and add batch testing infrastructure.

**Why now:** v1.6 shipped CLI with cascade resolver (deterministic-only). v1.7 adds credential wiring and LLM micro-prompts for full resolver capability, plus batch testing for QA workflows.

**Success criteria:**
- CLI resolves all credential references from vault
- CLI cascade resolver stages 3-5 work via LLM bridge
- Batch test runner aggregates results from multiple BSL files
- Auto-repair suggests updated hints after page changes

**Dependencies:** Phase 26 (credential security) provides vault infrastructure.

---

### Phase 27: Credential Wiring
**Goal**: CLI resolves credential references ({{credential:name}}) from vault, enabling automated login scripts
**Depends on**: Phase 26 (vault infrastructure)
**Requirements**: CRED-01, CRED-02, CRED-03, CRED-04, CRED-05
**Success Criteria** (what must be TRUE):
  1. CLI resolves {{credential:name}} references from vault before execution
  2. Vault must be unlocked via master password before credential-using scripts run
  3. Credential references in type actions inject decrypted values at execution time
  4. Missing credentials fail fast with clear error before script starts
  5. Credential values never appear in logs or error messages
**Plans:** TBD

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
**Plans:** 3 plans in 3 waves

Plans:
- [ ] 28-01-PLAN.md — LLM provider infrastructure (Claude, Ollama, micro-prompt router)
- [ ] 28-02-PLAN.md — page.exposeFunction bridge and --micro-prompts flag
- [ ] 28-03-PLAN.md — Validation tests and human verification

### Phase 29: Batch Test Runner
**Goal**: Users can run entire directories of BSL test scripts with aggregated reporting
**Depends on**: Phase 27 (credential wiring for scripts with credentials)
**Requirements**: BTST-01, BTST-02, BTST-03, BTST-04, BTST-05, BTST-06
**Success Criteria** (what must be TRUE):
  1. User can run all .bsl files in a directory with browserlet test command
  2. Exit code aggregates results (0=all pass, 1=any fail, 2=any error)
  3. Tests continue on failure by default, --bail flag stops on first failure
  4. Each script runs in fresh browser context for isolation
  5. Parallel execution supported via --workers flag (default: 1)
  6. Summary report shows passed/failed/skipped counts with detailed failure logs
**Plans:** 2 plans in 2 waves

Plans:
- [ ] 29-01-PLAN.md — Core batch runner (test command, script discovery, sequential execution, exit code aggregation, summary report)
- [ ] 29-02-PLAN.md — Parallel workers (--workers N) and bail-on-failure (--bail)

### Phase 30: AI-Powered Auto-Repair
**Goal**: CLI detects page structure changes and suggests updated hints via LLM analysis
**Depends on**: Phase 28 (LLM bridge for micro-prompts)
**Requirements**: ARPR-01, ARPR-02, ARPR-03, ARPR-04, ARPR-05
**Success Criteria** (what must be TRUE):
  1. When cascade resolver fails, CLI captures DOM context and suggests alternative hints
  2. Repair suggestions include confidence scores (>0.70 recommended)
  3. Users can apply repairs interactively or via --auto-repair flag
  4. Applied repairs update BSL script file on disk
  5. Repair history logged for audit trail
**Plans:** 2 plans in 2 waves

Plans:
- [ ] 30-01-PLAN.md — Repair engine (hint_repairer micro-prompt, DOM context capture, RepairEngine class)
- [ ] 30-02-PLAN.md — CLI integration (--auto-repair, --interactive flags, BSL file updater, repair history)

### Phase 31: Documentation & Examples
**Goal**: Complete CLI documentation with examples and migration guide from extension
**Depends on**: Phases 27-30 (all CLI features complete)
**Requirements**: DOCS-01, DOCS-02, DOCS-03, DOCS-04
**Success Criteria** (what must be TRUE):
  1. README.md documents all CLI commands and flags
  2. Examples directory contains 10+ real-world BSL scripts
  3. Migration guide explains extension → CLI workflow differences
  4. Troubleshooting section covers common errors and solutions
**Plans:** 1 plan in 1 wave

Plans:
- [ ] 31-01-PLAN.md — Complete CLI documentation (README.md, examples/, migration guide, troubleshooting)

---

## Requirements Coverage

### Credential Wiring (CRED)
- [ ] **CRED-01**: Credential vault integration in CLI (master password unlock)
- [ ] **CRED-02**: {{credential:name}} reference resolution before execution
- [ ] **CRED-03**: Fail-fast validation (missing credentials detected pre-run)
- [ ] **CRED-04**: Credential value redaction in all logs and error messages
- [ ] **CRED-05**: Bridge server shutdown after script completion

### LLM Micro-Prompt Bridge (LLMB)
- [ ] **LLMB-01**: Cascade resolver stages 3-5 work in CLI via `page.exposeFunction` bridge
- [ ] **LLMB-02**: LLM provider abstraction supports Claude API, Ollama, and OpenAI Compatible
- [ ] **LLMB-03**: `--micro-prompts` flag enables LLM stages (default: deterministic-only)
- [ ] **LLMB-04**: DOM context extracted around failure point (token-budget aware)
- [ ] **LLMB-05**: Structured output parsing validates LLM responses before use

### Batch Testing (BTST)
- [ ] **BTST-01**: `browserlet test <directory>` runs all .bsl files
- [ ] **BTST-02**: Exit codes: 0=all pass, 1=any fail, 2=any error
- [ ] **BTST-03**: `--bail` flag stops on first failure
- [ ] **BTST-04**: Fresh browser context per script for isolation
- [ ] **BTST-05**: `--workers N` for parallel execution (default: 1)
- [ ] **BTST-06**: Summary report with passed/failed/skipped counts

### Auto-Repair (ARPR)
- [ ] **ARPR-01**: Detect failures and capture DOM context for repair
- [ ] **ARPR-02**: LLM suggests alternative hints with confidence scores
- [ ] **ARPR-03**: Interactive repair approval (`--interactive` mode)
- [ ] **ARPR-04**: `--auto-repair` applies repairs automatically (>0.70 confidence)
- [ ] **ARPR-05**: Update BSL file on disk with repaired hints

### Documentation (DOCS)
- [ ] **DOCS-01**: CLI command reference in README.md
- [ ] **DOCS-02**: 10+ example BSL scripts in examples/
- [ ] **DOCS-03**: Extension-to-CLI migration guide
- [ ] **DOCS-04**: Troubleshooting section for common errors

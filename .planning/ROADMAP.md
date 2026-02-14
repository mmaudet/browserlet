# Roadmap: Browserlet

## Milestones

- [v1.0 MVP](milestones/v1.0-ROADMAP.md) - Phases 1-6 (shipped 2026-01-31)
- [v1.1 Security & Stability](milestones/v1.1-ROADMAP.md) - Phases 7-10 (shipped 2026-01-31)
- [v1.2 Persistent Credentials](milestones/v1.2-ROADMAP.md) - Phases 11-12 (shipped 2026-02-01)
- [v1.3 UX Sidepanel Refactoring](milestones/v1.3-ROADMAP.md) - Phase 13 (shipped 2026-02-01)
- [v1.4 Self-Healing & Data Extraction](milestones/v1.4-ROADMAP.md) - Phases 14-16 (shipped 2026-02-12)
- [v1.5 Resolver Redesign & Firefox](milestones/v1.5-ROADMAP.md) - Phases 17-22 (shipped 2026-02-13)
- **v1.6 CLI Runner & Automated Testing** - Phases 23-26 (in progress)

## v1.6 CLI Runner & Automated Testing

**Goal:** Users can execute BSL scripts outside the browser extension via a CLI tool (`browserlet run`), with Playwright-driven browser automation, semantic resolution via page.evaluate(), and secure credential access from a local vault or extension bridge.

**Phase Numbering:**
- Integer phases (23, 24, 25, 26): Planned milestone work
- Decimal phases (23.1, 23.2): Urgent insertions if needed (marked with INSERTED)

**Execution order:**
1. Phase 23 (sequential — blocking)
2. Phase 24 + Phase 26 (parallel — independent after shared core)
3. Phase 25 (after Phase 24)

- [ ] **Phase 23: Monorepo & Shared Core** - Extract browser-agnostic modules to shared package
- [ ] **Phase 24: CLI Runner & Playwright Actions** - Basic CLI that executes BSL scripts via Playwright ‖ Phase 26
- [ ] **Phase 25: Semantic Resolver & Reporting** - Cascade resolver via page.evaluate() and console reporting
- [ ] **Phase 26: Credential Bridge & Security** - Local vault and extension credential bridge for CLI ‖ Phase 24

## Phase Details

### Phase 23: Monorepo & Shared Core
**Goal**: Extension and CLI share a single source of truth for BSL parsing, hint types, LLM prompts, and credential substitution
**Depends on**: Nothing (first phase of v1.6)
**Requirements**: CORE-01, CORE-02, CORE-03, CORE-04, CORE-05, CORE-06
**Success Criteria** (what must be TRUE):
  1. Running `npm install` from the repo root bootstraps all workspace packages with no errors
  2. Extension builds and passes all existing tests with zero behavior change (imports now come from shared package)
  3. A Node.js script can import the BSL parser from the shared package and parse a .bsl file without any browser or chrome.* dependency
  4. Shared package exports hint types/weights, micro-prompt builders, and credential substitution logic that are importable from both browser and Node.js contexts
**Plans:** 3 plans

Plans:
- [ ] 23-01-PLAN.md — Monorepo scaffolding, shared package structure, and type extraction
- [ ] 23-02-PLAN.md — Extract parser, prompts, weights, and substitution logic to shared package
- [ ] 23-03-PLAN.md — Rewire extension imports to @browserlet/core and verify zero behavior change

### Phase 24: CLI Runner & Playwright Actions
**Goal**: User can run a BSL script from the terminal and see it execute in a Playwright-controlled browser with proper exit codes
**Depends on**: Phase 23
**Requirements**: EXEC-01, EXEC-02, EXEC-03, EXEC-04, EXEC-09
**Success Criteria** (what must be TRUE):
  1. Running `browserlet run script.bsl` launches a headless Playwright browser, executes each BSL step, and exits with code 0 on success
  2. Running `browserlet run script.bsl --headed` opens a visible browser window during execution
  3. Running `browserlet run script.bsl --timeout 5000` causes the script to fail with exit code 2 if any step exceeds 5 seconds
  4. BSL actions (click, fill, navigate, select, screenshot, extract) use Playwright native APIs (page.click, page.fill, page.goto) -- not manual event dispatch
  5. Exit code is 1 when a step fails to find its target, and 2 when an infrastructure error occurs (timeout, browser crash)
**Plans**: TBD

Plans:
- [ ] 24-01: TBD
- [ ] 24-02: TBD
- [ ] 24-03: TBD

### Phase 25: Semantic Resolver & Reporting
**Goal**: The cascade semantic resolver works in Playwright context via page.evaluate(), and the user sees clear pass/fail reporting with failure screenshots
**Depends on**: Phase 24
**Requirements**: EXEC-05, EXEC-06, EXEC-07, EXEC-08
**Success Criteria** (what must be TRUE):
  1. The cascade resolver (deterministic scoring at 0.85 threshold, then LLM micro-prompts at 0.70) runs inside page.evaluate() and resolves elements on real pages (static HTML and dynamic SPAs)
  2. Console output shows each step name with pass/fail status and duration (e.g., "PASS click 'Submit' (120ms)")
  3. When a step fails, a PNG screenshot is automatically saved to the output directory with the step name in the filename
  4. During execution, a live spinner shows the current step name, replaced by the result line when the step completes
**Plans**: TBD

Plans:
- [ ] 25-01: TBD
- [ ] 25-02: TBD

### Phase 26: Credential Bridge & Security
**Goal**: CLI users can securely access credentials from a local vault or from the running extension, with zero plaintext exposure
**Depends on**: Phase 23 (CORE-04 shared credential substitution) — runs in parallel with Phase 24
**Requirements**: CRED-01, CRED-02, CRED-03, CRED-04, CRED-05, CRED-06, CRED-07, CRED-08
**Success Criteria** (what must be TRUE):
  1. User can create and unlock a local CLI vault (`~/.browserlet/vault.json`) with a master password, and `{{credential:name}}` values are substituted into BSL steps during execution
  2. When the extension is running, CLI can request credentials via an HTTP bridge on localhost with one-time bearer tokens -- no manual credential re-entry needed
  3. Encryption/decryption round-trips work between Node.js (CLI) and browser (extension) using the same globalThis.crypto primitives
  4. Running `browserlet run` with `--verbose` or any log level never shows credential values in plaintext -- only masked placeholders appear in output
  5. The HTTP bridge rejects connections from non-localhost origins and invalidates tokens after single use
**Plans**: TBD

Plans:
- [ ] 26-01: TBD
- [ ] 26-02: TBD
- [ ] 26-03: TBD

## Progress

| Phase | Milestone | Plans | Status | Shipped |
|-------|-----------|-------|--------|---------|
| 1-6 | v1.0 MVP | 34 | Complete | 2026-01-31 |
| 7-10 | v1.1 Security | 16 | Complete | 2026-01-31 |
| 11-12 | v1.2 Credentials | 5 | Complete | 2026-02-01 |
| 13 | v1.3 UX Refactoring | 3 | Complete | 2026-02-01 |
| 14-16 | v1.4 Data Extraction & Screenshots | 12 | Complete | 2026-02-12 |
| 17-22 | v1.5 Resolver Redesign & Firefox | 14 | Complete | 2026-02-13 |
| 23 | v1.6 Monorepo & Shared Core | 0/3 | Planning complete | - |
| 24 | v1.6 CLI Runner & Playwright Actions | 0/TBD | Not started | - |
| 25 | v1.6 Semantic Resolver & Reporting | 0/TBD | Not started | - |
| 26 | v1.6 Credential Bridge & Security | 0/TBD | Not started | - |

**Total:** 22 phases shipped (84 plans) across 6 milestones | 4 phases planned for v1.6

---

*Roadmap updated: 2026-02-14 -- Phase 23 planned (3 plans)*

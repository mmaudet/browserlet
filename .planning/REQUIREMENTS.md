# Requirements: Browserlet v1.9

**Defined:** 2026-02-20
**Core Value:** Automatisation web resiliente pour applications legacy, sans cout recurrent d'IA

## v1.9 Requirements

Requirements for v1.9 Reliability & Diagnostics. Fiabiliser le pipeline record → generate → execute pour atteindre un taux de succes >90% au premier essai.

### Recording Quality

- [x] **REC-01**: Recording captures enriched DOM context per interaction (parent landmarks, fieldset legends, nearby labels, section headings)
- [x] **REC-02**: Recording filters unstable hints (auto-generated IDs, dynamic CSS classes, framework artifacts) before LLM submission
- [ ] **REC-03**: Recording detects and annotates SPA-specific patterns (React/Vue component structures, dynamic content zones)
- [ ] **REC-04**: Recording captures disambiguation context when multiple similar elements exist on the page

### Generation Quality

- [x] **GEN-01**: LLM preserves all meaningful recorded hints in generated BSL without loss
- [x] **GEN-02**: LLM selects optimal hint combinations favoring highest-weight, most stable hints
- [x] **GEN-03**: Generated BSL includes post-generation validation check against recorded DOM snapshot
- [x] **GEN-04**: Generation handles both legacy HTML table-based layouts and modern SPA component structures

### Diagnostics

- [ ] **DIAG-01**: Failed step reports which hints were searched and their individual scores per candidate
- [ ] **DIAG-02**: Failed step shows expected element description vs actual candidates found with structural context
- [ ] **DIAG-03**: Failed step reports confidence gap (threshold vs best candidate score)
- [ ] **DIAG-04**: Diagnostic output suggests most likely fix (hint correction, alternative selector)
- [ ] **DIAG-05**: Diagnostic report available in structured format (JSON for CLI automation, readable text for extension)

### Repair Workflow

- [ ] **REP-01**: User can repair a failed hint directly from the diagnostic output without re-recording the full script
- [ ] **REP-02**: Repair engine suggests alternative hints based on current page DOM state
- [ ] **REP-03**: Repaired script can be re-validated immediately against the target page
- [ ] **REP-04**: Repair tracks changes (old hint to new hint) for audit trail

### Validation

- [ ] **VAL-01**: Full pipeline (record, generate, execute) succeeds on OBM legacy at >90% first-try rate
- [ ] **VAL-02**: Full pipeline (record, generate, execute) succeeds on a modern SPA at >90% first-try rate
- [ ] **VAL-03**: Failure diagnostics correctly identify the root cause for each failed step

## Future Requirements (v2.0+)

### Reporting

- **RPT-01**: JUnit XML / HTML report output for CI/CD integration
- **RPT-02**: `--last-failed` flag for re-running only failed scripts

### Version Control

- **VCS-01**: Script version control with diff tracking
- **VCS-02**: Screenshot diff on repair

### Scheduling

- **SCHED-01**: Scheduled execution (cron-like) for automated runs

## Out of Scope

| Feature | Reason |
|---------|--------|
| New BSL actions | v1.9 is fiabilisation pure, no new actions |
| Additional LLM providers | Existing providers (Claude, Ollama, OpenAI) sufficient |
| Server-side components | v2, after field validation |
| New UI features | Focus on reliability, not UX additions |
| Mobile/responsive testing | Desktop-first automation tool |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| REC-01 | Phase 36 | Complete |
| REC-02 | Phase 36 | Complete |
| REC-03 | Phase 36 | Pending |
| REC-04 | Phase 36 | Pending |
| GEN-01 | Phase 37 | Complete |
| GEN-02 | Phase 37 | Complete |
| GEN-03 | Phase 37 | Complete |
| GEN-04 | Phase 37 | Complete |
| DIAG-01 | Phase 38 | Pending |
| DIAG-02 | Phase 38 | Pending |
| DIAG-03 | Phase 38 | Pending |
| DIAG-04 | Phase 38 | Pending |
| DIAG-05 | Phase 38 | Pending |
| REP-01 | Phase 39 | Pending |
| REP-02 | Phase 39 | Pending |
| REP-03 | Phase 39 | Pending |
| REP-04 | Phase 39 | Pending |
| VAL-01 | Phase 40 | Pending |
| VAL-02 | Phase 40 | Pending |
| VAL-03 | Phase 40 | Pending |

**Coverage:**
- v1.9 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0

---
*Requirements defined: 2026-02-20*
*Last updated: 2026-02-20 after roadmap creation*

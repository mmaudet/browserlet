# Requirements: Browserlet

**Defined:** 2026-01-29
**Core Value:** Automatisation web résiliente pour applications legacy, sans coût récurrent d'IA

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Recording

- [ ] **REC-01**: User can start/stop recording mode from Side Panel
- [ ] **REC-02**: Extension captures clicks on any element
- [ ] **REC-03**: Extension captures text input in form fields
- [ ] **REC-04**: Extension captures navigation between pages
- [ ] **REC-05**: Extension generates semantic hints (role, aria-label, text, data-attribute) instead of fragile XPath
- [ ] **REC-06**: Elements are highlighted during recording (visual feedback)
- [ ] **REC-07**: Recording works inside iframes (same-origin and cross-origin where possible)
- [ ] **REC-08**: Captured actions are sent to LLM for BSL script generation

### Execution

- [ ] **EXEC-01**: Extension parses BSL (YAML) scripts
- [ ] **EXEC-02**: Extension executes BSL scripts step-by-step (deterministic)
- [ ] **EXEC-03**: Semantic resolver finds elements by multi-hint strategy (role + text + aria + fallback)
- [ ] **EXEC-04**: Smart waiting detects element availability (not fixed delays)
- [ ] **EXEC-05**: Humanization layer adds random delays between actions
- [ ] **EXEC-06**: User can stop execution at any time
- [ ] **EXEC-07**: Execution handles errors gracefully with clear messages

### BSL Actions

- [ ] **ACT-01**: click — click on an element
- [ ] **ACT-02**: type — enter text in a field
- [ ] **ACT-03**: select — choose option in dropdown
- [ ] **ACT-04**: extract — extract data from element
- [ ] **ACT-05**: wait_for — wait for condition
- [ ] **ACT-06**: navigate — go to URL
- [ ] **ACT-07**: scroll — scroll to element
- [ ] **ACT-08**: hover — hover over element

### Side Panel UI

- [ ] **UI-01**: Side Panel displays list of available scripts
- [ ] **UI-02**: Scripts can be searched/filtered by name, app, tag
- [ ] **UI-03**: Monaco Editor integrated for BSL script editing with YAML syntax highlighting
- [ ] **UI-04**: Execution progress shows current step, progress bar
- [ ] **UI-05**: Execution results display extracted data
- [ ] **UI-06**: Results can be copied as JSON or CSV
- [ ] **UI-07**: Context zone shows current page URL and detected entities
- [ ] **UI-08**: Recording mode has dedicated UI with action list

### Contextual Triggers

- [ ] **TRIG-01**: Extension detects current page context (URL, elements, entities)
- [ ] **TRIG-02**: Trigger conditions can match URL patterns
- [ ] **TRIG-03**: Trigger conditions can detect element presence
- [ ] **TRIG-04**: Suggest mode: show relevant scripts in Side Panel when context matches
- [ ] **TRIG-05**: Auto-execute mode: run script automatically when context matches (with notification)
- [ ] **TRIG-06**: User can enable/disable triggers per site

### LLM Integration

- [ ] **LLM-01**: Recorded actions are analyzed by LLM to generate BSL script
- [ ] **LLM-02**: Support Claude API (Anthropic)
- [ ] **LLM-03**: Support Ollama (local models)
- [ ] **LLM-04**: User provides their own API key (stored encrypted)
- [ ] **LLM-05**: Rate limiting with exponential backoff
- [ ] **LLM-06**: Fallback if LLM unavailable (basic selector generation)

### Storage

- [ ] **STOR-01**: Scripts saved in chrome.storage.local
- [ ] **STOR-02**: Scripts can be exported as YAML files
- [ ] **STOR-03**: Scripts can be imported from YAML files
- [ ] **STOR-04**: Scripts have metadata (name, description, version, target_app, author)
- [ ] **STOR-05**: Execution history logged (last 50 runs per script)

### Authentication

- [ ] **AUTH-01**: Extension detects if user is not logged in (session check)
- [ ] **AUTH-02**: Extension prompts user to log in manually when session required
- [ ] **AUTH-03**: Script pauses and resumes after manual authentication

### Internationalization

- [ ] **I18N-01**: UI available in French
- [ ] **I18N-02**: UI available in English
- [ ] **I18N-03**: Language auto-detected from browser settings

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Authentication (Advanced)

- **AUTH-10**: SSO passthrough (SAML, CAS, OIDC detection and wait)
- **AUTH-11**: MFA detection and pause
- **AUTH-12**: Session recovery (resume script after re-authentication)
- **AUTH-13**: Encrypted credential store with master password

### Self-Healing

- **HEAL-01**: Detect when selector fails
- **HEAL-02**: Use LLM to suggest alternative selectors
- **HEAL-03**: Auto-repair script with user confirmation

### Enterprise

- **ENT-01**: Audit trail (who ran what when)
- **ENT-02**: Script version control
- **ENT-03**: Visual execution replay (screenshots)
- **ENT-04**: Scheduled execution
- **ENT-05**: Webhook output

### Server Central

- **SRV-01**: Central server for script sync
- **SRV-02**: Multi-user access control
- **SRV-03**: Usage analytics

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Firefox support | Chrome uniquement (Manifest V3 stable), pas de fragmentation |
| Self-healing v1 | Complexe, semantic selectors réduisent le besoin |
| Serveur central v1 | Valider l'extension seule d'abord |
| Version SaaS | AGPL-3.0 pur, pas de service hébergé |
| Runtime AI (full-IA) | Contre la vision produit — IA en création uniquement |
| Video recording | Complexité storage/bandwidth, screenshots suffisent |
| Multi-tab parallel | Complexité, single-tab workflows d'abord |
| Debugging breakpoints | Console logs suffisent pour v1 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| REC-01 | TBD | Pending |
| REC-02 | TBD | Pending |
| REC-03 | TBD | Pending |
| REC-04 | TBD | Pending |
| REC-05 | TBD | Pending |
| REC-06 | TBD | Pending |
| REC-07 | TBD | Pending |
| REC-08 | TBD | Pending |
| EXEC-01 | TBD | Pending |
| EXEC-02 | TBD | Pending |
| EXEC-03 | TBD | Pending |
| EXEC-04 | TBD | Pending |
| EXEC-05 | TBD | Pending |
| EXEC-06 | TBD | Pending |
| EXEC-07 | TBD | Pending |
| ACT-01 | TBD | Pending |
| ACT-02 | TBD | Pending |
| ACT-03 | TBD | Pending |
| ACT-04 | TBD | Pending |
| ACT-05 | TBD | Pending |
| ACT-06 | TBD | Pending |
| ACT-07 | TBD | Pending |
| ACT-08 | TBD | Pending |
| UI-01 | TBD | Pending |
| UI-02 | TBD | Pending |
| UI-03 | TBD | Pending |
| UI-04 | TBD | Pending |
| UI-05 | TBD | Pending |
| UI-06 | TBD | Pending |
| UI-07 | TBD | Pending |
| UI-08 | TBD | Pending |
| TRIG-01 | TBD | Pending |
| TRIG-02 | TBD | Pending |
| TRIG-03 | TBD | Pending |
| TRIG-04 | TBD | Pending |
| TRIG-05 | TBD | Pending |
| TRIG-06 | TBD | Pending |
| LLM-01 | TBD | Pending |
| LLM-02 | TBD | Pending |
| LLM-03 | TBD | Pending |
| LLM-04 | TBD | Pending |
| LLM-05 | TBD | Pending |
| LLM-06 | TBD | Pending |
| STOR-01 | TBD | Pending |
| STOR-02 | TBD | Pending |
| STOR-03 | TBD | Pending |
| STOR-04 | TBD | Pending |
| STOR-05 | TBD | Pending |
| AUTH-01 | TBD | Pending |
| AUTH-02 | TBD | Pending |
| AUTH-03 | TBD | Pending |
| I18N-01 | TBD | Pending |
| I18N-02 | TBD | Pending |
| I18N-03 | TBD | Pending |

**Coverage:**
- v1 requirements: 48 total
- Mapped to phases: 0
- Unmapped: 48 ⚠️

---
*Requirements defined: 2026-01-29*
*Last updated: 2026-01-29 after initial definition*

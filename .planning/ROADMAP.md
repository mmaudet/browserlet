# Roadmap: Browserlet

## Overview

Browserlet delivers semantic web automation for legacy applications through six phases: establish the Chrome extension foundation (service worker, storage, messaging), capture user interactions with AI-powered semantic hints, build a professional script management interface, execute scripts deterministically with resilient selectors, enhance recording with LLM-generated semantic analysis, and finally enable contextual automation with smart suggestions. Each phase delivers a complete component that builds toward deterministic, cost-free automation for legacy apps without APIs.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Service worker, storage, and messaging infrastructure
- [ ] **Phase 2: Recording** - DOM observation and semantic hint capture
- [ ] **Phase 3: Side Panel** - UI, Monaco Editor, and script management
- [ ] **Phase 4: Playback** - BSL execution engine with semantic resolution
- [ ] **Phase 5: LLM Integration** - AI-assisted semantic selector generation
- [ ] **Phase 6: Contextual Triggers** - Smart suggestions and auto-execution

## Phase Details

### Phase 1: Foundation
**Goal**: Extension infrastructure ready for recording and playback
**Depends on**: Nothing (first phase)
**Requirements**: None (foundational infrastructure)
**Success Criteria** (what must be TRUE):
  1. Extension loads in Chrome and appears in extensions list
  2. Service worker receives and routes messages between components
  3. Extension state persists across browser restarts via chrome.storage.local
  4. Context invalidation is detected and communicated to user
  5. All communication patterns work (service worker ↔ content script ↔ side panel)
**Plans**: TBD

Plans:
- [ ] TBD during planning

### Phase 2: Recording
**Goal**: User can record interactions and generate semantic BSL scripts
**Depends on**: Phase 1
**Requirements**: REC-01, REC-02, REC-03, REC-04, REC-05, REC-06, REC-07, REC-08
**Success Criteria** (what must be TRUE):
  1. User can start recording mode from Side Panel
  2. User's clicks, typing, and navigation are captured with visual feedback
  3. Captured actions include semantic hints (role, aria-label, text, data-attribute) not fragile XPath
  4. Recording works inside iframes (same-origin and cross-origin where possible)
  5. Captured action sequence is available for script generation
**Plans**: TBD

Plans:
- [ ] TBD during planning

### Phase 3: Side Panel
**Goal**: Professional UI for managing and editing BSL scripts
**Depends on**: Phase 2
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07, UI-08, STOR-01, STOR-02, STOR-03, STOR-04, STOR-05, I18N-01, I18N-02, I18N-03
**Success Criteria** (what must be TRUE):
  1. User can see list of saved scripts with search and filtering
  2. User can edit BSL scripts in Monaco Editor with YAML syntax highlighting
  3. User can import and export scripts as YAML files
  4. Execution progress displays current step with progress bar
  5. Execution results can be copied as JSON or CSV
  6. UI appears in French or English based on browser language
  7. Scripts are persisted locally and survive browser restart
**Plans**: TBD

Plans:
- [ ] TBD during planning

### Phase 4: Playback
**Goal**: Deterministic execution of BSL scripts with resilient semantic selectors
**Depends on**: Phase 3
**Requirements**: EXEC-01, EXEC-02, EXEC-03, EXEC-04, EXEC-05, EXEC-06, EXEC-07, ACT-01, ACT-02, ACT-03, ACT-04, ACT-05, ACT-06, ACT-07, ACT-08, AUTH-01, AUTH-02, AUTH-03
**Success Criteria** (what must be TRUE):
  1. User can execute a BSL script from Side Panel
  2. Semantic resolver finds elements using multi-hint strategy (not fragile selectors)
  3. All 8 BSL actions work (click, type, select, extract, wait_for, navigate, scroll, hover)
  4. Execution handles missing elements with clear error messages
  5. User can stop execution at any time
  6. Extension detects when user is logged out and pauses for manual authentication
  7. Humanization layer adds realistic delays to avoid bot detection
**Plans**: TBD

Plans:
- [ ] TBD during planning

### Phase 5: LLM Integration
**Goal**: AI-enhanced semantic selector generation during recording
**Depends on**: Phase 4
**Requirements**: LLM-01, LLM-02, LLM-03, LLM-04, LLM-05, LLM-06
**Success Criteria** (what must be TRUE):
  1. User can configure Claude API or Ollama with their own API key
  2. Recorded actions are sent to LLM for BSL script generation
  3. Generated BSL scripts use semantic hints from LLM analysis
  4. Rate limiting prevents API exhaustion with exponential backoff
  5. Extension falls back to basic selectors if LLM unavailable
  6. API keys are stored encrypted in chrome.storage
**Plans**: TBD

Plans:
- [ ] TBD during planning

### Phase 6: Contextual Triggers
**Goal**: Smart automation with context-aware script suggestions
**Depends on**: Phase 5
**Requirements**: TRIG-01, TRIG-02, TRIG-03, TRIG-04, TRIG-05, TRIG-06
**Success Criteria** (what must be TRUE):
  1. Extension detects current page context (URL, visible elements, entities)
  2. Relevant scripts appear in Side Panel when context matches (suggest mode)
  3. Scripts can auto-execute when context matches with user notification
  4. Triggers support URL patterns and element presence conditions
  5. User can enable or disable triggers per site
  6. Context detection works continuously without performance impact
**Plans**: TBD

Plans:
- [ ] TBD during planning

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/TBD | Not started | - |
| 2. Recording | 0/TBD | Not started | - |
| 3. Side Panel | 0/TBD | Not started | - |
| 4. Playback | 0/TBD | Not started | - |
| 5. LLM Integration | 0/TBD | Not started | - |
| 6. Contextual Triggers | 0/TBD | Not started | - |

---
*Last updated: 2026-01-29 after roadmap creation*

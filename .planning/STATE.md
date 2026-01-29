# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-29)

**Core value:** Automatisation web résiliente pour applications legacy, sans coût récurrent d'IA
**Current focus:** Phase 6 - Contextual Triggers

## Current Position

Phase: 6 of 6 (Contextual Triggers)
Plan: 4 of 6
Status: In progress
Last activity: 2026-01-29 — Completed 06-04-PLAN.md (Trigger System Wiring)

Progress: [████████░░] 88% (5 of 6 phases complete, Phase 6: 4/6 plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 10
- Average duration: 2.4 min
- Total execution time: 0.50 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 3 | 8 min | 2.7 min |
| 02-recording | 5 | ~15 min | 3 min |
| 06-contextual-triggers | 4 | 8.7 min | 2.2 min |

**Recent Trend:**
- Last 5 plans: 06-01 (1.7 min), 06-02 (2.1 min), 06-03 (2.2 min), 06-04 (2.8 min)
- Trend: Consistently fast (averaging 2.2 min for Phase 6)

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- IA en création uniquement: Évite coût récurrent, exécution déterministe et rapide
- YAML pour BSL: Lisible par non-dev, standard, commentable
- Chrome uniquement: Focus sur Manifest V3 stable, évite fragmentation
- Claude API + Ollama: Flexibilité cloud/local pour qualité et privacy
- Pas de serveur v1: Valider l'extension seule avant d'ajouter complexité
- Auth basique v1: Session existante + prompt suffisant pour valider le concept

**Phase 1 decisions (completed):**
- WXT framework for Chrome extension scaffolding (auto-manifest, HMR, file-based conventions)
- Vanilla TypeScript template - UI framework deferred to Phase 3
- chrome.storage.local as single source of truth - service worker is stateless router
- Top-level synchronous listener registration for service worker reliability
- chrome.runtime?.id check for context validation
- Exponential backoff 100/200/400ms for retry
- WxtVitest plugin for automatic fake-browser setup

**Phase 2 decisions (completed):**
- 10 semantic hint types for element identification (role, id, text_contains, type, name, aria_label, placeholder_contains, near_label, class_contains, data_attribute)
- Filter auto-generated IDs (UUIDs, React/Vue/Ember prefixes) to avoid unstable identifiers
- Skip utility classes (Tailwind patterns) to focus on semantic class names
- Normalize text with accent removal for locale-resilient matching
- Use capture phase for event interception (before target handlers run)
- Debounce input events at 500ms to capture final values, not keystrokes
- Mask password field values as [MASKED] for security
- Monkey-patch History API to detect SPA navigations
- Broadcast START/STOP_RECORDING to all tabs for multi-tab support
- Resume recording on page refresh by checking state on load
- Clear previous actions when starting new recording for clean sessions
- Show last 20 actions in reverse order (most recent first) for usability

**Phase 3 decisions (completed):**
- ESM/CJS interop for vite-plugin-monaco-editor using fallback pattern
- i18n files in public/ directory for WXT static asset copying
- Comprehensive i18n keys for all Phase 3 UI strings upfront
- crypto.randomUUID() for script/history ID generation (browser-native)
- Per-script history keying with browserlet_history_{scriptId} prefix
- Prepend new records and slice to enforce 50-entry history cap
- Return original YAML content on export if script.content exists (preserves formatting)
- Validate BSL structure on import: name string + steps array required
- UTF-8 encoding for file read/write operations
- Module-level editor singleton for external content access via exported functions
- 1 second debounce for auto-save balancing responsiveness and storage writes
- VanJS van.state for reactive store pattern in sidepanel
- Derived state with van.derive for computed/filtered values
- Storage change listener for cross-context sync in script stores
- Tab listeners at module level for singleton context updates
- @json2csv/plainjs Parser for CSV export functionality

**Phase 4 decisions (completed):**
- Re-export SemanticHint from playback/types.ts for convenience
- Separate step parser (stepParser.ts) from script parser (parser.ts) for single responsibility
- Validate target requirement per action type (7 require target, navigate requires value)
- Box-Muller transform for Gaussian distribution (natural timing feel)
- DEFAULT_CONFIG ranges: 500-2000ms base, 50-150ms typing, 100-300ms scroll
- Normalize Gaussian to 0-1 with (gaussian + 3) / 6 clamping
- Hint weights: data_attribute/role/type=1.0, aria_label/name=0.9, id=0.85, text_contains=0.8, placeholder_contains=0.7, near_label=0.6, class_contains=0.5
- 0.7 confidence threshold for valid element matches
- MutationObserver with childList/subtree/attributes for dynamic DOM detection
- isElementInteractable checks visibility + disabled + aria-disabled + dimensions
- Full event sequence (mousedown -> mouseup -> click) for framework compatibility
- Character-by-character typing with keydown/input/keyup per char
- Option search by value first, then by text content
- Hover persistence (no mouseleave dispatch)
- URL pattern wildcards converted to regex with proper escaping
- Case-insensitive URL pattern matching for robustness
- Short-circuit session checks: URL patterns first (fastest)
- 2000ms default polling interval for waitForAuthentication
- AbortController checked between steps for immediate stop
- Session check before each step, not just at start
- Error messages include step index and hint match details
- Store extract results by output.variable in Map
- Wait for page load after navigate with 10s timeout
- Fallback selector tried on both low confidence and timeout

**Phase 5 decisions (in progress):**
- AES-GCM 256-bit encryption for API keys
- Session key stored in chrome.storage.session (cleared on browser restart)
- 12-byte IV (96 bits) for AES-GCM as recommended
- Base64 encoding for ciphertext and IV storage
- JWK format for key serialization
- 10 hint types ordered by reliability: data_attribute most stable, id least reliable
- RateLimiter only retries 429 errors with exponential backoff and jitter
- Fallback generator uses top 3 hints for resilience
- Compact prompt variant for local models with limited context
- Action mapping: input->type, submit->click (semantic BSL mapping)
- dangerouslyAllowBrowser: true for Anthropic SDK in extension context
- Haiku model for cost-efficient availability checks
- No rate limiting for Ollama (local resource)
- GenerateBSLResult includes usedLLM flag for UI feedback
- API key encrypted before storage, decrypted on load (never stored plaintext)
- needsApiKey flag tracks when re-entry required after browser restart
- VanJS reactive pattern for LLM config store (matching existing stores)
- Test Connection button for Ollama to verify local server
- LLM config storage key: browserlet_llm_config

**Phase 6 decisions (in progress):**
- Trigger mode: suggest (show in sidepanel) vs auto_execute (run immediately)
- Cooldown default 300000ms (5 min) for auto_execute spam prevention
- Per-site overrides stored with domain-keyed pattern for granular control
- All trigger conditions use AND logic (all must match)
- Reuse SemanticHint from recording for element detection consistency
- Reuse sessionDetector URL pattern logic for trigger URL matching
- 500ms debounce for MutationObserver to balance responsiveness and performance
- Page Visibility API to pause observers when tab hidden
- Only notify listeners on state changes to avoid redundant callbacks
- Smart observer activation: only for element-based triggers
- Chrome notifications API for auto-execute user feedback
- Blue badge (#4285f4) for suggested scripts count display
- 10s auto-clear for execution notifications to prevent buildup
- Session storage for suggested scripts per tab (cleared on tab close)
- Singleton TriggerEngine pattern matching service worker architecture
- Content script initializes triggers lazily after recording manager setup
- GET_TRIGGERS handler ensures engine initialized before returning (race condition fix)
- Broadcast pattern updates all tabs on trigger CRUD operations

### Pending Todos

None.

### Blockers/Concerns

**Phase 2 (Recording):** ✅ RESOLVED
- ~~Need real legacy ERP testing for iframe patterns validation~~ - Tested on OBM
- ~~Selector validation with real target apps required~~ - Semantic hints working
- MutationObserver: Not needed for recording (only for playback element resolution)

**Phase 4 (Playback):**
- Bot detection landscape for legacy internal ERPs unknown
- Need validation during testing phase

**Phase 5 (LLM Integration):**
- Provider comparison needed (rate limits, accuracy, cost per selector)
- Prompt engineering for selector hints to be validated
- Pre-existing TypeScript errors in LLM providers need resolution

**Phase 6 (Contextual Triggers):**
- No blockers for remaining plans (06-05, 06-06)
- Message flow complete: content → background → actions
- Pre-existing TypeScript errors in LLM providers don't affect trigger functionality

## Completed Phases

### Phase 1: Foundation ✅
- **Completed:** 2026-01-29
- **Plans:** 3/3
- **Duration:** 8 min total
- **Commits:** 6 (e22f1d5, fbbaec4, c3cb4a5, be98ad0, c5549bc, af27a76, 1d0c4a2)
- **E2E Verification:** APPROVED

**Deliverables:**
- WXT-based Chrome extension (Manifest V3)
- Service worker with PING/GET_STATE/SET_STATE message routing
- Content script with context invalidation detection
- Side panel with real-time state display
- Unit test suite (20 tests passing)

### Phase 2: Recording ✅
- **Completed:** 2026-01-29
- **Plans:** 5/5
- **Duration:** ~15 min total
- **E2E Verification:** APPROVED (all 6 test scenarios passed)

**Deliverables:**
- Recording types and SemanticHint interface (10 hint types)
- Hint generator extracting semantic identifiers from DOM elements
- Visual feedback system (HighlightOverlay + RecordingIndicator)
- Event capture (clicks, inputs, form submits with debouncing)
- Navigation capture (History API patching for SPA support)
- RecordingManager state machine orchestrator
- Side Panel recording controls with action list display
- iframe injection via allFrames: true
- Recording persistence across page refresh

**Verified on:** Real legacy ERP (OBM - extranet.linagora.com)

### Phase 3: Side Panel ✅
- **Completed:** 2026-01-29
- **Plans:** 7/7
- **E2E Verification:** APPROVED (user tested all features)

**Deliverables:**
- Monaco Editor with YAML syntax highlighting
- Script list with search and filtering
- Import/export YAML files (js-yaml, file-saver)
- Execution view with progress bar and idle state
- Results export (JSON, CSV via @json2csv/plainjs)
- Context zone showing current tab URL
- Recording view with action list display
- i18n support (EN/FR via chrome.i18n)
- Script CRUD operations via chrome.storage.local
- Execution history storage per script
- VanJS reactive UI components
- View-based routing

**Bug fixes applied:**
- Export button now gets latest edited content
- Run tab shows idle state with instructions
- Context zone loads properly with tabs permission
- Run button added to script list

## Session Continuity

Last session: 2026-01-29T21:12:21Z
Stopped at: Completed 06-04-PLAN.md (Trigger System Wiring)
Resume file: None

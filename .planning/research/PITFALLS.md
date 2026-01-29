# Domain Pitfalls: Chrome Extension Web Automation

**Domain:** Chrome Manifest V3 extension with web automation and element recording
**Researched:** 2026-01-29
**Confidence:** HIGH (verified with official Chrome documentation and multiple 2026 sources)

## Critical Pitfalls

Mistakes that cause rewrites, major architectural changes, or complete feature failures.

### Pitfall 1: Service Worker State Loss (Premature Termination)

**What goes wrong:** Extension service workers terminate after 30 seconds of inactivity, or when operations exceed 5 minutes, or when fetch() responses take over 30 seconds. All global variables, in-memory state, and active listeners vanish immediately upon termination.

**Why it happens:** Developers migrate from persistent background scripts (MV2) to event-driven service workers (MV3) without understanding the ephemeral nature. They store critical state in global variables assuming continuous execution.

**Consequences:**
- User recordings mid-session get lost completely
- Active automation workflows fail silently
- Element selector hints accumulated during interaction vanish
- Connection state to content scripts becomes invalid
- LLM conversation context disappears

**Prevention:**
- Use `chrome.storage.local` or `chrome.storage.session` for all state that must survive termination
- Use IndexedDB for larger datasets (recording history, element selector database)
- Never rely on global variables for persistence beyond 30 seconds
- Implement "save on every change" pattern rather than "save at end"
- Add service worker lifecycle monitoring to detect unexpected terminations

**Detection (Warning Signs):**
- Users report "extension stopped working" after inactivity
- Recordings work initially but fail after 30+ seconds
- State resets unexpectedly during multi-step workflows
- Console shows "Extension context invalidated" errors

**Phase Impact:** Phase 1 (Architecture) - Must establish storage patterns before building recording features

**Sources:**
- [Extension Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) (HIGH confidence - official Chrome docs)

---

### Pitfall 2: Extension Context Invalidation During Updates

**What goes wrong:** When extension auto-updates or reloads, existing content scripts become orphaned. They continue running on pages but lose connection to the extension runtime. All `chrome.runtime.sendMessage()` calls fail with "Extension context invalidated" errors. Ports close unexpectedly.

**Why it happens:** Chrome's auto-update system replaces the extension while content scripts are still active in open tabs. Content scripts injected before the update cannot communicate with the new extension version.

**Consequences:**
- Users see cryptic "Extension context invalidated" errors mid-workflow
- Recorded actions fail to save to the service worker
- Element selection highlights freeze on the page
- LLM integration requests fail silently
- Extension appears broken but refresh fixes it (confusing UX)

**Prevention:**
- Implement connection health checks before every message
- Use `chrome.runtime.connect().onDisconnect` listener to detect invalidation early
- Check `chrome.runtime.id` with null-safe operators before sending messages
- Display user-friendly "Extension updated, please refresh page" banner when context invalidates
- Implement automatic content script re-injection after update detection
- Save work-in-progress to `chrome.storage` before every runtime call

**Detection (Warning Signs):**
- Spike in "Extension context invalidated" errors during active usage
- Features work initially after install but break randomly
- Errors coincide with Chrome auto-updating extensions
- Developer console shows `chrome.runtime.lastError` about invalid context

**Phase Impact:** Phase 1 (Architecture) - Context invalidation handling must be built into messaging layer from start

**Sources:**
- [Extension Context Invalidated Errors](https://github.com/crxjs/chrome-extension-tools/issues/673) (MEDIUM confidence - multiple developer reports)

---

### Pitfall 3: Cross-Origin iframe Access Blocked

**What goes wrong:** Content scripts cannot access iframe content when iframes are cross-origin (different domain from parent). Attempting to access `iframe.contentDocument` or `iframe.contentWindow.document` throws security errors. Element recording fails silently inside iframes. Legacy ERPs often use iframes extensively.

**Why it happens:** Browser same-origin policy prevents cross-origin DOM access even for extensions. Cross-Origin-Embedder-Policy (COEP) headers further restrict iframe access. Developers assume extension permissions bypass these restrictions.

**Consequences:**
- Cannot record user actions inside cross-origin iframes (major blind spot)
- Element selection fails in iframe-heavy legacy ERP apps
- Automation workflows break when navigating into iframes
- Cannot detect which iframe user is interacting with
- False negatives: "element not found" when element exists in iframe

**Prevention:**
- Declare `"all_frames": true` in manifest.json content_scripts configuration (runs separate content script instance per iframe)
- Use `window.postMessage()` for cross-origin iframe communication
- Implement iframe detection: check if current document is iframe with `window !== window.top`
- Build iframe-aware element selectors that include iframe context
- Add explicit iframe testing for legacy ERP target sites
- Consider using `chrome.webNavigation` API to track iframe navigations

**Detection (Warning Signs):**
- "Blocked a frame with origin from accessing a cross-origin frame" errors
- Element recording works on main page but not in embedded content
- Automation works on modern SPAs but fails on legacy multi-frame apps
- Users report "some buttons don't get recorded"

**Phase Impact:** Phase 2 (Recording) - iframe handling must be part of initial recording architecture

**Sources:**
- [Chrome Extension iframe Cross-Origin Issues](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/Ii6zH9lYw5I) (MEDIUM confidence)
- [Allow Cross-Origin iframe Access](https://bugs.chromium.org/p/chromium/issues/detail?id=344341) (MEDIUM confidence)

---

### Pitfall 4: Remote Code Execution Violations (CSP)

**What goes wrong:** Manifest V3 prohibits all remotely-hosted code. Extensions using `eval()`, `new Function()`, inline `<script>` tags, or fetching JavaScript from external sources get rejected from Chrome Web Store or disabled in user browsers.

**Why it happens:** Developers try to dynamically load LLM prompts, selector strategies, or automation scripts from servers. Legacy patterns from MV2 no longer work. CSP violations aren't always caught during local development.

**Consequences:**
- Extension rejected from Chrome Web Store during review
- Cannot dynamically update selector strategies without extension update
- LLM prompt templates must be bundled, reducing flexibility
- Cannot A/B test different automation approaches remotely
- Users' extensions get disabled if CSP violations ship to production

**Prevention:**
- Bundle all JavaScript code in the extension package
- Store dynamic configuration as JSON in `chrome.storage`, never as executable code
- Use sandboxed iframes for user-generated scripts if needed
- Load LLM prompts and selector hints as data (JSON/text), not code
- Test with strict CSP: `script-src 'self'` locally during development
- Use Chrome Web Store pre-publication checks before every release

**Detection (Warning Signs):**
- "Refused to execute inline script" errors in console
- Chrome Web Store review rejections citing CSP violations
- Extensions work in development but break in production
- Dynamic features suddenly stop after packaging

**Phase Impact:** Phase 1 (Architecture) - CSP constraints shape data vs code separation from day one

**Sources:**
- [Manifest V3 CSP Requirements](https://developer.chrome.com/docs/extensions/mv3/mv3-migration/) (HIGH confidence - official Chrome docs)
- [CSP Issues in Manifest V3](https://medium.com/@python-javascript-php-html-css/resolving-content-security-policy-issues-in-chrome-extension-manifest-v3-4ab8ee6b3275) (MEDIUM confidence)

---

### Pitfall 5: Bot Detection Triggers in Automation

**What goes wrong:** Automated interactions trigger anti-bot systems. Sites detect WebDriver properties, headless browser signatures, inhuman timing patterns, and rapid-fire clicks. Automation gets blocked or CAPTCHAs appear constantly.

**Why it happens:** Modern anti-bot systems (Cloudflare, Akamai, Fastly) use multi-layered detection: browser fingerprinting, TLS fingerprints, behavioral analysis, mouse movement patterns. Chrome extensions leave automation traces.

**Consequences:**
- Recorded workflows break when replayed due to bot detection
- Legacy ERP systems (target market) might have basic bot protection
- Users get account suspensions for "automated access"
- Automation only works intermittently, feels unreliable
- Cannot scale to high-frequency use cases

**Prevention:**
- Add random delays between actions (100-500ms variable timing)
- Simulate human-like mouse movements before clicks
- Vary interaction patterns (don't always click exact same coordinates)
- Avoid rapid-fire element queries (batch and throttle DOM access)
- For recording: preserve timing information from original interaction
- For playback: add configurable "humanization" layer
- Test against common anti-bot services early
- Document limitations: "not designed to bypass anti-bot systems"

**Detection (Warning Signs):**
- CAPTCHAs appear during automated playback but not manual use
- Workflows fail with "suspicious activity detected" messages
- Success rate degrades over time (pattern recognition)
- Works in development, blocked in production environments

**Phase Impact:** Phase 3 (Playback) - Humanization must be built into playback engine, not added later

**Sources:**
- [Bypass Bot Detection 2026](https://www.zenrows.com/blog/bypass-bot-detection) (MEDIUM confidence - recent industry analysis)
- [How to Avoid Bot Detection](https://roundproxies.com/blog/bypass-bot-detection/) (MEDIUM confidence)

---

## Moderate Pitfalls

Mistakes that cause delays, technical debt, or user experience degradation.

### Pitfall 6: Element Selector Collisions and False Positives

**What goes wrong:** Selectors match multiple elements when only one was intended. Aria-label selectors match decorative elements. CSS selectors break when page structure changes slightly. "Save" button gets confused with "Save As" button.

**Why it happens:** Relying on single selector attribute (aria-label alone, or CSS class alone) without validation. Legacy ERPs have duplicate labels, non-semantic HTML, and dynamically generated IDs. Developers don't test selector uniqueness.

**Consequences:**
- Automation clicks wrong element (deletes instead of saves)
- Recording captures ambiguous selectors that fail during playback
- Silent failures: workflow "succeeds" but operates on wrong element
- Difficult to debug: looks correct in DevTools but fails in practice

**Prevention (from POC learnings + research):**
- Always combine multiple hints (aria-label + data-attribute + position)
- Prefer explicit hints (aria-label, data-testid, data-attribute) over inferred (near_label)
- Use data-attribute selectors for table/list items where labels repeat
- Always include fallback_selector (CSS/XPath) for maximum reliability
- Validate selector uniqueness: `document.querySelectorAll(selector).length === 1`
- Test selectors against multiple page states (different data loaded)
- Build selector quality scoring: explicit > structural > positional

**Detection (Warning Signs):**
- Automation occasionally operates on wrong element
- Users report "it clicked the wrong button"
- `document.querySelectorAll(selector)` returns multiple results
- Selectors work on test pages but fail on production with different data

**Phase Impact:** Phase 2 (Recording) - Selector strategy is core architecture decision

**Sources:**
- [Playwright Selector Best Practices 2026](https://www.browserstack.com/guide/playwright-selectors-best-practices) (HIGH confidence)
- [CSS Selector Errors](https://help.autify.com/docs/how-to-fix-css-selector-errors) (MEDIUM confidence)
- [Selector Collisions](https://angular.dev/errors/NG0300) (MEDIUM confidence)

---

### Pitfall 7: Dynamic Content Timing and Race Conditions

**What goes wrong:** Automation tries to interact with elements before they load. AJAX requests complete after automation times out. Event handlers attach after automation clicks. Race conditions between content script initialization and page scripts executing.

**Why it happens:** Modern web apps load content asynchronously. Legacy ERPs have slow backend responses. Content scripts race with page initialization. Developers use fixed timeouts instead of condition-based waits.

**Consequences:**
- "Element not found" errors when element exists (loaded later)
- Clicks on elements before handlers attach (click does nothing)
- Automation works on fast machines, fails on slow networks
- Flaky playback: succeeds 80% of time, fails randomly 20%

**Prevention:**
- Implement smart waiting: poll for element existence + visibility + interactability
- Use MutationObserver to detect when dynamic content loads
- Wait for network idle before considering page "loaded"
- Add per-element timeout configuration (slow ERP endpoints need longer waits)
- Record page load timing during recording, apply similar waits during playback
- Implement retry logic with exponential backoff
- For content scripts: inject at `document_idle` by default, earlier only if needed
- Check `element.offsetParent !== null` to verify element is visible

**Detection (Warning Signs):**
- Automation works locally but fails in CI or on different network speeds
- Intermittent failures that resolve when workflow is re-run
- "Element not found" immediately followed by successful find 100ms later
- Automation works on cached pages but fails on fresh loads

**Phase Impact:** Phase 2 (Recording) and Phase 3 (Playback) - Timing strategy affects both recording metadata and playback engine

**Sources:**
- [Race Conditions in Web Applications 2026](https://momentic.ai/resources/the-ultimate-guide-to-race-condition-testing-in-web-applications) (MEDIUM confidence)
- [Race Condition Testing](https://portswigger.net/web-security/race-conditions) (HIGH confidence)

---

### Pitfall 8: LLM API Key Exposure

**What goes wrong:** API keys stored in extension code get exposed when users install extension. Keys hardcoded in JavaScript are readable in Chrome's extension folder. Keys in `chrome.storage` without encryption are accessible to malicious sites via XSS.

**Why it happens:** Developers treat extensions like server-side code. Forgetting that extension files are downloaded to user machines. Storing keys client-side for convenience.

**Consequences:**
- API keys stolen and abused (financial cost, rate limit exhaustion)
- Chrome Web Store rejection for security violations
- User accounts compromised if same keys used elsewhere
- Legal liability if user data processed with compromised keys

**Prevention:**
- NEVER bundle API keys in extension code
- Require users to provide their own API keys (user-owned credentials)
- If centralized key needed: proxy all LLM requests through your backend server
- Store user-provided keys encrypted in `chrome.storage.local`
- Use key rotation strategies for any server-side keys
- Implement rate limiting per-user on backend
- Display clear UI showing key is stored locally, never transmitted to your servers (unless proxied)
- Consider WebCrypto API for client-side key encryption with user passphrase

**Detection (Warning Signs):**
- API usage spikes from unknown sources
- Keys showing up in GitHub, extension code inspection tools
- Users concerned about where keys are stored
- Rate limits hit unexpectedly fast

**Phase Impact:** Phase 5 (LLM Integration) - Key management architecture must be designed before implementation

**Sources:**
- [Chrome Extension API Key Security](https://dev.to/notearthian/how-to-secure-api-keys-in-chrome-extension-3f19) (HIGH confidence - well-documented pattern)
- [Chrome Extensions Vulnerability Leaks API Keys](https://cyberpress.org/chrome-extensions-vulnerability/) (HIGH confidence - 2025/2026 incident)
- [Malicious Chrome Extension Steals API Keys](https://thehackernews.com/2026/01/malicious-chrome-extension-steals-mexc.html) (HIGH confidence - January 2026 report)

---

### Pitfall 9: LLM Rate Limiting Without Backoff

**What goes wrong:** Rapid-fire LLM API calls hit rate limits. Extension gets HTTP 429 errors. No retry logic means complete failure. User experience degrades when processing multiple recorded actions.

**Why it happens:** Treating LLM APIs like local function calls. Not implementing retry logic. Sending parallel requests without throttling. Different LLM providers have different rate limits (OpenAI, Anthropic, DeepSeek).

**Consequences:**
- Batch processing fails partway through
- Semantic analysis incomplete: some elements get hints, others don't
- Wasted API calls (failed requests count against rate limits)
- Poor user experience: "processing..." indefinitely with no feedback
- Users exceed free tier quotas faster than expected

**Prevention:**
- Implement exponential backoff with jitter (1s, 2s, 4s, 8s retries)
- Parse `Retry-After` header from 429 responses
- Use request queuing with rate limiting (e.g., max 3 requests per second)
- Show progress UI: "Processing 5/20 elements..."
- Implement request batching where provider supports it
- Add fallback logic: switch to simpler non-LLM selector generation if LLM unavailable
- Cache LLM responses for identical queries
- Consider using LLM gateway services (Portkey) for automatic fallback and retry

**Detection (Warning Signs):**
- HTTP 429 errors in background console
- Semantic analysis succeeds for first few elements, fails for rest
- Users report "stopped working after a few clicks"
- API costs higher than expected (retrying without backoff)

**Phase Impact:** Phase 5 (LLM Integration) - Retry/backoff must be part of initial LLM client implementation

**Sources:**
- [LLM API Rate Limiting Best Practices 2026](https://orq.ai/blog/api-rate-limit) (HIGH confidence)
- [Tackling Rate Limiting for LLM Apps](https://portkey.ai/blog/tackling-rate-limiting-for-llm-apps/) (HIGH confidence)
- [How to Handle LLM Rate Limits](https://docs.langchain.com/langsmith/rate-limiting) (MEDIUM confidence)

---

### Pitfall 10: MutationObserver Performance Degradation

**What goes wrong:** MutationObserver callbacks fire thousands of times on dynamic pages. Processing every DOM change causes lag and unresponsiveness. Recording captures excessive irrelevant changes.

**Why it happens:** Observing entire document with `{ childList: true, subtree: true }` without throttling. Modern SPAs mutate DOM constantly. Real-time collaboration tools, live dashboards, and dynamic content create mutation storms.

**Consequences:**
- Extension slows down pages noticeably
- High CPU usage, battery drain on laptops
- Recording captures animation frames and intermediate states (noise)
- Users disable extension because "it makes sites slow"

**Prevention:**
- Use targeted observation: observe specific container elements, not entire document
- Debounce mutation callbacks (collect changes, process batch after 100ms idle)
- Filter mutations: ignore style changes, only track structural/attribute changes relevant to recording
- Disconnect observer when not actively recording (don't observe 24/7)
- Use `{ attributes: true, attributeFilter: ['value', 'aria-*'] }` to limit which attributes trigger callbacks
- Consider IntersectionObserver for visibility tracking instead of MutationObserver
- Batch element analysis: process multiple changes in single LLM call

**Detection (Warning Signs):**
- Page scrolling feels janky with extension enabled
- CPU usage spikes when extension is active
- Callback fires 100+ times per second in console logs
- Users report performance issues on specific sites (SPAs, dashboards)

**Phase Impact:** Phase 2 (Recording) - Observer configuration impacts recording performance from day one

**Sources:**
- [Mutation Observer Performance](https://developer.chrome.com/blog/detect-dom-changes-with-mutation-observers) (HIGH confidence - official Chrome docs)
- [Mutation Events Deprecated](https://developer.chrome.com/blog/mutation-events-deprecation) (HIGH confidence)

---

## Minor Pitfalls

Issues that cause annoyance, edge cases, or minor UX degradation but are fixable.

### Pitfall 11: Shadow DOM Inaccessibility

**What goes wrong:** Cannot access elements inside closed Shadow DOM. Web components hide their internal structure. Selectors cannot penetrate shadow boundaries. Recording fails to capture interactions with shadow DOM content.

**Why it happens:** Closed shadow roots are intentionally inaccessible to preserve component encapsulation. Modern design systems (Material, Lit) use shadow DOM heavily. Extensions have same restrictions as page scripts.

**Consequences:**
- Cannot record interactions with modern web components
- Element selection fails on component internals
- Partial recording: outer click captured but not which internal button

**Prevention:**
- Detect shadow DOM: check `element.shadowRoot`
- For open shadow roots: traverse and record shadow DOM structure
- For closed shadow roots: document limitation clearly
- Record at shadow host level when internals inaccessible
- Consider using chrome.debugger API for deeper access (requires additional permissions, scary to users)
- Build workarounds: infer action from context when precise element unavailable

**Detection (Warning Signs):**
- Recording works on most sites but fails on modern component libraries
- "Element not found" on sites using web components
- Users report issues with specific design systems

**Phase Impact:** Phase 2 (Recording) - Shadow DOM handling is nice-to-have, not critical for MVP targeting legacy ERPs

**Sources:**
- [Chrome Extensions and Shadow DOM](https://blog.railwaymen.org/chrome-extensions-shadow-dom) (MEDIUM confidence)
- [Closed Shadow Root Access Proposal](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/JaHhogJuBOk) (LOW confidence - proposal not implemented)

---

### Pitfall 12: Session Timeout During Recording

**What goes wrong:** User records long workflow. Session expires mid-recording. Playback fails because authentication is lost. Particularly problematic for legacy ERP/SIRH systems with aggressive timeout policies.

**Why it happens:** Recording sessions span multiple pages and take time. Legacy systems time out after 15-30 minutes of inactivity. Authentication state not preserved between recording and playback.

**Consequences:**
- Recorded workflows fail at playback on authentication screens
- Cannot automate end-to-end flows that exceed session timeout
- User frustration: spent time recording, playback useless

**Prevention:**
- Detect session timeouts during recording: watch for redirect to login page
- Prompt user: "Session timeout detected, please re-authenticate to continue recording"
- Store cookie state at recording time (but don't replay - security issue)
- Document limitation: "Playback requires valid session"
- Consider building "pause and resume recording" feature for long workflows
- Add session health check before playback starts
- For automation: implement keep-alive pings during long workflows

**Detection (Warning Signs):**
- Playback fails at unpredictable steps with authentication errors
- Users report "works sometimes, fails other times" (session timing dependent)
- Failures correlate with time elapsed since login

**Phase Impact:** Phase 3 (Playback) - Session handling is enhancement, not blocker

**Sources:**
- [Session Management and Timeouts](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) (HIGH confidence)
- [Browser Automation Session Management 2026](https://www.skyvern.com/blog/browser-automation-session-management/) (HIGH confidence)

---

### Pitfall 13: Event Handler Race Conditions

**What goes wrong:** Click events get recorded but the actual event handler hasn't attached yet. Playback clicks element before handler attaches. Click registers but does nothing.

**Why it happens:** Modern frameworks (React, Vue) attach handlers asynchronously after initial render. Content script races with framework initialization. Clicking during React hydration phase.

**Consequences:**
- Clicks silently fail (element exists, click happens, but no handler responds)
- User confusion: "why didn't clicking work?"
- Works on second playback attempt (handlers attached by then)

**Prevention:**
- Wait for event handler attachment: check element properties for event listeners
- Add artificial delay after page load before enabling recording
- Record and replay user hesitation time (users naturally wait for page readiness)
- Verify interactivity: dispatch test event, verify it bubbles correctly
- For clicks: verify element is not disabled, not readonly, has valid handler

**Detection (Warning Signs):**
- Elements exist and are visible but clicks have no effect
- Works in manual testing but fails in automated playback
- First playback attempt fails, second succeeds
- Correlates with specific frameworks (React apps more affected)

**Phase Impact:** Phase 3 (Playback) - Handler readiness checks improve reliability

**Sources:**
- [Recording User Interactions Pitfalls](https://www.rrweb.io/) (MEDIUM confidence - rrweb library documentation)
- [User Interaction Recording Best Practices](https://webflow.com/blog/record-user-behavior-website) (LOW confidence)

---

### Pitfall 14: Permission Escalation on Update

**What goes wrong:** Adding new features that require additional host permissions triggers re-permission prompt. Extension gets disabled until user accepts new permissions. Users distrust "why does it need more permissions now?"

**Why it happens:** Initial MVP ships with minimal permissions. Later phases add features requiring broader access. Chrome enforces security by disabling extensions when new permissions are requested.

**Consequences:**
- Extension disabled for all users on update
- User trust damaged ("suspicious permission request")
- Support burden: users don't understand why extension stopped working
- Some users uninstall rather than accept new permissions

**Prevention:**
- Request maximum anticipated permissions from day one (even if not used yet)
- Use optional permissions: request additional permissions at feature use time, not update time
- Document permission rationale clearly in update notes
- Use `chrome.permissions.request()` in response to user action for optional permissions
- Phase permission additions: don't add multiple new permissions in single update
- Test permission flow in staging environment before production release

**Detection (Warning Signs):**
- Spike in support requests after update
- Reviews complaining about "suspicious new permissions"
- Extension disabled in chrome://extensions for many users

**Phase Impact:** Phase 1 (Architecture) - Permission strategy affects manifest design

**Sources:**
- [Manifest V3 Permissions Structure](https://extensionworkshop.com/documentation/develop/manifest-v3-migration-guide/) (HIGH confidence)
- [Host Permissions Behavior](https://developer.chrome.com/docs/extensions/mv3/mv3-migration/) (HIGH confidence)

---

## Phase-Specific Warnings

Recommendations for which phases need deeper research or vigilance around specific pitfalls.

| Phase | Topic | Likely Pitfall | Mitigation | Research Flag |
|-------|-------|----------------|------------|--------------|
| Phase 1 | Architecture | Service worker state management | Establish storage patterns first | CRITICAL |
| Phase 1 | Architecture | Message passing reliability | Build context invalidation handling into messaging layer | CRITICAL |
| Phase 1 | Manifest Design | Permission scope | Request all anticipated permissions up front | MODERATE |
| Phase 1 | CSP Compliance | Remote code prohibition | Strict data vs code separation | CRITICAL |
| Phase 2 | Element Recording | iframe cross-origin access | Implement all_frames pattern early | CRITICAL |
| Phase 2 | Selector Strategy | Collision and uniqueness | Validate POC multi-hint approach with real ERP sites | MODERATE |
| Phase 2 | DOM Observation | MutationObserver performance | Start with targeted observation, measure impact | MODERATE |
| Phase 2 | Dynamic Content | Timing and race conditions | Build smart waiting into recording metadata | MODERATE |
| Phase 2 | Shadow DOM | Component internals | Document limitations, focus on legacy ERP target | MINOR |
| Phase 3 | Playback Engine | Bot detection triggers | Add humanization layer from start | CRITICAL |
| Phase 3 | Timing | Race conditions on playback | Implement condition-based waits, not fixed delays | MODERATE |
| Phase 3 | Authentication | Session timeout handling | Detect and warn, document limitation | MINOR |
| Phase 3 | Event Handling | Handler attachment race | Add interactivity verification | MINOR |
| Phase 5 | LLM Integration | API key security | User-owned keys or backend proxy only | CRITICAL |
| Phase 5 | LLM Integration | Rate limiting | Implement backoff/retry from day one | MODERATE |
| All Phases | Updates | Context invalidation on auto-update | Test update scenarios continuously | MODERATE |
| All Phases | Testing | Legacy ERP compatibility | Test against real legacy apps early | CRITICAL |

## Research Recommendations

Areas where additional phase-specific research will be valuable:

1. **Phase 1: Permission Strategy**
   - Research exact permission combinations needed for all planned features
   - Investigate optional permissions for LLM integration vs required permissions

2. **Phase 2: Legacy ERP Compatibility**
   - Deep dive into specific ERP/SIRH systems (target market)
   - Document iframe patterns, non-standard HTML, session behaviors

3. **Phase 3: Bot Detection Landscape**
   - Research which anti-bot systems target market ERPs use
   - Determine if legacy internal apps have bot detection (unlikely)

4. **Phase 5: LLM Provider Comparison**
   - Research rate limits across providers (OpenAI, Anthropic, local models)
   - Evaluate tradeoffs: accuracy vs speed vs cost vs rate limits

## Confidence Assessment

| Area | Confidence | Rationale |
|------|------------|-----------|
| Service Worker Lifecycle | HIGH | Verified with official Chrome documentation |
| Context Invalidation | HIGH | Multiple developer reports, official docs, reproducible |
| iframe Cross-Origin | MEDIUM | Documented restrictions but workarounds exist |
| CSP Violations | HIGH | Official Manifest V3 requirements, well-documented |
| Bot Detection | MEDIUM | Industry practices documented but target market may not apply |
| Element Selectors | HIGH | POC learnings + industry best practices align |
| Race Conditions | HIGH | Well-understood web automation problem |
| API Key Security | HIGH | Recent 2025/2026 security incidents demonstrate criticality |
| LLM Rate Limiting | HIGH | All providers document rate limits, retry strategies |
| MutationObserver Performance | HIGH | Official Chrome guidance available |
| Shadow DOM | MEDIUM | Modern issue, less relevant for legacy ERP target |
| Session Timeout | MEDIUM | Documented security practice, legacy systems vary |
| Event Handler Races | MEDIUM | Framework-specific, testing will reveal extent |
| Permission Escalation | HIGH | Chrome's security model is well-documented |

## Known Gaps

Areas where research was incomplete or inconclusive:

1. **Specific Legacy ERP Behaviors:** Generic web automation research available, but target market (legacy ERP/SIRH systems) may have unique pitfalls. Need hands-on testing with real systems.

2. **LLM Provider-Specific Issues:** Rate limiting patterns documented generally, but specific providers' undocumented quirks will emerge during integration.

3. **Performance at Scale:** Unknown how extension performs with 100+ recorded steps, long workflows, or high-frequency automation. Load testing needed.

4. **Browser Compatibility:** Research focused on Chrome. Unknown if future Firefox/Edge support would introduce additional pitfalls.

## Sources Summary

**HIGH Confidence Sources (Official Documentation):**
- [Chrome Extension Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- [Known Issues - Manifest V3](https://developer.chrome.com/docs/extensions/develop/migrate/known-issues)
- [Manifest V3 Migration Guide](https://developer.chrome.com/docs/extensions/mv3/mv3-migration/)
- [Mutation Observers](https://developer.chrome.com/blog/detect-dom-changes-with-mutation-observers)
- [Session Management Best Practices](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)

**MEDIUM Confidence Sources (Community & Industry):**
- [Extension Context Invalidated Issues](https://github.com/crxjs/chrome-extension-tools/issues/673)
- [Chrome Extension API Key Security](https://dev.to/notearthian/how-to-secure-api-keys-in-chrome-extension-3f19)
- [Playwright Selector Best Practices 2026](https://www.browserstack.com/guide/playwright-selectors-best-practices)
- [Bypass Bot Detection 2026](https://www.zenrows.com/blog/bypass-bot-detection)
- [LLM API Rate Limiting](https://orq.ai/blog/api-rate-limit)
- [Tackling Rate Limiting for LLM Apps](https://portkey.ai/blog/tackling-rate-limiting-for-llm-apps/)
- [Browser Automation Session Management 2026](https://www.skyvern.com/blog/browser-automation-session-management/)

**Recent Security Incidents (HIGH Confidence - Factual Reports):**
- [Chrome Extensions Vulnerability Leaks API Keys](https://cyberpress.org/chrome-extensions-vulnerability/)
- [Malicious Chrome Extension Steals API Keys (Jan 2026)](https://thehackernews.com/2026/01/malicious-chrome-extension-steals-mexc.html)

**Cross-Reference Notes:**
Multiple sources corroborate the service worker termination timings (30s inactivity, 5min max operation, 30s fetch timeout). API key security concerns are validated by 2025/2026 security incidents affecting major extensions. Element selector best practices align across testing frameworks (Playwright, Cypress, Selenium).

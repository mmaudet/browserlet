# Browser Compatibility Matrix

## Build Commands

| Browser | Dev Server | Production Build | Package (zip) |
|---------|-----------|-----------------|---------------|
| Chrome | `npm run dev` | `npm run build` | `npm run zip` |
| Firefox | `npm run dev:firefox` | `npm run build:firefox` | `npm run zip:firefox` |

## Feature Compatibility

| Feature | Chrome MV3 | Firefox MV2 | Notes |
|---------|-----------|-------------|-------|
| **Sidebar** | sidePanel API | sidebar_action API | Different APIs, same UX |
| **Recording** | Full support | Full support | Standard DOM event listeners |
| **Playback** | Full support | Full support | Cascade resolver uses standard DOM APIs |
| **BSL Generation (Fallback)** | Full support | Full support | Pure data transformation, no browser APIs |
| **BSL Generation (LLM)** | Full support | Full support | Uses fetch() in service worker |
| **Semantic Resolver** | Full support | Full support | DOM queries + scoring |
| **Cascade Resolver (Stages 1-2)** | Full support | Full support | Deterministic resolution |
| **Micro-Prompts (Stages 3-5)** | Full support | Full support | Messages via chrome.runtime (polyfilled) |
| **Claude API** | Full support | Full support | @anthropic-ai/sdk uses fetch() |
| **Ollama** | Full support | Full support | ollama/browser uses fetch() |
| **OpenAI Compatible** | Full support | Full support | Raw fetch() calls |
| **Credential Vault** | Full support | Full support | WebCrypto + storage.local |
| **Script Storage** | Full support | Full support | storage.local via polyfill |
| **Hint Stability** | Full support | Full support | storage.local via polyfill |
| **Screenshots** | Full support | Full support | tabs.captureVisibleTab (activeTab) |
| **Triggers/Auto-execute** | Full support | Full support | Standard messaging |
| **Notifications** | Buttons supported | Basic only | Firefox lacks notification buttons |
| **Content Script Injection** | chrome.scripting API | Manifest-only | Firefox uses auto-registered content scripts |
| **Monaco Editor** | Full support | Full support | Inline script extracted to external file |

## Browser-Specific Code Locations

| File | What | Chrome | Firefox |
|------|------|--------|---------|
| `wxt.config.ts` | Manifest generation | sidePanel permission, side_panel config | sidebar_action config |
| `utils/firefoxPolyfill.ts` | API aliasing | No-op | Replaces chrome.* with browser.* |
| `utils/browser-detect.ts` | Build-time detection | isChrome = true | isFirefox = true |
| `utils/storage/browserCompat.ts` | Storage API | chrome.storage | browser.storage |
| `entrypoints/background/index.ts` | Sidebar open | chrome.sidePanel.open | browser.sidebarAction.toggle |
| `entrypoints/background/triggers/notifications.ts` | Notifications | Buttons included | Buttons omitted |
| `entrypoints/sidepanel/components/RecordingView.tsx` | Script injection | chrome.scripting.executeScript | Skipped (auto-registered) |
| `entrypoints/sidepanel/components/CredentialManager.tsx` | Script injection | chrome.scripting.executeScript | Skipped (auto-registered) |

## First-Run Instructions

### Chrome
1. Run `npm run build` or `npm run dev`
2. Open `chrome://extensions`, enable Developer Mode
3. Click "Load unpacked", select `.output/chrome-mv3`
4. Click the Browserlet icon in toolbar to open the side panel

### Firefox
1. Run `npm run build:firefox` or `npm run dev:firefox`
2. Open `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on", select any file in `.output/firefox-mv2`
4. Click the Browserlet icon in toolbar (or View > Sidebar > Browserlet) to open the sidebar
5. Note: Temporary add-ons are removed when Firefox closes. For persistent installation, use `npm run zip:firefox` and install from the generated .xpi file.

## Known Differences

1. **Notification buttons**: Firefox does not support `chrome.notifications` button actions. Auto-execute notifications show text-only on Firefox (no Stop/Disable buttons). In-page notifications still work.

2. **Content script injection**: Firefox does not support `chrome.scripting.executeScript` without the `scripting` permission. Content scripts are auto-registered via WXT manifest. If a content script is not loaded on a page, the user must refresh the page.

3. **Sidebar lifecycle**: Chrome's sidePanel is per-tab. Firefox's sidebar_action is global (opens for all tabs). Same HTML/JS, different scoping.

4. **Service worker lifecycle**: Firefox MV2 uses event pages (background scripts) rather than Chrome's service workers. The extension handles this via synchronous listener registration at the top of the background entry point.

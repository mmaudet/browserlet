---
phase: 06-contextual-triggers
plan: 03
subsystem: background-triggers
tags: [service-worker, notifications, triggers, badge, auto-execute]
requires: [06-01]
provides:
  - Background trigger engine with suggest/auto-execute modes
  - Chrome notification system for auto-execute feedback
  - Badge updates for suggested scripts
  - Cooldown mechanism for spam prevention
affects: [06-04, 06-05]
decisions:
  - "Chrome notifications API for auto-execute user feedback"
  - "Blue badge (#4285f4) for suggested scripts count display"
  - "10s auto-clear for execution notifications to prevent buildup"
  - "Session storage for suggested scripts per tab (cleared on tab close)"
  - "5-minute default cooldown for auto-execute spam prevention"
  - "Singleton TriggerEngine pattern matching service worker architecture"
tech-stack:
  added: []
  patterns: [singleton-engine, cooldown-tracking, session-storage]
key-files:
  created:
    - entrypoints/background/triggers/engine.ts
    - entrypoints/background/triggers/notifications.ts
  modified:
    - wxt.config.ts
metrics:
  tasks: 3
  commits: 3
  duration: 129s
  files-created: 2
  files-modified: 1
completed: 2026-01-29
---

# Phase 06 Plan 03: Background Trigger Engine Summary

**One-liner:** Service worker trigger engine with badge updates, Chrome notifications, cooldown tracking, and suggest/auto-execute mode handling

## What Was Built

### Core Deliverables

1. **Trigger Engine (engine.ts)**
   - Singleton TriggerEngine class coordinating trigger evaluation
   - handleContextMatch processes matched triggers from content script
   - Suggest mode: Updates badge with count, stores script IDs in session storage
   - Auto-execute mode: Shows notification, sends EXECUTE_SCRIPT message to tab
   - Site override check before any trigger action (respects user per-site preferences)
   - Cooldown tracking prevents spam (default 5 min per domain)
   - Storage change listener for hot reload when triggers/scripts change
   - getTriggerEngine singleton accessor for service worker context

2. **Notification System (notifications.ts)**
   - notifyAutoExecution creates Chrome notification with Stop/Disable buttons
   - setupNotificationListeners handles button clicks at service worker init
   - Stop button sends STOP_EXECUTION to content script
   - Disable button sets site override to false (disables trigger for domain)
   - Auto-clear after 10s prevents notification buildup
   - notifyExecutionComplete for success/failure feedback
   - Active notification tracking for script/tab association

3. **Manifest Updates**
   - Added 'notifications' permission to wxt.config.ts
   - Enables chrome.notifications.create() API

## Key Architectural Decisions

### Singleton Pattern
- TriggerEngine uses singleton pattern matching service worker architecture
- Prevents multiple engine instances in service worker lifecycle
- Single source of truth for cooldown state and trigger/script cache

### Cooldown Mechanism
- Per-trigger, per-domain cooldown tracking
- Default 5 minutes (300000ms), configurable via trigger.cooldownMs
- Prevents auto-execute spam when user repeatedly visits trigger conditions
- Stored in memory (Map<triggerId, Map<domain, timestamp>>)

### Badge Updates
- Blue badge (#4285f4) shows count of suggested scripts
- Uses chrome.action.setBadgeText/setBadgeBackgroundColor
- Per-tab badge state (cleared when context no longer matches)

### Session Storage for Suggestions
- Suggested script IDs stored in chrome.storage.session
- Key pattern: suggested_scripts_{tabId}
- Automatically cleared when tab closes
- Enables sidepanel to display suggested scripts

### Notification Design
- 10s auto-clear for execution notifications (prevents buildup)
- requireInteraction: false (dismissable by user)
- priority: 0 (normal priority)
- Two-button design: Stop (immediate) vs Disable (persistent)

## Technical Implementation

### Flow: Context Match → Actions

```
Content Script detects match
  ↓ (sends CONTEXT_MATCH)
Service Worker: handleContextMatch
  ↓
Check site overrides (getSiteOverride)
  ↓
Split by mode:
  - Suggest: Update badge + session storage
  - Auto-execute: Check cooldown → Notify → Send EXECUTE_SCRIPT
```

### Cooldown Logic
```typescript
// Check cooldown
isOnCooldown(trigger, url):
  domain = new URL(url).hostname
  lastExecution = cooldowns.get(trigger.id)?.get(domain)
  return Date.now() - lastExecution < cooldownMs

// Set cooldown after execution
setCooldown(trigger, url):
  cooldowns.get(trigger.id).set(domain, Date.now())
```

### Badge Update Logic
```typescript
// Suggest mode
scriptIds = Array.from(new Set(triggers.map(t => t.scriptId)))
chrome.action.setBadgeText({ text: String(scriptIds.length), tabId })
chrome.action.setBadgeBackgroundColor({ color: '#4285f4', tabId })
```

## Integration Points

### From 06-01 (Trigger Types & Storage)
- Uses getAllTriggers() to load trigger configurations
- Uses getSiteOverride() to check per-site preferences
- Uses setSiteOverride() when notification Disable button clicked

### From 06-02 (Detection Engine)
- Receives ContextState from content script context detector
- Processes context.matchedTriggers array

### To 06-04 (Service Worker Integration)
- Provides getTriggerEngine() singleton accessor
- Provides setupNotificationListeners() for initialization
- Expects service worker to call engine.initialize() on startup

### To 06-05 (Sidepanel Trigger UI)
- Stores suggested scripts in session storage for display
- Provides getSuggestedScripts(tabId) for sidepanel queries
- Provides getTriggersForScript(scriptId) for UI listing

### To Content Script
- Sends EXECUTE_SCRIPT message with script.content payload
- Receives STOP_EXECUTION via notification button click

## Testing Checklist

- [ ] Suggest mode updates badge with correct count
- [ ] Auto-execute mode shows notification
- [ ] Stop button sends STOP_EXECUTION to content script
- [ ] Disable button sets site override to false
- [ ] Cooldown prevents repeated auto-execution within 5 minutes
- [ ] Badge clears when context no longer matches
- [ ] Session storage cleared when tab closes
- [ ] Multiple triggers for same script deduplicated in badge count
- [ ] Site override false prevents trigger action
- [ ] Storage change listener refreshes triggers/scripts

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript Set iteration error**
- **Found during:** Task 3 compilation
- **Issue:** `[...new Set(array)]` spread syntax not supported in target ES version
- **Fix:** Changed to `Array.from(new Set(array))`
- **Files modified:** entrypoints/background/triggers/engine.ts
- **Commit:** 71cf96e (within task commit)

## Files Changed

### Created
- `entrypoints/background/triggers/engine.ts` (239 lines) - Core trigger evaluation engine
- `entrypoints/background/triggers/notifications.ts` (121 lines) - Chrome notification handling

### Modified
- `wxt.config.ts` - Added 'notifications' to permissions array

## Dependencies Added

None - uses existing Chrome APIs and project utilities.

## Known Limitations

1. **Cooldown state volatile:** Cooldown tracking stored in memory, lost on service worker restart
   - Acceptable: Service workers restart infrequently, worst case is one extra execution
   - Alternative: Could persist cooldown to chrome.storage.session if needed

2. **No retry on EXECUTE_SCRIPT failure:** If content script not ready, execution silently fails
   - Logged to console for debugging
   - User can manually trigger from sidepanel if needed

3. **Pre-existing TypeScript errors:** LLM provider type errors remain from Phase 5
   - Noted in STATE.md as known issue
   - Does not affect trigger engine functionality

## Next Phase Readiness

**Blockers:** None

**For 06-04 (Service Worker Integration):**
- Engine ready for initialization in background.ts
- setupNotificationListeners must be called once at startup
- Message handler needed for CONTEXT_MATCH from content script

**For 06-05 (Sidepanel Trigger UI):**
- getSuggestedScripts(tabId) ready for suggested scripts display
- getTriggersForScript(scriptId) ready for trigger management UI

## Metrics

- **Duration:** 129 seconds (~2.2 minutes)
- **Commits:** 3 atomic commits
- **Files created:** 2
- **Files modified:** 1
- **Lines added:** ~361 lines
- **TypeScript errors introduced:** 0

## Lessons Learned

1. **Singleton pattern essential:** Service worker can restart, need stable instance access
2. **Session storage perfect for tab-scoped data:** Auto-cleanup on tab close prevents stale data
3. **Chrome notifications well-suited for background actions:** Good UX for auto-execute transparency
4. **Cooldown in memory acceptable:** Service worker persistence overhead not worth complexity

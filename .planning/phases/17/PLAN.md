---
phase: 17-self-healing-removal
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  # Plan 01 - Delete healing code in reverse dependency order
  - entrypoints/sidepanel/components/RepairPanel.tsx
  - entrypoints/sidepanel/components/HealingHistory.tsx
  - entrypoints/sidepanel/stores/healing.ts
  - entrypoints/sidepanel/main.tsx
  - entrypoints/sidepanel/components/ScriptEditor.tsx
  - entrypoints/content/index.ts
  - entrypoints/content/playback/index.ts
  - entrypoints/content/playback/healingDetector.ts
  - entrypoints/content/playback/types.ts
  - entrypoints/background/messaging.ts
  - entrypoints/background/llm/prompts/healingPrompt.ts
  - entrypoints/background/index.ts
  - utils/storage/healing.ts
  - utils/types.ts
  - entrypoints/content/recording/visualFeedback.ts
  - entrypoints/content/recording/styles.ts
  - public/_locales/en/messages.json
  - public/_locales/fr/messages.json
  - utils/storage/screenshots.ts
  - README.md
autonomous: true

must_haves:
  truths:
    - "No healing UI is visible anywhere in the side panel (RepairPanel, HealingHistory gone)"
    - "PlaybackManager no longer enters waiting_healing state or emits healing_requested events"
    - "Background messaging handler has no HEALING_* case branches"
    - "TypeScript compiles with zero errors after all healing types, handlers, and state are removed"
    - "Extension loads and basic recording/playback still works after deletion"
  artifacts:
    - path: "entrypoints/sidepanel/components/RepairPanel.tsx"
      provides: "DELETED - was healing UI"
    - path: "entrypoints/sidepanel/components/HealingHistory.tsx"
      provides: "DELETED - was healing history display"
    - path: "entrypoints/sidepanel/stores/healing.ts"
      provides: "DELETED - was healing reactive state"
    - path: "entrypoints/content/playback/healingDetector.ts"
      provides: "DELETED - was healing detection logic"
    - path: "entrypoints/background/llm/prompts/healingPrompt.ts"
      provides: "DELETED - was LLM healing prompt builder"
    - path: "utils/storage/healing.ts"
      provides: "DELETED - was healing audit trail storage"
    - path: "entrypoints/content/playback/types.ts"
      provides: "PlaybackState without waiting_healing, no HealingContext or RepairSuggestion types"
      contains: "'idle' | 'running' | 'paused' | 'waiting_auth' | 'stopped'"
    - path: "utils/types.ts"
      provides: "MessageType without any HEALING_* entries"
  key_links:
    - from: "entrypoints/sidepanel/main.tsx"
      to: "entrypoints/sidepanel/stores/healing.ts"
      via: "import removed"
      pattern: "no import.*healing"
    - from: "entrypoints/content/playback/index.ts"
      to: "entrypoints/content/playback/healingDetector.ts"
      via: "import removed"
      pattern: "no import.*healingDetector"
    - from: "entrypoints/background/messaging.ts"
      to: "utils/storage/healing.ts"
      via: "import removed"
      pattern: "no import.*healing"
---

<objective>
Delete ALL self-healing code from the Browserlet codebase in reverse dependency order (UI -> stores -> PlaybackManager -> core modules -> storage utils -> types -> message handlers -> localization). This is a surgical deletion phase -- no new features, only removal.

Purpose: Clear the codebase of non-functional self-healing code before building the cascade resolver in Phase 19. Self-healing was shipped in v1.4 but proved non-functional in real conditions and is being replaced by the deterministic-first cascade architecture.

Output: Clean codebase with zero healing references (outside comments/changelog), compiling with zero TypeScript errors.
</objective>

<execution_context>
@/Users/mmaudet/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mmaudet/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/research/PITFALLS.md (Pitfall 2: self-healing deletion leaves integration ghosts)
@.planning/STATE.md

Key files to modify (read these before starting):
@entrypoints/sidepanel/main.tsx
@entrypoints/sidepanel/components/ScriptEditor.tsx
@entrypoints/content/index.ts
@entrypoints/content/playback/index.ts
@entrypoints/content/playback/types.ts
@entrypoints/background/messaging.ts
@entrypoints/background/index.ts
@utils/types.ts
@entrypoints/content/recording/visualFeedback.ts
@entrypoints/content/recording/styles.ts
@public/_locales/en/messages.json
@public/_locales/fr/messages.json
@utils/storage/screenshots.ts
@README.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Delete healing files and remove all imports/integrations in reverse dependency order</name>
  <files>
    entrypoints/sidepanel/components/RepairPanel.tsx
    entrypoints/sidepanel/components/HealingHistory.tsx
    entrypoints/sidepanel/stores/healing.ts
    entrypoints/sidepanel/main.tsx
    entrypoints/sidepanel/components/ScriptEditor.tsx
    entrypoints/content/index.ts
    entrypoints/content/playback/index.ts
    entrypoints/content/playback/healingDetector.ts
    entrypoints/content/playback/types.ts
    entrypoints/background/messaging.ts
    entrypoints/background/llm/prompts/healingPrompt.ts
    entrypoints/background/index.ts
    utils/storage/healing.ts
    utils/types.ts
    entrypoints/content/recording/visualFeedback.ts
    entrypoints/content/recording/styles.ts
  </files>
  <action>
Delete healing code in 7 layers (reverse dependency order). CRITICAL: Follow this exact order to avoid cascading import errors during incremental compilation checks.

**Layer 1 - Delete UI Components (nothing depends on these):**
- DELETE entire file: `entrypoints/sidepanel/components/RepairPanel.tsx`
- DELETE entire file: `entrypoints/sidepanel/components/HealingHistory.tsx`

**Layer 2 - Delete Sidepanel Store:**
- DELETE entire file: `entrypoints/sidepanel/stores/healing.ts`

**Layer 3 - Clean Sidepanel Integration:**
- `entrypoints/sidepanel/main.tsx`:
  - Remove import line: `import { initializeHealingListeners, hasPendingRepairs } from './stores/healing';`
  - Remove import line: `import { RepairPanel } from './components/RepairPanel';`
  - In `CompletionModal` function: remove the `|| hasPendingRepairs.value` condition from the early return (line ~31). The line `if (!showCompletionModal.value || hasPendingRepairs.value) return null;` should become `if (!showCompletionModal.value) return null;`
  - Remove the comment lines 29-30 about healing
  - Remove the RepairPanel render block (lines ~447-452): the entire `{(hasPendingRepairs.value || isExecuting.value) && (` block including `<RepairPanel />`). Keep the `{/* Bottom action bar */}` section below it.
  - Remove `initializeHealingListeners();` call in init() function (line ~468)
  - Remove the comment on line ~467 about healing listeners
- `entrypoints/sidepanel/components/ScriptEditor.tsx`:
  - Remove import: `import { HealingHistory } from './HealingHistory';`
  - Remove the HealingHistory render: `<HealingHistory scriptId={script.id} />` (line ~140) and its comment on line ~139

**Layer 4 - Clean Content Script Message Handlers:**
- `entrypoints/content/index.ts`:
  - Remove import: `import type { HealingOverlayState } from './recording/visualFeedback';`
  - Remove variable: `let healingOverlay: HighlightOverlay | null = null;` (line 19)
  - Remove entire case blocks for: `'HIGHLIGHT_HEALING_ELEMENT'` (lines ~299-345), `'TEST_REPAIR'` (lines ~348-402), `'HEALING_APPROVED'` (lines ~405-411), `'HEALING_REJECTED'` (lines ~414-420)
  - Keep the `HighlightOverlay` import (it is also used for recording overlay), but it is only imported for healing -- check if HighlightOverlay is used elsewhere in this file. Actually, the healing overlay is the only usage of HighlightOverlay in content/index.ts. However, the import `import { CredentialCaptureIndicator, HighlightOverlay } from './recording/visualFeedback';` -- keep `CredentialCaptureIndicator`, remove `HighlightOverlay` from this import since it is no longer used in this file.

**Layer 5 - Clean PlaybackManager (core healing state):**
- `entrypoints/content/playback/index.ts`:
  - Remove imports from healingDetector (lines ~36-44): `detectHealingNeeded`, `buildHealingContext`, `getHealingAttempts`, `incrementHealingAttempts`, `resetHealingAttempts`, `maxHealingAttemptsReached`, `HEALING_CONFIDENCE_THRESHOLD`, `MAX_HEALING_ATTEMPTS`
  - Remove `HealingContext` from the types import (line ~25)
  - In the PlaybackEventHandler type (line ~51): remove `'healing_requested'` from the union type, remove `healingContext?: HealingContext` property
  - Remove private fields from PlaybackManager class: `healingResolver` (line ~81), `pendingHealingContext` (line ~82)
  - In `execute()` method: remove `resetHealingAttempts()` call (line ~299)
  - In the element resolution loop (starting ~line 476): replace the healing-aware resolution logic with a simpler version. Currently the loop has `detectHealingNeeded` checks, `maxHealingAttemptsReached`, `incrementHealingAttempts`, `buildHealingContext`, and `requestHealing` calls. Replace with a direct fail path:
    - When `result.element === null || result.confidence < 0.7`: instead of triggering healing, throw a step error immediately with the same error message format: `Element not found. {matchedHints info}. Confidence: {confidence}%`
    - Remove the entire "healing attempt" loop wrapping the resolution
    - Similarly for the timeout path (~lines 556-610): remove healing retry logic, just fail the step
  - Remove methods: `requestHealing()` (~lines 696-729), `applyHealing()` (~lines 734-748), `rejectHealing()` (~lines 752-764), `getPendingHealingContext()` (~lines 769-772)
  - Remove healing-related re-exports at bottom of file (~lines 787-798): the re-exports of `detectHealingNeeded`, `buildHealingContext`, `getHealingAttempts`, etc.

- DELETE entire file: `entrypoints/content/playback/healingDetector.ts`

**Layer 6 - Clean Background Messaging and Prompts:**
- `entrypoints/background/messaging.ts`:
  - Remove imports (lines 8-9): `import { buildHealingPrompt, parseHealingResponse } from './llm/prompts/healingPrompt';` and `import type { HealingPromptContext } from './llm/prompts/healingPrompt';`
  - Remove imports (lines 17-18): `import { getHealingHistory, addHealingRecord, markHealingUndone } from '../../utils/storage/healing';` and `import type { HealingRecord } from '../../utils/storage/healing';`
  - Remove entire case blocks: `'HEALING_REQUESTED'` (~lines 282-348), `'APPLY_REPAIR'` (~lines 351-423), `'HEALING_REJECTED'` (~lines 425-431), `'GET_HEALING_HISTORY'` (~lines 434-438), `'UNDO_HEALING'` (~lines 441-486)
  - Note: The `'APPLY_REPAIR'` handler also calls `getScript`, `saveScript`, `updateStepHints` -- these imports are still needed for other functionality, do NOT remove them

- DELETE entire file: `entrypoints/background/llm/prompts/healingPrompt.ts`

- `entrypoints/background/index.ts`:
  - Update comment on line 60: change `// Initialize LLM service from stored config (for self-healing, etc.)` to `// Initialize LLM service from stored config (for BSL generation, etc.)`

**Layer 7 - Clean Storage, Types, Visual Feedback:**
- DELETE entire file: `utils/storage/healing.ts`

- `utils/types.ts`:
  - Remove all healing MessageType entries (lines 57-67): `'HEALING_REQUESTED'`, `'HEALING_SUGGESTION'`, `'TEST_REPAIR'`, `'TEST_REPAIR_RESULT'`, `'APPLY_REPAIR'`, `'HEALING_APPROVED'`, `'HEALING_REJECTED'`, `'HIGHLIGHT_HEALING_ELEMENT'`, `'GET_HEALING_HISTORY'`, `'UNDO_HEALING'`
  - Remove the comment `// Self-healing selector messages`

- `entrypoints/content/playback/types.ts`:
  - In `PlaybackState` type (line 75): remove `'waiting_healing'` -- result: `'idle' | 'running' | 'paused' | 'waiting_auth' | 'stopped'`
  - Remove the comment `// Context for healing when element resolution fails` (line 77)
  - Remove the `HealingContext` interface entirely (lines 78-99)
  - Remove the comment `// LLM-suggested repair for failed element resolution` (line 101)
  - Remove the `RepairSuggestion` interface entirely (lines 102-109)

- `entrypoints/content/recording/visualFeedback.ts`:
  - Remove import of `HEALING_OVERLAY_STYLES` from styles import (line 1)
  - Remove `HealingOverlayState` type export (line 6)
  - Remove private field `healingStyleElement` (line 17)
  - Remove private field `currentHealingState` (line 18)
  - In constructor/show method: remove `this.currentHealingState = null;` (line 30)
  - In `hide()` method: remove the `healingStyleElement` cleanup block (lines 56-59) and `this.currentHealingState = null;` (line 62)
  - In `setState()` method: remove `this.currentHealingState = null;` (line 71)
  - Remove entire method `setHealingState()` (lines 78-96)
  - Remove entire method `showHealing()` (lines 99-132)
  - Remove entire method `getHealingState()` (lines 142-145)

- `entrypoints/content/recording/styles.ts`:
  - Remove the entire `HEALING_OVERLAY_STYLES` constant and its comment (lines 38-78)

After all deletions, run `npx tsc --noEmit` to confirm zero TypeScript errors.
  </action>
  <verify>
Run the following commands in sequence:
1. `npx tsc --noEmit` -- must show zero errors
2. `npm run build` -- must succeed with no errors
3. Verify deleted files are gone: `ls entrypoints/sidepanel/components/RepairPanel.tsx entrypoints/sidepanel/components/HealingHistory.tsx entrypoints/sidepanel/stores/healing.ts entrypoints/content/playback/healingDetector.ts entrypoints/background/llm/prompts/healingPrompt.ts utils/storage/healing.ts 2>&1` -- all should show "No such file"
  </verify>
  <done>
All 6 healing files deleted. All healing imports, message handlers, state management, UI components, type definitions, and visual feedback code removed. TypeScript compiles with zero errors. Build succeeds.
  </done>
</task>

<task type="auto">
  <name>Task 2: Clean localization, documentation, add storage migration, verify with grep and bundle size</name>
  <files>
    public/_locales/en/messages.json
    public/_locales/fr/messages.json
    utils/storage/screenshots.ts
    README.md
    entrypoints/background/index.ts
  </files>
  <action>
**Localization cleanup:**
- `public/_locales/en/messages.json`: Remove all healing-related i18n keys (lines ~959-1039):
  - Remove keys: `repairs`, `repairsPending`, `testRepair`, `applyFix`, `rejectRepair`, `originalHints`, `proposedHints`, `confidenceScore`, `llmReason`, `domContext`, `testPassed`, `testFailed`, `saveFix`, `waitingHealing`, `healingHistory`, `undoHealing`, `healingUndone`, `noHealingHistory`, `repairedOn`
  - Also remove `healingInProgress` key if it exists
  - Keep proper JSON structure (no trailing commas after the last entry before these were removed)

- `public/_locales/fr/messages.json`: Remove the exact same set of keys as English (lines ~959-1039)

**Documentation cleanup:**
- `utils/storage/screenshots.ts`: Line 4 has comment `* Follows patterns from history.ts and healing.ts` -- change to `* Follows patterns from history.ts`

- `README.md`:
  - Line 21: Remove the `### Self-Healing Selectors` section header and any content below it that describes healing (check what follows and remove the healing-specific content)
  - Line 303: Update `│       ├── components/   # UI components (RepairPanel, ScreenshotGallery, etc.)` to remove RepairPanel mention: `│       ├── components/   # UI components (ScreenshotGallery, etc.)`
  - Line 304: Update `│       └── stores/       # State management (execution, healing, etc.)` to remove healing mention: `│       └── stores/       # State management (execution, etc.)`
  - Line 306: Update `│   ├── storage/          # Chrome storage (scripts, history, screenshots, healing)` to remove healing: `│   ├── storage/          # Chrome storage (scripts, history, screenshots)`
  - Line 309: Remove the line `│   ├── healing/          # Self-healing (detector, prompt builder)` entirely (this directory path does not exist as actual directory; the files were in different locations)
  - Line 328: Update the version table -- change `| v1.4 | Data Extraction, Self-Healing, Screenshots | ✅ Shipped |` to `| v1.4 | Data Extraction, Screenshots | ✅ Shipped |`

**Storage migration for orphaned keys:**
- `entrypoints/background/index.ts`: Add a storage migration in the `onInstalled` handler for the `'update'` case. Inside the `if (details.reason === 'update')` block, add code to clear all `browserlet_healing_*` keys from chrome.storage.local:

```typescript
if (details.reason === 'update') {
  console.log('[Browserlet] Extension updated from', details.previousVersion);

  // v1.5 migration: clear orphaned healing storage keys (self-healing removed)
  try {
    const allKeys = await storage.local.get(null);
    const healingKeys = Object.keys(allKeys).filter(key => key.startsWith('browserlet_healing_'));
    if (healingKeys.length > 0) {
      await storage.local.remove(healingKeys);
      console.log(`[Browserlet] Cleared ${healingKeys.length} orphaned healing storage keys`);
    }
  } catch (error) {
    console.error('[Browserlet] Failed to clear healing storage keys:', error);
  }
}
```

This ensures existing users who upgrade will have their orphaned `browserlet_healing_*` keys cleaned up silently. The `storage` import from `../../utils/storage/browserCompat` is already present in the file.

**Final verification:**
After all changes, run:
1. `grep -r "healing\|Healing\|HEALING" --include="*.ts" --include="*.tsx" --include="*.json" --exclude-dir=node_modules --exclude-dir=.output --exclude-dir=.planning --exclude="CHANGELOG.md"` -- should return zero matches outside comments. A few acceptable exceptions:
   - The storage migration code in `background/index.ts` that clears healing keys (this references the string `browserlet_healing_` for cleanup)
   - Any remaining references in `.planning/` or `CHANGELOG.md` are acceptable
2. Build the extension and record bundle size: `npm run build` -- compare total size against baseline (5.22 MB). Record the delta.
3. Run `npx tsc --noEmit` one final time to confirm clean compilation.
  </action>
  <verify>
1. `npx tsc --noEmit` -- zero errors
2. `npm run build` -- succeeds, record bundle size from output
3. `grep -rn "healing\|Healing\|HEALING" --include="*.ts" --include="*.tsx" --include="*.json" entrypoints/ utils/ public/` -- only matches should be the storage migration cleanup code in `background/index.ts` referencing `browserlet_healing_` string literal for key prefix matching
4. Verify storage migration code exists: `grep -n "browserlet_healing_" entrypoints/background/index.ts` -- should show the migration code
  </verify>
  <done>
All healing i18n keys removed from en/fr localization files. README updated to remove healing references. Storage migration added to clear orphaned `browserlet_healing_*` keys on extension update. Grep verification confirms zero healing references outside migration code. Bundle size decreased (delta recorded). HEAL-01 through HEAL-08 all satisfied.
  </done>
</task>

</tasks>

<verification>
Phase 17 is complete when ALL of the following are true:

1. **HEAL-01**: RepairPanel.tsx and HealingHistory.tsx deleted, no healing UI rendered in sidepanel
2. **HEAL-02**: utils/storage/healing.ts deleted, no healing storage utilities remain
3. **HEAL-03**: All HEALING_* message handlers removed from background/messaging.ts
4. **HEAL-04**: HealingContext, RepairSuggestion, HealingOverlayState type definitions removed
5. **HEAL-05**: PlaybackManager has no healing state (`waiting_healing`), no `healing_requested` events
6. **HEAL-06**: Storage migration in background/index.ts clears `browserlet_healing_*` keys on update
7. **HEAL-07**: `grep -r "healing|Healing|HEALING"` returns zero matches in source code (except migration cleanup string)
8. **HEAL-08**: Extension bundle size decreased vs baseline (5.22 MB total, 120.93 KB content.js)
9. **TypeScript**: `npx tsc --noEmit` returns zero errors
10. **Build**: `npm run build` succeeds with no errors
</verification>

<success_criteria>
- 6 files completely deleted (RepairPanel.tsx, HealingHistory.tsx, healing.ts store, healingDetector.ts, healingPrompt.ts, healing.ts storage)
- 14 files modified to remove healing references
- Zero TypeScript errors
- Zero grep matches for healing (outside migration code and .planning/)
- Bundle size decreased
- Storage migration runs on extension update
</success_criteria>

<output>
After completion, create `.planning/phases/17/17-01-SUMMARY.md`
</output>

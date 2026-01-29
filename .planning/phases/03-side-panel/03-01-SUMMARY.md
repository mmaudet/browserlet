---
phase: 03-side-panel
plan: 01
subsystem: ui
tags: [monaco-editor, i18n, vite, yaml, vanjs]

# Dependency graph
requires:
  - phase: 02-recording
    provides: Recording infrastructure and types
provides:
  - Monaco Editor configured with Vite worker bundling
  - i18n infrastructure with English and French locales
  - Phase 3 UI dependencies (vanjs-core, file-saver, js-yaml, @json2csv/plainjs)
affects: [03-02, 03-03, 03-04, 03-05]

# Tech tracking
tech-stack:
  added: [monaco-editor, monaco-yaml, vite-plugin-monaco-editor, js-yaml, vanjs-core, file-saver, @json2csv/plainjs]
  patterns: [ESM/CJS interop handling, public/ static assets for WXT]

key-files:
  created:
    - public/_locales/en/messages.json
    - public/_locales/fr/messages.json
  modified:
    - package.json
    - wxt.config.ts

key-decisions:
  - "ESM/CJS interop for vite-plugin-monaco-editor using fallback pattern"
  - "i18n files in public/ directory for WXT static asset copying"
  - "Comprehensive i18n keys for all Phase 3 UI strings upfront"

patterns-established:
  - "ESM/CJS interop: (module as any).default || module pattern"
  - "Static assets: place in public/ for WXT builds"

# Metrics
duration: 4min
completed: 2026-01-29
---

# Phase 3 Plan 01: Dependencies and Monaco Setup Summary

**Monaco Editor + vite-plugin-monaco-editor configured with ESM/CJS interop, plus bilingual i18n (EN/FR) for all Phase 3 UI strings**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-29T12:05:00Z
- **Completed:** 2026-01-29T12:09:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Installed all Phase 3 dependencies (monaco-editor, monaco-yaml, vanjs-core, js-yaml, file-saver, @json2csv/plainjs)
- Configured Monaco Editor Vite plugin with proper ESM/CJS interop handling
- Created comprehensive i18n locale files for English and French with all Phase 3 UI strings
- Extension builds successfully with Monaco workers and locales included

## Task Commits

Each task was committed atomically:

1. **Task 1: Install npm dependencies** - `55e07b9` (chore)
2. **Task 2: Configure Monaco in WXT and add i18n** - `a052adc` (feat)

## Files Created/Modified
- `package.json` - Added 8 new dependencies for Phase 3
- `wxt.config.ts` - Monaco Vite plugin configuration with i18n manifest settings
- `public/_locales/en/messages.json` - English translations (50+ keys)
- `public/_locales/fr/messages.json` - French translations (50+ keys)

## Decisions Made
- **ESM/CJS interop pattern:** Used `(module as any).default || module` to handle vite-plugin-monaco-editor's inconsistent exports between ESM and CJS contexts
- **Static assets location:** Placed _locales in public/ directory since WXT copies public/ contents to output, not root-level directories
- **Comprehensive i18n upfront:** Included all expected Phase 3 UI strings in initial locale files to avoid piecemeal additions

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed Monaco plugin ESM/CJS import**
- **Found during:** Task 2 (Configure Monaco in WXT)
- **Issue:** vite-plugin-monaco-editor has ESM/CJS interop issues - `.default.default()` was being called incorrectly
- **Fix:** Added interop handling: `const monacoEditorPlugin = (monacoEditorPluginModule as any).default || monacoEditorPluginModule`
- **Files modified:** wxt.config.ts
- **Verification:** Build succeeds without errors
- **Committed in:** a052adc (Task 2 commit)

**2. [Rule 3 - Blocking] Moved _locales to public/ directory**
- **Found during:** Task 2 (Configure Monaco in WXT)
- **Issue:** _locales directory at root was not being copied to build output
- **Fix:** Created public/ directory and moved _locales there - WXT copies public/ contents to output
- **Files modified:** Moved _locales/ to public/_locales/
- **Verification:** Build output includes _locales/en/messages.json and _locales/fr/messages.json
- **Committed in:** a052adc (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both auto-fixes were necessary for the build to succeed. No scope creep.

## Issues Encountered
None beyond the blocking issues that were auto-fixed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Monaco Editor configured and ready for use in script editor component
- i18n infrastructure in place for all UI components
- All Phase 3 dependencies installed and verified
- Ready for Plan 02: Script types and storage

---
*Phase: 03-side-panel*
*Completed: 2026-01-29*

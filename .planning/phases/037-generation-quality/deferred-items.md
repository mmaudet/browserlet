# Deferred Items - Phase 037

## Pre-existing Test Failure

- **File:** `tests/content/playback/semanticResolver.test.ts`
- **Test:** `HINT_WEIGHTS > should have exactly 13 hint types`
- **Issue:** Test hardcodes 13 hint types but Phase 036 added `landmark_context` (14th type). Test needs updating to expect 14.
- **Origin:** Phase 036 (not caused by 037 changes)
- **Fix:** Change `toHaveLength(13)` to `toHaveLength(14)` in line 74

---
phase: 035-bsl-integration-validation
plan: 01
subsystem: core-parser
tags: [parser, types, bsl, session-persistence, tdd]
dependency_graph:
  requires: []
  provides: [SessionPersistenceConfig, parseSessionPersistence, BSL-session-persistence-field]
  affects: [core-parser, extension-import]
tech_stack:
  added: []
  patterns: [parser-validation, optional-field-extraction]
key_files:
  created: []
  modified:
    - packages/core/src/types/bsl.ts
    - packages/core/src/types/index.ts
    - packages/core/src/parser/stepParser.ts
    - tests/utils/yaml/stepParser.test.ts
    - utils/yaml/parser.ts
decisions:
  - "SessionPersistenceConfig validated at parse-time (enabled boolean required, max_age/snapshot_id optional strings)"
  - "Extension Script.sessionPersistence uses different format ({enabled, ttl?}) than ParsedScript ({enabled, max_age?, snapshot_id?})"
  - "Import bridge maps enabled directly but does not map max_age to ttl (extension uses its own default)"
  - "Syntactic validation only for max_age string format (no ms library call in shared parser)"
metrics:
  duration: 181
  tasks_completed: 2
  files_modified: 5
  commits: 2
  tests_added: 7
  completed_date: 2026-02-16
---

# Phase 035 Plan 01: BSL Session Persistence Parser Summary

**One-liner:** Added session_persistence as first-class BSL metadata field with TypeScript interface, parser validation, comprehensive tests, and extension import bridge.

## Objective

Add session_persistence as a first-class BSL metadata field: define the TypeScript interface, implement parser validation following the existing parseSessionCheck pattern, add comprehensive tests, and bridge the field to extension Script type during import.

Purpose: Enable BSL-01 (declare session_persistence) and BSL-02 (parser validates and exposes to execution engine). Also bridges parsed metadata to extension Script type on import so existing execution.ts session logic works automatically.

## What Was Built

### Task 1: Add SessionPersistenceConfig type and parser validation
**Commit:** bac111a

1. **Type Definition** - Added `SessionPersistenceConfig` interface to `packages/core/src/types/bsl.ts`:
   - `enabled: boolean` (required)
   - `max_age?: string` (optional, e.g., "72h", "30d")
   - `snapshot_id?: string` (optional, custom session identifier)
   - Added JSDoc comment documenting BSL YAML mapping: `session_persistence` (snake_case) → `sessionPersistence` (camelCase)

2. **Type Export** - Exported `SessionPersistenceConfig` from `packages/core/src/types/index.ts`

3. **Parser Validation** - Added `parseSessionPersistence()` function in `packages/core/src/parser/stepParser.ts`:
   - Returns undefined if rawConfig is null/undefined/not-object
   - Validates `enabled` field: must be boolean, throws descriptive Error if not
   - Validates `max_age` if present: must be non-empty string, throws descriptive Error if not
   - Validates `snapshot_id` if present: must be non-empty string, throws descriptive Error if not
   - Follows EXACT same pattern as existing `parseSessionCheck()` function

4. **ParsedScript Integration** - Added `sessionPersistence?: SessionPersistenceConfig` field to `ParsedScript` interface

5. **Parser Integration** - Updated `parseSteps()` to extract session_persistence from YAML and populate ParsedScript.sessionPersistence

**Verification:** All existing parser tests pass unchanged (backward compatibility verified). TypeScript compiles without errors.

### Task 2: Add parser tests for session_persistence and bridge to extension import
**Commit:** 3528810

1. **Parser Tests** - Added 7 new tests in `tests/utils/yaml/stepParser.test.ts`:

   **Valid cases (4 tests):**
   - "should parse session_persistence with all fields" - validates all 3 fields parsed correctly
   - "should parse session_persistence with enabled only" - validates minimal config
   - "should parse session_persistence with enabled false" - validates disabled state
   - "should return undefined sessionPersistence when field absent" - validates backward compatibility

   **Error cases (3 tests):**
   - "should throw error for non-boolean enabled" - validates type checking
   - "should throw error for non-string max_age" - validates type checking
   - "should throw error for empty snapshot_id" - validates non-empty string requirement

2. **Extension Import Bridge** - Updated `utils/yaml/parser.ts` to extract session_persistence from BSL YAML:
   - Maps `session_persistence.enabled` to `Script.sessionPersistence.enabled`
   - Extension Script format: `{ enabled: boolean; ttl?: number }`
   - ParsedScript format: `{ enabled: boolean; max_age?: string; snapshot_id?: string }`
   - Only `enabled` is mapped; `ttl` uses extension's own default (not set from BSL)
   - This enables imported BSL scripts with `session_persistence: {enabled: true}` to automatically trigger session capture/restore in execution.ts

**Verification:** All 30 parser tests pass (23 existing + 7 new). Full test suite shows 439 tests passing. All 11 existing BSL examples in packages/cli/examples/ parse without error.

## Success Criteria Met

- [x] SessionPersistenceConfig type defined and exported from @browserlet/core
- [x] parseSessionPersistence validates enabled (boolean, required), max_age (string, optional), snapshot_id (string, optional)
- [x] ParsedScript.sessionPersistence populated when session_persistence present in BSL YAML
- [x] Extension import (utils/yaml/parser.ts) maps session_persistence to Script.sessionPersistence
- [x] 7 new tests for session_persistence parsing (4 valid, 3 error)
- [x] All existing tests pass (backward compatibility)
- [x] All existing BSL examples parse without error

## Deviations from Plan

None - plan executed exactly as written.

## Key Integration Points

### Downstream Dependencies
- **Phase 035 Plan 02**: BSL scripts with session_persistence field can now be parsed without error
- **Phase 035 Plan 03**: Extension execution.ts can read Script.sessionPersistence from imported BSL scripts
- **CLI execution**: Parsed session_persistence metadata available for CLI session management

### Type Compatibility
- Core ParsedScript uses `{ enabled, max_age?, snapshot_id? }` - optimized for BSL metadata
- Extension Script uses `{ enabled, ttl? }` - optimized for runtime execution
- Import bridge maps between formats transparently

## Technical Notes

### Parser Validation Approach
- **Syntactic validation only** for `max_age` field (non-empty string check)
- **No semantic validation** in parser (no ms library call to validate format like "72h")
- Semantic validation (duration parsing) happens in execution engines (CLI/extension)
- This keeps the parser as shared code without execution-specific dependencies

### Field Naming Convention
- BSL YAML uses snake_case: `session_persistence`
- TypeScript uses camelCase: `sessionPersistence`
- Consistent with existing BSL fields (e.g., `session_check` → `session_check` in ParsedScript)

### Error Messages
All validation errors include descriptive messages:
- `session_persistence.enabled must be a boolean`
- `session_persistence.max_age must be a non-empty string`
- `session_persistence.snapshot_id must be a non-empty string`

## Test Coverage

### Parser Tests (7 new)
- Valid parsing: 4 test cases
- Error handling: 3 test cases
- Total parser tests: 30 (23 existing + 7 new)

### Backward Compatibility
- All 23 existing parser tests pass unchanged
- All 11 BSL example scripts parse without error
- No breaking changes to existing BSL scripts

## Performance Impact

- Minimal: parseSessionPersistence only called once per script parse
- No performance degradation for scripts without session_persistence field (early return on undefined)

## Self-Check: PASSED

**Verified created/modified files:**
- [x] packages/core/src/types/bsl.ts (modified, SessionPersistenceConfig added)
- [x] packages/core/src/types/index.ts (modified, export added)
- [x] packages/core/src/parser/stepParser.ts (modified, parseSessionPersistence added)
- [x] tests/utils/yaml/stepParser.test.ts (modified, 7 tests added)
- [x] utils/yaml/parser.ts (modified, import bridge added)

**Verified commits:**
- [x] bac111a: feat(035-01): add SessionPersistenceConfig type and parser validation
- [x] 3528810: test(035-01): add parser tests for session_persistence and bridge to extension import

**Verified test results:**
- [x] 30 parser tests pass (23 existing + 7 new)
- [x] Full test suite: 439 tests passing
- [x] TypeScript compilation: no errors
- [x] Backward compatibility: all 11 BSL examples parse successfully

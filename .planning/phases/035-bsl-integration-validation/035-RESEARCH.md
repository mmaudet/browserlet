# Phase 35: BSL Integration & Validation - Research

**Researched:** 2026-02-16
**Domain:** BSL parser extension, YAML validation, execution engine integration
**Confidence:** HIGH

## Summary

Phase 35 integrates session persistence into the BSL language itself, allowing users to declare session capture/restore behavior declaratively in script metadata. This builds on Phase 33 (extension session persistence) and Phase 34 (CLI session persistence) by exposing session_persistence as a top-level metadata field in BSL scripts, validated by the parser, and consumed by both execution engines (extension and CLI).

The core challenge is extending the BSL parser to recognize and validate a new metadata field (`session_persistence`), propagating that metadata to both execution contexts, and integrating automatic session capture/restore logic into the execution lifecycle. The implementation must maintain backward compatibility (scripts without session_persistence continue to work) and provide clear validation errors for malformed declarations.

**Primary recommendation:** Extend ParsedScript interface with optional sessionPersistence field, add validation to stepParser.ts parseSteps function, and integrate automatic capture/restore in execution.ts (extension) and runner.ts (CLI) based on parsed metadata.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| js-yaml | ^4.1.0 | YAML parsing | Already used in packages/core/src/parser/stepParser.ts for BSL parsing |
| TypeScript | ^5.x | Type safety | Entire codebase is TypeScript with strict type checking |
| @browserlet/core/parser | Internal | BSL parsing | Shared parser module between extension and CLI |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ms | ^2.1.3 | Duration parsing | Already used in extension code for TTL parsing (e.g., "72h" → milliseconds) |
| zod | N/A | Schema validation | NOT USED - project uses manual validation with descriptive errors per existing patterns |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual validation | zod/yup schema validation | Manual validation provides better error messages and follows existing codebase patterns (see stepParser.ts validateStep function) |
| TTL string parsing | parseInt only | ms library handles human-readable durations ("72h", "30d") which is more user-friendly |

**Installation:**
No new dependencies required - all needed libraries already installed.

## Architecture Patterns

### Recommended Project Structure
```
packages/core/src/
├── types/
│   └── bsl.ts                    # Add sessionPersistence to ParsedScript interface
├── parser/
│   └── stepParser.ts             # Add parseSessionPersistence validation
entrypoints/sidepanel/stores/
└── execution.ts                  # Already has session logic (lines 66-87, 160-179)
packages/cli/src/
└── runner.ts                     # Already has session logic (lines 38, 61, 373-384)
```

### Pattern 1: Optional Metadata Field Extension

**What:** Add optional field to existing ParsedScript interface without breaking backward compatibility

**When to use:** When extending BSL syntax with new metadata that doesn't affect core step execution

**Example:**
```typescript
// packages/core/src/types/bsl.ts
export interface ParsedScript {
  name: string;
  steps: BSLStep[];
  metadata?: Record<string, unknown>;
  session_check?: SessionCheckConfig;
  sessionPersistence?: SessionPersistenceConfig;  // NEW
}

export interface SessionPersistenceConfig {
  enabled: boolean;
  max_age?: string;      // Optional: "72h", "30d", "7d" (human-readable duration)
  snapshot_id?: string;  // Optional: custom identifier for session snapshots
}
```

**Rationale:**
- Follows existing pattern (see session_check at line 73 in bsl.ts)
- Optional field ensures backward compatibility
- Type-safe propagation to execution engines

### Pattern 2: Parser Validation Function

**What:** Dedicated validation function that parses and validates raw YAML object into typed interface

**When to use:** When adding new structured metadata fields that need type checking and business logic validation

**Example:**
```typescript
// packages/core/src/parser/stepParser.ts (add after parseSessionCheck)
function parseSessionPersistence(rawConfig: unknown): SessionPersistenceConfig | undefined {
  if (!rawConfig || typeof rawConfig !== 'object') {
    return undefined;
  }

  const config = rawConfig as Record<string, unknown>;

  // Validate enabled field (required)
  if (typeof config.enabled !== 'boolean') {
    throw new Error('session_persistence.enabled must be a boolean (true or false)');
  }

  const result: SessionPersistenceConfig = {
    enabled: config.enabled
  };

  // Validate max_age if provided
  if (config.max_age !== undefined) {
    if (typeof config.max_age !== 'string') {
      throw new Error('session_persistence.max_age must be a string (e.g., "72h", "30d")');
    }
    // Validate format with ms library (throws if invalid)
    try {
      const parsed = ms(config.max_age);
      if (parsed === undefined || parsed <= 0) {
        throw new Error('Invalid duration');
      }
    } catch {
      throw new Error(`session_persistence.max_age has invalid format: "${config.max_age}". Use format like "72h", "7d", "30d"`);
    }
    result.max_age = config.max_age;
  }

  // Validate snapshot_id if provided
  if (config.snapshot_id !== undefined) {
    if (typeof config.snapshot_id !== 'string' || config.snapshot_id.trim() === '') {
      throw new Error('session_persistence.snapshot_id must be a non-empty string');
    }
    result.snapshot_id = config.snapshot_id;
  }

  return result;
}
```

**Integration point:**
```typescript
// In parseSteps function (around line 313 in stepParser.ts)
// After: if (sessionCheck) { script.session_check = sessionCheck; }

const sessionPersistence = parseSessionPersistence(rawScript.session_persistence);
if (sessionPersistence) {
  script.sessionPersistence = sessionPersistence;
}
```

**Source:** Follows exact pattern from parseSessionCheck (lines 176-205 in stepParser.ts)

### Pattern 3: Execution Engine Conditional Logic

**What:** Check parsed sessionPersistence metadata in execution engine and conditionally enable auto-capture/restore

**When to use:** When BSL metadata controls runtime behavior in execution engines

**Example (Extension):**
```typescript
// entrypoints/sidepanel/stores/execution.ts
// ALREADY IMPLEMENTED at lines 66-87 for restore, 160-179 for capture
// Current code checks script.sessionPersistence?.enabled

// Future enhancement: Use max_age and snapshot_id from parsed metadata
if (script.sessionPersistence?.enabled) {
  const snapshotId = script.sessionPersistence.snapshot_id || script.id;
  const ttl = script.sessionPersistence.max_age
    ? ms(script.sessionPersistence.max_age)
    : undefined;

  await chrome.runtime.sendMessage({
    type: 'CAPTURE_SESSION',
    payload: {
      scriptId: snapshotId,  // Use snapshot_id if provided
      tabId: tab.id,
      ttl: ttl              // Optional TTL override
    }
  });
}
```

**Example (CLI):**
```typescript
// packages/cli/src/runner.ts
// ALREADY IMPLEMENTED at lines 373-384 for capture
// Current code checks this.options.sessionId

// Future: Parse script.sessionPersistence to auto-enable capture
// In run() method after parsing script:
if (script.sessionPersistence?.enabled && !this.options.sessionId) {
  // Auto-generate session ID from snapshot_id or script name
  const snapshotId = script.sessionPersistence.snapshot_id
    || scriptBaseName;
  this.options.sessionId = `session-${snapshotId}-${Date.now()}`;
}
```

### Pattern 4: BSL Syntax for session_persistence

**What:** Top-level YAML field at same level as name/steps, following existing metadata conventions

**When to use:** Declaring session persistence configuration in BSL scripts

**Example:**
```yaml
name: Login to Application
session_persistence:
  enabled: true
  max_age: "72h"           # Optional: session expires after 72 hours
  snapshot_id: "myapp"     # Optional: custom ID for session file
steps:
  - action: navigate
    value: "https://app.example.com"
  # ... login steps ...
```

**Minimal example:**
```yaml
name: Simple Script
session_persistence:
  enabled: false  # Explicitly disable session capture
steps:
  - action: navigate
    value: "https://example.com"
```

**Rationale:**
- Consistent with existing top-level fields (name, steps, metadata, session_check)
- Human-readable and self-documenting
- max_age uses human-readable durations (not milliseconds)
- snapshot_id enables meaningful session file names (not random UUIDs)

### Anti-Patterns to Avoid

- **Nesting under metadata:** DON'T put session_persistence under metadata field - it's execution-critical configuration, not descriptive metadata (like author, tags)
- **Required fields:** DON'T make enabled required - scripts without session_persistence should work unchanged (backward compatibility)
- **Mixing manual and automatic:** DON'T allow both --session-restore flag AND session_persistence.enabled=true simultaneously - leads to confusion about which session is restored
- **Breaking existing scripts:** DON'T change existing Script interface fields in utils/types.ts - extension already stores sessionPersistence at top level (line 109-112)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Duration parsing | Custom regex for "72h" → ms | ms library | Handles edge cases (weeks, months, negative values, invalid formats), already installed |
| YAML validation | Custom nested object validation | Manual validation per existing pattern | Project uses descriptive manual validation (see validateStep function), not schema libraries |
| Session ID generation | Random strings | generateSessionId from session/storage.ts | Already implements timestamp + random hex pattern consistently |
| Type-safe metadata propagation | Dynamic property access | Explicit interface fields | TypeScript compiler catches missing fields across extension/CLI boundary |

**Key insight:** BSL parser is shared code between extension and CLI - any validation logic must work in both contexts without platform-specific APIs.

## Common Pitfalls

### Pitfall 1: Breaking Backward Compatibility

**What goes wrong:** Existing BSL scripts without session_persistence field fail to parse or execute

**Why it happens:** Adding required fields or changing parser strictness

**How to avoid:**
- Make session_persistence entirely optional at ParsedScript level
- Only validate when field is present (undefined is valid)
- Test with existing BSL examples to ensure they still parse

**Warning signs:**
- Unit tests for existing BSL examples fail
- Error messages mention session_persistence for scripts that don't use it

### Pitfall 2: Extension/CLI Divergence

**What goes wrong:** session_persistence works in CLI but not extension (or vice versa), or behaves differently

**Why it happens:** Different execution paths for session logic, different session storage mechanisms

**How to avoid:**
- Use shared ParsedScript interface from @browserlet/core/types
- Test identical BSL script in both extension and CLI
- Ensure validation errors are identical (same error messages)

**Warning signs:**
- Script parses successfully in one context but fails in other
- Session captured in CLI but not in extension with same script
- Different error messages for same invalid session_persistence config

### Pitfall 3: Invalid Duration Format Crashing Parser

**What goes wrong:** User writes `max_age: "3 days"` (invalid ms format) and parser crashes with cryptic error

**Why it happens:** ms library returns undefined for invalid formats, not throwing error

**How to avoid:**
- Wrap ms() call in try-catch
- Check if result is undefined or <= 0
- Provide helpful error message with examples of valid formats

**Warning signs:**
- Parser silently accepts invalid durations
- Scripts fail at execution time (not parse time) with duration errors
- Error messages don't explain valid duration format

### Pitfall 4: session_persistence vs sessionPersistence Naming Inconsistency

**What goes wrong:** BSL uses snake_case (session_persistence) but TypeScript interfaces use camelCase (sessionPersistence), leading to confusion

**Why it happens:** YAML conventions favor snake_case, JavaScript/TypeScript favor camelCase

**How to avoid:**
- Document the mapping explicitly in types/bsl.ts comments
- Parser handles the conversion (rawScript.session_persistence → script.sessionPersistence)
- Keep BSL syntax stable (don't change to camelCase in YAML)

**Warning signs:**
- Developers try to use sessionPersistence in BSL YAML
- Type errors when accessing session_persistence from ParsedScript

### Pitfall 5: Missing Protocol Validation for Extension Sessions

**What goes wrong:** Extension restores HTTPS session to HTTP URL, leaking secure cookies

**Why it happens:** CLI has validateProtocolMatch function, extension does not (yet)

**How to avoid:**
- Extension session restoration should validate origin protocol matches snapshot protocol
- Block HTTPS → HTTP restoration
- Warn on HTTP → HTTPS restoration

**Warning signs:**
- Extension restores sessions across protocol boundaries without warning
- Security audit flags potential cookie leakage

## Code Examples

Verified patterns from official sources:

### Extending ParsedScript Interface

```typescript
// packages/core/src/types/bsl.ts (add after line 73)
/**
 * Session persistence configuration for automatic session capture/restore.
 * Declared at top level in BSL scripts via session_persistence field.
 *
 * Example BSL:
 *   session_persistence:
 *     enabled: true
 *     max_age: "72h"
 *     snapshot_id: "myapp"
 */
export interface SessionPersistenceConfig {
  /** Whether to automatically capture and restore sessions */
  enabled: boolean;
  /** Optional: session expiry duration (e.g., "72h", "30d") */
  max_age?: string;
  /** Optional: custom session snapshot identifier */
  snapshot_id?: string;
}

// Add to ParsedScript interface (around line 69)
export interface ParsedScript {
  name: string;
  steps: BSLStep[];
  metadata?: Record<string, unknown>;
  session_check?: SessionCheckConfig;
  sessionPersistence?: SessionPersistenceConfig;  // NEW
}
```

**Source:** Follows existing pattern from SessionCheckConfig (lines 62-66 in bsl.ts)

### Parser Integration

```typescript
// packages/core/src/parser/stepParser.ts
// Add parseSessionPersistence function after parseSessionCheck (after line 205)

/**
 * Parse session_persistence configuration from raw object
 * @param rawConfig - Raw session_persistence object from YAML
 * @returns Validated SessionPersistenceConfig
 * @throws Error if configuration is malformed
 */
function parseSessionPersistence(rawConfig: unknown): SessionPersistenceConfig | undefined {
  if (!rawConfig || typeof rawConfig !== 'object') {
    return undefined;
  }

  const config = rawConfig as Record<string, unknown>;

  // Validate enabled field
  if (typeof config.enabled !== 'boolean') {
    throw new Error('session_persistence.enabled must be a boolean (true or false)');
  }

  const result: SessionPersistenceConfig = {
    enabled: config.enabled
  };

  // Validate max_age if provided
  if (config.max_age !== undefined) {
    if (typeof config.max_age !== 'string') {
      throw new Error('session_persistence.max_age must be a string (e.g., "72h", "30d")');
    }
    // Note: Actual duration validation would use ms library, not available in parser
    // Validation is syntactic only - semantic validation happens at execution time
    result.max_age = config.max_age;
  }

  // Validate snapshot_id if provided
  if (config.snapshot_id !== undefined) {
    if (typeof config.snapshot_id !== 'string' || config.snapshot_id.trim() === '') {
      throw new Error('session_persistence.snapshot_id must be a non-empty string');
    }
    result.snapshot_id = config.snapshot_id;
  }

  return result;
}

// Integrate in parseSteps function (after line 316)
const sessionPersistence = parseSessionPersistence(rawScript.session_persistence);
if (sessionPersistence) {
  script.sessionPersistence = sessionPersistence;
}
```

**Source:** Exact pattern from parseSessionCheck function (lines 176-205 in stepParser.ts)

### Extension Execution Integration

```typescript
// entrypoints/sidepanel/stores/execution.ts
// ALREADY IMPLEMENTED at lines 66-87 (restore) and 160-179 (capture)
// No changes needed - extension already checks script.sessionPersistence?.enabled

// Future enhancement: Use parsed max_age and snapshot_id
// In startExecution (line 66):
if (script.sessionPersistence?.enabled && tab.url) {
  try {
    const domain = new URL(tab.url).hostname;
    const snapshotId = script.sessionPersistence.snapshot_id || script.id;

    const response = await chrome.runtime.sendMessage({
      type: 'RESTORE_SESSION',
      payload: {
        scriptId: snapshotId,  // Use custom snapshot_id if provided
        domain,
        tabId: tab.id
      }
    });
    // ... existing restore logic ...
  } catch (err) {
    console.warn('[Browserlet] Session restore failed (non-fatal):', err);
  }
}
```

**Source:** Existing execution.ts lines 66-87 and 160-179

### CLI Execution Integration

```typescript
// packages/cli/src/runner.ts
// ALREADY IMPLEMENTED at lines 373-384 (capture)
// Enhancement: Auto-enable capture when session_persistence.enabled is true

// In run() method after parsing script (around line 96):
const script = parseSteps(yamlContent);

// Auto-generate session ID if session_persistence enabled and not manually provided
if (script.sessionPersistence?.enabled && !this.options.sessionId) {
  const snapshotId = script.sessionPersistence.snapshot_id || scriptBaseName;
  this.options.sessionId = `session-${snapshotId}-${Date.now()}`;
  console.log(`[Session] Auto-capture enabled via session_persistence declaration`);
}

// Existing capture logic at line 373 works unchanged
```

**Source:** Existing runner.ts lines 373-384 and session/storage.ts generateSessionId

### BSL Script Example

```yaml
# Example: Login script with session persistence
name: Login to MyApp
description: Authenticate and save session for 72 hours
session_persistence:
  enabled: true
  max_age: "72h"
  snapshot_id: "myapp-prod"

steps:
  - action: navigate
    value: "https://app.example.com/login"

  - action: type
    target:
      intent: "Username field"
      hints:
        - type: name
          value: username
      fallback_selector: "input[name='username']"
    value: "{{credential:username}}"

  - action: type
    target:
      intent: "Password field"
      hints:
        - type: name
          value: password
      fallback_selector: "input[name='password']"
    value: "{{credential:password}}"

  - action: click
    target:
      intent: "Login button"
      hints:
        - type: role
          value: button
        - type: text_contains
          value: "Sign in"
      fallback_selector: "button[type='submit']"
```

**Source:** Pattern follows existing BSL examples in packages/cli/examples/

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual --session-restore flag | Declarative session_persistence in BSL | Phase 35 (2026-02-16) | Users declare session behavior once in script, not per invocation |
| Random session IDs | Custom snapshot_id field | Phase 35 | Session files have meaningful names (myapp-prod vs session-1708112345678-a3f2c1d4) |
| Global TTL (1 hour default) | Per-script max_age | Phase 35 | Different scripts can have different session expiry policies |
| Implicit session capture | Explicit enabled flag | Phase 35 | Clear intent in script whether session should be persisted |

**Deprecated/outdated:**
- N/A - This is a new feature, no deprecated patterns to replace

## Open Questions

1. **Should session_persistence.enabled default to false or true if field is omitted?**
   - What we know: Scripts without session_persistence field exist in examples/, must continue to work
   - What's unclear: Is absence of field equivalent to enabled=false, or should there be a third state (undefined)?
   - Recommendation: Undefined is distinct from false. Only auto-capture/restore if sessionPersistence?.enabled === true explicitly. Absence means "don't use session persistence" (not an error).

2. **Should CLI --session-restore flag override session_persistence.enabled=false?**
   - What we know: CLI already has --session-restore flag for manual restoration
   - What's unclear: What happens if script has enabled=false but user passes --session-restore?
   - Recommendation: Manual flag takes precedence (explicit user intent), log warning if conflicts with script declaration

3. **Should extension auto-restore on every script run or only first step?**
   - What we know: Extension execution.ts already restores before startExecution (line 69)
   - What's unclear: Should restore happen on every script run or be conditional on session existence?
   - Recommendation: Current behavior is correct - try restore, fail gracefully if no session exists (lines 78-86)

4. **How to handle max_age validation in parser without ms library?**
   - What we know: Parser runs in both extension (browser) and CLI (Node.js)
   - What's unclear: ms library is available in Node but might not be in browser extension context
   - Recommendation: Parser does syntactic validation only (string type check), execution engines validate duration format with ms library. Parser error: "max_age must be a string", executor error: "max_age format invalid (use 72h, 30d)"

## Sources

### Primary (HIGH confidence)
- `/Users/mmaudet/work/browserlet/packages/core/src/types/bsl.ts` - Existing ParsedScript interface and SessionCheckConfig pattern
- `/Users/mmaudet/work/browserlet/packages/core/src/parser/stepParser.ts` - Parser validation patterns (validateStep, parseSessionCheck functions)
- `/Users/mmaudet/work/browserlet/entrypoints/sidepanel/stores/execution.ts` - Extension session logic already implemented (lines 66-87, 160-179)
- `/Users/mmaudet/work/browserlet/packages/cli/src/runner.ts` - CLI session capture already implemented (lines 373-384)
- `/Users/mmaudet/work/browserlet/packages/cli/src/session/storage.ts` - Session storage module with generateSessionId
- `/Users/mmaudet/work/browserlet/utils/types.ts` - Script interface with sessionPersistence field (lines 109-112)
- `.planning/phases/033-extension-session-persistence/033-03-PLAN.md` - Phase 33 integration plan
- `.planning/phases/034-cli-session-persistence/034-02-PLAN.md` - Phase 34 integration plan
- `.planning/ROADMAP.md` - Phase 35 requirements and success criteria

### Secondary (MEDIUM confidence)
- js-yaml library documentation - Referenced in stepParser.ts line 5, standard YAML parsing
- ms library - Common duration parsing library used in Node.js projects

### Tertiary (LOW confidence)
- N/A - All findings verified from codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, no new dependencies
- Architecture: HIGH - Clear patterns from existing session_check implementation
- Pitfalls: HIGH - Identified from existing session persistence implementations (phases 33-34)

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (30 days - stable codebase)

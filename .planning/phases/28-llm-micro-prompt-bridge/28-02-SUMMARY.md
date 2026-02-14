---
phase: 28-llm-micro-prompt-bridge
plan: 02
subsystem: llm
tags: [playwright, page-expose-function, cli-flags, environment-config, micro-prompts, bridge]

# Dependency graph
requires:
  - phase: 28-01
    provides: LLM provider abstraction and micro-prompt router
provides:
  - installMicroPromptBridge function using Playwright page.exposeFunction
  - --micro-prompts CLI flag for enabling LLM stages
  - Environment-based LLM configuration (ANTHROPIC_API_KEY, BROWSERLET_LLM_PROVIDER)
  - Conditional bridge installation in BSLRunner
affects: [28-03, 29-batch-runner, 30-ai-auto-repair]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Playwright page.exposeFunction for page-to-Node.js bridge
    - CLI flag-gated feature enablement (deterministic-only by default)
    - Environment variable configuration for credentials

key-files:
  created:
    - packages/cli/src/llm/bridge.ts
  modified:
    - packages/cli/src/index.ts
    - packages/cli/src/runner.ts

key-decisions:
  - "Bridge installed after page creation, before resolver injection - follows Phase 26 credential bridge pattern"
  - "Default behavior is deterministic-only (stages 1-2) - LLM stages require explicit --micro-prompts flag"
  - "Environment variable configuration - ANTHROPIC_API_KEY for Claude, BROWSERLET_LLM_PROVIDER for provider selection"

patterns-established:
  - "page.exposeFunction bridges survive navigations per Playwright docs - no re-installation needed"
  - "JSON serialization for all bridge inputs/outputs with comprehensive error codes"
  - "CLI validates credentials before browser launch - fail fast on missing config"

# Metrics
duration: 3min
completed: 2026-02-14
---

# Phase 28 Plan 02: LLM Micro-Prompt Bridge Summary

**Playwright page.exposeFunction bridge connecting cascade resolver to Node.js LLM providers, controlled by --micro-prompts CLI flag and environment-based configuration**

## Performance

- **Duration:** 3 min (176 seconds)
- **Started:** 2026-02-14T16:44:01Z
- **Completed:** 2026-02-14T16:46:57Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Installed page.exposeFunction bridge creating window.__browserlet_microPrompt in page context
- Bridge routes JSON-serialized micro-prompt requests from cascade resolver to Node.js LLM providers
- Added --micro-prompts CLI flag enabling LLM stages 3-5 (default: deterministic-only stages 1-2)
- Implemented environment-based LLM configuration reading ANTHROPIC_API_KEY and BROWSERLET_LLM_PROVIDER
- Conditional provider creation (ClaudeProvider or OllamaProvider) based on configuration
- Comprehensive error handling with clear messages when credentials missing

## Task Commits

Each task was committed atomically:

1. **Task 1: Install page.exposeFunction Bridge** - `5aea974` (feat)
   - Created packages/cli/src/llm/bridge.ts
   - installMicroPromptBridge function using page.exposeFunction
   - Routes inputJson through routeMicroPrompt pipeline
   - Returns JSON-stringified results with success envelope
   - Error handling with BRIDGE_ERROR code for parse failures
   - Console log confirms installation

2. **Task 2: Wire --micro-prompts Flag and Environment Config** - `b1f60d6` (feat)
   - Added --micro-prompts flag to CLI command options
   - Read LLM config from environment variables (ANTHROPIC_API_KEY, BROWSERLET_LLM_PROVIDER, etc.)
   - Updated BSLRunnerOptions with microPrompts and llmConfig fields
   - Conditional bridge installation in runner.ts when microPrompts=true
   - Create ClaudeProvider or OllamaProvider based on config
   - Default behavior: deterministic-only with clear console log
   - Validation errors when --micro-prompts without credentials

## Files Created/Modified

**Created:**
- `packages/cli/src/llm/bridge.ts` - page.exposeFunction bridge installer

**Modified:**
- `packages/cli/src/index.ts` - CLI flag and environment config reading
- `packages/cli/src/runner.ts` - Bridge installation logic and options interface

## Decisions Made

**1. Bridge installed after page creation, before resolver injection**
- Follows Phase 26 credential bridge pattern (packages/cli/src/vault/bridge.ts)
- Ensures window.__browserlet_microPrompt available when resolver bundle executes
- Rationale: Consistent with established bridge installation pattern

**2. Default behavior is deterministic-only (stages 1-2)**
- LLM stages require explicit --micro-prompts flag
- Console logs indicate mode: "Micro-prompts enabled via {provider}" or "Running deterministic-only"
- Rationale: Matches research "Anti-Pattern 5" - don't install bridge when not needed, avoid unnecessary API calls

**3. Environment variable configuration**
- ANTHROPIC_API_KEY for Claude provider
- BROWSERLET_LLM_PROVIDER for provider selection (default: 'claude')
- BROWSERLET_LLM_MODEL for model override
- BROWSERLET_OLLAMA_HOST for Ollama server (default: http://localhost:11434)
- Rationale: Standard CLI pattern, keeps secrets out of command line arguments

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - bridge is functional. Users who want to use --micro-prompts need to:
1. Set ANTHROPIC_API_KEY environment variable (for Claude), OR
2. Set BROWSERLET_LLM_PROVIDER=ollama and run local Ollama server

## Next Phase Readiness

Ready for Phase 28-03 (Integration Testing):
- Bridge installed via page.exposeFunction
- window.__browserlet_microPrompt accessible from page context
- JSON request/response protocol established
- Error codes standardized (BRIDGE_ERROR, LLM_NOT_CONFIGURED, etc.)
- CLI flag and environment configuration working
- Default behavior preserves deterministic-only mode

## Bridge Protocol Specification

**Function installed in page context:**
```javascript
window.__browserlet_microPrompt(inputJson: string) => Promise<string>
```

**Input format (JSON-stringified MicroPromptInput):**
```json
{
  "type": "hint_suggester",
  "intent": "click the login button",
  "context": { "domContext": "..." }
}
```

**Output format (JSON-stringified response envelope):**
```json
{
  "success": true,
  "data": {
    "success": true,
    "output": { "hints": [...], "confidence": 0.95 },
    "tokenEstimate": 150
  }
}
```

**Error format:**
```json
{
  "success": false,
  "error": "Invalid JSON input: ...",
  "code": "BRIDGE_ERROR"
}
```

## Verification Results

All verification criteria from plan met:

- [x] --micro-prompts flag appears in browserlet run --help
- [x] Bridge installed only when flag is true
- [x] ANTHROPIC_API_KEY env var read and passed to ClaudeProvider
- [x] BROWSERLET_LLM_PROVIDER=ollama creates OllamaProvider
- [x] Default run without flag skips bridge installation
- [x] Error thrown if --micro-prompts without credentials

## Self-Check: PASSED

All files verified:
```bash
[ -f "/Users/mmaudet/work/browserlet/packages/cli/src/llm/bridge.ts" ] && echo "FOUND"
# FOUND

[ -f "/Users/mmaudet/work/browserlet/packages/cli/src/index.ts" ] && echo "FOUND"
# FOUND

[ -f "/Users/mmaudet/work/browserlet/packages/cli/src/runner.ts" ] && echo "FOUND"
# FOUND
```

All commits verified:
```bash
git log --oneline --all | grep -q "5aea974" && echo "FOUND: 5aea974"
# FOUND: 5aea974

git log --oneline --all | grep -q "b1f60d6" && echo "FOUND: b1f60d6"
# FOUND: b1f60d6
```

---
*Phase: 28-llm-micro-prompt-bridge*
*Completed: 2026-02-14*

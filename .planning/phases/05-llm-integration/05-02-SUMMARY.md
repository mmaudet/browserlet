---
phase: 05-llm-integration
plan: 02
subsystem: llm
tags: [llm, exponential-backoff, rate-limiting, js-yaml, prompt-engineering]

# Dependency graph
requires:
  - phase: 02-recording
    provides: CapturedAction type and SemanticHint interface
provides:
  - LLMProvider interface for provider abstraction
  - LLMConfig for provider settings storage
  - RateLimiter with exponential backoff for API stability
  - buildBSLPrompt for LLM-based BSL generation
  - generateBasicBSL fallback without LLM
affects: [05-03, 05-04, 06-testing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Provider abstraction pattern (LLMProvider interface)
    - Rate limiting with jitter to avoid thundering herd
    - Structured prompts with hint type ordering

key-files:
  created:
    - entrypoints/background/llm/providers/types.ts
    - entrypoints/background/llm/rateLimiter.ts
    - entrypoints/background/llm/promptBuilder.ts
    - entrypoints/background/llm/fallback.ts
  modified: []

key-decisions:
  - "10 hint types ordered by reliability: data_attribute most stable, id least reliable"
  - "RateLimiter only retries 429 errors with exponential backoff and jitter"
  - "Fallback generator uses top 3 hints for resilience"
  - "Compact prompt variant added for local models with limited context"

patterns-established:
  - "LLM provider abstraction: name, generateBSL, isAvailable"
  - "Rate limit handling: backOff with jitter='full', retry only 429"
  - "Action type mapping: input->type, submit->click, navigate->navigate"

# Metrics
duration: 2.3min
completed: 2026-01-29
---

# Phase 5 Plan 2: LLM Infrastructure Summary

**LLM provider abstraction with RateLimiter using exponential-backoff, structured prompt builder with reliability-ordered hint types, and js-yaml fallback generator**

## Performance

- **Duration:** 2.3 min
- **Started:** 2026-01-29T15:14:40Z
- **Completed:** 2026-01-29T15:16:58Z
- **Tasks:** 3
- **Files created:** 4

## Accomplishments
- Created LLMProvider interface and LLMConfig for unified provider abstraction
- Built RateLimiter class with exponential backoff, jitter, and 429-only retry
- Implemented buildBSLPrompt with 10 hint types ordered by reliability
- Created generateBasicBSL fallback generator using js-yaml

## Task Commits

Each task was committed atomically:

1. **Task 1: Create provider types and LLM config interface** - `14928f6` (feat)
2. **Task 2: Create rate limiter with exponential backoff** - `d30787e` (feat)
3. **Task 3: Create prompt builder and fallback generator** - `b7e72cc` (feat)

## Files Created/Modified

- `entrypoints/background/llm/providers/types.ts` - LLMProvider interface, LLMConfig interface, DEFAULT_LLM_CONFIG
- `entrypoints/background/llm/rateLimiter.ts` - RateLimiter class with exponential backoff
- `entrypoints/background/llm/promptBuilder.ts` - buildBSLPrompt and buildCompactBSLPrompt functions
- `entrypoints/background/llm/fallback.ts` - generateBasicBSL function using js-yaml

## Decisions Made

- **Hint type reliability ordering:** data_attribute > role > type > aria_label > name > text_contains > placeholder_contains > near_label > class_contains > id
- **Rate limiter jitter:** Using 'full' jitter to avoid thundering herd on retries
- **Fallback generator:** Uses top 3 hints from each action for balance of resilience and readability
- **Compact prompt variant:** Added buildCompactBSLPrompt for Ollama/local models with limited context windows
- **Action mapping:** input->type, submit->click (semantic mapping for BSL)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- LLM infrastructure ready for Claude and Ollama provider implementations
- RateLimiter ready for use in provider execute calls
- Prompt builder and fallback provide complete BSL generation pipeline
- Next plan (05-03) can implement ClaudeProvider using these foundations

---
*Phase: 05-llm-integration*
*Completed: 2026-01-29*

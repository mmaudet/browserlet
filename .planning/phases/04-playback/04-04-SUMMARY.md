---
phase: 04-playback
plan: 04
subsystem: playback-execution
tags: [dom-actions, event-dispatch, bsl-execution, framework-compatibility]

dependency-graph:
  requires: ["04-01", "04-02", "04-03"]
  provides: ["ActionExecutor", "executeClick", "executeType", "executeSelect", "executeExtract", "executeScroll", "executeHover"]
  affects: ["04-05"]

tech-stack:
  added: []
  patterns: ["event-dispatching", "framework-compatible-events", "character-by-character-typing"]

key-files:
  created:
    - entrypoints/content/playback/actionExecutor.ts
  modified: []

decisions:
  - id: "full-event-sequence"
    choice: "Dispatch mousedown -> mouseup -> click for framework compatibility"
    rationale: "React/Vue/Angular rely on complete event sequences"
  - id: "character-typing"
    choice: "Type character-by-character with keydown/input/keyup per char"
    rationale: "Mimics real user typing, triggers proper framework reactivity"
  - id: "option-search"
    choice: "Search by value first, then by text content"
    rationale: "Value is more stable, text is user-visible fallback"
  - id: "hover-persistence"
    choice: "No mouseleave dispatch - hover persists"
    rationale: "Matches real hover behavior until another action occurs"

metrics:
  tasks: 3
  duration: 2.1 min
  completed: 2026-01-29
---

# Phase 04 Plan 04: Action Executor Summary

DOM action execution for all 8 BSL actions with proper event dispatching for React/Vue/Angular/jQuery compatibility.

## What Was Built

### Action Executor Module (`entrypoints/content/playback/actionExecutor.ts`)

Complete implementation of all 8 BSL actions:

1. **executeClick** (ACT-01): Full mousedown -> mouseup -> click sequence
2. **executeType** (ACT-02): Character-by-character with humanized delays
3. **executeSelect** (ACT-03): Find options by value or text content
4. **executeExtract** (ACT-04): Extract with transforms (trim, number, json, attribute:*)
5. **executeWaitFor** (ACT-05): Delegate to semantic resolver
6. **executeNavigate** (ACT-06): Trigger page navigation
7. **executeScroll** (ACT-07): Smooth scroll with settle delay
8. **executeHover** (ACT-08): mouseenter -> mouseover -> mousemove sequence

### ActionExecutor Class

Unified interface wrapping all actions:
- Accepts BSLStep and resolved element
- Manages HumanizerConfig for timing
- Exhaustive switch with TypeScript type safety
- Validates required parameters per action

## Key Implementation Details

### Event Dispatching for Framework Compatibility

```typescript
// Click sequence - required for React synthetic events
element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX, clientY }));
element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX, clientY }));
element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX, clientY }));
```

### Character-by-Character Typing

```typescript
for (const char of text) {
  element.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
  element.value += char;
  element.dispatchEvent(new InputEvent('input', { bubbles: true, data: char }));
  element.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
  await typeCharacterDelay(config);
}
```

### Extract Transforms

- `trim`: Remove whitespace
- `number`: Parse to float
- `lowercase`: Convert to lowercase
- `json`: Parse JSON
- `attribute:name`: Get element attribute

## Commits

| Hash | Type | Description |
|------|------|-------------|
| a2ede47 | feat | Implement click, type, select action executors |
| 2f0bd79 | feat | Add extract, wait_for, navigate actions |
| e545932 | feat | Add scroll, hover actions and ActionExecutor class |

## Dependencies

**Imports from:**
- `./humanizer`: typeCharacterDelay, scrollSettleDelay, DEFAULT_CONFIG, HumanizerConfig
- `./types`: BSLStep, SemanticHint
- `./semanticResolver`: waitForElement

**Exports:**
- Individual functions: executeClick, executeType, executeSelect, executeExtract, executeWaitFor, executeNavigate, executeScroll, executeHover
- Class: ActionExecutor

## Verification

- [x] WXT build succeeds
- [x] All 8 action functions exported
- [x] ActionExecutor class wraps all actions
- [x] TypeScript exhaustive check on action types

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

**Provides for 04-05 (PlaybackManager):**
- ActionExecutor class ready for integration
- All execute* functions available for direct use
- Proper error throwing for invalid parameters

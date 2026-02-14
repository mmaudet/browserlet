/**
 * Micro-prompt templates for targeted LLM calls during element resolution
 *
 * Three prompt types (hint_suggester, disambiguator, confidence_booster) with
 * strict token budgets (<600 tokens roundtrip). Used when deterministic
 * resolution fails during playback.
 *
 * Phase 20 - Plans 20-01
 */

import type { SemanticHint, HintType } from '../../content/recording/types';

// ---------------------------------------------------------------------------
// Token budget constants (documentation/logging constraints)
// ---------------------------------------------------------------------------

export const MICRO_PROMPT_BUDGETS = {
  hint_suggester: { maxInput: 250, maxOutput: 350, maxRoundtrip: 600 },
  disambiguator: { maxInput: 280, maxOutput: 200, maxRoundtrip: 480 },
  confidence_booster: { maxInput: 200, maxOutput: 160, maxRoundtrip: 360 },
} as const;

// ---------------------------------------------------------------------------
// Micro-prompt type discriminated union
// ---------------------------------------------------------------------------

export type MicroPromptType = 'hint_suggester' | 'disambiguator' | 'confidence_booster';

// ---------------------------------------------------------------------------
// Valid hint types for validation
// ---------------------------------------------------------------------------

const VALID_HINT_TYPES: readonly HintType[] = [
  'role', 'text_contains', 'type', 'name', 'placeholder_contains',
  'aria_label', 'near_label', 'class_contains', 'data_attribute', 'id',
] as const;

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface HintSuggesterInput {
  original_hints: SemanticHint[];
  dom_excerpt: string;       // max 300 chars of DOM around expected location
  page_url: string;
  action_type: string;       // click, type, select, etc.
}

export interface DisambiguatorInput {
  candidates: Array<{
    index: number;
    tag: string;
    text: string;            // first 50 chars of visible text
    attributes: Record<string, string>;
    structural_context: string;  // e.g. "inside fieldset 'Billing'"
  }>;
  original_hints: SemanticHint[];
  action_type: string;
  action_value?: string;     // for type actions, the value being typed
}

export interface ConfidenceBoosterInput {
  candidate: {
    tag: string;
    text: string;
    attributes: Record<string, string>;
    structural_context: string;
  };
  original_hints: SemanticHint[];
  matched_hints: string[];   // hint types that matched
  failed_hints: string[];    // hint types that failed
  confidence: number;        // current confidence score (0.50-0.69)
}

// Discriminated union for type-safe dispatch
export type MicroPromptInput =
  | { type: 'hint_suggester'; data: HintSuggesterInput }
  | { type: 'disambiguator'; data: DisambiguatorInput }
  | { type: 'confidence_booster'; data: ConfidenceBoosterInput };

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface HintSuggesterOutput {
  suggested_hints: SemanticHint[];  // 2-3 alternative hints
  reasoning: string;
}

export interface DisambiguatorOutput {
  selected_index: number;
  confidence: number;   // 0-1
  reasoning: string;
}

export interface ConfidenceBoosterOutput {
  is_correct: boolean;
  reasoning: string;
}

// Discriminated union for type-safe results
export type MicroPromptOutput =
  | { type: 'hint_suggester'; data: HintSuggesterOutput }
  | { type: 'disambiguator'; data: DisambiguatorOutput }
  | { type: 'confidence_booster'; data: ConfidenceBoosterOutput };

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

/**
 * Build a micro-prompt string from typed input.
 * Each prompt is self-contained, requests JSON-only output, and includes
 * the expected output schema inline.
 */
export function buildMicroPrompt(input: MicroPromptInput): string {
  let prompt: string;

  switch (input.type) {
    case 'hint_suggester':
      prompt = buildHintSuggesterPrompt(input.data);
      break;
    case 'disambiguator':
      prompt = buildDisambiguatorPrompt(input.data);
      break;
    case 'confidence_booster':
      prompt = buildConfidenceBoosterPrompt(input.data);
      break;
  }

  // Estimate token count and warn if over budget
  const estimatedTokens = Math.ceil(prompt.length / 4);
  const budget = MICRO_PROMPT_BUDGETS[input.type];
  console.log(`[MicroPrompt] Built ${input.type} prompt: ${prompt.length} chars (~${estimatedTokens} tokens est.)`);

  if (estimatedTokens > budget.maxInput) {
    console.warn(
      `[MicroPrompt] ${input.type} prompt exceeds input budget: ~${estimatedTokens} tokens > ${budget.maxInput} max`
    );
  }

  return prompt;
}

function truncateUrl(url: string, maxLen = 80): string {
  if (url.length <= maxLen) return url;
  try {
    const u = new URL(url);
    const short = u.origin + u.pathname;
    return short.length <= maxLen ? short : short.slice(0, maxLen);
  } catch {
    return url.slice(0, maxLen);
  }
}

function buildHintSuggesterPrompt(data: HintSuggesterInput): string {
  // Truncate DOM excerpt to 300 chars to stay within token budget
  const domExcerpt = data.dom_excerpt.length > 300
    ? data.dom_excerpt.slice(0, 300)
    : data.dom_excerpt;

  // Strip query params from URL to save tokens
  const pageUrl = truncateUrl(data.page_url);

  return `Resolve a web element. No elements matched original hints.
Action: ${data.action_type} | URL: ${pageUrl}
Hints: ${JSON.stringify(data.original_hints)}
DOM: ${domExcerpt}
Suggest 2-3 alternative hints. Types: role,text_contains,type,name,placeholder_contains,aria_label,near_label,class_contains,data_attribute,id
If the DOM clearly belongs to a different page (e.g. dashboard vs login), return empty: {"suggested_hints":[],"reasoning":"wrong page"}
JSON only: {"suggested_hints":[{"type":"...","value":"..."}],"reasoning":"..."}`;
}

function buildDisambiguatorPrompt(data: DisambiguatorInput): string {
  // Limit candidates to max 5
  const candidates = data.candidates.slice(0, 5);

  // Format candidates as numbered list with truncated text
  const candidateList = candidates.map(c => {
    const text = c.text.length > 50 ? c.text.slice(0, 50) : c.text;
    return `[${c.index}] <${c.tag}> text="${text}" attributes=${JSON.stringify(c.attributes)} context: ${c.structural_context}`;
  }).join('\n');

  const actionStr = data.action_value
    ? `${data.action_type} with value "${data.action_value}"`
    : data.action_type;

  return `You are resolving a web element for browser automation. Multiple elements matched.

Action: ${actionStr}
Original hints: ${JSON.stringify(data.original_hints)}

Candidates:
${candidateList}

Which candidate is the correct target? Output ONLY this JSON (no markdown):
{"selected_index": 0, "confidence": 0.95, "reasoning": "brief explanation"}`;
}

function buildConfidenceBoosterPrompt(data: ConfidenceBoosterInput): string {
  return `You are resolving a web element for browser automation. One element found but confidence is low (${data.confidence}).

Action hints: ${JSON.stringify(data.original_hints)}
Matched hints: ${JSON.stringify(data.matched_hints)}
Failed hints: ${JSON.stringify(data.failed_hints)}
Element: <${data.candidate.tag}> text="${data.candidate.text}" attributes=${JSON.stringify(data.candidate.attributes)} context: ${data.candidate.structural_context}

Is this the correct target? Output ONLY this JSON (no markdown):
{"is_correct": true, "reasoning": "brief explanation"}`;
}

// ---------------------------------------------------------------------------
// Response validators
// ---------------------------------------------------------------------------

/**
 * Validate hint_suggester output.
 * Returns typed output or null if validation fails.
 */
export function validateHintSuggesterOutput(parsed: unknown): HintSuggesterOutput | null {
  if (!parsed || typeof parsed !== 'object') {
    console.warn('[MicroPrompt] hint_suggester: response is not an object');
    return null;
  }

  const obj = parsed as Record<string, unknown>;

  if (!Array.isArray(obj.suggested_hints)) {
    console.warn('[MicroPrompt] hint_suggester: missing or invalid suggested_hints array');
    return null;
  }

  if (obj.suggested_hints.length < 1 || obj.suggested_hints.length > 5) {
    console.warn(`[MicroPrompt] hint_suggester: suggested_hints has ${obj.suggested_hints.length} items (expected 1-5)`);
    return null;
  }

  // Validate each hint
  for (const hint of obj.suggested_hints) {
    if (!hint || typeof hint !== 'object') {
      console.warn('[MicroPrompt] hint_suggester: hint is not an object');
      return null;
    }
    const h = hint as Record<string, unknown>;
    if (typeof h.type !== 'string' || !VALID_HINT_TYPES.includes(h.type as HintType)) {
      console.warn(`[MicroPrompt] hint_suggester: invalid hint type "${h.type}"`);
      return null;
    }
    // Value can be string or { name, value } for data_attribute
    if (h.type === 'data_attribute') {
      if (typeof h.value === 'string') {
        // Accept string value for data_attribute (LLM might return simple string)
      } else if (h.value && typeof h.value === 'object') {
        const dv = h.value as Record<string, unknown>;
        if (typeof dv.name !== 'string' || typeof dv.value !== 'string') {
          console.warn('[MicroPrompt] hint_suggester: data_attribute hint has invalid value object');
          return null;
        }
      } else {
        console.warn('[MicroPrompt] hint_suggester: data_attribute hint has invalid value');
        return null;
      }
    } else if (typeof h.value !== 'string' || h.value === '') {
      console.warn(`[MicroPrompt] hint_suggester: hint value is empty or not a string`);
      return null;
    }
  }

  const reasoning = typeof obj.reasoning === 'string' ? obj.reasoning : '';

  return {
    suggested_hints: obj.suggested_hints as SemanticHint[],
    reasoning,
  };
}

/**
 * Validate disambiguator output.
 * Returns typed output or null if validation fails.
 */
export function validateDisambiguatorOutput(parsed: unknown): DisambiguatorOutput | null {
  if (!parsed || typeof parsed !== 'object') {
    console.warn('[MicroPrompt] disambiguator: response is not an object');
    return null;
  }

  const obj = parsed as Record<string, unknown>;

  if (typeof obj.selected_index !== 'number' || !Number.isInteger(obj.selected_index) || obj.selected_index < 0) {
    console.warn(`[MicroPrompt] disambiguator: invalid selected_index "${obj.selected_index}"`);
    return null;
  }

  if (typeof obj.confidence !== 'number' || obj.confidence < 0 || obj.confidence > 1) {
    console.warn(`[MicroPrompt] disambiguator: invalid confidence "${obj.confidence}"`);
    return null;
  }

  const reasoning = typeof obj.reasoning === 'string' ? obj.reasoning : '';

  return {
    selected_index: obj.selected_index,
    confidence: obj.confidence,
    reasoning,
  };
}

/**
 * Validate confidence_booster output.
 * Returns typed output or null if validation fails.
 */
export function validateConfidenceBoosterOutput(parsed: unknown): ConfidenceBoosterOutput | null {
  if (!parsed || typeof parsed !== 'object') {
    console.warn('[MicroPrompt] confidence_booster: response is not an object');
    return null;
  }

  const obj = parsed as Record<string, unknown>;

  if (typeof obj.is_correct !== 'boolean') {
    console.warn(`[MicroPrompt] confidence_booster: invalid is_correct "${obj.is_correct}"`);
    return null;
  }

  const reasoning = typeof obj.reasoning === 'string' ? obj.reasoning : '';

  return {
    is_correct: obj.is_correct,
    reasoning,
  };
}

/**
 * Unified validator that dispatches to type-specific validators
 * and wraps the result in the discriminated union.
 */
export function validateMicroPromptOutput(
  type: MicroPromptType,
  parsed: unknown
): MicroPromptOutput | null {
  switch (type) {
    case 'hint_suggester': {
      const result = validateHintSuggesterOutput(parsed);
      return result ? { type: 'hint_suggester', data: result } : null;
    }
    case 'disambiguator': {
      const result = validateDisambiguatorOutput(parsed);
      return result ? { type: 'disambiguator', data: result } : null;
    }
    case 'confidence_booster': {
      const result = validateConfidenceBoosterOutput(parsed);
      return result ? { type: 'confidence_booster', data: result } : null;
    }
    default:
      console.warn(`[MicroPrompt] Unknown prompt type: ${type}`);
      return null;
  }
}

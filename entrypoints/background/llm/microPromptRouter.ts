/**
 * Micro-prompt router for background service worker
 *
 * Receives typed micro-prompt requests, builds prompts via microPromptBuilder,
 * sends them to the active LLM provider via LLMService.generate(), parses
 * JSON responses, validates against schemas, and returns typed results.
 *
 * Phase 20 - Plan 20-02
 */

import type {
  MicroPromptInput,
  MicroPromptOutput,
  MicroPromptType,
} from './microPromptBuilder';
import { buildMicroPrompt, validateMicroPromptOutput } from './microPromptBuilder';
import { getLLMService } from './index';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MicroPromptRequest {
  promptType: MicroPromptType;
  input: MicroPromptInput;
}

export interface MicroPromptResponse {
  success: true;
  output: MicroPromptOutput;
  tokenEstimate: number;  // rough char/4 estimate of roundtrip
}

export interface MicroPromptError {
  success: false;
  error: string;
  code:
    | 'LLM_NOT_CONFIGURED'
    | 'LLM_NOT_AVAILABLE'
    | 'LLM_GENERATION_FAILED'
    | 'INVALID_RESPONSE'
    | 'VALIDATION_FAILED'
    | 'UNKNOWN_PROMPT_TYPE';
}

export type MicroPromptResult = MicroPromptResponse | MicroPromptError;

// ---------------------------------------------------------------------------
// Valid prompt types for validation
// ---------------------------------------------------------------------------

const VALID_PROMPT_TYPES: readonly MicroPromptType[] = [
  'hint_suggester',
  'disambiguator',
  'confidence_booster',
];

// ---------------------------------------------------------------------------
// Main router function
// ---------------------------------------------------------------------------

/**
 * Route a micro-prompt request through the LLM pipeline.
 *
 * Steps:
 * 1. Validate prompt type
 * 2. Check LLM availability
 * 3. Build prompt string
 * 4. Call LLM provider
 * 5. Parse JSON from response
 * 6. Validate against schema
 * 7. Return typed result
 */
export async function routeMicroPrompt(
  request: MicroPromptRequest
): Promise<MicroPromptResult> {
  const { promptType } = request;

  console.log(`[MicroPromptRouter] Routing ${promptType} prompt`);

  // Step 1: Validate prompt type
  if (!VALID_PROMPT_TYPES.includes(promptType)) {
    const msg = `Unknown prompt type: "${promptType}"`;
    console.error(`[MicroPromptRouter] ${promptType} failed: UNKNOWN_PROMPT_TYPE - ${msg}`);
    return {
      success: false,
      error: msg,
      code: 'UNKNOWN_PROMPT_TYPE',
    };
  }

  // Step 2: Check LLM availability
  const llmService = getLLMService();
  if (!llmService.isConfigured()) {
    const msg = 'LLM service is not configured';
    console.error(`[MicroPromptRouter] ${promptType} failed: LLM_NOT_CONFIGURED - ${msg}`);
    return {
      success: false,
      error: msg,
      code: 'LLM_NOT_CONFIGURED',
    };
  }

  // Step 3: Build prompt
  const prompt = buildMicroPrompt(request.input);
  console.log(`[MicroPromptRouter] Prompt built: ${prompt.length} chars`);

  // Step 4: Call LLM
  let rawResponse: string;
  try {
    rawResponse = await llmService.generate(prompt);
    console.log(`[MicroPromptRouter] LLM response: ${rawResponse.length} chars`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown LLM error';

    // Distinguish "not available" from other generation failures
    if (errorMessage === 'LLM provider not available') {
      console.error(`[MicroPromptRouter] ${promptType} failed: LLM_NOT_AVAILABLE - ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
        code: 'LLM_NOT_AVAILABLE',
      };
    }

    console.error(`[MicroPromptRouter] ${promptType} failed: LLM_GENERATION_FAILED - ${errorMessage}`);
    return {
      success: false,
      error: errorMessage,
      code: 'LLM_GENERATION_FAILED',
    };
  }

  // Step 5: Parse JSON from response (three-tier extraction)
  const parsed = extractJSON(rawResponse);
  if (parsed === null) {
    const preview = rawResponse.slice(0, 200);
    const msg = `Could not parse JSON from LLM response: "${preview}"`;
    console.error(`[MicroPromptRouter] ${promptType} failed: INVALID_RESPONSE - ${msg}`);
    return {
      success: false,
      error: msg,
      code: 'INVALID_RESPONSE',
    };
  }

  // Step 6: Validate against schema
  const validated = validateMicroPromptOutput(promptType, parsed);
  if (validated === null) {
    console.error(`[MicroPromptRouter] ${promptType} failed: VALIDATION_FAILED - parsed JSON did not match expected schema`);
    return {
      success: false,
      error: `Response validation failed for ${promptType}: parsed JSON does not match expected schema`,
      code: 'VALIDATION_FAILED',
    };
  }

  // Step 7: Return success
  const tokenEstimate = Math.ceil((prompt.length + rawResponse.length) / 4);
  console.log(`[MicroPromptRouter] ${promptType} completed, ~${tokenEstimate} tokens roundtrip`);

  return {
    success: true,
    output: validated,
    tokenEstimate,
  };
}

// ---------------------------------------------------------------------------
// JSON extraction helper
// ---------------------------------------------------------------------------

/**
 * Extract a JSON object from an LLM response string.
 * Tries three approaches in order:
 * 1. Direct JSON.parse
 * 2. Extract from markdown code block
 * 3. Regex match for JSON object pattern
 */
function extractJSON(raw: string): unknown | null {
  // Try 1: Direct parse
  try {
    return JSON.parse(raw);
  } catch {
    // Continue to next strategy
  }

  // Try 2: Extract from markdown code block
  const codeBlockMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch?.[1]) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch {
      // Continue to next strategy
    }
  }

  // Try 3: Find JSON object pattern
  const objectMatch = raw.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try {
      return JSON.parse(objectMatch[0]);
    } catch {
      // All strategies failed
    }
  }

  return null;
}

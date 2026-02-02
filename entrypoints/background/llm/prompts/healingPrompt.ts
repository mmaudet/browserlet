/**
 * Prompt builder for self-healing selector repair suggestions
 * Asks LLM to suggest alternative semantic hints when resolution fails
 * Covers requirements: HEAL-01, HEAL-02, HEAL-10
 */

import type { HealingContext, RepairSuggestion, SemanticHint, HintType } from '../../../content/playback/types';

// Valid hint types (10 types in Browserlet)
const VALID_HINT_TYPES: HintType[] = [
  'role',
  'text_contains',
  'type',
  'name',
  'placeholder_contains',
  'aria_label',
  'near_label',
  'class_contains',
  'data_attribute',
  'id',
];

/**
 * Extended healing context with step action information
 */
export interface HealingPromptContext extends HealingContext {
  /** The action being performed (click, type, extract, etc.) */
  stepAction: string;
  /** The value being typed or selected (if applicable) */
  stepValue?: string;
  /** The intent description from the step (if available) */
  stepIntent?: string;
}

/**
 * Build prompt for LLM to suggest alternative hints
 * @param context - Complete healing context with step information
 * @returns Prompt string for LLM
 */
export function buildHealingPrompt(context: HealingPromptContext): string {
  // Format original hints for display
  const originalHintsFormatted = context.originalHints.map(hint => {
    if (typeof hint.value === 'object') {
      return `  - ${hint.type}: ${hint.value.name}="${hint.value.value}"`;
    }
    return `  - ${hint.type}: "${hint.value}"`;
  }).join('\n');

  // Format matched/failed hints
  const matchedFormatted = context.matchedHints.length > 0
    ? context.matchedHints.join(', ')
    : 'none';
  const failedFormatted = context.failedHints.length > 0
    ? context.failedHints.join(', ')
    : 'none';

  return `You are a self-healing selector expert for Browserlet, a web automation tool.

## Context

**Page:** ${context.pageTitle}
**URL:** ${context.pageUrl}
**Action:** ${context.stepAction}${context.stepValue ? ` (value: "${context.stepValue}")` : ''}${context.stepIntent ? `\n**Intent:** ${context.stepIntent}` : ''}

## Failed Resolution

The semantic resolver failed to find the target element.

**Original hints:**
${originalHintsFormatted}

**Resolution result:**
- Confidence achieved: ${Math.round(context.confidence * 100)}% (threshold: 70%)
- Hints that matched: ${matchedFormatted}
- Hints that failed: ${failedFormatted}

## DOM Excerpt

Here is the DOM around the expected element location:

\`\`\`html
${context.domExcerpt}
\`\`\`

## Browserlet Semantic Hint Types

You MUST use ONLY these 10 hint types. Each has a specific purpose:

1. **role** (weight: 1.0) - ARIA role of the element
   - Values: button, link, textbox, checkbox, radio, combobox, cell, heading, paragraph, navigation, etc.
   - Example: { "type": "role", "value": "button" }

2. **type** (weight: 1.0) - Input type attribute
   - Values: text, password, email, number, checkbox, radio, submit, etc.
   - Example: { "type": "type", "value": "password" }

3. **data_attribute** (weight: 1.0) - Custom data-* attribute (most stable)
   - Use object format with name and value
   - Example: { "type": "data_attribute", "value": { "name": "data-testid", "value": "submit-btn" } }

4. **aria_label** (weight: 0.9) - Accessibility label
   - Example: { "type": "aria_label", "value": "Search" }

5. **name** (weight: 0.9) - Form field name attribute
   - Example: { "type": "name", "value": "username" }

6. **id** (weight: 0.85) - Element ID (avoid auto-generated IDs)
   - Example: { "type": "id", "value": "login-form" }

7. **text_contains** (weight: 0.8) - Partial text content match
   - Example: { "type": "text_contains", "value": "Submit" }

8. **placeholder_contains** (weight: 0.7) - Partial placeholder text match
   - Example: { "type": "placeholder_contains", "value": "Enter your email" }

9. **near_label** (weight: 0.6) - Text of associated label element
   - Example: { "type": "near_label", "value": "Password" }

10. **class_contains** (weight: 0.5) - CSS class name (least reliable, often minified)
    - Example: { "type": "class_contains", "value": "primary-action" }

## Instructions

Analyze the DOM excerpt and suggest 2-3 alternative hint combinations that could find the target element.

**Important:**
- Preserve the semantic INTENT of the original hints (what the element represents, not just how to find it)
- Prefer high-weight hints (role, type, data_attribute) over low-weight ones
- Combine multiple hints for higher confidence (aim for 70%+ total weight)
- Avoid using IDs that look auto-generated (random strings, numbers, hashes)
- For data_attribute, use the object format: { "name": "...", "value": "..." }

## Response Format

Return ONLY a JSON array with this structure:

\`\`\`json
[
  {
    "proposedHints": [
      { "type": "role", "value": "button" },
      { "type": "text_contains", "value": "Login" }
    ],
    "confidence": 0.85,
    "reason": "Button with Login text is unique on the page"
  },
  {
    "proposedHints": [
      { "type": "type", "value": "submit" },
      { "type": "near_label", "value": "Sign in" }
    ],
    "confidence": 0.75,
    "reason": "Submit button near Sign in form"
  }
]
\`\`\`

Return ONLY the JSON array, no explanation or markdown code blocks around it.`;
}

/**
 * Validate a hint type against the known list
 * @param type - Hint type to validate
 * @returns true if valid
 */
export function validateHintType(type: string): type is HintType {
  return VALID_HINT_TYPES.includes(type as HintType);
}

/**
 * Parse LLM response into structured repair suggestions
 * @param response - Raw LLM response string
 * @returns Array of validated RepairSuggestion objects
 */
export function parseHealingResponse(response: string): RepairSuggestion[] {
  try {
    // Extract JSON array from response (handle markdown code blocks)
    let jsonStr = response;

    // Remove markdown code blocks if present
    const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1];
    }

    // Find JSON array
    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (!arrayMatch) {
      console.warn('[healingPrompt] No JSON array found in response');
      return [];
    }

    let parsed: unknown[];
    try {
      parsed = JSON.parse(arrayMatch[0]) as unknown[];
    } catch (parseError) {
      // Try to fix truncated JSON
      console.warn('[healingPrompt] JSON parse failed, attempting to fix...');
      const fixedJson = fixTruncatedJson(arrayMatch[0]);
      parsed = JSON.parse(fixedJson) as unknown[];
    }

    if (!Array.isArray(parsed)) {
      console.warn('[healingPrompt] Parsed result is not an array');
      return [];
    }

    // Validate and filter suggestions
    const suggestions: RepairSuggestion[] = [];

    for (const item of parsed) {
      const suggestion = validateSuggestion(item);
      if (suggestion) {
        suggestions.push(suggestion);
      }
    }

    // Sort by confidence (highest first) and limit to 3
    return suggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);
  } catch (error) {
    console.error('[healingPrompt] Failed to parse healing response:', error);
    return [];
  }
}

/**
 * Attempt to fix truncated JSON
 */
function fixTruncatedJson(jsonStr: string): string {
  // Count brackets
  const openBrackets = (jsonStr.match(/\[/g) || []).length;
  const closeBrackets = (jsonStr.match(/\]/g) || []).length;
  const openBraces = (jsonStr.match(/\{/g) || []).length;
  const closeBraces = (jsonStr.match(/\}/g) || []).length;

  // If truncated, try to close structures
  if (openBrackets !== closeBrackets || openBraces !== closeBraces) {
    // Find last complete object
    const lastComplete = jsonStr.lastIndexOf('},');
    if (lastComplete > 0) {
      return jsonStr.substring(0, lastComplete + 1) + ']';
    }
    const lastObject = jsonStr.lastIndexOf('}');
    if (lastObject > 0) {
      return jsonStr.substring(0, lastObject + 1) + ']';
    }
  }

  return jsonStr;
}

/**
 * Validate a single suggestion from the parsed response
 * @param item - Parsed item to validate
 * @returns Validated RepairSuggestion or null if invalid
 */
function validateSuggestion(item: unknown): RepairSuggestion | null {
  if (!item || typeof item !== 'object') return null;

  const obj = item as Record<string, unknown>;

  // Check required fields
  if (!Array.isArray(obj.proposedHints)) {
    console.warn('[healingPrompt] Missing proposedHints array');
    return null;
  }

  if (typeof obj.confidence !== 'number' || obj.confidence < 0 || obj.confidence > 1) {
    console.warn('[healingPrompt] Invalid or missing confidence');
    return null;
  }

  if (typeof obj.reason !== 'string') {
    console.warn('[healingPrompt] Missing reason string');
    return null;
  }

  // Validate each hint
  const validHints: SemanticHint[] = [];

  for (const hint of obj.proposedHints) {
    if (!hint || typeof hint !== 'object') continue;

    const hintObj = hint as Record<string, unknown>;

    if (typeof hintObj.type !== 'string') continue;

    // Validate hint type
    if (!validateHintType(hintObj.type)) {
      console.warn(`[healingPrompt] Invalid hint type: ${hintObj.type}`);
      continue;
    }

    // Validate hint value based on type
    if (hintObj.type === 'data_attribute') {
      // data_attribute requires object value
      if (typeof hintObj.value === 'object' && hintObj.value !== null) {
        const valueObj = hintObj.value as Record<string, unknown>;
        if (typeof valueObj.name === 'string' && typeof valueObj.value === 'string') {
          validHints.push({
            type: hintObj.type as HintType,
            value: { name: valueObj.name, value: valueObj.value },
          });
        }
      } else if (typeof hintObj.value === 'string') {
        // Some LLMs might return string format, try to parse it
        const match = hintObj.value.match(/^(\S+)=(.+)$/);
        if (match) {
          validHints.push({
            type: hintObj.type as HintType,
            value: { name: match[1], value: match[2] },
          });
        }
      }
    } else {
      // Other types require string value
      if (typeof hintObj.value === 'string') {
        validHints.push({
          type: hintObj.type as HintType,
          value: hintObj.value,
        });
      }
    }
  }

  // Must have at least one valid hint
  if (validHints.length === 0) {
    console.warn('[healingPrompt] No valid hints in suggestion');
    return null;
  }

  return {
    proposedHints: validHints,
    confidence: obj.confidence,
    reason: obj.reason,
  };
}

/**
 * BSL generation prompt builder
 * Creates structured prompts for LLM-based BSL script generation
 */

import type { CapturedAction } from '../../content/recording/types';

/**
 * Build a structured prompt for BSL generation from captured actions
 *
 * The prompt includes:
 * - System context establishing BSL expertise
 * - BSL format specification with YAML structure
 * - Hint types ordered by reliability
 * - Generation rules and best practices
 * - Serialized captured actions
 *
 * @param actions - Array of captured user actions
 * @returns Structured prompt string for LLM
 */
export function buildBSLPrompt(actions: CapturedAction[]): string {
  const actionsJson = JSON.stringify(actions, null, 2);

  return `You are a BSL (Browserlet Scripting Language) expert. Convert the following captured user actions into a valid BSL script.

## BSL Format
BSL is YAML-based with this structure:
\`\`\`yaml
name: Script Name
version: "1.0.0"
description: Brief description of what the script does
steps:
  - action: click|type|select|navigate|wait_for|scroll|hover|extract
    target:
      intent: "Human-readable description of the element"
      hints:
        - type: data_attribute|role|type|aria_label|name|text_contains|placeholder_contains|near_label|class_contains|id
          value: "hint value"
      fallback_selector: "css selector as backup"
    value: "for type/select actions"
    timeout: "10s"
\`\`\`

## Hint Types (ordered by reliability - MOST to LEAST stable)
1. **data_attribute** - Custom data attributes like {"name": "data-testid", "value": "submit-btn"} - Most stable, test-specific
2. **role** - ARIA roles like "button", "textbox", "link" - Semantic and stable
3. **type** - Input types like "submit", "text", "password", "email" - HTML-native, reliable
4. **aria_label** - Accessibility labels - Meaningful and usually stable
5. **name** - Form field name attributes - Often stable for form processing
6. **text_contains** - Visible text content - Good for buttons/links with static text
7. **placeholder_contains** - Placeholder text - Useful for inputs without labels
8. **near_label** - Associated label text - Proximity-based, context-dependent
9. **class_contains** - Semantic CSS classes (NOT utility classes like Tailwind) - Less stable
10. **id** - Element ID - ONLY if not auto-generated (avoid UUIDs, React/Vue prefixes)

## Rules
1. Always include 2-3 hints per target for resilience
2. Put most reliable hints first (data_attribute, role, aria_label)
3. Use semantic intent descriptions that explain WHAT the element does, not just its technical attributes
4. Add fallback_selector only when element has a unique, stable ID or data attribute
5. Use wait_for before actions on dynamically loaded elements (after navigation, AJAX, etc.)
6. Group related actions logically with appropriate timeouts
7. For input fields, prefer type action over click
8. **NAVIGATE ACTIONS**: The navigate action ONLY takes a URL in the \`value\` field. Do NOT include \`target\` or \`hints\` for navigate - just \`action: navigate\` and \`value: "https://..."\`
9. **PRESERVE USER INPUT VALUES**: Keep the actual values the user typed (usernames, emails, search terms, etc.). Only use \`{{credential:name}}\` placeholder syntax for PASSWORD fields. Never replace usernames or other non-password inputs with placeholders like \`{{username}}\` - that syntax is not supported.

## Captured Actions
\`\`\`json
${actionsJson}
\`\`\`

Generate a complete, valid BSL script. Output ONLY the YAML, no explanations or markdown code fences.`;
}

/**
 * Build a simpler prompt for quick BSL generation (less tokens)
 * Useful for Ollama/local models with limited context
 *
 * @param actions - Array of captured user actions
 * @returns Compact prompt string for LLM
 */
export function buildCompactBSLPrompt(actions: CapturedAction[]): string {
  const actionsJson = JSON.stringify(actions, null, 2);

  return `Convert these browser actions to BSL YAML:

${actionsJson}

BSL format:
- name: string
- version: "1.0.0"
- steps: array with action, target (intent + hints), value

Hints (by priority): data_attribute, role, type, aria_label, name, text_contains, placeholder_contains, near_label, class_contains, id

Rules:
- Use 2-3 hints per target
- navigate action: ONLY use value field with URL, NO target/hints
- Preserve actual user input values, only use {{credential:name}} for passwords

Output ONLY YAML.`;
}

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
 * @param startUrl - Optional URL to navigate to at script start
 * @returns Structured prompt string for LLM
 */
export function buildBSLPrompt(actions: CapturedAction[], startUrl?: string): string {
  const actionsJson = JSON.stringify(actions, null, 2);

  return `You are a BSL (Browserlet Scripting Language) expert. Convert the following captured user actions into a valid BSL script.

## BSL Format
BSL is YAML-based with this structure:
\`\`\`yaml
name: Script Name
version: "1.0.0"
description: Brief description of what the script does
steps:
  - action: click|type|select|navigate|wait_for|scroll|hover|extract|table_extract|screenshot
    target:
      hints:
        - type: data_attribute|role|type|aria_label|name|text_contains|placeholder_contains|near_label|fieldset_context|associated_label|section_context|class_contains|id
          value: "hint value"
      fallback_selector: "css selector as backup"
    value: "for type/select actions"
    output:  # for extract/table_extract - stores extracted data
      variable: "extracted.variable_name"
      transform: "trim|extract_number|parse_currency|parse_number|parse_date"  # optional
    timeout: "10s"
\`\`\`

## Hint Types (ordered by reliability - MOST to LEAST stable)
1. **data_attribute** - Custom data attributes like {"name": "data-testid", "value": "submit-btn"} - Most stable, test-specific
2. **role** - ARIA roles (see list below) - Semantic and stable
3. **type** - Input types like "submit", "text", "password", "email" - HTML-native, reliable
4. **aria_label** - Accessibility labels - Meaningful and usually stable
5. **name** - Form field name attributes - Often stable for form processing
6. **text_contains** - Visible text content - Good for buttons/links with static text
7. **placeholder_contains** - Placeholder text - Useful for inputs without labels
8. **near_label** - Associated label text - Proximity-based, context-dependent
9. **fieldset_context** - Fieldset legend text (e.g., "Billing Address", "Shipping Address") - Critical for disambiguating identical inputs in different form sections
10. **associated_label** - Label text via for=/aria-labelledby - More precise than near_label when explicit label association exists
11. **section_context** - Nearest section heading text (h1-h6) - Helps identify which page section the element belongs to
12. **class_contains** - Semantic CSS classes (NOT utility classes like Tailwind) - Less stable
13. **id** - Element ID - ONLY if not auto-generated (avoid UUIDs, React/Vue prefixes)

## IMPORTANT: ARIA Roles (NOT HTML tags)
The "role" hint MUST use ARIA role names, NOT HTML tag names. Here is the mapping:
- h1, h2, h3, h4, h5, h6 → "heading" (NOT "h1" or "h2")
- p → "paragraph" (NOT "p")
- button → "button"
- a (with href) → "link" (NOT "a")
- input[type="text"], input[type="email"], textarea → "textbox" (NOT "input")
- input[type="checkbox"] → "checkbox"
- input[type="radio"] → "radio"
- select → "combobox" (NOT "select")
- input[type="number"] → "spinbutton"
- input[type="range"] → "slider"
- input[type="search"] → "searchbox"
- nav → "navigation"
- main → "main"
- header → "banner"
- footer → "contentinfo"
- form → "form"
- ul, ol → "list"
- li → "listitem"
- table → "table"
- td → "cell" (table data cell)
- th → "columnheader" or "rowheader" (table header cell)
- tr → "row" (table row)
- img → "img"
- article → "article"
- aside → "complementary"

WRONG: role: h1, role: div, role: span, role: input, role: a, role: td
CORRECT: role: heading, role: textbox, role: link, role: button, role: cell

## IMPORTANT: Styled Links vs Real Buttons
Many websites use \`<a>\` tags styled as buttons (e.g., \`<a class="btn">Submit</a>\`).
- These have role "link", NOT "button"
- Use \`class_contains: btn\` to identify them as button-like elements
- Only use \`role: button\` for actual \`<button>\` elements or elements with \`role="button"\`

WRONG (for styled links):
  - type: role
    value: button  # Will fail - it's an <a> tag!

CORRECT (for styled links like "C'est parti !" or "Submit"):
  - type: text_contains
    value: "C'est parti"
  - type: class_contains
    value: btn

## IMPORTANT: Structural Context Hints (Form Disambiguation)
When actions include \`fieldset_context\`, \`associated_label\`, or \`section_context\` hints, these provide critical structural DOM context:

- **fieldset_context**: The fieldset legend text. When two inputs have identical name/type/role but different fieldset_context values (e.g., "Billing Address" vs "Shipping Address"), the fieldset_context is what distinguishes them. ALWAYS include fieldset_context in the generated hints when present.
- **associated_label**: Explicit label association (via for= or aria-labelledby). More precise than near_label. Prefer this over near_label when both exist for the same element.
- **section_context**: Section heading text (h1-h6). Useful when elements are in different page sections but not in fieldsets.

Example - two "Email" inputs in a checkout form:
\`\`\`yaml
# Billing email
- action: type
  target:
    hints:
      - type: role
        value: textbox
      - type: name
        value: email
      - type: fieldset_context
        value: "Billing Address"
  value: "user@example.com"

# Shipping email
- action: type
  target:
    hints:
      - type: role
        value: textbox
      - type: name
        value: email
      - type: fieldset_context
        value: "Shipping Address"
  value: "user@example.com"
\`\`\`
Without fieldset_context, these two steps would be indistinguishable.

## Rules
1. Always include 2-3 hints per target for resilience
2. Put most reliable hints first (data_attribute, role, aria_label)
3. **NO intent field** - The target object only has "hints" and optionally "fallback_selector"
4. **FALLBACK SELECTOR**: If the captured action includes a \`fallbackSelector\` field, ALWAYS include it in the target as \`fallback_selector\`. This is especially important for links (\`<a>\` elements) where the href provides a stable backup selector.
5. Use wait_for before actions on dynamically loaded elements (after navigation, AJAX, etc.)
6. Group related actions logically with appropriate timeouts
7. For input fields, prefer type action over click
8. **PRESERVE ALL NAVIGATION ACTIONS**: NEVER remove or skip clicks on links, menu items, or any action that causes page navigation. If a captured action has role "link" or navigates to a different URL/page, it MUST be included in the output. Do NOT optimize away navigation steps - they are essential for the script to work correctly.
8. **NAVIGATE ACTIONS**: The navigate action ONLY takes a URL in the \`value\` field. Do NOT include \`target\` or \`hints\` for navigate - just \`action: navigate\` and \`value: "https://..."\`
9. **PRESERVE USER INPUT VALUES**: Keep the actual values the user typed (usernames, emails, search terms, etc.). Only use \`{{credential:name}}\` placeholder syntax for PASSWORD fields. Never replace usernames or other non-password inputs with placeholders like \`{{username}}\` - that syntax is not supported.
10. **EXTRACT ACTIONS**: Use extract to capture single values and table_extract for tabular data.
11. **START URL**: If a startUrl is provided, the FIRST step MUST be:
    \`\`\`yaml
    - action: navigate
      value: "{startUrl}"
    \`\`\`
    - The "output" field is an OBJECT with "variable" (required) and "transform" (optional)
    - Variable MUST start with "extracted." prefix (e.g., "extracted.deal_number")
    - Available transforms:
      - **extract_number**: Extract first number from mixed text (e.g., "4 pending tasks" → 4)
      - **parse_currency**: Parse currency amount ("$1,234.56" → 1234.56)
      - **parse_number**: Parse formatted number ("1,234.56" → 1234.56)
      - **parse_date**: Parse date to ISO format
      - **trim**: Remove whitespace
      - **lowercase/uppercase**: Change case
12. **SCREENSHOT ACTIONS**: The screenshot action captures the current viewport. It has NO target, NO hints, NO value - just \`action: screenshot\`. ALWAYS preserve screenshot actions from captured actions in the output script.
13. **TEXT NORMALIZATION**: The text_contains and placeholder_contains hints are automatically normalized (lowercase, accents/diacritics removed). Use plain ASCII text without accents in hint values - e.g., use "communaute" instead of "Communauté", "francais" instead of "Français". The resolver will match regardless of case or accents in the actual page content.
14. **NAVIGATION MENUS & DROPDOWNS**: If an action targets an element inside a navigation menu, dropdown, or popover (detected via attributes like \`data-slot="navigation-menu-link"\`, \`data-radix-*\`, \`aria-expanded\`, or classes containing "dropdown", "popover", "menu"), the element may be hidden until its container is opened. In such cases:
    - Check if the captured actions include a click on the menu trigger BEFORE the target action
    - If not present, add a \`wait_for\` with timeout for the menu trigger, then a \`click\` action on it
    - Elements with role="menuitem" or inside \`[role="menu"]\` typically require opening the parent menu first
15. **STRUCTURAL HINTS**: When captured actions include \`fieldset_context\`, \`associated_label\`, or \`section_context\` hints, ALWAYS preserve them in the generated BSL. These hints are critical for disambiguating identical elements in different form sections. Without them, the resolver cannot distinguish between e.g., "Email" in billing vs "Email" in shipping.

## BSL Examples (Correct Format)
\`\`\`yaml
# Click a heading (NOT role: h1)
- action: click
  target:
    hints:
      - type: role
        value: heading
      - type: text_contains
        value: "Welcome"

# Extract title from an h1 element
- action: extract
  target:
    hints:
      - type: role
        value: heading
      - type: text_contains
        value: "Product Name"
  output:
    variable: extracted.product_title
    transform: trim

# Extract a count from mixed text like "4 pending requests"
- action: extract
  target:
    hints:
      - type: text_contains
        value: "pending requests"
      - type: class_contains
        value: badge
  output:
    variable: extracted.pending_count
    transform: extract_number

# Extract value from a table cell
- action: extract
  target:
    hints:
      - type: role
        value: cell
      - type: text_contains
        value: "18032"
  output:
    variable: extracted.deal_number

# Type in a text input
- action: type
  target:
    hints:
      - type: role
        value: textbox
      - type: placeholder_contains
        value: "Enter email"
  value: "user@example.com"

# Click a link (NOT role: a)
- action: click
  target:
    hints:
      - type: role
        value: link
      - type: text_contains
        value: "Learn more"
\`\`\`

## Start URL
${startUrl || 'Not provided - infer from first action URL'}

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
 * @param startUrl - Optional URL to navigate to at script start
 * @returns Compact prompt string for LLM
 */
export function buildCompactBSLPrompt(actions: CapturedAction[], startUrl?: string): string {
  const actionsJson = JSON.stringify(actions, null, 2);

  return `Convert these browser actions to BSL YAML:

${actionsJson}

${startUrl ? `Start URL: ${startUrl} (MUST be first step with navigate action)` : ''}

BSL format:
- name: string
- version: "1.0.0"
- steps: array with action, target (hints array only), value, output (for extract)

Hints (by priority): data_attribute, role, type, aria_label, name, text_contains, placeholder_contains, near_label, fieldset_context, associated_label, section_context, class_contains, id

ARIA roles (use these for "role" hint, NOT HTML tags):
- h1-h6 → "heading", p → "paragraph", a → "link", button → "button"
- input/textarea → "textbox", select → "combobox", nav → "navigation"

Rules:
- Use 2-3 hints per target
- NO "intent" field in target - only "hints" array
- role hint value must be ARIA role, NOT HTML tag (heading, NOT h1)
- navigate action: ONLY use value field with URL, NO target/hints
- screenshot action: NO target, NO hints, NO value - just "action: screenshot". ALWAYS preserve screenshot actions.
- extract output is OBJECT: { variable: "extracted.xxx", transform: "extract_number" }
- Transforms: extract_number (for counts in text), parse_currency, parse_number, trim
- Styled links (<a class="btn">) use class_contains: btn, NOT role: button
- Preserve actual user input values, only use {{credential:name}} for passwords
- If startUrl provided, first step MUST be navigate to that URL
- TEXT NORMALIZATION: Use plain ASCII in text_contains (e.g., "communaute" not "Communauté") - resolver handles accents
- NAVIGATION MENUS: If element is inside dropdown/menu (data-radix-*, navigation-menu-link), add click to open menu first
- FALLBACK SELECTOR: If action has fallbackSelector field, include it as fallback_selector in target (important for links)
- PRESERVE ALL LINK CLICKS: NEVER remove clicks on links or menu items that navigate to other pages - they are essential
- STRUCTURAL HINTS: fieldset_context (fieldset legend), associated_label (label[for]/aria-labelledby), section_context (heading) disambiguate identical elements in different form sections. ALWAYS preserve these when present.

Output ONLY YAML.`;
}

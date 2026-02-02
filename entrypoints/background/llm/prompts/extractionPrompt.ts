/**
 * Prompt for AI extraction suggestions during recording
 * Analyzes page content and suggests key values to extract
 */

export interface PageContext {
  url: string;
  title: string;
  /** Simplified DOM representation (key text nodes with context) */
  textNodes: Array<{
    text: string;
    tagName: string;
    className?: string;
    id?: string;
    ariaLabel?: string;
    nearbyLabels: string[];
  }>;
}

export interface ExtractionSuggestion {
  /** Variable name for extracted value (e.g., "client_name") */
  variableName: string;
  /** The actual value found on the page */
  displayValue: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Hints for targeting the element */
  semanticHints: Array<{
    type: string;
    value: string;
  }>;
  /** Suggested transform function (e.g., "parse_currency") */
  suggestedTransform?: string;
  /** Whether this is a table extraction (use table_extract action) */
  isTable?: boolean;
}

/**
 * Build prompt for LLM to analyze page and suggest extractions
 */
export function buildExtractionPrompt(context: PageContext): string {
  // Limit nodes to avoid overly long prompts (prioritize first 100 nodes which are usually the most important)
  const limitedNodes = context.textNodes.slice(0, 100);
  const truncated = context.textNodes.length > 100;

  return `You are analyzing a web page to identify key data points that a user might want to extract.

Page URL: ${context.url}
Page Title: ${context.title}
${truncated ? `\n(Note: Showing first 100 of ${context.textNodes.length} elements - focus on key data)\n` : ''}
Here are text elements from the page with their context:
${limitedNodes.map((node, i) =>
  `[${i}] "${node.text.substring(0, 150)}${node.text.length > 150 ? '...' : ''}" (${node.tagName}${node.className ? `, class="${node.className}"` : ''}${node.ariaLabel ? `, aria-label="${node.ariaLabel}"` : ''})
   Labels nearby: ${node.nearbyLabels.join(', ') || 'none'}`
).join('\n')}

Identify ALL valuable data points to extract. Include:
- Names (client, company, contact, product names)
- Amounts (prices, totals, quantities, percentages, money values)
- Dates (start date, end date, due date, created date)
- Reference numbers (order #, invoice #, account #, ID, deal number)
- Status values (pending, completed, active, approved, signed)
- Descriptions and summaries
- **Label-value pairs**: Items marked with [FIELD: "Label" = "Value"] - these are key data fields
- **Tables**: Any structured tabular data (marked with [TABLE:...])

IMPORTANT PATTERNS:
1. **[FIELD: "Label" = "Value"]** - These are structured label-value pairs from the page.
   - Extract the VALUE part (after the = sign)
   - Use the LABEL as context for generating the variable name
   - Use near_label hint with the label text to target the value cell
   - Example: [FIELD: "Montant" = "45914.00"] → variableName: "montant", use near_label: "Montant"

2. **[TABLE: ...]** - Extractable data tables
   - Set "isTable": true in the suggestion
   - Use the table name from the marker as variableName

For each data point, provide:
1. A snake_case variable name in French if the label is French (e.g., "montant", "date_debut", "etat")
2. The actual value found on the page (extract from [FIELD: ...] or directly from text)
3. Confidence score (0.0-1.0)
4. Semantic hints to target this element. Use these hint types:
   - **near_label**: The label text next to the value (BEST for [FIELD:...] patterns)
   - **text_contains**: Part of the value text itself
   - **role**: ARIA role (cell, heading, paragraph, link, button, textbox, combobox)
   - **class_contains**: CSS class name
   - **id**: Element ID
5. Suggested transform if applicable:
   - **extract_number**: Extract first number from text (e.g., "Demandes en attente 4" → 4, "4 tâches" → 4)
   - **parse_currency**: Parse currency amount (e.g., "$1,234.56" → 1234.56)
   - **parse_number**: Parse formatted number (e.g., "1,234.56" → 1234.56)
   - **parse_date**: Parse date to ISO format
   - **trim**: Remove leading/trailing whitespace
6. "isTable": true if this is a table extraction

ARIA roles mapping (use these, NOT HTML tags):
- td/th → "cell", h1-h6 → "heading", p → "paragraph", a → "link"

Return JSON array:
[
  {
    "variableName": "montant",
    "displayValue": "45914.00",
    "confidence": 0.95,
    "semanticHints": [
      { "type": "near_label", "value": "Montant" },
      { "type": "role", "value": "cell" }
    ],
    "suggestedTransform": "parse_number"
  },
  {
    "variableName": "etat",
    "displayValue": "Signée",
    "confidence": 0.95,
    "semanticHints": [
      { "type": "near_label", "value": "Etat" },
      { "type": "text_contains", "value": "Signée" }
    ]
  },
  {
    "variableName": "societe",
    "displayValue": "ASSURANCE MALADIE",
    "confidence": 0.9,
    "semanticHints": [
      { "type": "near_label", "value": "Société" },
      { "type": "role", "value": "cell" }
    ]
  },
  {
    "variableName": "products_table",
    "displayValue": "Table with 5 columns: Product, Qty, Price, Discount, Total",
    "confidence": 0.9,
    "semanticHints": [
      { "type": "role", "value": "table" },
      { "type": "class_contains", "value": "products" }
    ],
    "isTable": true
  },
  {
    "variableName": "demandes_en_attente",
    "displayValue": "4",
    "confidence": 0.95,
    "semanticHints": [
      { "type": "text_contains", "value": "Demandes en attente" },
      { "type": "role", "value": "link" }
    ],
    "suggestedTransform": "extract_number"
  }
]

Include the most valuable data points (up to 25 items max). Focus on:
- [FIELD:...] markers (label-value pairs)
- [TABLE:...] markers (data tables)
- Key headings and important values
Return ONLY the JSON array, no explanation or markdown.`;
}

/**
 * Parse LLM response into structured suggestions
 */
export function parseExtractionResponse(response: string): ExtractionSuggestion[] {
  try {
    // Extract JSON from response (handle markdown code blocks)
    let jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.warn('[extractionPrompt] No JSON array found in extraction response');
      return [];
    }

    let jsonStr = jsonMatch[0];

    // Try to fix common JSON errors from truncated responses
    // Count brackets to see if JSON is incomplete
    const openBrackets = (jsonStr.match(/\[/g) || []).length;
    const closeBrackets = (jsonStr.match(/\]/g) || []).length;
    const openBraces = (jsonStr.match(/\{/g) || []).length;
    const closeBraces = (jsonStr.match(/\}/g) || []).length;

    // If truncated, try to fix by closing open structures
    if (openBrackets !== closeBrackets || openBraces !== closeBraces) {
      console.warn('[extractionPrompt] JSON appears truncated, attempting to fix...');
      // Find the last complete object (ends with })
      const lastCompleteObject = jsonStr.lastIndexOf('},');
      if (lastCompleteObject > 0) {
        jsonStr = jsonStr.substring(0, lastCompleteObject + 1) + ']';
      } else {
        // Try to find last complete object without trailing comma
        const lastObject = jsonStr.lastIndexOf('}');
        if (lastObject > 0) {
          jsonStr = jsonStr.substring(0, lastObject + 1) + ']';
        }
      }
    }

    let parsed: unknown[];
    try {
      parsed = JSON.parse(jsonStr) as unknown[];
    } catch (parseError) {
      // Second attempt: try to extract individual objects
      console.warn('[extractionPrompt] JSON parse failed, trying to extract individual objects...');
      const objectMatches = jsonStr.match(/\{[^{}]*"variableName"[^{}]*\}/g);
      if (objectMatches) {
        parsed = objectMatches.map(obj => {
          try {
            return JSON.parse(obj);
          } catch {
            return null;
          }
        }).filter(Boolean) as unknown[];
      } else {
        throw parseError;
      }
    }

    // Validate and filter suggestions
    const suggestions: ExtractionSuggestion[] = [];
    for (const item of parsed) {
      if (isValidSuggestion(item)) {
        suggestions.push(item);
      }
    }

    // Filter by confidence and limit to 25
    return suggestions
      .filter(s => s.confidence >= 0.7)
      .slice(0, 25);
  } catch (error) {
    console.error('[extractionPrompt] Failed to parse extraction suggestions:', error);
    return [];
  }
}

/**
 * Type guard to validate suggestion structure
 */
function isValidSuggestion(item: unknown): item is ExtractionSuggestion {
  if (!item || typeof item !== 'object') return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj.variableName === 'string' &&
    typeof obj.displayValue === 'string' &&
    typeof obj.confidence === 'number' &&
    Array.isArray(obj.semanticHints)
  );
}

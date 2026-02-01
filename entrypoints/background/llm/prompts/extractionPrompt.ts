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
}

/**
 * Build prompt for LLM to analyze page and suggest extractions
 */
export function buildExtractionPrompt(context: PageContext): string {
  return `You are analyzing a web page to identify key data points that a user might want to extract.

Page URL: ${context.url}
Page Title: ${context.title}

Here are text elements from the page with their context:
${context.textNodes.map((node, i) =>
  `[${i}] "${node.text}" (${node.tagName}${node.className ? `, class="${node.className}"` : ''}${node.ariaLabel ? `, aria-label="${node.ariaLabel}"` : ''})
   Labels nearby: ${node.nearbyLabels.join(', ') || 'none'}`
).join('\n')}

Identify valuable data points to extract. Focus on:
- Names (client, company, contact)
- Amounts (prices, totals, quantities)
- Dates (order date, due date, invoice date)
- Reference numbers (order #, invoice #, account #)
- Status values (pending, completed, active)

For each data point, provide:
1. A snake_case variable name (without "extracted." prefix)
2. The actual value found on the page
3. Confidence score (0.0-1.0)
4. Semantic hints to target this element (use existing hint types: text_contains, aria_label, role, placeholder, name, id, class_name)
5. Suggested transform if applicable (parse_currency, parse_number, parse_date, trim)

Return JSON array:
[
  {
    "variableName": "client_name",
    "displayValue": "Acme Corp",
    "confidence": 0.95,
    "semanticHints": [
      { "type": "text_contains", "value": "Client:" },
      { "type": "aria_label", "value": "Client name" }
    ],
    "suggestedTransform": "trim"
  }
]

Only include high-confidence suggestions (>0.7). Limit to 10 most relevant items.
Return ONLY the JSON array, no explanation.`;
}

/**
 * Parse LLM response into structured suggestions
 */
export function parseExtractionResponse(response: string): ExtractionSuggestion[] {
  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.warn('[extractionPrompt] No JSON array found in extraction response');
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]) as unknown[];

    // Validate and filter suggestions
    const suggestions: ExtractionSuggestion[] = [];
    for (const item of parsed) {
      if (isValidSuggestion(item)) {
        suggestions.push(item);
      }
    }

    // Filter by confidence and limit to 10
    return suggestions
      .filter(s => s.confidence >= 0.7)
      .slice(0, 10);
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

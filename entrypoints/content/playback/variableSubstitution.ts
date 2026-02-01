/**
 * Variable substitution for extracted values
 * Pattern: {{extracted.variable_name}}
 * Similar to credential substitution pattern (utils/passwords/substitution.ts)
 */

/**
 * Regex pattern for extracted variable references: {{extracted.name}}
 * Name must contain only alphanumeric characters, dashes, and underscores.
 */
export const EXTRACTED_VAR_PATTERN = /\{\{extracted\.([a-zA-Z0-9_-]+)\}\}/g;

/**
 * Check if a string contains extracted variable references
 * @param text - Text to check for variable references
 * @returns true if text contains {{extracted.*}} patterns
 */
export function hasExtractedVariables(text: string): boolean {
  // Reset lastIndex to ensure regex starts from beginning
  EXTRACTED_VAR_PATTERN.lastIndex = 0;
  return EXTRACTED_VAR_PATTERN.test(text);
}

/**
 * Extract all variable names from a string
 * @param text - Text to search for variable references
 * @returns Array of variable paths (e.g., ["extracted.client_name", "extracted.total"])
 */
export function extractVariableRefs(text: string): string[] {
  const refs: string[] = [];
  // Reset lastIndex to ensure regex starts from beginning
  EXTRACTED_VAR_PATTERN.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = EXTRACTED_VAR_PATTERN.exec(text)) !== null) {
    // Return the full path including "extracted." prefix
    refs.push(`extracted.${match[1]}`);
  }

  return refs;
}

/**
 * Substitute extracted variables in a string
 * @param text - String containing {{extracted.name}} placeholders
 * @param extractedData - Map of variable names to values (keys include "extracted." prefix)
 * @returns String with placeholders replaced by values
 * @throws Error if variable not found or value is complex type
 *
 * @example
 * substituteVariables("Navigate to {{extracted.invoice_url}}", { "extracted.invoice_url": "https://..." })
 * // => "Navigate to https://..."
 */
export function substituteVariables(
  text: string,
  extractedData: Record<string, unknown>
): string {
  // Reset lastIndex to ensure regex starts from beginning
  EXTRACTED_VAR_PATTERN.lastIndex = 0;

  return text.replace(EXTRACTED_VAR_PATTERN, (match, varName: string) => {
    const varPath = `extracted.${varName}`;
    const value = extractedData[varPath];

    if (value === undefined) {
      const available = Object.keys(extractedData);
      const availableList = available.length > 0
        ? `Available: ${available.join(', ')}`
        : 'No variables have been extracted yet.';
      throw new Error(
        `Variable "${varPath}" not found. ${availableList}`
      );
    }

    // Block complex types - substitution is text-only
    if (typeof value === 'object' && value !== null) {
      throw new Error(
        `Cannot substitute complex value for "${varPath}". ` +
        `Variable substitution only supports strings and numbers. ` +
        `Use table_extract results directly in export, not in step values.`
      );
    }

    return String(value);
  });
}

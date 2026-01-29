/**
 * Text manipulation utilities
 * Ported from POC semantic-resolver
 */

/**
 * Normalize text for comparison:
 * - Remove multiple spaces
 * - Trim
 * - Lowercase
 * - Remove accents (optional)
 */
export function normalizeText(text: string | null | undefined, removeAccents = true): string {
  if (!text) return '';

  let normalized = text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' '); // Multiple spaces to single space

  if (removeAccents) {
    normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  return normalized;
}

/**
 * Extract visible text from an element (without hidden children)
 */
export function getVisibleText(element: Element): string {
  // Simple case: textContent
  const text = element.textContent || '';

  // Filter text from hidden elements (basic version)
  // A more robust version would iterate over childNodes
  return text.trim();
}

/**
 * Get short text for debugging (max N characters)
 */
export function getTextPreview(element: Element, maxLength = 50): string {
  const text = getVisibleText(element);
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Check if a string contains another (normalized)
 */
export function containsText(haystack: string, needle: string): boolean {
  return normalizeText(haystack).includes(normalizeText(needle));
}

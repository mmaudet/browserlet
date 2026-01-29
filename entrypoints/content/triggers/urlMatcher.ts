/**
 * URL pattern matching for contextual triggers
 * Reuses the proven pattern from sessionDetector.ts
 */

/**
 * Convert wildcard URL pattern to regex
 * Handles asterisk wildcards, escapes special regex chars
 * @example "star/login-star" becomes regex for any prefix/suffix
 */
export function urlPatternToRegex(pattern: string): RegExp {
  // Escape special regex chars except asterisks, then replace asterisks with .*
  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp(regexPattern, 'i'); // Case insensitive
}

/**
 * Check if URL matches a single pattern
 * @param url - Full URL to check
 * @param pattern - Wildcard pattern using asterisks
 * @returns true if URL matches pattern
 */
export function matchesUrlPattern(url: string, pattern: string): boolean {
  try {
    const regex = urlPatternToRegex(pattern);
    return regex.test(url);
  } catch {
    console.warn('[Browserlet] Invalid URL pattern:', pattern);
    return false;
  }
}

/**
 * Check if URL matches any pattern in the list
 * @param url - Full URL to check
 * @param patterns - Array of wildcard patterns
 * @returns true if URL matches at least one pattern
 */
export function matchesAnyUrlPattern(url: string, patterns: string[]): boolean {
  if (!patterns || patterns.length === 0) {
    return true; // No patterns = matches all
  }
  return patterns.some(pattern => matchesUrlPattern(url, pattern));
}

/**
 * Extract domain from URL for site override lookups
 * @param url - Full URL
 * @returns hostname (e.g., "example.com")
 */
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

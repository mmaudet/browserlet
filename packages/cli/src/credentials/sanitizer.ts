/**
 * Credential value sanitizer for CLI log output.
 *
 * Prevents credential plaintext from appearing in logs, error messages,
 * or terminal output. Two layers of protection:
 *
 * 1. Pattern-based: Replaces {{credential:xxx}} references with {{credential:***}}
 * 2. Value-based: Replaces known decrypted values with [REDACTED]
 *
 * The sanitized logger wraps console.* methods with automatic redaction.
 */

/**
 * Regex for credential reference patterns in text.
 * Matches {{credential:name}} where name is alphanumeric, dashes, or underscores.
 */
const CREDENTIAL_REF_PATTERN = /\{\{credential:[a-zA-Z0-9_-]+\}\}/g;

/**
 * Sanitize text by replacing credential reference patterns.
 *
 * Replaces any {{credential:xxx}} with {{credential:***}} to prevent
 * credential names from leaking in log output.
 *
 * If knownValues are provided, also replaces actual credential values
 * with [REDACTED].
 *
 * @param text - Text that may contain credential references or values
 * @param knownValues - Optional array of known credential plaintext values to redact
 * @returns Sanitized text with credential patterns and values replaced
 */
export function sanitizeForLog(text: string, knownValues?: string[]): string {
  // Reset regex lastIndex for safety
  CREDENTIAL_REF_PATTERN.lastIndex = 0;

  let result = text.replace(CREDENTIAL_REF_PATTERN, '{{credential:***}}');

  if (knownValues && knownValues.length > 0) {
    result = redactCredentialValues(result, knownValues);
  }

  return result;
}

/**
 * Replace known credential values in text with [REDACTED].
 *
 * Processes values longest-first to avoid partial matches.
 * For example, if values are ["password123", "password"], the longer
 * value is replaced first so "password123" becomes "[REDACTED]" rather
 * than "[REDACTED]123".
 *
 * @param text - Text that may contain credential values
 * @param knownValues - Array of known credential plaintext values
 * @returns Text with all known values replaced by [REDACTED]
 */
export function redactCredentialValues(
  text: string,
  knownValues: string[]
): string {
  if (knownValues.length === 0) {
    return text;
  }

  // Sort longest first to avoid partial matches
  const sorted = [...knownValues]
    .filter((v) => v.length > 0)
    .sort((a, b) => b.length - a.length);

  let result = text;
  for (const value of sorted) {
    // Use split+join for global replacement without regex escaping issues
    result = result.split(value).join('[REDACTED]');
  }

  return result;
}

/**
 * Logger interface matching the subset of console methods we wrap.
 */
export interface SanitizedLogger {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
}

/**
 * Create a logger that automatically redacts known credential values.
 *
 * Wraps console.log/warn/error/debug so that any string argument
 * is passed through redactCredentialValues before output. Non-string
 * arguments pass through unchanged.
 *
 * @param knownValues - Array of known credential plaintext values to redact
 * @returns Object with log, warn, error, debug methods that auto-redact
 *
 * @example
 * ```ts
 * const logger = createSanitizedLogger(['s3cret']);
 * logger.log('Password is s3cret'); // outputs: "Password is [REDACTED]"
 * ```
 */
export function createSanitizedLogger(
  knownValues: string[]
): SanitizedLogger {
  function sanitizeArgs(args: unknown[]): unknown[] {
    return args.map((arg) => {
      if (typeof arg === 'string') {
        return redactCredentialValues(arg, knownValues);
      }
      return arg;
    });
  }

  return {
    log: (...args: unknown[]) => console.log(...sanitizeArgs(args)),
    warn: (...args: unknown[]) => console.warn(...sanitizeArgs(args)),
    error: (...args: unknown[]) => console.error(...sanitizeArgs(args)),
    debug: (...args: unknown[]) => console.debug(...sanitizeArgs(args)),
  };
}

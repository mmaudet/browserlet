/**
 * Session detector for authentication state detection
 * Identifies when user is logged out so script can pause for manual authentication
 * Covers requirements AUTH-01, AUTH-02, AUTH-03
 */

import type { SessionCheckConfig, SemanticHint } from './types';
import { resolveElement } from './semanticResolver';
import { isElementVisible } from '../../../utils/hints/dom';

/**
 * Default patterns that indicate login/authentication pages
 * Used when no custom patterns are provided
 */
export const DEFAULT_LOGIN_PATTERNS = [
  '*/login*',
  '*/signin*',
  '*/sign-in*',
  '*/auth/*',
  '*/authenticate*',
  '*/session/new*',
];

/**
 * Check if current URL matches any login page patterns
 * @param patterns - Wildcard patterns like "*\/login*"
 * @returns false if on login page (not authenticated), true otherwise
 */
export function checkUrlPatterns(patterns: string[] | undefined): boolean {
  if (!patterns || patterns.length === 0) {
    return true; // No patterns = assume authenticated
  }

  const currentUrl = window.location.href;

  for (const pattern of patterns) {
    // Convert wildcard pattern to regex
    // Escape special regex chars except *, then replace * with .*
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');
    const regex = new RegExp(regexPattern, 'i');

    if (regex.test(currentUrl)) {
      return false; // On login page = not authenticated
    }
  }

  return true; // No patterns matched = not on login page
}

/**
 * Check if session indicator element is present and visible
 * @param indicatorConfig - Config with hints to find indicator element (e.g., user avatar)
 * @returns true if indicator found and visible (authenticated), false otherwise
 */
export function checkIndicatorPresent(
  indicatorConfig: { hints: SemanticHint[] } | undefined
): boolean {
  if (!indicatorConfig) {
    return true; // No indicator config = skip check, assume authenticated
  }

  const result = resolveElement(indicatorConfig.hints);

  if (!result.element) {
    return false; // Element not found = not authenticated
  }

  if (!isElementVisible(result.element)) {
    return false; // Element found but hidden = not authenticated
  }

  return true; // Element found and visible = authenticated
}

/**
 * Check if login-related element is absent (indicating authenticated state)
 * @param absenceConfig - Config with hints to find login form or button
 * @returns true if login form NOT found or NOT visible (authenticated), false if visible
 */
export function checkAbsenceIndicator(
  absenceConfig: { hints: SemanticHint[] } | undefined
): boolean {
  if (!absenceConfig) {
    return true; // No absence config = skip check, assume authenticated
  }

  const result = resolveElement(absenceConfig.hints);

  if (!result.element) {
    return true; // Login form not found = authenticated
  }

  if (!isElementVisible(result.element)) {
    return true; // Login form found but hidden = authenticated
  }

  return false; // Login form found and visible = not authenticated
}

/**
 * Check if session is active using all three detection strategies
 * @param config - Session check configuration
 * @returns true only if ALL checks pass (authenticated)
 */
export function checkSessionActive(config: SessionCheckConfig): boolean {
  // Check URL patterns first (fastest check)
  if (!checkUrlPatterns(config.url_patterns)) {
    return false;
  }

  // Check presence indicator (e.g., user avatar must be visible)
  if (!checkIndicatorPresent(config.indicator)) {
    return false;
  }

  // Check absence indicator (e.g., login form must NOT be visible)
  if (!checkAbsenceIndicator(config.absence_indicator)) {
    return false;
  }

  return true; // All checks passed = authenticated
}

/**
 * SessionDetector class for stateful session monitoring with polling
 * Provides waitForAuthentication to pause until user logs in
 */
export class SessionDetector {
  private config: SessionCheckConfig | undefined;
  private onAuthRequired: (() => void) | null = null;
  private isWaiting = false;

  constructor(config?: SessionCheckConfig) {
    this.config = config;
  }

  /**
   * Set callback for when authentication is required
   * Called when waitForAuthentication starts
   */
  onAuthenticationRequired(callback: () => void): void {
    this.onAuthRequired = callback;
  }

  /**
   * Check if session is currently active
   * @returns true if authenticated or no config set
   */
  isAuthenticated(): boolean {
    if (!this.config) return true; // No config = skip check
    return checkSessionActive(this.config);
  }

  /**
   * Wait for user to complete authentication
   * Polls until authenticated or stopWaiting is called
   * @param pollIntervalMs - Interval between checks in milliseconds
   */
  async waitForAuthentication(pollIntervalMs: number = 2000): Promise<void> {
    if (this.isWaiting) return; // Already waiting
    this.isWaiting = true;

    // Notify that auth is required
    this.onAuthRequired?.();

    // Poll until authenticated
    while (!this.isAuthenticated() && this.isWaiting) {
      await new Promise(r => setTimeout(r, pollIntervalMs));
    }

    this.isWaiting = false;
  }

  /**
   * Stop waiting for authentication (for cancellation)
   */
  stopWaiting(): void {
    this.isWaiting = false;
  }

  /**
   * Update session check configuration at runtime
   * @param config - New session check configuration
   */
  setConfig(config: SessionCheckConfig): void {
    this.config = config;
  }
}

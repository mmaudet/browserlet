/**
 * SimpleResolver - Resolves BSL step targets to Playwright-compatible selectors
 *
 * Uses a priority-ordered strategy chain: fallback_selector, text_contains,
 * role, id, name. For actions that don't need a selector (navigate, screenshot
 * without target), returns empty string.
 */

import type { Page } from 'playwright';
import type { BSLStep } from '@browserlet/core/types';

/**
 * Actions that do not require a target selector.
 * The executor handles these directly (e.g., navigate uses a URL, not a selector).
 */
const NO_SELECTOR_ACTIONS = new Set(['navigate', 'screenshot']);

/**
 * SimpleResolver resolves BSL step targets to Playwright-compatible selectors
 * using a priority-ordered fallback chain.
 *
 * Resolution strategies (in priority order):
 * 1. fallback_selector -- CSS selector from recording
 * 2. text_contains -- Playwright text selector
 * 3. role -- Playwright role selector
 * 4. id -- CSS ID selector
 * 5. name -- CSS attribute selector
 */
export class SimpleResolver {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Resolve a BSL step target to a Playwright-compatible selector string.
   *
   * @param step - The BSL step to resolve
   * @returns The resolved selector string, or empty string for actions that don't need one
   * @throws Error if no strategy can find a matching element
   */
  async resolve(step: BSLStep): Promise<string> {
    // Actions that don't need a selector
    if (NO_SELECTOR_ACTIONS.has(step.action) && !step.target) {
      return '';
    }

    // No target defined -- cannot resolve
    if (!step.target) {
      throw new Error(
        `Could not resolve selector for step: ${step.id || step.action} (no target defined)`,
      );
    }

    // Strategy 1: fallback_selector (CSS selector from recording)
    if (step.target.fallback_selector) {
      const selector = step.target.fallback_selector;
      const count = await this.page.locator(selector).count();
      if (count > 0) {
        return selector;
      }
      throw new Error(
        `Fallback selector not found on page: ${selector}`,
      );
    }

    // Strategy 2-5: hint-based resolution
    if (step.target.hints && step.target.hints.length > 0) {
      for (const hint of step.target.hints) {
        const value = typeof hint.value === 'string' ? hint.value : hint.value.value;

        let selector: string | null = null;

        switch (hint.type) {
          case 'text_contains':
            selector = `text=${value}`;
            break;
          case 'role':
            selector = `role=${value}`;
            break;
          case 'id':
            selector = `#${value}`;
            break;
          case 'name':
            selector = `[name="${value}"]`;
            break;
          default:
            // Other hint types not supported by SimpleResolver in Phase 24
            continue;
        }

        if (selector) {
          const count = await this.page.locator(selector).count();
          if (count > 0) {
            return selector;
          }
        }
      }
    }

    // No strategy worked
    throw new Error(
      `Could not resolve selector for step: ${step.id || step.action}`,
    );
  }
}

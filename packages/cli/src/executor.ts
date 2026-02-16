/**
 * PlaywrightExecutor - Translates BSL actions into Playwright native APIs
 *
 * Maps all 10 BSL action types to Playwright Page methods with proper
 * timeout handling and error classification (TIMEOUT vs STEP_FAILURE).
 */

import type { Page } from 'playwright';
import type { BSLStep, ActionType, TableExtractionResult } from '@browserlet/core/types';

/** Custom error codes for step execution failures */
export type StepErrorCode = 'TIMEOUT' | 'STEP_FAILURE';

export interface StepError extends Error {
  code: StepErrorCode;
  action: ActionType;
  selector?: string;
}

/**
 * Creates a StepError with the given code, message, and context.
 */
function createStepError(
  code: StepErrorCode,
  message: string,
  action: ActionType,
  selector?: string,
): StepError {
  const error = new Error(message) as StepError;
  error.code = code;
  error.action = action;
  error.selector = selector;
  return error;
}

/**
 * Parses a BSL timeout string (e.g., "10s", "5000ms", "30000") into milliseconds.
 */
export function parseTimeout(timeout: string): number {
  const trimmed = timeout.trim();
  if (trimmed.endsWith('ms')) {
    return parseInt(trimmed.slice(0, -2), 10);
  }
  if (trimmed.endsWith('s')) {
    return parseFloat(trimmed.slice(0, -1)) * 1000;
  }
  return parseInt(trimmed, 10);
}

/**
 * PlaywrightExecutor maps BSL step actions to Playwright Page methods.
 *
 * Each action uses Playwright's built-in auto-waiting and actionability
 * checks. Errors are classified as TIMEOUT (infrastructure) or
 * STEP_FAILURE (logic/assertion) for proper exit code handling.
 */
export class PlaywrightExecutor {
  private page: Page;
  private globalTimeout: number;

  constructor(page: Page, globalTimeout: number = 30000) {
    this.page = page;
    this.globalTimeout = globalTimeout;
  }

  /**
   * Execute a BSL step action against the given selector.
   *
   * @param step - The BSL step to execute
   * @param selector - The resolved CSS/text selector to target
   * @returns The result of the action (extraction results, or undefined for void actions)
   */
  async execute(step: BSLStep, selector: string): Promise<unknown> {
    const timeout = step.timeout
      ? parseTimeout(step.timeout)
      : this.globalTimeout;

    try {
      switch (step.action) {
        case 'click':
          return await this.executeClick(selector, timeout);

        case 'type':
          return await this.executeType(selector, step.value, timeout);

        case 'select':
          return await this.executeSelect(selector, step.value, timeout);

        case 'navigate':
          return await this.executeNavigate(step.value, timeout);

        case 'hover':
          return await this.executeHover(selector, timeout);

        case 'scroll':
          return await this.executeScroll(selector, timeout);

        case 'screenshot':
          return await this.executeScreenshot(step.value, timeout);

        case 'wait_for':
          return await this.executeWaitFor(selector, timeout);

        case 'extract':
          return await this.executeExtract(selector, step, timeout);

        case 'table_extract':
          return await this.executeTableExtract(selector, timeout);

        default: {
          const exhaustiveCheck: never = step.action;
          throw createStepError(
            'STEP_FAILURE',
            `Unknown action: ${exhaustiveCheck}`,
            step.action,
            selector,
          );
        }
      }
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && (error as StepError).code) {
        throw error; // Already a StepError, re-throw
      }
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw createStepError(
          'TIMEOUT',
          `Timeout after ${timeout}ms on ${step.action}: ${error.message}`,
          step.action,
          selector,
        );
      }
      throw createStepError(
        'STEP_FAILURE',
        error instanceof Error ? error.message : String(error),
        step.action,
        selector,
      );
    }
  }

  /**
   * Click an element. Playwright handles actionability checks
   * (visible, enabled, stable, receives events).
   */
  private async executeClick(selector: string, timeout: number): Promise<void> {
    await this.page.click(selector, { timeout });
  }

  /**
   * Type into an element using page.fill() which clears the field first.
   * Faster than page.type() which types character-by-character.
   *
   * If the resolved element is a non-fillable container (e.g. a <div> wrapper),
   * automatically looks for a child input/textarea/[contenteditable] element.
   */
  private async executeType(
    selector: string,
    value: string | undefined,
    timeout: number,
  ): Promise<void> {
    if (!value) {
      throw createStepError(
        'STEP_FAILURE',
        'type action requires a value',
        'type',
        selector,
      );
    }
    try {
      await this.page.fill(selector, value, { timeout });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('not an <input>') || msg.includes('not have a role allowing')) {
        // Resolved element is a wrapper — find the actual input inside
        const child = this.page.locator(selector).locator('input, textarea, [contenteditable="true"]').first();
        await child.fill(value, { timeout });
      } else {
        throw err;
      }
    }
  }

  /**
   * Select an option from a <select> element.
   * Playwright selectOption accepts value, label, or index.
   */
  private async executeSelect(
    selector: string,
    value: string | undefined,
    timeout: number,
  ): Promise<void> {
    if (!value) {
      throw createStepError(
        'STEP_FAILURE',
        'select action requires a value',
        'select',
        selector,
      );
    }
    await this.page.selectOption(selector, value, { timeout });
  }

  /**
   * Navigate to a URL. Selector is ignored for navigate actions.
   * Uses waitUntil: 'load' to ensure page fully loads before continuing.
   */
  private async executeNavigate(
    value: string | undefined,
    timeout: number,
  ): Promise<void> {
    if (!value) {
      throw createStepError(
        'STEP_FAILURE',
        'navigate action requires a value (URL)',
        'navigate',
      );
    }
    await this.page.goto(value, { timeout, waitUntil: 'load' });
  }

  /**
   * Hover over an element. Playwright handles actionability and
   * scrolls the element into view automatically.
   */
  private async executeHover(selector: string, timeout: number): Promise<void> {
    await this.page.hover(selector, { timeout });
  }

  /**
   * Scroll an element into view using Playwright's locator API.
   */
  private async executeScroll(selector: string, timeout: number): Promise<void> {
    await this.page.locator(selector).scrollIntoViewIfNeeded({ timeout });
  }

  /**
   * Take a screenshot of the current page.
   * Saves to the path specified in step.value, or generates a timestamped filename.
   */
  private async executeScreenshot(
    value: string | undefined,
    timeout: number,
  ): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 2000));
    const path = value || `screenshot-${Date.now()}.png`;
    await this.page.screenshot({ path, timeout });
  }

  /**
   * Wait for an element to become visible on the page.
   */
  private async executeWaitFor(selector: string, timeout: number): Promise<void> {
    await this.page.waitForSelector(selector, { state: 'visible', timeout });
  }

  /**
   * Extract text content or an attribute value from an element.
   * If step.output.attribute is set, extracts that attribute.
   * Otherwise extracts the element's text content.
   */
  private async executeExtract(
    selector: string,
    step: BSLStep,
    timeout: number,
  ): Promise<string | null> {
    if (step.output?.attribute) {
      return await this.page.getAttribute(selector, step.output.attribute, { timeout });
    }
    return await this.page.textContent(selector, { timeout });
  }

  /**
   * Extract tabular data from a <table> element.
   * Returns headers from <th> elements and rows as Record<string, string>[].
   */
  private async executeTableExtract(
    selector: string,
    timeout: number,
  ): Promise<TableExtractionResult> {
    // Wait for the table to be visible first
    await this.page.waitForSelector(selector, { state: 'visible', timeout });

    const result = await this.page.$$eval(
      `${selector} tr`,
      (rows: Element[]) => {
        const headers: string[] = [];
        const dataRows: Record<string, string>[] = [];

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i]!;
          const thCells = row.querySelectorAll('th');
          const tdCells = row.querySelectorAll('td');

          if (thCells.length > 0 && headers.length === 0) {
            // Extract headers from <th> elements
            thCells.forEach((th) => headers.push(th.textContent?.trim() ?? ''));
          } else if (tdCells.length > 0) {
            // Extract data row using headers as keys
            const rowData: Record<string, string> = {};
            tdCells.forEach((td, colIndex) => {
              const key = headers[colIndex] ?? `col_${colIndex}`;
              rowData[key] = td.textContent?.trim() ?? '';
            });
            dataRows.push(rowData);
          }
        }

        return { headers, rows: dataRows };
      },
    );

    return result;
  }
}

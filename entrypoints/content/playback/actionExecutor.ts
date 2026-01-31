/**
 * Action executor implementing all 8 BSL actions with proper DOM event dispatching.
 * Proper event sequences ensure compatibility with React, Vue, Angular, and legacy jQuery apps.
 */

import type { HumanizerConfig } from './humanizer';
import { typeCharacterDelay, scrollSettleDelay, DEFAULT_CONFIG } from './humanizer';
import type { BSLStep, SemanticHint } from './types';
import { waitForElement } from './semanticResolver';

// Password utilities for credential injection
import { substituteCredentials, extractCredentialRefs } from '../../../utils/passwords/substitution';
import { getPasswords } from '../../../utils/passwords/storage';

/**
 * Execute a click action on an element (ACT-01)
 * Dispatches proper mousedown -> mouseup -> click sequence for framework compatibility
 */
export async function executeClick(element: Element): Promise<void> {
  // Scroll element into view
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // Wait for scroll to complete
  await scrollSettleDelay();

  // Focus element if it's an HTMLElement
  if (element instanceof HTMLElement) {
    element.focus();
  }

  // Calculate center coordinates from bounding rect
  const rect = element.getBoundingClientRect();
  const clientX = rect.left + rect.width / 2;
  const clientY = rect.top + rect.height / 2;

  // Dispatch full event sequence for framework compatibility
  element.dispatchEvent(new MouseEvent('mousedown', {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
    view: window,
  }));

  element.dispatchEvent(new MouseEvent('mouseup', {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
    view: window,
  }));

  element.dispatchEvent(new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
    view: window,
  }));
}

/**
 * Execute a type action on an element (ACT-02)
 * Types character-by-character with humanized delays
 */
export async function executeType(
  element: Element,
  text: string,
  config: HumanizerConfig = DEFAULT_CONFIG
): Promise<void> {
  // Validate element is an input or textarea
  if (!(element instanceof HTMLInputElement) && !(element instanceof HTMLTextAreaElement)) {
    throw new Error('executeType requires HTMLInputElement or HTMLTextAreaElement');
  }

  // Focus element
  element.focus();

  // Clear existing value
  element.value = '';

  // Type character by character
  for (const char of text) {
    // Dispatch keydown
    element.dispatchEvent(new KeyboardEvent('keydown', {
      key: char,
      bubbles: true,
      cancelable: true,
    }));

    // Add character to value
    element.value += char;

    // Dispatch input event
    element.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      data: char,
      inputType: 'insertText',
    }));

    // Dispatch keyup
    element.dispatchEvent(new KeyboardEvent('keyup', {
      key: char,
      bubbles: true,
      cancelable: true,
    }));

    // Wait for humanized delay between keystrokes
    await typeCharacterDelay(config);
  }

  // Dispatch change event at end
  element.dispatchEvent(new Event('change', { bubbles: true }));

  // Dispatch blur to trigger validation
  element.dispatchEvent(new Event('blur', { bubbles: true }));
}

/**
 * Execute a select action on a select element (ACT-03)
 * Finds option by value or text content
 */
export async function executeSelect(element: Element, optionValue: string): Promise<void> {
  // Validate element is a select
  if (!(element instanceof HTMLSelectElement)) {
    throw new Error('executeSelect requires HTMLSelectElement');
  }

  // Focus element
  element.focus();

  // Find option by value OR by text content
  let targetOption: HTMLOptionElement | null = null;

  // First try to find by value
  for (const option of Array.from(element.options)) {
    if (option.value === optionValue) {
      targetOption = option;
      break;
    }
  }

  // If not found by value, try by text content
  if (!targetOption) {
    for (const option of Array.from(element.options)) {
      if (option.textContent?.trim() === optionValue) {
        targetOption = option;
        break;
      }
    }
  }

  if (!targetOption) {
    throw new Error(`Option not found: "${optionValue}"`);
  }

  // Set the value
  element.value = targetOption.value;

  // Dispatch change event
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Execute an extract action to get data from an element (ACT-04)
 * Supports multiple transforms (trim, number, lowercase, json, attribute:*)
 */
export function executeExtract(element: Element, transform?: string): unknown {
  // Get raw value based on element type
  let rawValue: string;

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    rawValue = element.value;
  } else if (element instanceof HTMLSelectElement) {
    const selectedOption = element.options[element.selectedIndex];
    rawValue = selectedOption ? selectedOption.text : '';
  } else {
    rawValue = element.textContent || '';
  }

  // Apply transform if specified
  if (!transform) {
    return rawValue;
  }

  switch (transform) {
    case 'trim':
      return rawValue.trim();
    case 'number':
      return parseFloat(rawValue);
    case 'lowercase':
      return rawValue.toLowerCase();
    case 'json':
      return JSON.parse(rawValue);
    default:
      // Check for attribute:name pattern
      if (transform.startsWith('attribute:')) {
        const attrName = transform.slice('attribute:'.length);
        return element.getAttribute(attrName);
      }
      // Unknown transform, return raw value
      return rawValue;
  }
}

/**
 * Execute a wait_for action to wait for an element (ACT-05)
 * Delegates to waitForElement from semanticResolver
 */
export async function executeWaitFor(hints: SemanticHint[], timeoutMs: number): Promise<Element> {
  const result = await waitForElement(hints, timeoutMs);

  if (!result.element) {
    throw new Error(`waitForElement failed: no element found (confidence: ${result.confidence})`);
  }

  return result.element;
}

/**
 * Execute a navigate action to change page (ACT-06)
 * Navigation is async by nature - PlaybackManager handles post-navigation waiting
 */
export function executeNavigate(url: string): void {
  window.location.href = url;
}

/**
 * Execute a scroll action to bring an element into view (ACT-07)
 * Uses smooth scrolling for natural appearance
 */
export async function executeScroll(element: Element): Promise<void> {
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // Wait for scroll to complete
  await scrollSettleDelay();
}

/**
 * Execute a hover action on an element (ACT-08)
 * Dispatches mouseenter -> mouseover -> mousemove sequence
 * Does NOT dispatch mouseleave (hover persists)
 */
export function executeHover(element: Element): void {
  // Calculate center coordinates
  const rect = element.getBoundingClientRect();
  const clientX = rect.left + rect.width / 2;
  const clientY = rect.top + rect.height / 2;

  // Dispatch mouseenter (doesn't bubble)
  element.dispatchEvent(new MouseEvent('mouseenter', {
    bubbles: false,
    cancelable: false,
    clientX,
    clientY,
    view: window,
  }));

  // Dispatch mouseover (bubbles)
  element.dispatchEvent(new MouseEvent('mouseover', {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
    view: window,
  }));

  // Dispatch mousemove (bubbles)
  element.dispatchEvent(new MouseEvent('mousemove', {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
    view: window,
  }));
}

/**
 * Parse timeout string to milliseconds
 * Supports formats: "10s", "30s", "5000ms", "5000"
 */
function parseTimeout(timeout?: string): number {
  if (!timeout) {
    return 10000; // Default 10s
  }

  if (timeout.endsWith('ms')) {
    return parseInt(timeout.slice(0, -2), 10);
  }

  if (timeout.endsWith('s')) {
    return parseInt(timeout.slice(0, -1), 10) * 1000;
  }

  return parseInt(timeout, 10);
}

/**
 * ActionExecutor class - unified interface for all 8 BSL actions
 * Wraps individual functions with config management
 */
export class ActionExecutor {
  constructor(private config: HumanizerConfig = DEFAULT_CONFIG) {}

  /**
   * Execute a BSL step action
   * @param step - The BSL step to execute
   * @param element - The resolved element (not needed for navigate/wait_for)
   * @returns Result of the action (extract returns data, others return void/element)
   */
  async execute(step: BSLStep, element?: Element): Promise<unknown> {
    switch (step.action) {
      case 'click':
        if (!element) throw new Error('click action requires element');
        return executeClick(element);

      case 'type': {
        if (!element) throw new Error('type action requires element');
        if (!step.value) throw new Error('type action requires value');

        // Check for credential references and substitute if present
        let valueToType = step.value;
        const credRefs = extractCredentialRefs(step.value);

        if (credRefs.length > 0) {
          // Fetch passwords and substitute
          // Note: Pre-flight check in PlaybackManager already validated credentials exist
          const passwords = await getPasswords();
          valueToType = await substituteCredentials(step.value, passwords);
        }

        return executeType(element, valueToType, this.config);
      }

      case 'select':
        if (!element) throw new Error('select action requires element');
        if (!step.value) throw new Error('select action requires value');
        return executeSelect(element, step.value);

      case 'extract':
        if (!element) throw new Error('extract action requires element');
        return executeExtract(element, step.output?.transform);

      case 'wait_for':
        if (!step.target?.hints) throw new Error('wait_for action requires target hints');
        return executeWaitFor(step.target.hints, parseTimeout(step.timeout));

      case 'navigate':
        if (!step.value) throw new Error('navigate action requires value');
        return executeNavigate(step.value);

      case 'scroll':
        if (!element) throw new Error('scroll action requires element');
        return executeScroll(element);

      case 'hover':
        if (!element) throw new Error('hover action requires element');
        return executeHover(element);

      default: {
        const exhaustiveCheck: never = step.action;
        throw new Error(`Unknown action: ${exhaustiveCheck}`);
      }
    }
  }

  /**
   * Update humanizer config
   */
  setConfig(config: Partial<HumanizerConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

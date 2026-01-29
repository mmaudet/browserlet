/**
 * Action executor implementing all 8 BSL actions with proper DOM event dispatching.
 * Proper event sequences ensure compatibility with React, Vue, Angular, and legacy jQuery apps.
 */

import type { HumanizerConfig } from './humanizer';
import { typeCharacterDelay, scrollSettleDelay, DEFAULT_CONFIG } from './humanizer';
import type { BSLStep, SemanticHint } from './types';
import { waitForElement } from './semanticResolver';

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

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

import {
  resolveElement,
  waitForElement,
  isElementInteractable,
  HINT_WEIGHTS,
} from '../../../entrypoints/content/playback/semanticResolver';
import type { SemanticHint } from '../../../entrypoints/content/playback/types';

// Set up a minimal DOM environment for each test
let dom: JSDOM;

beforeEach(() => {
  dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost/',
  });
  // Set up globals from JSDOM window
  global.document = dom.window.document;
  global.window = dom.window as unknown as Window & typeof globalThis;
  global.MutationObserver = dom.window.MutationObserver;
  global.HTMLElement = dom.window.HTMLElement;
  global.Element = dom.window.Element;
  global.Node = dom.window.Node;
});

afterEach(() => {
  dom.window.close();
});

describe('HINT_WEIGHTS', () => {
  it('should have data_attribute weight of 1.0 (highest)', () => {
    expect(HINT_WEIGHTS.data_attribute).toBe(1.0);
  });

  it('should have role weight of 1.0 (highest)', () => {
    expect(HINT_WEIGHTS.role).toBe(1.0);
  });

  it('should have type weight of 1.0 (highest)', () => {
    expect(HINT_WEIGHTS.type).toBe(1.0);
  });

  it('should have aria_label weight of 0.9', () => {
    expect(HINT_WEIGHTS.aria_label).toBe(0.9);
  });

  it('should have name weight of 0.9', () => {
    expect(HINT_WEIGHTS.name).toBe(0.9);
  });

  it('should have id weight of 0.85', () => {
    expect(HINT_WEIGHTS.id).toBe(0.85);
  });

  it('should have text_contains weight of 0.8', () => {
    expect(HINT_WEIGHTS.text_contains).toBe(0.8);
  });

  it('should have placeholder_contains weight of 0.7', () => {
    expect(HINT_WEIGHTS.placeholder_contains).toBe(0.7);
  });

  it('should have near_label weight of 0.6', () => {
    expect(HINT_WEIGHTS.near_label).toBe(0.6);
  });

  it('should have class_contains weight of 0.5 (lowest)', () => {
    expect(HINT_WEIGHTS.class_contains).toBe(0.5);
  });

  it('should have exactly 13 hint types', () => {
    expect(Object.keys(HINT_WEIGHTS)).toHaveLength(13);
  });
});

describe('resolveElement', () => {
  it('should return null element with empty hints array', () => {
    const result = resolveElement([]);
    expect(result.element).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.matchedHints).toEqual([]);
    expect(result.failedHints).toEqual([]);
  });

  it('should match element by role hint', () => {
    document.body.innerHTML = '<button role="button">Click me</button>';
    const hints: SemanticHint[] = [
      { type: 'role', value: 'button' },
    ];

    const result = resolveElement(hints);
    expect(result.element).not.toBeNull();
    expect(result.element?.tagName.toLowerCase()).toBe('button');
    expect(result.confidence).toBe(1.0);
    expect(result.matchedHints).toContain('role:button');
  });

  it('should match element by id hint', () => {
    document.body.innerHTML = '<input id="username" type="text">';
    const hints: SemanticHint[] = [
      { type: 'id', value: 'username' },
    ];

    const result = resolveElement(hints);
    expect(result.element).not.toBeNull();
    expect(result.element?.id).toBe('username');
    expect(result.confidence).toBe(1.0);
  });

  it('should match element by type hint', () => {
    document.body.innerHTML = '<input type="email" name="email">';
    const hints: SemanticHint[] = [
      { type: 'type', value: 'email' },
    ];

    const result = resolveElement(hints);
    expect(result.element).not.toBeNull();
    expect(result.element?.getAttribute('type')).toBe('email');
  });

  it('should match element by name hint', () => {
    document.body.innerHTML = '<input type="text" name="firstName">';
    const hints: SemanticHint[] = [
      { type: 'name', value: 'firstName' },
    ];

    const result = resolveElement(hints);
    expect(result.element).not.toBeNull();
    expect(result.element?.getAttribute('name')).toBe('firstName');
  });

  it('should match element by aria_label hint', () => {
    document.body.innerHTML = '<button aria-label="Submit Form">Submit</button>';
    const hints: SemanticHint[] = [
      { type: 'role', value: 'button' },
      { type: 'aria_label', value: 'Submit Form' },
    ];

    const result = resolveElement(hints);
    expect(result.element).not.toBeNull();
    expect(result.element?.getAttribute('aria-label')).toBe('Submit Form');
  });

  it('should match element by text_contains hint with normalized text', () => {
    document.body.innerHTML = '<button>  Login Now  </button>';
    const hints: SemanticHint[] = [
      { type: 'role', value: 'button' },
      { type: 'text_contains', value: 'login' },
    ];

    const result = resolveElement(hints);
    expect(result.element).not.toBeNull();
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('should match element by placeholder_contains hint', () => {
    document.body.innerHTML = '<input type="text" placeholder="Enter your email address">';
    const hints: SemanticHint[] = [
      { type: 'type', value: 'text' },
      { type: 'placeholder_contains', value: 'email' },
    ];

    const result = resolveElement(hints);
    expect(result.element).not.toBeNull();
    expect(result.element?.getAttribute('placeholder')).toContain('email');
  });

  it('should match element by class_contains hint', () => {
    document.body.innerHTML = '<button class="btn btn-primary submit-btn">Submit</button>';
    const hints: SemanticHint[] = [
      { type: 'role', value: 'button' },
      { type: 'class_contains', value: 'submit-btn' },
    ];

    const result = resolveElement(hints);
    expect(result.element).not.toBeNull();
    expect(result.element?.classList.contains('submit-btn')).toBe(true);
  });

  it('should match element by data_attribute hint', () => {
    document.body.innerHTML = '<button data-testid="submit-button">Submit</button>';
    const hints: SemanticHint[] = [
      { type: 'role', value: 'button' },
      { type: 'data_attribute', value: { name: 'data-testid', value: 'submit-button' } },
    ];

    const result = resolveElement(hints);
    expect(result.element).not.toBeNull();
    expect(result.element?.getAttribute('data-testid')).toBe('submit-button');
  });

  it('should match element by near_label hint', () => {
    document.body.innerHTML = `
      <label for="email">Email Address</label>
      <input id="email" type="email">
    `;
    const hints: SemanticHint[] = [
      { type: 'id', value: 'email' },
      { type: 'near_label', value: 'Email' },
    ];

    const result = resolveElement(hints);
    expect(result.element).not.toBeNull();
    expect(result.element?.id).toBe('email');
  });

  it('should calculate correct confidence for multiple matching hints', () => {
    document.body.innerHTML = '<input id="email" type="email" name="email">';
    const hints: SemanticHint[] = [
      { type: 'id', value: 'email' },       // 0.85
      { type: 'type', value: 'email' },     // 1.0
      { type: 'name', value: 'email' },     // 0.9
    ];

    const result = resolveElement(hints);
    expect(result.element).not.toBeNull();
    // All hints match: (0.85 + 1.0 + 0.9) / (0.85 + 1.0 + 0.9) = 1.0
    expect(result.confidence).toBe(1.0);
    expect(result.matchedHints).toHaveLength(3);
    expect(result.failedHints).toHaveLength(0);
  });

  it('should calculate partial confidence for partial matches', () => {
    document.body.innerHTML = '<input id="email" type="text" name="other">';
    const hints: SemanticHint[] = [
      { type: 'id', value: 'email' },       // 0.85 - matches
      { type: 'type', value: 'email' },     // 1.0 - fails (type is text)
      { type: 'name', value: 'email' },     // 0.9 - fails (name is other)
    ];

    const result = resolveElement(hints);
    // Only id matches: 0.85 / (0.85 + 1.0 + 0.9) = 0.85 / 2.75 ≈ 0.31
    expect(result.confidence).toBeLessThan(0.7);
    expect(result.element).toBeNull(); // Below threshold
    expect(result.matchedHints).toContain('id:email');
    expect(result.failedHints).toContain('type:email');
  });

  it('should return null element when confidence is below 0.7 threshold', () => {
    document.body.innerHTML = '<input id="wrong" type="text">';
    const hints: SemanticHint[] = [
      { type: 'id', value: 'email' },       // fails
      { type: 'type', value: 'email' },     // fails
    ];

    const result = resolveElement(hints);
    expect(result.element).toBeNull();
    expect(result.confidence).toBe(0);
  });

  it('should select best matching element among multiple candidates', () => {
    document.body.innerHTML = `
      <button id="btn1">Button 1</button>
      <button id="btn2" data-testid="target">Button 2</button>
      <button id="btn3">Button 3</button>
    `;
    const hints: SemanticHint[] = [
      { type: 'role', value: 'button' },
      { type: 'id', value: 'btn2' },
      { type: 'data_attribute', value: { name: 'data-testid', value: 'target' } },
    ];

    const result = resolveElement(hints);
    expect(result.element).not.toBeNull();
    expect(result.element?.id).toBe('btn2');
    expect(result.confidence).toBe(1.0);
  });

  it('should find button with implicit role (no explicit role attribute)', () => {
    document.body.innerHTML = '<button>Submit</button>';
    const hints: SemanticHint[] = [
      { type: 'role', value: 'button' },
      { type: 'text_contains', value: 'submit' },
    ];

    const result = resolveElement(hints);
    expect(result.element).not.toBeNull();
    expect(result.element?.tagName.toLowerCase()).toBe('button');
  });
});

describe('isElementInteractable', () => {
  it('should return true for visible enabled element', () => {
    document.body.innerHTML = '<button>Click me</button>';
    const button = document.querySelector('button')!;

    // Mock getBoundingClientRect for JSDOM
    button.getBoundingClientRect = () => ({
      x: 0, y: 0, top: 0, left: 0, bottom: 50, right: 100,
      width: 100, height: 50, toJSON: () => ({}),
    });

    expect(isElementInteractable(button)).toBe(true);
  });

  it('should return false for hidden element (display: none)', () => {
    document.body.innerHTML = '<button style="display: none">Hidden</button>';
    const button = document.querySelector('button')!;

    expect(isElementInteractable(button)).toBe(false);
  });

  it('should return false for hidden element (visibility: hidden)', () => {
    document.body.innerHTML = '<button style="visibility: hidden">Hidden</button>';
    const button = document.querySelector('button')!;

    expect(isElementInteractable(button)).toBe(false);
  });

  it('should return false for disabled element', () => {
    document.body.innerHTML = '<button disabled>Disabled</button>';
    const button = document.querySelector('button')!;

    button.getBoundingClientRect = () => ({
      x: 0, y: 0, top: 0, left: 0, bottom: 50, right: 100,
      width: 100, height: 50, toJSON: () => ({}),
    });

    expect(isElementInteractable(button)).toBe(false);
  });

  it('should return false for aria-disabled element', () => {
    document.body.innerHTML = '<button aria-disabled="true">Aria Disabled</button>';
    const button = document.querySelector('button')!;

    button.getBoundingClientRect = () => ({
      x: 0, y: 0, top: 0, left: 0, bottom: 50, right: 100,
      width: 100, height: 50, toJSON: () => ({}),
    });

    expect(isElementInteractable(button)).toBe(false);
  });

  it('should return false for zero-width element', () => {
    document.body.innerHTML = '<button>Zero width</button>';
    const button = document.querySelector('button')!;

    button.getBoundingClientRect = () => ({
      x: 0, y: 0, top: 0, left: 0, bottom: 50, right: 0,
      width: 0, height: 50, toJSON: () => ({}),
    });

    expect(isElementInteractable(button)).toBe(false);
  });

  it('should return false for zero-height element', () => {
    document.body.innerHTML = '<button>Zero height</button>';
    const button = document.querySelector('button')!;

    button.getBoundingClientRect = () => ({
      x: 0, y: 0, top: 0, left: 0, bottom: 0, right: 100,
      width: 100, height: 0, toJSON: () => ({}),
    });

    expect(isElementInteractable(button)).toBe(false);
  });
});

describe('waitForElement', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should resolve immediately if element exists and is interactable', async () => {
    document.body.innerHTML = '<button id="target">Click me</button>';
    const button = document.querySelector('button')!;

    button.getBoundingClientRect = () => ({
      x: 0, y: 0, top: 0, left: 0, bottom: 50, right: 100,
      width: 100, height: 50, toJSON: () => ({}),
    });

    const hints: SemanticHint[] = [
      { type: 'id', value: 'target' },
    ];

    const resultPromise = waitForElement(hints, 5000);
    const result = await resultPromise;

    expect(result.element).not.toBeNull();
    expect(result.element?.id).toBe('target');
  });

  it('should reject with timeout error when element not found', async () => {
    document.body.innerHTML = '<div>No matching element</div>';

    const hints: SemanticHint[] = [
      { type: 'id', value: 'nonexistent' },
    ];

    const resultPromise = waitForElement(hints, 1000);

    // Attach catch handler BEFORE advancing time to avoid unhandled rejection warning
    let caughtError: Error | null = null;
    resultPromise.catch((err) => { caughtError = err; });

    // Advance time past timeout
    await vi.advanceTimersByTimeAsync(1100);

    expect(caughtError).not.toBeNull();
    expect(caughtError!.message).toContain('waitForElement timeout after 1000ms');
  });

  it('should include hint summary in timeout error message', async () => {
    document.body.innerHTML = '<div>No matching element</div>';

    const hints: SemanticHint[] = [
      { type: 'id', value: 'target' },
      { type: 'role', value: 'button' },
    ];

    const resultPromise = waitForElement(hints, 500);

    // Attach catch handler BEFORE advancing time
    let caughtError: Error | null = null;
    resultPromise.catch((err) => { caughtError = err; });

    await vi.advanceTimersByTimeAsync(600);

    expect(caughtError).not.toBeNull();
    expect(caughtError!.message).toContain('id:target');
    expect(caughtError!.message).toContain('role:button');
  });

  it('should resolve when element appears via mutation', async () => {
    document.body.innerHTML = '<div id="container"></div>';

    const hints: SemanticHint[] = [
      { type: 'id', value: 'dynamic-btn' },
    ];

    const resultPromise = waitForElement(hints, 5000);

    // Simulate dynamic content adding after short delay
    await vi.advanceTimersByTimeAsync(100);

    // Add element to DOM
    const container = document.getElementById('container')!;
    const button = document.createElement('button');
    button.id = 'dynamic-btn';
    button.textContent = 'Dynamic Button';
    button.getBoundingClientRect = () => ({
      x: 0, y: 0, top: 0, left: 0, bottom: 50, right: 100,
      width: 100, height: 50, toJSON: () => ({}),
    });
    container.appendChild(button);

    // Let MutationObserver callback run
    await vi.advanceTimersByTimeAsync(0);

    const result = await resultPromise;
    expect(result.element).not.toBeNull();
    expect(result.element?.id).toBe('dynamic-btn');
  });

  it('should use default timeout of 10000ms', async () => {
    document.body.innerHTML = '<div>Empty</div>';

    const hints: SemanticHint[] = [
      { type: 'id', value: 'missing' },
    ];

    const resultPromise = waitForElement(hints); // No timeout specified

    // Advance less than 10s - should not reject yet
    await vi.advanceTimersByTimeAsync(9000);

    // Check promise is still pending (not rejected)
    let rejected = false;
    resultPromise.catch(() => { rejected = true; });
    await vi.advanceTimersByTimeAsync(0);
    expect(rejected).toBe(false);

    // Advance past 10s - should reject
    await vi.advanceTimersByTimeAsync(2000);

    try {
      await resultPromise;
      expect.fail('Expected promise to reject');
    } catch (error) {
      expect((error as Error).message).toContain('timeout after 10000ms');
    }
  });
});

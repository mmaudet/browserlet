/**
 * DOMHintSuggester - Scans the live page for candidate elements matching a failed step's intent
 *
 * Given the original hints and intent of a failed BSL step, finds real DOM elements
 * that are plausible matches, extracts their semantic attributes as SemanticHint arrays,
 * and returns up to 5 ranked candidate sets.
 *
 * Runs entirely in page context. No LLM calls. Bounded to max 300 candidates for <100ms.
 *
 * Phase 039 - Plan 02 (REP-02)
 */

import type { SemanticHint, HintType } from '@browserlet/core/types';
import { normalizeText } from '../../../utils/hints/text';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of candidate elements to consider */
const MAX_CANDIDATES = 300;

/** Maximum number of suggestion sets to return */
const MAX_SUGGESTIONS = 5;

/** Interactable element selector */
const INTERACTABLE_SELECTOR =
  'input, button, a, select, textarea, [role], [tabindex], label';

// ---------------------------------------------------------------------------
// Implicit role mapping (mirrors cascadeResolver matchHintSimple)
// ---------------------------------------------------------------------------

const TAG_IMPLICIT_ROLES: Record<string, string> = {
  a: 'link',
  button: 'button',
  select: 'combobox',
  textarea: 'textbox',
};

const INPUT_TYPE_ROLES: Record<string, string> = {
  text: 'textbox',
  submit: 'button',
  checkbox: 'checkbox',
  radio: 'radio',
  search: 'searchbox',
  email: 'textbox',
  tel: 'textbox',
  url: 'textbox',
  number: 'spinbutton',
  password: 'textbox',
  reset: 'button',
  button: 'button',
  range: 'slider',
};

// ---------------------------------------------------------------------------
// Stability filters for IDs and class names
// ---------------------------------------------------------------------------

/** Reject ID values that look auto-generated */
function isStableId(id: string): boolean {
  if (!id) return false;
  // UUID pattern
  if (/^[0-9a-f-]{36}$/.test(id)) return false;
  // React/Vue generated (long alphanumeric sequences)
  if (/[a-z0-9]{8,}/.test(id) && !/[A-Z_-]/.test(id)) return false;
  // Pure numbers
  if (/^\d+$/.test(id)) return false;
  return true;
}

/** Reject class names that look hashed/auto-generated */
function isStableClass(cls: string): boolean {
  if (!cls) return false;
  // Long alphanumeric hash
  if (/^[a-z0-9]{8,}$/.test(cls)) return false;
  // Ends with numeric suffix (e.g. "component-12345")
  if (/-\d+$/.test(cls)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Element role extraction
// ---------------------------------------------------------------------------

/** Get the effective role of an element (explicit aria-role or implicit from tag) */
function getElementRole(element: Element): string | null {
  const explicitRole = element.getAttribute('role');
  if (explicitRole) return explicitRole;

  const tag = element.tagName.toLowerCase();

  if (tag === 'input') {
    const inputType = (element as HTMLInputElement).type || 'text';
    return INPUT_TYPE_ROLES[inputType] || null;
  }

  return TAG_IMPLICIT_ROLES[tag] || null;
}

// ---------------------------------------------------------------------------
// Hint matching (reuses logic from cascadeResolver matchHintSimple)
// ---------------------------------------------------------------------------

/** Check if an element matches a single semantic hint */
function matchHint(element: Element, hint: SemanticHint): boolean {
  if (typeof hint.value === 'string') {
    const value = hint.value;
    switch (hint.type) {
      case 'role': {
        return getElementRole(element) === value;
      }
      case 'id':
        return element.id === value;
      case 'type':
        return element.getAttribute('type') === value;
      case 'name':
        return element.getAttribute('name') === value;
      case 'aria_label':
        return element.getAttribute('aria-label') === value;
      case 'text_contains': {
        const text = normalizeText(element.textContent);
        return text.includes(normalizeText(value));
      }
      case 'placeholder_contains': {
        const placeholder = element.getAttribute('placeholder') || '';
        return normalizeText(placeholder).includes(normalizeText(value));
      }
      case 'class_contains':
        return element.classList.contains(value);
      default:
        return false;
    }
  } else if (hint.type === 'data_attribute') {
    const { name, value: attrValue } = hint.value as { name: string; value: string };
    return element.getAttribute(name) === attrValue;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Hint extraction from element
// ---------------------------------------------------------------------------

/** Extract all available semantic attributes from an element as a hint set */
function extractHintSet(element: Element): SemanticHint[] {
  const hints: SemanticHint[] = [];

  // Role (explicit aria-role or implicit from tag)
  const role = getElementRole(element);
  if (role) {
    hints.push({ type: 'role', value: role });
  }

  // Type (for inputs)
  const typeAttr = element.getAttribute('type');
  if (typeAttr) {
    hints.push({ type: 'type', value: typeAttr });
  }

  // Name (form name attribute)
  const nameAttr = element.getAttribute('name');
  if (nameAttr) {
    hints.push({ type: 'name', value: nameAttr });
  }

  // ID (only if stable-looking)
  if (element.id && isStableId(element.id)) {
    hints.push({ type: 'id', value: element.id });
  }

  // Aria-label
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) {
    hints.push({ type: 'aria_label', value: ariaLabel });
  }

  // Text content (first 60 chars, trimmed)
  const textContent = normalizeText(element.textContent);
  if (textContent && textContent.length > 0) {
    const trimmedText = textContent.slice(0, 60).trim();
    if (trimmedText) {
      hints.push({ type: 'text_contains', value: trimmedText });
    }
  }

  // Placeholder
  const placeholder = element.getAttribute('placeholder');
  if (placeholder) {
    hints.push({ type: 'placeholder_contains', value: placeholder });
  }

  // Class (first stable-looking class)
  for (const cls of element.classList) {
    if (isStableClass(cls)) {
      hints.push({ type: 'class_contains', value: cls });
      break; // Only first stable class
    }
  }

  return hints;
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Scan the live page for candidate elements matching the failed step's original hints,
 * score them, and return up to 5 ranked candidate hint sets.
 *
 * @param originalHints - The hints from the failed BSL step
 * @param intent - Optional step intent string for bonus scoring
 * @returns Array of hint arrays (one per top candidate), best-matching first
 */
export async function suggestHintsFromDOM(
  originalHints: SemanticHint[],
  intent?: string,
): Promise<SemanticHint[][]> {
  if (originalHints.length === 0) return [];

  // Step 1: Gather candidates (max 300 visible interactable elements)
  const allElements = document.querySelectorAll(INTERACTABLE_SELECTOR);
  const candidates: Element[] = [];

  for (const el of allElements) {
    if (candidates.length >= MAX_CANDIDATES) break;
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      candidates.push(el);
    }
  }

  if (candidates.length === 0) return [];

  // Step 2: Score each candidate against originalHints
  const scored: Array<{ element: Element; score: number }> = [];
  const normalizedIntent = intent ? normalizeText(intent) : null;

  for (const el of candidates) {
    let matchedCount = 0;

    for (const hint of originalHints) {
      if (matchHint(el, hint)) {
        matchedCount++;
      }
    }

    let score = matchedCount / originalHints.length;

    // Bonus for intent match
    if (normalizedIntent && score > 0) {
      const elText = normalizeText(el.textContent);
      if (elText.includes(normalizedIntent)) {
        score += 0.1;
      }
    }

    if (score > 0) {
      scored.push({ element: el, score });
    }
  }

  if (scored.length === 0) return [];

  // Step 3: Select top 5 by score
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, MAX_SUGGESTIONS);

  // Step 4: Extract hint sets from each top candidate
  const results: SemanticHint[][] = [];

  for (const { element } of top) {
    const hintSet = extractHintSet(element);
    if (hintSet.length >= 1) {
      results.push(hintSet);
    }
  }

  return results;
}

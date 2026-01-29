/**
 * Semantic resolver for finding DOM elements using multi-hint weighted scoring
 * Core of resilient automation - survives DOM restructuring unlike CSS/XPath
 */

import type { SemanticHint, HintType } from '../recording/types';
import type { ResolverResult } from './types';
import { getElementRole, isElementVisible, findAssociatedLabel } from '../../../utils/hints/dom';
import { normalizeText } from '../../../utils/hints/text';

/**
 * Hint weights for scoring element matches
 * Higher weight = more reliable for identification
 */
export const HINT_WEIGHTS: Record<HintType, number> = {
  data_attribute: 1.0,  // Most reliable - stable across deployments
  role: 1.0,            // ARIA role - semantic and stable
  type: 1.0,            // Input type - fundamental to element
  aria_label: 0.9,      // Accessibility label - usually stable
  name: 0.9,            // Form name attribute - stable
  id: 0.85,             // Filtered for auto-generated in recording
  text_contains: 0.8,   // Text content - may change with i18n
  placeholder_contains: 0.7, // Placeholder text - may change
  near_label: 0.6,      // Less reliable in tables/complex layouts
  class_contains: 0.5,  // Often minified/generated
};

/**
 * Get initial candidate elements based on first reliable hint
 * Optimizes by narrowing search space before full scoring
 */
function getInitialCandidates(hints: SemanticHint[]): Element[] {
  // Priority order for initial filtering
  const priorityHints: HintType[] = ['role', 'type', 'name', 'id'];

  for (const priorityType of priorityHints) {
    const hint = hints.find(h => h.type === priorityType);
    if (hint && typeof hint.value === 'string') {
      let elements: NodeListOf<Element> | Element[];

      switch (priorityType) {
        case 'role': {
          // Try explicit role first
          elements = document.querySelectorAll(`[role="${hint.value}"]`);
          if (elements.length === 0) {
            // Fallback: get elements with implicit role
            elements = getElementsByImplicitRole(hint.value);
          }
          break;
        }
        case 'type':
          elements = document.querySelectorAll(`[type="${hint.value}"]`);
          break;
        case 'id':
          const el = document.getElementById(hint.value);
          elements = el ? [el] : [];
          break;
        case 'name':
          elements = document.querySelectorAll(`[name="${hint.value}"]`);
          break;
        default:
          elements = [];
      }

      if (elements.length > 0) {
        return Array.from(elements);
      }
    }
  }

  // Fallback: get all interactive elements
  return Array.from(document.querySelectorAll(
    'a, button, input, select, textarea, [role="button"], [role="link"], ' +
    '[role="textbox"], [role="checkbox"], [role="radio"], [tabindex]'
  ));
}

/**
 * Get elements with a specific implicit ARIA role
 */
function getElementsByImplicitRole(role: string): Element[] {
  const roleToTags: Record<string, string[]> = {
    'button': ['button', 'input[type="button"]', 'input[type="submit"]', 'input[type="reset"]'],
    'link': ['a[href]'],
    'textbox': ['input:not([type])', 'input[type="text"]', 'input[type="email"]', 'input[type="tel"]', 'input[type="url"]', 'input[type="search"]', 'textarea'],
    'checkbox': ['input[type="checkbox"]'],
    'radio': ['input[type="radio"]'],
    'combobox': ['select'],
    'listbox': ['select[multiple]'],
    'searchbox': ['input[type="search"]'],
    'spinbutton': ['input[type="number"]'],
    'slider': ['input[type="range"]'],
    'navigation': ['nav'],
    'main': ['main'],
    'banner': ['header'],
    'contentinfo': ['footer'],
    'form': ['form'],
    'list': ['ul', 'ol'],
    'listitem': ['li'],
    'table': ['table'],
    'img': ['img'],
    'article': ['article'],
    'complementary': ['aside'],
  };

  const selectors = roleToTags[role];
  if (!selectors) return [];

  const elements: Element[] = [];
  for (const selector of selectors) {
    elements.push(...Array.from(document.querySelectorAll(selector)));
  }
  return elements;
}

/**
 * Check if an element matches a specific hint
 */
function matchHint(element: Element, hint: SemanticHint): boolean {
  switch (hint.type) {
    case 'role': {
      if (typeof hint.value !== 'string') return false;
      const elementRole = getElementRole(element);
      return elementRole === hint.value;
    }

    case 'id': {
      if (typeof hint.value !== 'string') return false;
      return element.id === hint.value;
    }

    case 'text_contains': {
      if (typeof hint.value !== 'string') return false;
      const textContent = element.textContent || '';
      return normalizeText(textContent).includes(normalizeText(hint.value));
    }

    case 'type': {
      if (typeof hint.value !== 'string') return false;
      return element.getAttribute('type') === hint.value;
    }

    case 'name': {
      if (typeof hint.value !== 'string') return false;
      return element.getAttribute('name') === hint.value;
    }

    case 'aria_label': {
      if (typeof hint.value !== 'string') return false;
      return element.getAttribute('aria-label') === hint.value;
    }

    case 'placeholder_contains': {
      if (typeof hint.value !== 'string') return false;
      const placeholder = element.getAttribute('placeholder') || '';
      return normalizeText(placeholder).includes(normalizeText(hint.value));
    }

    case 'near_label': {
      if (typeof hint.value !== 'string') return false;
      const label = findAssociatedLabel(element);
      if (!label) return false;
      const labelText = label.textContent || '';
      return normalizeText(labelText).includes(normalizeText(hint.value));
    }

    case 'class_contains': {
      if (typeof hint.value !== 'string') return false;
      return element.classList.contains(hint.value);
    }

    case 'data_attribute': {
      if (typeof hint.value === 'string') return false;
      const { name, value } = hint.value;
      return element.getAttribute(name) === value;
    }

    default:
      return false;
  }
}

/**
 * Resolve an element from semantic hints using weighted scoring
 * Returns the best match if confidence >= 0.7 threshold
 */
export function resolveElement(hints: SemanticHint[]): ResolverResult {
  if (hints.length === 0) {
    return {
      element: null,
      confidence: 0,
      matchedHints: [],
      failedHints: [],
    };
  }

  const candidates = getInitialCandidates(hints);

  // Calculate max possible score
  const maxPossibleScore = hints.reduce((sum, hint) => sum + HINT_WEIGHTS[hint.type], 0);

  let bestMatch: Element | null = null;
  let bestScore = 0;
  let bestMatchedHints: string[] = [];
  let bestFailedHints: string[] = [];

  for (const candidate of candidates) {
    let score = 0;
    const matchedHints: string[] = [];
    const failedHints: string[] = [];

    for (const hint of hints) {
      const hintDescription = typeof hint.value === 'string'
        ? `${hint.type}:${hint.value}`
        : `${hint.type}:${hint.value.name}=${hint.value.value}`;

      if (matchHint(candidate, hint)) {
        score += HINT_WEIGHTS[hint.type];
        matchedHints.push(hintDescription);
      } else {
        failedHints.push(hintDescription);
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = candidate;
      bestMatchedHints = matchedHints;
      bestFailedHints = failedHints;
    }
  }

  // Normalize score to 0-1 range
  const confidence = maxPossibleScore > 0 ? bestScore / maxPossibleScore : 0;

  // Apply confidence threshold
  const CONFIDENCE_THRESHOLD = 0.7;

  if (confidence >= CONFIDENCE_THRESHOLD && bestMatch) {
    return {
      element: bestMatch,
      confidence,
      matchedHints: bestMatchedHints,
      failedHints: bestFailedHints,
    };
  }

  // No match above threshold
  return {
    element: null,
    confidence,
    matchedHints: bestMatchedHints,
    failedHints: bestFailedHints,
  };
}

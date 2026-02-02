/**
 * Healing detection for self-healing selectors
 * Identifies when element resolution fails and extracts DOM context for LLM repair
 * Covers requirements: HEAL-01, HEAL-02, HEAL-07
 */

import type { SemanticHint, HintType } from '../recording/types';
import type { ResolverResult, HealingContext } from './types';
import { normalizeText } from '../../../utils/hints/text';

// Constants for healing thresholds
export const HEALING_CONFIDENCE_THRESHOLD = 0.7;    // Trigger healing below this
export const AUTO_SUGGEST_CONFIDENCE_THRESHOLD = 0.85; // High confidence badge above this
export const MAX_HEALING_ATTEMPTS = 3;              // Maximum retries per step

// Track healing attempts per step (step index -> attempt count)
const healingAttempts = new Map<number, number>();

/**
 * Detect if healing is needed based on resolution confidence
 * @param result - Result from semantic resolver
 * @param threshold - Confidence threshold (default: 0.7)
 * @returns true if healing should be triggered
 */
export function detectHealingNeeded(
  result: ResolverResult,
  threshold: number = HEALING_CONFIDENCE_THRESHOLD
): boolean {
  // No element found or confidence below threshold
  return result.element === null || result.confidence < threshold;
}

/**
 * Get current healing attempt count for a step
 * @param stepIndex - Step index (0-based)
 * @returns Number of attempts made
 */
export function getHealingAttempts(stepIndex: number): number {
  return healingAttempts.get(stepIndex) || 0;
}

/**
 * Increment healing attempt count for a step
 * @param stepIndex - Step index (0-based)
 * @returns New attempt count
 */
export function incrementHealingAttempts(stepIndex: number): number {
  const current = healingAttempts.get(stepIndex) || 0;
  const newCount = current + 1;
  healingAttempts.set(stepIndex, newCount);
  return newCount;
}

/**
 * Check if max healing attempts reached
 * @param stepIndex - Step index (0-based)
 * @returns true if max attempts reached
 */
export function maxHealingAttemptsReached(stepIndex: number): boolean {
  return getHealingAttempts(stepIndex) >= MAX_HEALING_ATTEMPTS;
}

/**
 * Reset healing attempts for a step (call on successful resolution or script start)
 * @param stepIndex - Step index (0-based), or undefined to reset all
 */
export function resetHealingAttempts(stepIndex?: number): void {
  if (stepIndex !== undefined) {
    healingAttempts.delete(stepIndex);
  } else {
    healingAttempts.clear();
  }
}

/**
 * Serialize an element to a compact string representation
 * Includes tag, id, class, aria-*, role, and truncated text content
 */
function serializeElement(element: Element, depth: number = 0, maxDepth: number = 2): string {
  if (depth > maxDepth) return '';

  const tag = element.tagName.toLowerCase();
  const id = element.id ? ` id="${element.id}"` : '';
  const classes = element.className && typeof element.className === 'string'
    ? ` class="${element.className.split(' ').slice(0, 3).join(' ')}"`
    : '';
  const role = element.getAttribute('role') ? ` role="${element.getAttribute('role')}"` : '';
  const ariaLabel = element.getAttribute('aria-label')
    ? ` aria-label="${element.getAttribute('aria-label')}"`
    : '';
  const type = element.getAttribute('type') ? ` type="${element.getAttribute('type')}"` : '';
  const name = element.getAttribute('name') ? ` name="${element.getAttribute('name')}"` : '';
  const placeholder = element.getAttribute('placeholder')
    ? ` placeholder="${element.getAttribute('placeholder')?.substring(0, 30)}"`
    : '';

  // Get direct text content (not from children)
  let textContent = '';
  for (const child of element.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent?.trim();
      if (text) {
        textContent += text + ' ';
      }
    }
  }
  textContent = textContent.trim().substring(0, 50);
  const textAttr = textContent ? ` text="${textContent}"` : '';

  // Build opening tag
  const attrs = `${id}${classes}${role}${ariaLabel}${type}${name}${placeholder}${textAttr}`;
  const indent = '  '.repeat(depth);

  // Self-closing for elements without children at max depth
  if (depth === maxDepth || element.children.length === 0) {
    return `${indent}<${tag}${attrs} />\n`;
  }

  // Serialize children
  let childContent = '';
  for (const child of Array.from(element.children).slice(0, 10)) { // Limit children
    childContent += serializeElement(child, depth + 1, maxDepth);
  }

  return `${indent}<${tag}${attrs}>\n${childContent}${indent}</${tag}>\n`;
}

/**
 * Find elements that partially match the hints
 * Used to locate the approximate DOM region for context extraction
 */
function findPartialMatches(hints: SemanticHint[]): Element[] {
  const candidates: Element[] = [];

  for (const hint of hints) {
    let elements: Element[] = [];

    switch (hint.type) {
      case 'role': {
        if (typeof hint.value === 'string') {
          // Try explicit role
          elements = Array.from(document.querySelectorAll(`[role="${hint.value}"]`));
          // Also try implicit roles
          const implicitMap: Record<string, string> = {
            'button': 'button',
            'textbox': 'input:not([type]), input[type="text"], input[type="email"], textarea',
            'checkbox': 'input[type="checkbox"]',
            'link': 'a[href]',
          };
          if (implicitMap[hint.value]) {
            elements.push(...Array.from(document.querySelectorAll(implicitMap[hint.value])));
          }
        }
        break;
      }
      case 'type': {
        if (typeof hint.value === 'string') {
          elements = Array.from(document.querySelectorAll(`[type="${hint.value}"]`));
        }
        break;
      }
      case 'id': {
        if (typeof hint.value === 'string') {
          const el = document.getElementById(hint.value);
          if (el) elements = [el];
        }
        break;
      }
      case 'name': {
        if (typeof hint.value === 'string') {
          elements = Array.from(document.querySelectorAll(`[name="${hint.value}"]`));
        }
        break;
      }
      case 'text_contains': {
        if (typeof hint.value === 'string') {
          const searchText = normalizeText(hint.value);
          // Search in interactive elements and text containers
          const allElements = document.querySelectorAll(
            'button, a, input, label, span, div, p, h1, h2, h3, td, th'
          );
          for (const el of allElements) {
            if (normalizeText(el.textContent || '').includes(searchText)) {
              elements.push(el);
            }
          }
        }
        break;
      }
      case 'near_label': {
        if (typeof hint.value === 'string') {
          const searchText = normalizeText(hint.value);
          const labels = document.querySelectorAll('label');
          for (const label of labels) {
            if (normalizeText(label.textContent || '').includes(searchText)) {
              // Get associated input
              const forId = label.getAttribute('for');
              if (forId) {
                const associated = document.getElementById(forId);
                if (associated) elements.push(associated);
              }
              // Also check nested inputs
              const nested = label.querySelector('input, select, textarea');
              if (nested) elements.push(nested);
            }
          }
        }
        break;
      }
      case 'class_contains': {
        if (typeof hint.value === 'string') {
          elements = Array.from(document.querySelectorAll(`.${hint.value}`));
        }
        break;
      }
      case 'aria_label': {
        if (typeof hint.value === 'string') {
          elements = Array.from(document.querySelectorAll(`[aria-label="${hint.value}"]`));
        }
        break;
      }
      case 'placeholder_contains': {
        if (typeof hint.value === 'string') {
          elements = Array.from(document.querySelectorAll('[placeholder]'));
          elements = elements.filter(el =>
            normalizeText(el.getAttribute('placeholder') || '').includes(normalizeText(hint.value as string))
          );
        }
        break;
      }
      case 'data_attribute': {
        if (typeof hint.value === 'object' && hint.value.name) {
          elements = Array.from(document.querySelectorAll(`[${hint.value.name}="${hint.value.value}"]`));
        }
        break;
      }
    }

    candidates.push(...elements);
  }

  // Deduplicate
  return [...new Set(candidates)];
}

/**
 * Extract DOM context around the expected element location
 * Returns a compact DOM excerpt limited to ~2000 characters
 * @param hints - Semantic hints for the target element
 * @returns DOM excerpt string
 */
export function extractDOMContext(hints: SemanticHint[]): string {
  const MAX_LENGTH = 2000;

  // Find partial matches to locate the region
  const partialMatches = findPartialMatches(hints);

  if (partialMatches.length === 0) {
    // No matches - return body summary
    const bodyChildren = Array.from(document.body.children).slice(0, 5);
    let excerpt = '<!-- No partial matches found. Body structure: -->\n';
    for (const child of bodyChildren) {
      excerpt += serializeElement(child, 0, 1);
      if (excerpt.length > MAX_LENGTH) break;
    }
    return excerpt.substring(0, MAX_LENGTH);
  }

  // Extract context from each partial match's parent
  let excerpt = '';
  const processedParents = new Set<Element>();

  for (const match of partialMatches.slice(0, 5)) { // Limit to 5 matches
    // Get parent element (or grandparent for more context)
    const parent = match.parentElement?.parentElement || match.parentElement || match;

    if (processedParents.has(parent)) continue;
    processedParents.add(parent);

    excerpt += `<!-- Context around: ${match.tagName.toLowerCase()} -->\n`;
    excerpt += serializeElement(parent, 0, 2);
    excerpt += '\n';

    if (excerpt.length > MAX_LENGTH) break;
  }

  return excerpt.substring(0, MAX_LENGTH);
}

/**
 * Get page context (URL, title, simplified structure)
 * @returns Page context object
 */
export function getPageContext(): { url: string; title: string; structure: string } {
  // Get main structural elements
  const landmarks = document.querySelectorAll(
    'header, nav, main, aside, footer, [role="banner"], [role="navigation"], [role="main"], [role="complementary"], [role="contentinfo"]'
  );

  let structure = '';
  for (const landmark of Array.from(landmarks).slice(0, 10)) {
    const tag = landmark.tagName.toLowerCase();
    const role = landmark.getAttribute('role') || '';
    const id = landmark.id ? `#${landmark.id}` : '';
    structure += `<${tag}${role ? ` role="${role}"` : ''}${id}> `;
  }

  return {
    url: window.location.href,
    title: document.title,
    structure: structure.trim() || '<body>',
  };
}

/**
 * Build complete healing context for a failed resolution
 * @param stepIndex - Step index in the script
 * @param hints - Original hints that failed
 * @param result - Resolver result with confidence and match info
 * @returns Complete HealingContext
 */
export function buildHealingContext(
  stepIndex: number,
  hints: SemanticHint[],
  result: ResolverResult
): HealingContext {
  const pageContext = getPageContext();

  return {
    stepIndex,
    originalHints: hints,
    confidence: result.confidence,
    matchedHints: result.matchedHints,
    failedHints: result.failedHints,
    pageUrl: pageContext.url,
    pageTitle: pageContext.title,
    domExcerpt: extractDOMContext(hints),
  };
}

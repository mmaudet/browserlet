/**
 * DOM utilities for hint extraction
 * Ported from POC semantic-resolver
 */

// Implicit ARIA roles by tag
const IMPLICIT_ROLES: Record<string, string> = {
  'a': 'link',
  'button': 'button',
  'input': 'textbox', // Simplified, depends on type
  'select': 'combobox',
  'textarea': 'textbox',
  'img': 'img',
  'table': 'table',
  'td': 'cell',
  'th': 'cell',  // Also columnheader/rowheader depending on context
  'tr': 'row',
  'nav': 'navigation',
  'main': 'main',
  'header': 'banner',
  'footer': 'contentinfo',
  'article': 'article',
  'aside': 'complementary',
  'form': 'form',
  'ul': 'list',
  'ol': 'list',
  'li': 'listitem',
  // Headings
  'h1': 'heading',
  'h2': 'heading',
  'h3': 'heading',
  'h4': 'heading',
  'h5': 'heading',
  'h6': 'heading',
  // Text elements
  'p': 'paragraph',
};

// Implicit roles for input by type
// Note: password has no ARIA role (security), so it maps to empty string
const INPUT_TYPE_ROLES: Record<string, string> = {
  'button': 'button',
  'submit': 'button',
  'reset': 'button',
  'checkbox': 'checkbox',
  'radio': 'radio',
  'range': 'slider',
  'search': 'searchbox',
  'email': 'textbox',
  'tel': 'textbox',
  'url': 'textbox',
  'number': 'spinbutton',
  'password': '', // No ARIA role for password fields (security)
};

/**
 * Get the ARIA role of an element (explicit or implicit)
 */
export function getElementRole(element: Element): string | null {
  // Explicit role
  const explicitRole = element.getAttribute('role');
  if (explicitRole) return explicitRole;

  const tagName = element.tagName.toLowerCase();

  // Special case for input
  if (tagName === 'input') {
    const type = (element as HTMLInputElement).type || 'text';
    const role = INPUT_TYPE_ROLES[type];
    // Return null for password (empty string) or undefined types default to textbox
    if (role === '') return null;
    return role ?? 'textbox';
  }

  // Implicit role by tag
  return IMPLICIT_ROLES[tagName] || null;
}

/**
 * Check if an element is visible
 */
export function isElementVisible(element: Element): boolean {
  if (!(element instanceof HTMLElement)) return true;

  const style = window.getComputedStyle(element);

  // Basic checks
  if (style.display === 'none') return false;
  if (style.visibility === 'hidden') return false;
  if (style.opacity === '0') return false;

  // Check dimensions
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;

  return true;
}

/**
 * Find the associated label for an element
 * Handles: label[for], parent label, <th> siblings in tables, preceding text
 */
export function findAssociatedLabel(element: Element): Element | null {
  // Method 1: label[for="id"]
  const id = element.getAttribute('id');
  if (id) {
    const label = document.querySelector(`label[for="${id}"]`);
    if (label) return label;
  }

  // Method 2: parent label
  const parentLabel = element.closest('label');
  if (parentLabel) return parentLabel;

  // Method 3: For table cells (td), look for th sibling in same row
  if (element.tagName === 'TD') {
    const row = element.closest('tr');
    if (row) {
      const th = row.querySelector('th');
      if (th) return th;
    }
  }

  // Method 4: Previous sibling that looks like a label
  const prevSibling = element.previousElementSibling;
  if (prevSibling) {
    const tagName = prevSibling.tagName;
    // Common label-like elements
    if (tagName === 'LABEL' || tagName === 'TH' || tagName === 'DT' ||
        tagName === 'STRONG' || tagName === 'B' ||
        prevSibling.classList.contains('label')) {
      return prevSibling;
    }
  }

  // Method 5: Check parent for label-like siblings before the element
  const parent = element.parentElement;
  if (parent) {
    const children = Array.from(parent.children);
    const elementIndex = children.indexOf(element);
    for (let i = elementIndex - 1; i >= 0; i--) {
      const sibling = children[i];
      if (sibling.tagName === 'LABEL' || sibling.classList.contains('label')) {
        return sibling;
      }
    }
  }

  return null;
}

/**
 * Get nearby text from element (labels, siblings, parents)
 */
export function getNearbyText(element: Element, maxLevels = 3): string[] {
  const texts: string[] = [];

  // Associated label
  const label = findAssociatedLabel(element);
  if (label) {
    texts.push(label.textContent || '');
  }

  // Direct siblings
  const siblings = element.parentElement?.children || [];
  for (const sibling of siblings) {
    if (sibling !== element && sibling.textContent) {
      texts.push(sibling.textContent);
    }
  }

  // Parents (up to maxLevels)
  let parent = element.parentElement;
  let level = 0;
  while (parent && level < maxLevels) {
    // Direct text from parent (not from children)
    for (const node of parent.childNodes) {
      if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
        texts.push(node.textContent);
      }
    }
    parent = parent.parentElement;
    level++;
  }

  return texts.filter(t => t.trim().length > 0);
}

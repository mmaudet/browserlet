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
};

// Implicit roles for input by type
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
    return INPUT_TYPE_ROLES[type] || 'textbox';
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
 * Find the associated label for a form element
 */
export function findAssociatedLabel(element: Element): HTMLLabelElement | null {
  // Method 1: label[for="id"]
  const id = element.getAttribute('id');
  if (id) {
    const label = document.querySelector(`label[for="${id}"]`);
    if (label) return label as HTMLLabelElement;
  }

  // Method 2: parent label
  const parentLabel = element.closest('label');
  if (parentLabel) return parentLabel as HTMLLabelElement;

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

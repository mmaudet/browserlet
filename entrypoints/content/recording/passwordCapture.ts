/**
 * Password field detection and value capture during recording.
 * Uses MutationObserver for SPA support (dynamically added login forms).
 *
 * Note: EventCapture masks password values with [MASKED] for security.
 * This class captures actual values separately for the end-of-recording save prompt.
 */

export interface CapturedPassword {
  url: string;
  username: string;
  password: string;
  fieldSelector: string;  // CSS selector hint for the field
}

export type PasswordCallback = (captured: CapturedPassword) => void;

/**
 * Detects password fields during recording and captures their values.
 * Supports SPAs that add login forms dynamically via MutationObserver.
 */
export class PasswordCapture {
  private observer: MutationObserver | null = null;
  private detectedFields: Set<HTMLInputElement> = new Set();
  private passwordValues: Map<HTMLInputElement, string> = new Map();
  private callback: PasswordCallback | null = null;
  private inputListeners: Map<HTMLInputElement, () => void> = new Map();

  /**
   * Start capturing password fields.
   * Scans existing DOM and watches for dynamically added fields.
   */
  start(callback: PasswordCallback): void {
    this.callback = callback;

    // Scan existing DOM for password fields
    this.scanForPasswordFields(document.body);

    // Watch for dynamically added fields (SPA support)
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              this.scanForPasswordFields(node as Element);
            }
          });
        }
      }
    });

    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  /**
   * Stop capturing and return all captured passwords.
   */
  stop(): CapturedPassword[] {
    // Disconnect observer
    this.observer?.disconnect();
    this.observer = null;

    // Remove input listeners
    this.inputListeners.forEach((listener, field) => {
      field.removeEventListener('input', listener);
    });
    this.inputListeners.clear();

    // Build captured passwords array from fields that have values
    const captured: CapturedPassword[] = [];
    this.detectedFields.forEach((field) => {
      const password = this.passwordValues.get(field) || field.value;
      if (password) {
        captured.push({
          url: window.location.href,
          username: this.findAssociatedUsername(field),
          password,
          fieldSelector: this.generateSelector(field)
        });
      }
    });

    // Clear state
    this.detectedFields.clear();
    this.passwordValues.clear();
    this.callback = null;

    return captured;
  }

  /**
   * Scan an element subtree for password fields.
   */
  private scanForPasswordFields(root: Element): void {
    // Check if root itself is a password field
    if (root instanceof HTMLInputElement && root.type === 'password') {
      this.trackPasswordField(root);
    }

    // Query for password fields in subtree
    const fields = root.querySelectorAll('input[type="password"]');
    fields.forEach(field => {
      this.trackPasswordField(field as HTMLInputElement);
    });
  }

  /**
   * Track a password field for value capture.
   */
  private trackPasswordField(field: HTMLInputElement): void {
    if (this.detectedFields.has(field)) return;

    this.detectedFields.add(field);

    // Track value changes
    const inputHandler = () => {
      this.passwordValues.set(field, field.value);
    };

    field.addEventListener('input', inputHandler);
    this.inputListeners.set(field, inputHandler);

    // Capture current value if already filled
    if (field.value) {
      this.passwordValues.set(field, field.value);
    }
  }

  /**
   * Find the username field associated with a password field.
   * Looks for nearby email/text inputs in the same form or as siblings.
   */
  private findAssociatedUsername(passwordField: HTMLInputElement): string {
    // First, try to find within the same form
    const form = passwordField.closest('form');
    if (form) {
      const usernameField = this.findUsernameFieldIn(form);
      if (usernameField) return usernameField.value;
    }

    // Otherwise, look for sibling inputs before the password field
    let sibling = passwordField.previousElementSibling;
    while (sibling) {
      if (sibling instanceof HTMLInputElement && this.isUsernameField(sibling)) {
        return sibling.value;
      }
      // Check children if it's a wrapper element
      const inputs = sibling.querySelectorAll('input');
      for (const input of Array.from(inputs)) {
        if (this.isUsernameField(input as HTMLInputElement)) {
          return (input as HTMLInputElement).value;
        }
      }
      sibling = sibling.previousElementSibling;
    }

    // Check parent's siblings
    const parent = passwordField.parentElement;
    if (parent) {
      let parentSibling = parent.previousElementSibling;
      while (parentSibling) {
        if (parentSibling instanceof HTMLInputElement && this.isUsernameField(parentSibling)) {
          return parentSibling.value;
        }
        const inputs = parentSibling.querySelectorAll('input');
        for (const input of Array.from(inputs)) {
          if (this.isUsernameField(input as HTMLInputElement)) {
            return (input as HTMLInputElement).value;
          }
        }
        parentSibling = parentSibling.previousElementSibling;
      }
    }

    return '';
  }

  /**
   * Find a username field within an element.
   */
  private findUsernameFieldIn(container: Element): HTMLInputElement | null {
    // Priority: email > text with username-like name > first text input
    const emailField = container.querySelector('input[type="email"]') as HTMLInputElement | null;
    if (emailField) return emailField;

    // Look for inputs with username-related names
    const usernamePatterns = ['user', 'email', 'login', 'account', 'id'];
    const textInputs = container.querySelectorAll('input[type="text"], input:not([type])');

    for (const input of Array.from(textInputs)) {
      const el = input as HTMLInputElement;
      const name = (el.name || '').toLowerCase();
      const id = (el.id || '').toLowerCase();
      const autocomplete = (el.autocomplete || '').toLowerCase();

      if (usernamePatterns.some(p => name.includes(p) || id.includes(p) || autocomplete.includes(p))) {
        return el;
      }
    }

    // Fallback: first text input that's not hidden
    for (const input of Array.from(textInputs)) {
      const el = input as HTMLInputElement;
      if (el.type !== 'hidden' && el.offsetParent !== null) {
        return el;
      }
    }

    return null;
  }

  /**
   * Check if an input field is likely a username/email field.
   */
  private isUsernameField(input: HTMLInputElement): boolean {
    const type = input.type.toLowerCase();
    if (type === 'email') return true;
    if (type !== 'text' && type !== '') return false;
    // Check for hidden or not visible
    if (input.offsetParent === null) return false;

    const name = (input.name || '').toLowerCase();
    const id = (input.id || '').toLowerCase();
    const autocomplete = (input.autocomplete || '').toLowerCase();

    const usernamePatterns = ['user', 'email', 'login', 'account', 'id', 'name'];
    return usernamePatterns.some(p =>
      name.includes(p) || id.includes(p) || autocomplete.includes(p)
    );
  }

  /**
   * Generate a CSS selector hint for a field.
   */
  private generateSelector(field: HTMLInputElement): string {
    // Prefer id if available
    if (field.id) {
      return `#${CSS.escape(field.id)}`;
    }

    // Try name attribute
    if (field.name) {
      return `input[name="${CSS.escape(field.name)}"]`;
    }

    // Fallback to structural path
    const path: string[] = [];
    let current: Element | null = field;

    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();

      if (current.id) {
        selector = `#${CSS.escape(current.id)}`;
        path.unshift(selector);
        break;
      }

      // Add nth-child for uniqueness
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          el => el.tagName === current!.tagName
        );
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-of-type(${index})`;
        }
      }

      path.unshift(selector);
      current = current.parentElement;
    }

    return path.join(' > ');
  }
}

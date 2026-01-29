/**
 * Style constants for recording visual feedback.
 * Using CSS-in-JS strings to avoid external CSS file requirements.
 */

// Maximum safe z-index value
export const MAX_Z_INDEX = 2147483647;

// Highlight overlay styles
export const OVERLAY_STYLES = {
  base: `
    position: absolute;
    pointer-events: none;
    box-sizing: border-box;
    z-index: ${MAX_Z_INDEX};
    transition: all 0.1s ease-out;
  `,
  // Hover state - subtle highlight
  hover: `
    border: 2px solid rgba(66, 133, 244, 0.8);
    background-color: rgba(66, 133, 244, 0.1);
    border-radius: 2px;
  `,
  // Click/captured state - strong highlight
  captured: `
    border: 2px solid rgba(76, 175, 80, 0.9);
    background-color: rgba(76, 175, 80, 0.15);
    border-radius: 2px;
  `,
  // Error state - element not found
  error: `
    border: 2px solid rgba(244, 67, 54, 0.8);
    background-color: rgba(244, 67, 54, 0.1);
    border-radius: 2px;
  `,
} as const;

// Recording indicator badge (shows "REC" in corner)
export const RECORDING_INDICATOR_STYLES = {
  container: `
    position: fixed;
    top: 10px;
    right: 10px;
    z-index: ${MAX_Z_INDEX};
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background-color: rgba(244, 67, 54, 0.95);
    color: white;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 12px;
    font-weight: 600;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    pointer-events: none;
  `,
  dot: `
    width: 8px;
    height: 8px;
    background-color: white;
    border-radius: 50%;
    animation: pulse 1.5s ease-in-out infinite;
  `,
  // Keyframes need to be injected separately
  keyframes: `
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
  `,
} as const;

// Utility function to create style element
export function injectStyles(css: string, id: string): HTMLStyleElement {
  // Remove existing style element if present
  const existing = document.getElementById(id);
  if (existing) {
    existing.remove();
  }

  const style = document.createElement('style');
  style.id = id;
  style.textContent = css;
  document.head.appendChild(style);
  return style;
}

/**
 * Context invalidation detection utilities.
 *
 * When a Chrome extension is updated or reloaded, existing content scripts
 * lose their connection to the service worker. These utilities detect this
 * condition and provide user-friendly recovery options.
 */

/**
 * Check if extension context is still valid.
 * Returns false when extension has been updated/reloaded while content script is running.
 */
export function isContextValid(): boolean {
  try {
    // chrome.runtime.id is undefined when context is invalidated
    return !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

/**
 * Display a non-intrusive banner prompting user to refresh the page.
 * Called when extension context is permanently invalidated.
 */
export function showUpdateBanner(): void {
  // Prevent duplicate banners
  if (document.getElementById('browserlet-update-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'browserlet-update-banner';
  banner.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; gap: 12px;">
      <span>Browserlet was updated. Please refresh this page to continue.</span>
      <button id="browserlet-refresh-btn" style="
        background: white;
        color: #f57c00;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 500;
      ">Refresh Now</button>
      <button id="browserlet-dismiss-btn" style="
        background: transparent;
        color: white;
        border: 1px solid white;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
      ">Dismiss</button>
    </div>
  `;
  banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: linear-gradient(135deg, #f57c00, #ff9800);
    color: white;
    padding: 12px 16px;
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  `;

  document.body.prepend(banner);

  document.getElementById('browserlet-refresh-btn')?.addEventListener('click', () => {
    location.reload();
  });

  document.getElementById('browserlet-dismiss-btn')?.addEventListener('click', () => {
    banner.remove();
  });
}

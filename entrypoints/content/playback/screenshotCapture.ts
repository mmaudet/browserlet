/**
 * Screenshot capture module for Browserlet
 * Uses chrome.tabs.captureVisibleTab via background messaging
 * Content scripts cannot directly use chrome.tabs API
 */

interface CaptureOptions {
  scriptId: string;
  executionId?: string;
  stepIndex: number;
  isFailure?: boolean;
  failureReason?: string;
}

/**
 * Capture screenshot of visible viewport
 * Sends message to background service worker which has access to chrome.tabs API
 * @param options - Capture options including script context
 */
export async function captureScreenshot(options: CaptureOptions): Promise<void> {
  const { scriptId, executionId, stepIndex, isFailure = false, failureReason } = options;

  console.log('[Browserlet] captureScreenshot called with:', { scriptId, executionId, stepIndex, isFailure, failureReason });

  // Skip if no scriptId (can happen during manual testing)
  if (!scriptId) {
    console.warn('[Browserlet] Screenshot skipped - no scriptId provided');
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'CAPTURE_SCREENSHOT',
      payload: {
        scriptId,
        executionId,
        stepIndex,
        isFailure,
        failureReason,
        pageUrl: window.location.href,
        pageTitle: document.title
      }
    });

    if (response?.success) {
      console.log(`[Browserlet] Screenshot captured for step ${stepIndex}${isFailure ? ' (failure)' : ''}`);
    } else {
      console.error('[Browserlet] Screenshot capture failed:', response?.error);
    }
  } catch (error) {
    console.error('[Browserlet] Failed to capture screenshot:', error);
    // Don't throw - screenshot failure shouldn't block execution
  }
}

/**
 * Capture failure screenshot when a step fails
 * Called when a step fails to find/interact with an element
 * @param options - Capture options with failure reason
 */
export async function captureFailureScreenshot(
  options: Omit<CaptureOptions, 'isFailure'> & { failureReason: string }
): Promise<void> {
  await captureScreenshot({
    ...options,
    isFailure: true
  });
}

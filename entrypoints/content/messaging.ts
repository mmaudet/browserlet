import type { Message, MessageResponse } from '../../utils/types';
import { isContextValid, showUpdateBanner } from '../../utils/context-check';

const MAX_RETRIES = 3;
const RETRY_DELAY_BASE_MS = 100;

/**
 * Send message to service worker with automatic retry and context invalidation handling.
 *
 * Uses exponential backoff: 100ms, 200ms, 400ms
 * Shows update banner on permanent context invalidation.
 *
 * @throws Error if context is permanently invalidated (extension updated)
 */
export async function sendMessageSafe<T = unknown>(
  message: Message,
  retries = MAX_RETRIES
): Promise<MessageResponse<T>> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Check context before attempting to send
      if (!isContextValid()) {
        throw new Error('Extension context invalidated');
      }

      const response = await chrome.runtime.sendMessage(message);
      return response as MessageResponse<T>;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      const isContextError =
        errorMessage.includes('Extension context invalidated') ||
        errorMessage.includes('Receiving end does not exist') ||
        errorMessage.includes('Could not establish connection');

      if (isContextError) {
        if (attempt === retries - 1) {
          // Final retry failed - notify user
          showUpdateBanner();
          throw new Error('Extension context invalidated. Please refresh the page.');
        }

        // Exponential backoff before retry
        const delay = RETRY_DELAY_BASE_MS * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // Non-context error - don't retry
      throw error;
    }
  }

  // Should not reach here, but TypeScript needs this
  throw new Error('Max retries exceeded');
}

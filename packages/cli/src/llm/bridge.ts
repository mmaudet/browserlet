/**
 * LLM micro-prompt bridge for CLI using Playwright's page.exposeFunction
 *
 * Installs window.__browserlet_microPrompt in page context, routing calls from
 * cascade resolver bundle to Node.js LLM providers via routeMicroPrompt.
 *
 * Pattern from Phase 26 vault bridge (packages/cli/src/vault/bridge.ts):
 * - page.exposeFunction creates secure bridge between page and Node.js contexts
 * - Functions survive navigations per Playwright docs
 * - JSON serialization for all inputs/outputs
 * - Comprehensive error handling with structured error codes
 *
 * Security:
 * - No exposed credentials (provider instance stays in Node.js)
 * - All errors caught and returned as JSON (no unhandled exceptions in page context)
 *
 * Phase 28 - Plan 28-02
 */

import type { Page } from 'playwright';
import type { MicroPromptInput } from '@browserlet/core/prompts';
import { routeMicroPrompt } from './microPromptRouter.js';
import type { LLMProvider } from './providers/types.js';
import type { MicroPromptResult } from './microPromptRouter.js';

/**
 * Install window.__browserlet_microPrompt bridge in page context.
 *
 * Creates a function accessible from page JavaScript that routes micro-prompt
 * requests to the provided LLM provider via routeMicroPrompt pipeline.
 *
 * Bridge function signature (page context):
 *   window.__browserlet_microPrompt(inputJson: string) => Promise<string>
 *
 * Input: JSON-stringified MicroPromptInput
 * Output: JSON-stringified { success: boolean, data?: MicroPromptResult, error?: string }
 *
 * Error handling:
 * - JSON parse errors return BRIDGE_ERROR code
 * - routeMicroPrompt errors are already structured, wrap in success envelope
 * - Unknown errors return generic BRIDGE_ERROR with message
 *
 * Per Playwright docs: "Functions installed via page.exposeFunction() survive
 * navigations" -- no re-installation needed after page.goto().
 *
 * @param page - Playwright page instance
 * @param provider - LLM provider instance (ClaudeProvider or OllamaProvider)
 */
export async function installMicroPromptBridge(
  page: Page,
  provider: LLMProvider
): Promise<void> {
  await page.exposeFunction(
    '__browserlet_microPrompt',
    async (inputJson: string): Promise<string> => {
      try {
        // Step 1: Parse input JSON
        let input: MicroPromptInput;
        try {
          input = JSON.parse(inputJson) as MicroPromptInput;
        } catch (parseError: unknown) {
          const errorMessage = parseError instanceof Error ? parseError.message : 'JSON parse error';
          return JSON.stringify({
            success: false,
            error: `Invalid JSON input: ${errorMessage}`,
            code: 'BRIDGE_ERROR',
          });
        }

        // Step 2: Route to micro-prompt pipeline
        const result: MicroPromptResult = await routeMicroPrompt(provider, {
          promptType: input.type,
          input,
        });

        // Step 3: Return wrapped result
        // routeMicroPrompt already returns structured error or success
        if (result.success) {
          return JSON.stringify({
            success: true,
            data: result,
          });
        } else {
          // Error from routeMicroPrompt - wrap in success envelope
          return JSON.stringify({
            success: false,
            data: result,
          });
        }
      } catch (error: unknown) {
        // Unknown error - return generic BRIDGE_ERROR
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return JSON.stringify({
          success: false,
          error: errorMessage,
          code: 'BRIDGE_ERROR',
        });
      }
    }
  );

  console.log('[LLM Bridge] Installed __browserlet_microPrompt via page.exposeFunction');
}

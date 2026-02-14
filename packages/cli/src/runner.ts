/**
 * BSLRunner - Main orchestrator for BSL script execution
 *
 * Reads .bsl files from disk, parses them with @browserlet/core, iterates
 * steps with SimpleResolver + PlaywrightExecutor, tracks extracted variable
 * results, reports progress via StepReporter, and returns exit codes.
 *
 * Exit codes: 0 = success, 1 = step failure, 2 = timeout/infrastructure error
 */

import fs from 'node:fs';
import type { Page } from 'playwright';
import { parseSteps } from '@browserlet/core/parser';
import {
  substituteVariables,
  hasExtractedVariables,
  CREDENTIAL_PATTERN,
} from '@browserlet/core/substitution';
import { PlaywrightExecutor } from './executor.js';
import type { StepError } from './executor.js';
import { SimpleResolver } from './resolver.js';
import { StepReporter } from './output.js';

/** Actions that do not require selector resolution */
const NO_SELECTOR_ACTIONS = new Set(['navigate', 'screenshot']);

export interface RunResult {
  exitCode: number;
}

export interface BSLRunnerOptions {
  globalTimeout: number;
}

/**
 * BSLRunner orchestrates BSL script execution end-to-end:
 * 1. Read and parse .bsl YAML file
 * 2. Iterate steps: resolve selector -> execute action -> track results
 * 3. Handle variable substitution for extracted values
 * 4. Report progress with colored terminal output
 * 5. Return appropriate exit code
 */
export class BSLRunner {
  private page: Page;
  private options: BSLRunnerOptions;

  constructor(page: Page, options: BSLRunnerOptions) {
    this.page = page;
    this.options = options;
  }

  /**
   * Execute a BSL script file end-to-end.
   *
   * @param scriptPath - Path to the .bsl YAML file
   * @returns Object with exitCode: 0 (success), 1 (step failure), 2 (timeout)
   */
  async run(scriptPath: string): Promise<RunResult> {
    // 1. Read the .bsl file from disk
    const yamlContent = fs.readFileSync(scriptPath, 'utf-8');

    // 2. Parse with @browserlet/core parser
    const script = parseSteps(yamlContent);

    // 3. Create executor, resolver, and reporter
    const executor = new PlaywrightExecutor(this.page, this.options.globalTimeout);
    const resolver = new SimpleResolver(this.page);
    const reporter = new StepReporter();

    // 4. Runtime context for extracted variable substitution
    const extractedData: Record<string, unknown> = {};

    // 5. Begin script execution
    reporter.scriptStart(script.name, script.steps.length);
    const scriptStartTime = performance.now();

    for (let i = 0; i < script.steps.length; i++) {
      const step = script.steps[i]!;
      const total = script.steps.length;

      reporter.stepStart(i, total, step.action, step.target?.intent || '');
      const stepStartTime = performance.now();

      try {
        // Handle variable substitution in step.value
        if (step.value) {
          // Check for credential references (Phase 26 feature)
          CREDENTIAL_PATTERN.lastIndex = 0;
          if (CREDENTIAL_PATTERN.test(step.value)) {
            console.warn(
              `[Browserlet] Warning: Step ${i + 1} contains credential references. ` +
              `Credential substitution requires --vault or extension bridge (Phase 26).`,
            );
          }

          // Substitute extracted variables
          if (hasExtractedVariables(step.value)) {
            step.value = substituteVariables(step.value, extractedData);
          }
        }

        // Determine if step needs a selector
        const needsSelector = !NO_SELECTOR_ACTIONS.has(step.action) ||
          (step.action === 'screenshot' && step.target != null);

        // Resolve selector if needed
        let selector = '';
        if (needsSelector) {
          selector = await resolver.resolve(step);
        }

        // Execute the step
        const result = await executor.execute(step, selector);

        // Track extraction results for variable substitution
        if (step.output?.variable && result !== undefined && result !== null) {
          extractedData[step.output.variable] = result;
        }

        // Report success
        const stepDuration = performance.now() - stepStartTime;
        reporter.stepPass(stepDuration);
      } catch (error: unknown) {
        const stepError = error as StepError;
        const errorMessage = stepError.message || String(error);

        reporter.stepFail(errorMessage);

        // Determine exit code based on error type
        const exitCode = stepError.code === 'TIMEOUT' ? 2 : 1;
        return { exitCode };
      }
    }

    // All steps succeeded
    const totalDuration = performance.now() - scriptStartTime;
    reporter.scriptPass(totalDuration);
    return { exitCode: 0 };
  }
}

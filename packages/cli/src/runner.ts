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
import path from 'node:path';
import readline from 'node:readline';
import type { Page } from 'playwright';
import pc from 'picocolors';
import { parseSteps } from '@browserlet/core/parser';
import {
  substituteVariables,
  hasExtractedVariables,
  CREDENTIAL_PATTERN,
  substituteCredentials,
} from '@browserlet/core/substitution';
import { PlaywrightExecutor } from './executor.js';
import type { StepError } from './executor.js';
import { CascadeCLIResolver } from './cascadeResolver.js';
import { SimpleResolver } from './resolver.js';
import { StepReporter } from './output.js';
import { CLIPasswordStorage } from './credentials/resolver.js';
import { ClaudeProvider } from './llm/providers/claude.js';
import { OllamaProvider } from './llm/providers/ollama.js';
import type { LLMProvider } from './llm/providers/types.js';
import { installMicroPromptBridge } from './llm/bridge.js';
import { RepairEngine } from './repair/repairEngine.js';
import type { RepairContext, RepairSuggestion } from './repair/types.js';
import { applyRepair } from './repair/repairApplier.js';
import { RepairHistoryLogger } from './repair/repairHistory.js';
import { captureDOMContext } from './repair/domCapture.js';

/** Actions that do not require selector resolution */
const NO_SELECTOR_ACTIONS = new Set(['navigate', 'screenshot']);

export interface RunResult {
  exitCode: number;
}

export interface BSLRunnerOptions {
  globalTimeout: number;
  outputDir: string; // Directory for failure screenshots
  derivedKey?: CryptoKey; // Optional: if provided, enables credential substitution
  microPrompts?: boolean; // Enable LLM stages (default: false)
  llmConfig?: {
    provider: 'claude' | 'ollama';
    claudeApiKey?: string;
    claudeModel?: string;
    ollamaHost?: string;
    ollamaModel?: string;
  };
  autoRepair?: boolean;    // --auto-repair: apply repairs >= 0.70 confidence automatically
  interactive?: boolean;   // --interactive: prompt user to approve each repair
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
    // 1. Read the .bsl file from disk, strip invisible Unicode control chars
    //    (e.g. U+200E LTR mark that can leak from browser recording)
    const rawContent = fs.readFileSync(scriptPath, 'utf-8');
    const yamlContent = rawContent.replace(/[\u200B-\u200F\u2028-\u202F\uFEFF]/g, '');

    // 2. Parse with @browserlet/core parser
    const script = parseSteps(yamlContent);

    // 3. Create output directory for screenshots
    fs.mkdirSync(this.options.outputDir, { recursive: true });

    // Extract script base name for screenshot filenames (e.g. "Twake_Drive")
    const scriptBaseName = path.basename(scriptPath, path.extname(scriptPath))
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_');

    // 4. Install LLM bridge if micro-prompts enabled
    if (this.options.microPrompts) {
      if (!this.options.llmConfig) {
        throw new Error('--micro-prompts requires LLM configuration');
      }

      const { provider: providerName, claudeApiKey, claudeModel, ollamaHost, ollamaModel } = this.options.llmConfig;

      // Create provider based on config
      if (providerName === 'claude') {
        if (!claudeApiKey) {
          throw new Error('--micro-prompts with provider=claude requires ANTHROPIC_API_KEY');
        }
        const provider = new ClaudeProvider(claudeApiKey, claudeModel);
        await installMicroPromptBridge(this.page, provider);
        console.log(`[BSLRunner] Micro-prompts enabled via ${providerName}`);
      } else if (providerName === 'ollama') {
        const provider = new OllamaProvider(ollamaHost, ollamaModel);
        await installMicroPromptBridge(this.page, provider);
        console.log(`[BSLRunner] Micro-prompts enabled via ${providerName}`);
      } else {
        throw new Error(`Unknown LLM provider: ${providerName}`);
      }
    } else {
      console.log('[BSLRunner] Running deterministic-only (stages 1-2)');
    }

    // 5. Create repair engine if auto-repair or interactive mode enabled
    let repairEngine: RepairEngine | null = null;
    let repairHistory: RepairHistoryLogger | null = null;

    if (this.options.autoRepair || this.options.interactive) {
      if (!this.options.llmConfig) {
        throw new Error('--auto-repair / --interactive requires LLM configuration (set ANTHROPIC_API_KEY or configure Ollama)');
      }
      const { provider: providerName, claudeApiKey, claudeModel, ollamaHost, ollamaModel } = this.options.llmConfig;
      let repairProvider: LLMProvider;
      if (providerName === 'claude') {
        if (!claudeApiKey) throw new Error('--auto-repair with provider=claude requires ANTHROPIC_API_KEY');
        repairProvider = new ClaudeProvider(claudeApiKey, claudeModel);
      } else {
        repairProvider = new OllamaProvider(ollamaHost, ollamaModel);
      }
      repairEngine = new RepairEngine(this.page, repairProvider);
      repairHistory = new RepairHistoryLogger(scriptPath);
      console.log(`[BSLRunner] Auto-repair enabled (mode: ${this.options.autoRepair ? 'auto' : 'interactive'})`);
    }

    // Create executor, resolvers (cascade + fallback), and reporter
    const executor = new PlaywrightExecutor(this.page, this.options.globalTimeout);
    const cascadeResolver = new CascadeCLIResolver(this.page, this.options.globalTimeout);
    await cascadeResolver.inject();
    const simpleResolver = new SimpleResolver(this.page);
    const reporter = new StepReporter();

    // 6. Runtime context for extracted variable substitution
    const extractedData: Record<string, unknown> = {};

    // 7. Create password storage if vault is unlocked
    const passwordStorage = this.options.derivedKey
      ? new CLIPasswordStorage(this.options.derivedKey)
      : null;

    // 8. Begin script execution
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
          // Substitute credentials if vault is unlocked
          if (passwordStorage) {
            step.value = await substituteCredentials(step.value, passwordStorage);
          } else {
            // Check for credential references without vault
            CREDENTIAL_PATTERN.lastIndex = 0;
            if (CREDENTIAL_PATTERN.test(step.value)) {
              throw new Error(
                `Step ${i + 1} contains credential references but --vault flag not provided. ` +
                `Use --vault to unlock credential vault.`
              );
            }
          }

          // Substitute extracted variables
          if (hasExtractedVariables(step.value)) {
            step.value = substituteVariables(step.value, extractedData);
          }
        }

        // Determine if step needs a selector
        const needsSelector = !NO_SELECTOR_ACTIONS.has(step.action) ||
          (step.action === 'screenshot' && step.target != null);

        // Resolve selector: cascade resolver first, fallback to SimpleResolver, then repair
        let selector = '';
        if (needsSelector) {
          let cascadeError: string | null = null;
          try {
            selector = await cascadeResolver.resolve(step);
          } catch (err: unknown) {
            cascadeError = err instanceof Error ? err.message : String(err);
            // Cascade failed -- try SimpleResolver
            try {
              selector = await simpleResolver.resolve(step);
              cascadeError = null; // Simple resolver succeeded, no repair needed
            } catch {
              // Both resolvers failed
              if (!repairEngine) {
                // No repair available, throw cascade error
                throw new Error(cascadeError ?? 'Both cascade and simple resolver failed');
              }
            }
          }

          // Attempt repair if both resolvers failed and repair engine exists
          if (cascadeError && repairEngine) {
            console.log(`[BSLRunner] Both resolvers failed for step ${i + 1}, attempting repair...`);

            // Capture DOM context
            const domExcerpt = await captureDOMContext(this.page, step);

            // Parse cascade diagnostics from error message
            const failedMatch = cascadeError.match(/failed=\[([^\]]*)\]/);
            const matchedMatch = cascadeError.match(/matched=\[([^\]]*)\]/);

            const repairContext: RepairContext = {
              scriptPath,
              stepIndex: i,
              step,
              failedHints: failedMatch?.[1]?.split(', ').filter(Boolean) ?? [],
              matchedHints: matchedMatch?.[1]?.split(', ').filter(Boolean) ?? [],
              cascadeError,
              domExcerpt,
              pageUrl: this.page.url(),
            };

            const repairResult = await repairEngine.attemptRepair(repairContext);

            if (repairResult.suggestions.length > 0) {
              const topSuggestion = repairResult.suggestions[0]!;
              console.log(
                `[BSLRunner] Repair suggestion: confidence=${topSuggestion.confidence.toFixed(2)}, ` +
                `${topSuggestion.hints.length} hints — ${topSuggestion.reasoning}`
              );

              let shouldApply = false;

              if (this.options.autoRepair && topSuggestion.confidence >= 0.70) {
                shouldApply = true;
                console.log(`[BSLRunner] Auto-applying repair (confidence ${topSuggestion.confidence.toFixed(2)} >= 0.70)`);
              } else if (this.options.interactive) {
                shouldApply = await promptRepairApproval(topSuggestion);
              } else if (this.options.autoRepair && topSuggestion.confidence < 0.70) {
                console.log(
                  `[BSLRunner] Skipping repair: confidence ${topSuggestion.confidence.toFixed(2)} < 0.70 threshold`
                );
              }

              if (shouldApply) {
                // Apply the repair to the BSL file on disk
                const applied = applyRepair(scriptPath, i, topSuggestion.hints);

                if (applied) {
                  // Log to repair history
                  repairHistory?.logRepair({
                    timestamp: new Date().toISOString(),
                    scriptPath,
                    stepIndex: i,
                    stepId: step.id,
                    originalHints: step.target?.hints ?? [],
                    appliedHints: topSuggestion.hints,
                    confidence: topSuggestion.confidence,
                    reasoning: topSuggestion.reasoning,
                    pageUrl: repairContext.pageUrl,
                  });

                  // Update the step's hints in memory for this run
                  if (step.target) {
                    step.target.hints = topSuggestion.hints;
                  }

                  // Re-attempt resolution with the new hints
                  try {
                    selector = await cascadeResolver.resolve(step);
                    console.log(`[BSLRunner] Repair successful! Resolved with new hints.`);
                  } catch {
                    // Even repaired hints didn't work
                    throw new Error(
                      `Repair applied but resolution still failed for step ${step.id || step.action}`
                    );
                  }
                } else {
                  throw new Error(`Failed to write repair to ${scriptPath}`);
                }
              } else {
                // Repair not applied (user rejected or below threshold)
                throw new Error(cascadeError);
              }
            } else {
              // No suggestions from LLM
              console.log(`[BSLRunner] No repair suggestions available`);
              throw new Error(cascadeError);
            }
          }
        }

        // For screenshot actions without an explicit path, generate a named path
        if (step.action === 'screenshot' && !step.value) {
          const stepLabel = step.id || `step-${String(i + 1).padStart(3, '0')}`;
          const safeLabel = stepLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
          step.value = path.join(
            this.options.outputDir,
            `${scriptBaseName}_${safeLabel}_${formatTimestamp()}.png`,
          );
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

        // Screenshot on failure
        const stepName = step.id || `step-${String(i + 1).padStart(3, '0')}-${step.action}`;
        const safeName = stepName.replace(/[^a-zA-Z0-9_-]/g, '_');
        const screenshotPath = path.join(
          this.options.outputDir,
          `${scriptBaseName}_fail-${safeName}_${formatTimestamp()}.png`,
        );

        let capturedScreenshotPath: string | undefined;
        try {
          await this.page.screenshot({ path: screenshotPath, fullPage: false, timeout: 5000 });
          capturedScreenshotPath = screenshotPath;
        } catch {
          // Screenshot itself failed (browser crashed, page closed, etc.)
        }

        reporter.stepFail(errorMessage, capturedScreenshotPath);

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

/**
 * Prompt user to approve or reject a repair suggestion in interactive mode.
 * Shows the suggestion details and waits for y/n input.
 */
async function promptRepairApproval(suggestion: RepairSuggestion): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('');
  console.log(pc.bold('  Repair suggestion:'));
  console.log(pc.dim(`    Confidence: ${suggestion.confidence.toFixed(2)}`));
  console.log(pc.dim(`    Reasoning: ${suggestion.reasoning}`));
  console.log(pc.dim(`    New hints:`));
  for (const hint of suggestion.hints) {
    const val = typeof hint.value === 'string' ? hint.value : JSON.stringify(hint.value);
    console.log(pc.dim(`      - ${hint.type}: ${val}`));
  }
  console.log('');

  return new Promise<boolean>((resolve) => {
    rl.question(pc.bold('  Apply this repair? (y/n) '), (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

/**
 * Format current date/time as a filesystem-safe timestamp.
 * Example: "2025-02-14_15-30-45"
 */
function formatTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
}

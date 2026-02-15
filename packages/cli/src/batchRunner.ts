/**
 * BatchRunner - Discovers and executes .bsl test scripts in batch
 *
 * Runs each script in an isolated browser instance, aggregates results,
 * and reports pass/fail/error counts via TestReporter.
 *
 * Supports parallel execution via --workers N and early termination
 * via --bail. Default behavior (workers=1, bail=false) is sequential
 * execution without bail, identical to plan 29-01 behavior.
 *
 * Exit codes: 0 = all passed, 1 = any failed, 2 = any errored
 */

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { BSLRunner } from './runner.js';
import type { TestReporter } from './testReporter.js';

export interface ScriptResult {
  scriptPath: string;       // Absolute path to .bsl file
  scriptName: string;       // Basename for display
  exitCode: number;         // 0=pass, 1=fail, 2=error, -1=skipped
  durationMs: number;       // Execution time
  error?: string;           // Error message if exitCode > 0
}

export interface BatchResult {
  passed: number;
  failed: number;
  errored: number;
  skipped: number;          // Scripts skipped due to --bail
  totalDurationMs: number;
  results: ScriptResult[];
  exitCode: number;         // Aggregated: 0 if all pass, 2 if any error, 1 if any fail
}

export interface BatchRunnerOptions {
  headed: boolean;
  globalTimeout: number;
  outputDir: string;
  vault: boolean;
  derivedKey?: CryptoKey;
  microPrompts: boolean;
  llmConfig?: {
    provider: 'claude' | 'ollama';
    claudeApiKey?: string;
    claudeModel?: string;
    ollamaHost?: string;
    ollamaModel?: string;
  };
  bail?: boolean;            // Stop on first failure (default: false)
  workers?: number;          // Concurrent worker count (default: 1)
  autoRepair?: boolean;      // Auto-apply LLM repairs (>= 0.70 confidence)
  interactive?: boolean;     // Interactively approve repairs
}

/**
 * BatchRunner discovers .bsl files in a directory and executes each
 * in a fresh, isolated browser instance. Results are aggregated
 * and reported via a TestReporter.
 *
 * When workers > 1, scripts run in parallel with a worker pool.
 * When bail is true, execution stops after the first failure and
 * remaining scripts are marked as skipped.
 */
export class BatchRunner {
  private options: BatchRunnerOptions;
  private reporter: TestReporter;

  constructor(options: BatchRunnerOptions, reporter: TestReporter) {
    this.options = options;
    this.reporter = reporter;
  }

  /**
   * Discover all .bsl files in a directory (non-recursive, sorted alphabetically).
   *
   * @param directory - Path to directory containing .bsl files
   * @returns Array of absolute paths to .bsl files
   * @throws If directory doesn't exist or contains no .bsl files
   */
  discover(directory: string): string[] {
    const absDir = path.resolve(directory);

    if (!fs.existsSync(absDir)) {
      throw new Error(`Directory not found: ${absDir}`);
    }

    if (!fs.statSync(absDir).isDirectory()) {
      throw new Error(`Not a directory: ${absDir}`);
    }

    const entries = fs.readdirSync(absDir)
      .filter((f) => f.endsWith('.bsl'))
      .sort();

    if (entries.length === 0) {
      throw new Error(`No .bsl files found in: ${absDir}`);
    }

    return entries.map((f) => path.join(absDir, f));
  }

  /**
   * Run a single script in a fresh browser instance.
   *
   * @param scriptPath - Absolute path to the .bsl file
   * @returns ScriptResult with exit code, duration, and optional error
   */
  private async runScript(scriptPath: string): Promise<ScriptResult> {
    const scriptName = path.basename(scriptPath);
    const scriptStart = performance.now();
    let browser = null;

    try {
      browser = await chromium.launch({
        headless: !this.options.headed,
        timeout: 30000,
      });
      const context = await browser.newContext();
      const page = await context.newPage();

      const runner = new BSLRunner(page, {
        globalTimeout: this.options.globalTimeout,
        outputDir: this.options.outputDir,
        derivedKey: this.options.derivedKey,
        microPrompts: this.options.microPrompts,
        llmConfig: this.options.llmConfig,
        autoRepair: this.options.autoRepair,
        interactive: this.options.interactive,
      });

      const runResult = await runner.run(scriptPath);
      const durationMs = performance.now() - scriptStart;

      await context.close();
      await browser.close();
      browser = null;

      return {
        scriptPath,
        scriptName,
        exitCode: runResult.exitCode,
        durationMs,
        error: runResult.exitCode > 0
          ? `Script ${runResult.exitCode === 2 ? 'errored' : 'failed'} with exit code ${runResult.exitCode}`
          : undefined,
      };
    } catch (error: unknown) {
      // Infrastructure error (browser launch failure, etc.)
      const durationMs = performance.now() - scriptStart;
      const message = error instanceof Error ? error.message : String(error);

      return {
        scriptPath,
        scriptName,
        exitCode: 2,
        durationMs,
        error: message,
      };
    } finally {
      if (browser) {
        await browser.close().catch(() => {});
      }
    }
  }

  /**
   * Run all scripts using a worker pool pattern.
   *
   * When workers=1, this behaves identically to sequential execution.
   * When workers>1, N scripts run in parallel with fresh browser per script.
   *
   * The worker pool uses a shared index counter. Since Node.js is
   * single-threaded, `nextIndex++` is safe (no race condition on the
   * increment). Each worker awaits browser operations, yielding back
   * to the event loop, but the index increment is synchronous.
   *
   * Results are stored by original index to maintain script order
   * regardless of completion order.
   *
   * @param scriptPaths - Array of absolute paths to .bsl files
   * @returns Aggregated batch result with per-script details
   */
  async runAll(scriptPaths: string[]): Promise<BatchResult> {
    const results: ScriptResult[] = new Array(scriptPaths.length);
    let nextIndex = 0;
    let bailed = false;
    const startTime = performance.now();

    const runWorker = async () => {
      while (true) {
        const index = nextIndex++;
        if (index >= scriptPaths.length) break;

        if (bailed) {
          // Mark remaining as skipped
          const scriptPath = scriptPaths[index]!;
          const result: ScriptResult = {
            scriptPath,
            scriptName: path.basename(scriptPath),
            exitCode: -1,
            durationMs: 0,
          };
          results[index] = result;
          this.reporter.scriptResult(result);
          continue;
        }

        const scriptPath = scriptPaths[index]!;
        this.reporter.scriptStart(path.basename(scriptPath), index + 1, scriptPaths.length);

        const result = await this.runScript(scriptPath);
        results[index] = result;
        this.reporter.scriptResult(result);

        if ((this.options.bail ?? false) && result.exitCode > 0) {
          bailed = true;
        }
      }
    };

    const workerCount = Math.min(this.options.workers ?? 1, scriptPaths.length);
    await Promise.all(Array.from({ length: workerCount }, () => runWorker()));

    const totalDurationMs = performance.now() - startTime;

    const passed = results.filter((r) => r.exitCode === 0).length;
    const failed = results.filter((r) => r.exitCode === 1).length;
    const errored = results.filter((r) => r.exitCode === 2).length;
    const skipped = results.filter((r) => r.exitCode === -1).length;

    // Aggregated exit code: 2 if any errored, 1 if any failed, 0 if all passed
    let exitCode = 0;
    if (errored > 0) exitCode = 2;
    else if (failed > 0) exitCode = 1;

    const batchResult: BatchResult = {
      passed,
      failed,
      errored,
      skipped,
      totalDurationMs,
      results,
      exitCode,
    };

    this.reporter.summary(batchResult);

    return batchResult;
  }
}

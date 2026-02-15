/**
 * @browserlet/cli - BSL automation CLI entry point
 *
 * Parses CLI arguments with Commander.js, manages Playwright browser
 * lifecycle, and wires BSLRunner for end-to-end script execution.
 *
 * Usage: browserlet run <script> [--headed] [--timeout <ms>]
 *        browserlet test <directory> [--headed] [--timeout <ms>]
 */

import fs from 'node:fs';
import { Command } from 'commander';
import { chromium } from 'playwright';
import pc from 'picocolors';
import { BSLRunner } from './runner.js';
import { BatchRunner } from './batchRunner.js';
import { TestReporter } from './testReporter.js';
import { promptMasterPassword, verifyMasterPassword } from './vault/encryption.js';
import { vaultExists, readVault } from './vault/storage.js';
import { base64ToBuffer } from './vault/encryption.js';

// Re-export core modules for programmatic usage
export { PlaywrightExecutor, parseTimeout } from './executor.js';
export type { StepError, StepErrorCode } from './executor.js';
export { StepReporter } from './output.js';
export { SimpleResolver } from './resolver.js';
export { BSLRunner } from './runner.js';
export type { RunResult, BSLRunnerOptions } from './runner.js';
export { CascadeCLIResolver } from './cascadeResolver.js';
export { BatchRunner } from './batchRunner.js';
export type { BatchResult, ScriptResult, BatchRunnerOptions } from './batchRunner.js';
export { TestReporter } from './testReporter.js';

const program = new Command();

program
  .name('browserlet')
  .description('Run BSL automation scripts')
  .version('0.1.0');

program
  .command('run')
  .description('Execute a BSL automation script')
  .argument('<script>', 'Path to .bsl script file')
  .option('--headed', 'Run browser in headed mode', false)
  .option('--timeout <ms>', 'Global step timeout in milliseconds', '30000')
  .option('--output-dir <dir>', 'Directory for failure screenshots', 'browserlet-output')
  .option('--vault', 'Use encrypted credential vault for {{credential:name}} substitution', false)
  .option('--micro-prompts', 'Enable LLM micro-prompts for cascade resolver stages 3-5 (requires ANTHROPIC_API_KEY or Ollama)', false)
  .option('--auto-repair', 'Automatically apply LLM-suggested repairs for failed selectors (confidence >= 0.70)', false)
  .option('--interactive', 'Interactively approve repair suggestions for failed selectors', false)
  .action(async (scriptPath: string, options: { headed: boolean; timeout: string; outputDir: string; vault: boolean; microPrompts: boolean; autoRepair: boolean; interactive: boolean }) => {
    // Validate script path
    if (!fs.existsSync(scriptPath)) {
      console.error(pc.red(`Error: Script file not found: ${scriptPath}`));
      process.exit(2);
    }

    // Validate timeout
    const timeout = parseInt(options.timeout, 10);
    if (isNaN(timeout) || timeout <= 0) {
      console.error(pc.red(`Error: Invalid timeout value: ${options.timeout}. Must be a positive integer.`));
      process.exit(2);
    }

    // Handle vault flag
    let derivedKey: CryptoKey | undefined;
    if (options.vault) {
      // Check vault exists
      if (!(await vaultExists())) {
        console.error(pc.red('Vault not found. Initialize with browserlet vault init'));
        process.exit(2);
      }

      // Prompt for master password
      const password = await promptMasterPassword();

      // Read vault and verify password against stored validation data
      const vault = await readVault();
      const saltBuffer = base64ToBuffer(vault.salt);
      const verification = await verifyMasterPassword(password, new Uint8Array(saltBuffer), vault.validationData);
      if (!verification.valid) {
        console.error(pc.red('Invalid master password'));
        process.exit(2);
      }
      derivedKey = verification.key!
    }

    // Handle --micro-prompts flag: read LLM config from environment
    let llmConfig: { provider: 'claude' | 'ollama'; claudeApiKey?: string; claudeModel?: string; ollamaHost?: string; ollamaModel?: string } | undefined;
    if (options.microPrompts) {
      const provider = (process.env.BROWSERLET_LLM_PROVIDER || 'claude') as 'claude' | 'ollama';

      if (provider === 'claude') {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          console.error(pc.red('--micro-prompts with provider=claude requires ANTHROPIC_API_KEY environment variable'));
          process.exit(2);
        }
        llmConfig = {
          provider: 'claude',
          claudeApiKey: apiKey,
          claudeModel: process.env.BROWSERLET_LLM_MODEL || 'claude-sonnet-4-5-20250929',
        };
      } else if (provider === 'ollama') {
        llmConfig = {
          provider: 'ollama',
          ollamaHost: process.env.BROWSERLET_OLLAMA_HOST || 'http://localhost:11434',
          ollamaModel: process.env.BROWSERLET_LLM_MODEL || 'llama3.1',
        };
      } else {
        console.error(pc.red(`Unknown LLM provider: ${provider}. Use 'claude' or 'ollama'.`));
        process.exit(2);
      }
    }

    // Validate mutually exclusive flags
    if (options.autoRepair && options.interactive) {
      console.error(pc.red('--auto-repair and --interactive are mutually exclusive. Use one or the other.'));
      process.exit(2);
    }

    // Auto-repair and interactive modes require LLM config
    if ((options.autoRepair || options.interactive) && !llmConfig) {
      const provider = (process.env.BROWSERLET_LLM_PROVIDER || 'claude') as 'claude' | 'ollama';
      if (provider === 'claude') {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          console.error(pc.red('--auto-repair / --interactive requires ANTHROPIC_API_KEY environment variable'));
          process.exit(2);
        }
        llmConfig = {
          provider: 'claude',
          claudeApiKey: apiKey,
          claudeModel: process.env.BROWSERLET_LLM_MODEL || 'claude-sonnet-4-5-20250929',
        };
      } else if (provider === 'ollama') {
        llmConfig = {
          provider: 'ollama',
          ollamaHost: process.env.BROWSERLET_OLLAMA_HOST || 'http://localhost:11434',
          ollamaModel: process.env.BROWSERLET_LLM_MODEL || 'llama3.1',
        };
      }
    }

    let browser = null;
    try {
      browser = await chromium.launch({
        headless: !options.headed,
        timeout: 30000, // Browser launch timeout, separate from step timeout
      });
      const context = await browser.newContext();
      const page = await context.newPage();

      const runner = new BSLRunner(page, {
        globalTimeout: timeout,
        outputDir: options.outputDir,
        derivedKey,
        microPrompts: options.microPrompts,
        llmConfig,
        autoRepair: options.autoRepair,
        interactive: options.interactive,
      });

      const result = await runner.run(scriptPath);

      await context.close();
      await browser.close();
      browser = null; // Prevent double-close in finally

      process.exit(result.exitCode);
    } catch (error: unknown) {
      // Infrastructure error (browser crash, launch failure)
      const message = error instanceof Error ? error.message : String(error);
      console.error(pc.red('Infrastructure error:'), message);
      process.exit(2);
    } finally {
      if (browser) {
        await browser.close().catch(() => {});
      }
    }
  });

program
  .command('test')
  .description('Run all BSL scripts in a directory')
  .argument('<directory>', 'Directory containing .bsl test scripts')
  .option('--headed', 'Run browser in headed mode', false)
  .option('--timeout <ms>', 'Global step timeout in milliseconds', '30000')
  .option('--output-dir <dir>', 'Directory for failure screenshots', 'browserlet-output')
  .option('--vault', 'Use encrypted credential vault', false)
  .option('--micro-prompts', 'Enable LLM micro-prompts for cascade resolver', false)
  .option('--bail', 'Stop on first failure', false)
  .option('--workers <count>', 'Number of parallel workers', '1')
  .option('--auto-repair', 'Automatically apply LLM-suggested repairs for failed selectors (confidence >= 0.70)', false)
  .option('--interactive', 'Interactively approve repair suggestions for failed selectors', false)
  .action(async (directory: string, options: { headed: boolean; timeout: string; outputDir: string; vault: boolean; microPrompts: boolean; bail: boolean; workers: string; autoRepair: boolean; interactive: boolean }) => {
    // Validate directory exists
    if (!fs.existsSync(directory)) {
      console.error(pc.red(`Error: Directory not found: ${directory}`));
      process.exit(2);
    }
    if (!fs.statSync(directory).isDirectory()) {
      console.error(pc.red(`Error: Not a directory: ${directory}`));
      process.exit(2);
    }

    // Validate timeout
    const timeout = parseInt(options.timeout, 10);
    if (isNaN(timeout) || timeout <= 0) {
      console.error(pc.red(`Error: Invalid timeout value: ${options.timeout}. Must be a positive integer.`));
      process.exit(2);
    }

    // Validate workers
    const workers = parseInt(options.workers, 10);
    if (isNaN(workers) || workers < 1) {
      console.error(pc.red('Invalid --workers value: must be a positive integer'));
      process.exit(2);
    }

    // Handle vault flag
    let derivedKey: CryptoKey | undefined;
    if (options.vault) {
      if (!(await vaultExists())) {
        console.error(pc.red('Vault not found. Initialize with browserlet vault init'));
        process.exit(2);
      }

      const password = await promptMasterPassword();
      const vault = await readVault();
      const saltBuffer = base64ToBuffer(vault.salt);
      const verification = await verifyMasterPassword(password, new Uint8Array(saltBuffer), vault.validationData);
      if (!verification.valid) {
        console.error(pc.red('Invalid master password'));
        process.exit(2);
      }
      derivedKey = verification.key!;
    }

    // Handle --micro-prompts flag: read LLM config from environment
    let llmConfig: { provider: 'claude' | 'ollama'; claudeApiKey?: string; claudeModel?: string; ollamaHost?: string; ollamaModel?: string } | undefined;
    if (options.microPrompts) {
      const provider = (process.env.BROWSERLET_LLM_PROVIDER || 'claude') as 'claude' | 'ollama';

      if (provider === 'claude') {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          console.error(pc.red('--micro-prompts with provider=claude requires ANTHROPIC_API_KEY environment variable'));
          process.exit(2);
        }
        llmConfig = {
          provider: 'claude',
          claudeApiKey: apiKey,
          claudeModel: process.env.BROWSERLET_LLM_MODEL || 'claude-sonnet-4-5-20250929',
        };
      } else if (provider === 'ollama') {
        llmConfig = {
          provider: 'ollama',
          ollamaHost: process.env.BROWSERLET_OLLAMA_HOST || 'http://localhost:11434',
          ollamaModel: process.env.BROWSERLET_LLM_MODEL || 'llama3.1',
        };
      } else {
        console.error(pc.red(`Unknown LLM provider: ${provider}. Use 'claude' or 'ollama'.`));
        process.exit(2);
      }
    }

    // Validate mutually exclusive flags
    if (options.autoRepair && options.interactive) {
      console.error(pc.red('--auto-repair and --interactive are mutually exclusive. Use one or the other.'));
      process.exit(2);
    }

    // Auto-repair and interactive modes require LLM config
    if ((options.autoRepair || options.interactive) && !llmConfig) {
      const provider = (process.env.BROWSERLET_LLM_PROVIDER || 'claude') as 'claude' | 'ollama';
      if (provider === 'claude') {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          console.error(pc.red('--auto-repair / --interactive requires ANTHROPIC_API_KEY environment variable'));
          process.exit(2);
        }
        llmConfig = {
          provider: 'claude',
          claudeApiKey: apiKey,
          claudeModel: process.env.BROWSERLET_LLM_MODEL || 'claude-sonnet-4-5-20250929',
        };
      } else if (provider === 'ollama') {
        llmConfig = {
          provider: 'ollama',
          ollamaHost: process.env.BROWSERLET_OLLAMA_HOST || 'http://localhost:11434',
          ollamaModel: process.env.BROWSERLET_LLM_MODEL || 'llama3.1',
        };
      }
    }

    try {
      const reporter = new TestReporter();
      const batchRunner = new BatchRunner({
        headed: options.headed,
        globalTimeout: timeout,
        outputDir: options.outputDir,
        vault: options.vault,
        derivedKey,
        microPrompts: options.microPrompts,
        llmConfig,
        bail: options.bail,
        workers,
        autoRepair: options.autoRepair,
        interactive: options.interactive,
      }, reporter);

      const scripts = batchRunner.discover(directory);
      reporter.suiteStart(directory, scripts.length);

      const batchResult = await batchRunner.runAll(scripts);
      process.exit(batchResult.exitCode);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(pc.red(`Error: ${message}`));
      process.exit(2);
    }
  });

program.parse();

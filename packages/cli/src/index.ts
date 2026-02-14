/**
 * @browserlet/cli - BSL automation CLI entry point
 *
 * Parses CLI arguments with Commander.js, manages Playwright browser
 * lifecycle, and wires BSLRunner for end-to-end script execution.
 *
 * Usage: browserlet run <script> [--headed] [--timeout <ms>]
 */

import fs from 'node:fs';
import { Command } from 'commander';
import { chromium } from 'playwright';
import pc from 'picocolors';
import { BSLRunner } from './runner.js';
import { promptMasterPassword, deriveKey } from './vault/encryption.js';
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
  .action(async (scriptPath: string, options: { headed: boolean; timeout: string; outputDir: string; vault: boolean }) => {
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

      // Read vault and derive key
      const vault = await readVault();
      const saltBuffer = base64ToBuffer(vault.salt);
      derivedKey = await deriveKey(password, new Uint8Array(saltBuffer));

      // Note: Password verification happens during first credential decryption attempt
      // If wrong password, decryption will fail with clear error
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

program.parse();

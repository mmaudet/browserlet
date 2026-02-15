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
import { promptMasterPassword, verifyMasterPassword, generateSalt, deriveKey, createValidationData, encrypt, bufferToBase64 } from './vault/encryption.js';
import { vaultExists, readVault, initializeVault, addCredential, getVaultPath, writeVault } from './vault/storage.js';
import { base64ToBuffer } from './vault/encryption.js';
import { importFromExtension } from './vault/chromeImporter.js';

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

// ─── Vault commands ───────────────────────────────────────────

const vault = program
  .command('vault')
  .description('Manage the encrypted credential vault');

vault
  .command('init')
  .description('Initialize a new credential vault with a master password')
  .action(async () => {
    if (await vaultExists()) {
      console.error(pc.red(`Vault already exists at ${getVaultPath()}`));
      console.error(pc.red('Delete it manually to reinitialize.'));
      process.exit(2);
    }

    console.log(pc.bold('Initialize credential vault'));
    console.log(pc.dim(`Location: ${getVaultPath()}`));
    console.log();

    const password = await promptMasterPassword();
    if (!password) {
      console.error(pc.red('Password cannot be empty'));
      process.exit(2);
    }

    // Confirm password
    process.stdout.write('Confirm master password: ');
    const confirm = await new Promise<string>((resolve) => {
      const chars: string[] = [];
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      const onData = (ch: string) => {
        if (ch === '\r' || ch === '\n' || ch === '\u0004') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(chars.join(''));
        } else if (ch === '\u0003') {
          process.stdin.setRawMode(false);
          process.stdout.write('\n');
          process.exit(130);
        } else if (ch === '\u007F' || ch === '\b') {
          if (chars.length > 0) { chars.pop(); process.stdout.write('\b \b'); }
        } else {
          chars.push(ch);
          process.stdout.write('*');
        }
      };
      process.stdin.on('data', onData);
    });

    if (password !== confirm) {
      console.error(pc.red('Passwords do not match'));
      process.exit(2);
    }

    const salt = generateSalt();
    const key = await deriveKey(password, salt);
    const validationData = await createValidationData(key);
    await initializeVault(bufferToBase64(salt.buffer as ArrayBuffer), validationData);

    console.log(pc.green('Vault initialized successfully'));
  });

vault
  .command('add')
  .description('Add a credential to the vault')
  .argument('<alias>', 'Credential alias (used as {{credential:alias}} in BSL scripts)')
  .action(async (alias: string) => {
    if (!(await vaultExists())) {
      console.error(pc.red('Vault not found. Run: browserlet vault init'));
      process.exit(2);
    }

    // Unlock vault
    const password = await promptMasterPassword();
    const vaultData = await readVault();
    const saltBuffer = base64ToBuffer(vaultData.salt);
    const verification = await verifyMasterPassword(password, new Uint8Array(saltBuffer), vaultData.validationData);
    if (!verification.valid) {
      console.error(pc.red('Invalid master password'));
      process.exit(2);
    }

    // Check for duplicate alias
    const existing = vaultData.credentials.find((c) => c.alias === alias);
    if (existing) {
      console.error(pc.red(`Credential with alias "${alias}" already exists`));
      process.exit(2);
    }

    // Prompt for credential value (masked)
    process.stdout.write(`Enter value for "${alias}": `);
    const value = await new Promise<string>((resolve) => {
      const chars: string[] = [];
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      const onData = (ch: string) => {
        if (ch === '\r' || ch === '\n' || ch === '\u0004') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(chars.join(''));
        } else if (ch === '\u0003') {
          process.stdin.setRawMode(false);
          process.stdout.write('\n');
          process.exit(130);
        } else if (ch === '\u007F' || ch === '\b') {
          if (chars.length > 0) { chars.pop(); process.stdout.write('\b \b'); }
        } else {
          chars.push(ch);
          process.stdout.write('*');
        }
      };
      process.stdin.on('data', onData);
    });

    if (!value) {
      console.error(pc.red('Value cannot be empty'));
      process.exit(2);
    }

    const encrypted = await encrypt(value, verification.key!);
    const id = await addCredential(alias, encrypted);

    console.log(pc.green(`Credential "${alias}" added (${id})`));
  });

vault
  .command('list')
  .description('List stored credentials (aliases only, no values)')
  .action(async () => {
    if (!(await vaultExists())) {
      console.error(pc.red('Vault not found. Run: browserlet vault init'));
      process.exit(2);
    }

    const vaultData = await readVault();
    const creds = vaultData.credentials;

    if (creds.length === 0) {
      console.log(pc.dim('No credentials stored. Add one with: browserlet vault add <alias>'));
      return;
    }

    console.log(pc.bold(`Credentials (${creds.length}):`));
    for (const cred of creds) {
      const date = new Date(cred.createdAt).toLocaleDateString();
      console.log(`  ${pc.cyan(cred.alias || cred.id)}  ${pc.dim(date)}`);
    }
  });

vault
  .command('import-from-extension')
  .description('Import credentials from the Chrome extension vault')
  .action(async () => {
    console.log(pc.bold('Scanning Chrome profiles for Browserlet extension...'));

    const result = await importFromExtension();
    if (!result) {
      console.error(pc.red('Browserlet extension vault not found in any Chrome profile.'));
      console.error(pc.dim('Make sure the extension is installed and has a master password configured.'));
      process.exit(2);
    }

    const { data, extensionId, cleanup } = result;
    console.log(pc.green(`Found extension vault (${extensionId})`));
    console.log(pc.dim(`  ${data.credentials.length} credential(s) available`));

    if (data.credentials.length === 0) {
      console.log(pc.yellow('No credentials to import.'));
      cleanup();
      return;
    }

    // Verify extension master password
    console.log();
    console.log('Enter your extension master password to decrypt credentials:');
    const extPassword = await promptMasterPassword();
    const saltBuffer = base64ToBuffer(data.salt);
    const verification = await verifyMasterPassword(extPassword, new Uint8Array(saltBuffer), data.validationData);
    if (!verification.valid) {
      console.error(pc.red('Invalid master password for extension vault'));
      cleanup();
      process.exit(2);
    }

    const extKey = verification.key!;

    // Check if CLI vault exists
    const cliVaultExists = await vaultExists();

    if (!cliVaultExists) {
      // Create CLI vault with same salt+validation (same master password works)
      await initializeVault(data.salt, data.validationData);
      console.log(pc.green('CLI vault created (same master password as extension)'));
    }

    // Read current CLI vault
    const cliVault = await readVault();

    // If CLI vault uses a different password, we need to re-encrypt
    let cliKey: CryptoKey;
    if (cliVaultExists) {
      const cliSaltBuffer = base64ToBuffer(cliVault.salt);
      const cliVerification = await verifyMasterPassword(extPassword, new Uint8Array(cliSaltBuffer), cliVault.validationData);
      if (cliVerification.valid) {
        // Same password — can use encrypted data directly
        cliKey = cliVerification.key!;
      } else {
        // Different password — need CLI password to re-encrypt
        console.log();
        console.log('CLI vault uses a different password. Enter CLI master password:');
        const cliPassword = await promptMasterPassword();
        const cliVerification2 = await verifyMasterPassword(cliPassword, new Uint8Array(cliSaltBuffer), cliVault.validationData);
        if (!cliVerification2.valid) {
          console.error(pc.red('Invalid CLI vault master password'));
          cleanup();
          process.exit(2);
        }
        cliKey = cliVerification2.key!;
      }
    } else {
      cliKey = extKey;
    }

    // Import credentials
    const { decrypt } = await import('./vault/encryption.js');
    let imported = 0;
    let skipped = 0;

    for (const cred of data.credentials) {
      const alias = cred.alias || cred.username || cred.id;

      // Skip if alias already exists in CLI vault
      const existing = cliVault.credentials.find((c) => c.alias === alias);
      if (existing) {
        console.log(pc.dim(`  skip: ${alias} (already exists)`));
        skipped++;
        continue;
      }

      // If same password, copy encrypted data directly; otherwise re-encrypt
      let encryptedValue: { ciphertext: string; iv: string };
      if (cliKey === extKey) {
        encryptedValue = cred.encryptedPassword;
      } else {
        // Decrypt with extension key, re-encrypt with CLI key
        const plaintext = await decrypt(cred.encryptedPassword, extKey);
        encryptedValue = await encrypt(plaintext, cliKey);
      }

      cliVault.credentials.push({
        id: `cred-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
        alias,
        encryptedValue,
        createdAt: cred.createdAt,
        updatedAt: cred.updatedAt,
      });

      console.log(pc.green(`  imported: ${alias}`));
      imported++;
    }

    // Save vault
    await writeVault(cliVault);
    cleanup();

    console.log();
    console.log(pc.bold(`Done: ${imported} imported, ${skipped} skipped`));
  });

program.parse();

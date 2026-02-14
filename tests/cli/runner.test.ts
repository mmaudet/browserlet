/**
 * BSLRunner integration tests
 *
 * These tests verify the full CLI pipeline end-to-end with real Playwright
 * browser execution. Each test runs a BSL script file through BSLRunner and
 * verifies exit codes and behavior.
 *
 * Requires: `npx playwright install chromium`
 * Timeout: 60s per test (multiple browser operations per test)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type Page, type BrowserContext } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { BSLRunner } from '../../packages/cli/src/runner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('BSLRunner', { timeout: 60000 }, () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext();
    page = await context.newPage();
  });

  afterAll(async () => {
    await context?.close();
    await browser?.close();
  });

  it('runs simple.bsl successfully with exit code 0', async () => {
    const scriptPath = path.resolve(__dirname, 'fixtures/simple.bsl');
    const runner = new BSLRunner(page, { globalTimeout: 15000, outputDir: path.join(os.tmpdir(), 'browserlet-test-output') });
    const result = await runner.run(scriptPath);
    expect(result.exitCode).toBe(0);
  });

  it('returns exit code 1 on step failure (bad selector)', async () => {
    // Create a temporary BSL file with a nonexistent fallback selector
    const tempScript = path.join(os.tmpdir(), 'browserlet-test-failure.bsl');
    const yaml = `name: "Failure test"
steps:
  - action: navigate
    value: "https://example.com"
  - action: click
    target:
      intent: "Nonexistent button"
      hints:
        - type: id
          value: "absolutely-does-not-exist-xyz"
      fallback_selector: "#absolutely-does-not-exist-xyz"
    timeout: "2s"
`;
    fs.writeFileSync(tempScript, yaml, 'utf-8');

    try {
      // Navigate fresh for a clean page state
      await page.goto('about:blank');

      const runner = new BSLRunner(page, { globalTimeout: 5000, outputDir: path.join(os.tmpdir(), 'browserlet-test-output') });
      const result = await runner.run(tempScript);
      // The click on a nonexistent element should timeout -> exit code 2 (TIMEOUT)
      // or fail to find -> exit code 1 (STEP_FAILURE)
      expect([1, 2]).toContain(result.exitCode);
    } finally {
      fs.unlinkSync(tempScript);
    }
  });

  it('returns exit code 1 on missing selector (timeout.bsl)', async () => {
    // Navigate fresh for a clean page state
    await page.goto('about:blank');

    const scriptPath = path.resolve(__dirname, 'fixtures/timeout.bsl');
    const runner = new BSLRunner(page, { globalTimeout: 2000, outputDir: path.join(os.tmpdir(), 'browserlet-test-output') });
    const result = await runner.run(scriptPath);
    // The resolver fails to find #does-not-exist-xyz-12345 via locator.count()
    // and throws a STEP_FAILURE error (exit code 1), not a Playwright timeout
    expect(result.exitCode).toBe(1);
  });

  it('returns exit code 2 on Playwright timeout (hidden element)', async () => {
    // Create a BSL script that targets a hidden element -- the resolver finds
    // it via locator.count() but wait_for with state:'visible' times out
    const tempScript = path.join(os.tmpdir(), 'browserlet-test-timeout.bsl');
    const yaml = `name: "True timeout test"
steps:
  - action: navigate
    value: "data:text/html,<html><body><h1>Visible</h1><div id='hidden-el' style='display:none'>Hidden</div></body></html>"
  - action: wait_for
    target:
      intent: "Hidden element"
      hints:
        - type: id
          value: hidden-el
      fallback_selector: "#hidden-el"
    timeout: "1s"
`;
    fs.writeFileSync(tempScript, yaml, 'utf-8');

    try {
      await page.goto('about:blank');
      const runner = new BSLRunner(page, { globalTimeout: 2000, outputDir: path.join(os.tmpdir(), 'browserlet-test-output') });
      const result = await runner.run(tempScript);
      // The element exists (resolver passes) but is hidden, so
      // page.waitForSelector({ state: 'visible' }) times out -> exit code 2
      expect(result.exitCode).toBe(2);
    } finally {
      fs.unlinkSync(tempScript);
    }
  });

  it('runs multi-action.bsl with extract and exit code 0', async () => {
    // Navigate fresh for a clean page state
    await page.goto('about:blank');

    const scriptPath = path.resolve(__dirname, 'fixtures/multi-action.bsl');
    const runner = new BSLRunner(page, { globalTimeout: 15000, outputDir: path.join(os.tmpdir(), 'browserlet-test-output') });
    const result = await runner.run(scriptPath);
    expect(result.exitCode).toBe(0);

    // Verify screenshot was created
    expect(fs.existsSync('/tmp/browserlet-test-screenshot.png')).toBe(true);
    // Clean up
    if (fs.existsSync('/tmp/browserlet-test-screenshot.png')) {
      fs.unlinkSync('/tmp/browserlet-test-screenshot.png');
    }
  });
});

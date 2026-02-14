/**
 * PlaywrightExecutor integration tests
 *
 * These tests use a real Playwright Chromium browser to verify that each BSL
 * action correctly maps to the corresponding Playwright API. Requires
 * `npx playwright install chromium` to have been run.
 *
 * Timeout: 30s per test (browser operations are slow)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type Page, type BrowserContext } from 'playwright';
import fs from 'node:fs';
import { PlaywrightExecutor } from '../../packages/cli/src/executor.js';
import type { BSLStep } from '../../packages/core/src/types/bsl.js';

const DATA_HTML = `data:text/html,<html><body>
<h1>Test</h1>
<input name="email" type="text">
<button>Submit</button>
<select id="picker"><option value="a">A</option><option value="b">B</option></select>
</body></html>`;

describe('PlaywrightExecutor', { timeout: 30000 }, () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let executor: PlaywrightExecutor;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext();
    page = await context.newPage();
    await page.goto(DATA_HTML);
    executor = new PlaywrightExecutor(page, 10000);
  });

  afterAll(async () => {
    await context?.close();
    await browser?.close();
  });

  it('click action calls page.click', async () => {
    const step: BSLStep = { action: 'click', target: { hints: [], fallback_selector: 'button' } };
    // Should not throw
    await expect(executor.execute(step, 'button')).resolves.not.toThrow();
  });

  it('type action calls page.fill', async () => {
    const step: BSLStep = { action: 'type', value: 'test@example.com', target: { hints: [], fallback_selector: '[name="email"]' } };
    await executor.execute(step, '[name="email"]');
    const value = await page.inputValue('[name="email"]');
    expect(value).toBe('test@example.com');
  });

  it('select action calls page.selectOption', async () => {
    const step: BSLStep = { action: 'select', value: 'b', target: { hints: [], fallback_selector: '#picker' } };
    await executor.execute(step, '#picker');
    const value = await page.$eval('#picker', (el) => (el as HTMLSelectElement).value);
    expect(value).toBe('b');
  });

  it('navigate action calls page.goto', async () => {
    const step: BSLStep = { action: 'navigate', value: 'https://example.com' };
    await executor.execute(step, '');
    expect(page.url()).toContain('example.com');
    // Navigate back to data page for remaining tests
    await page.goto(DATA_HTML);
  });

  it('extract action returns text content', async () => {
    const step: BSLStep = {
      action: 'extract',
      target: { hints: [], fallback_selector: 'h1' },
      output: { variable: 'extracted.heading' },
    };
    const result = await executor.execute(step, 'h1');
    expect(result).toBe('Test');
  });

  it('screenshot action creates file', async () => {
    const screenshotPath = '/tmp/browserlet-executor-test-screenshot.png';
    // Clean up any previous test file
    if (fs.existsSync(screenshotPath)) {
      fs.unlinkSync(screenshotPath);
    }
    const step: BSLStep = { action: 'screenshot', value: screenshotPath };
    await executor.execute(step, '');
    expect(fs.existsSync(screenshotPath)).toBe(true);
    // Clean up
    fs.unlinkSync(screenshotPath);
  });

  it('wait_for action waits for visible element', async () => {
    const step: BSLStep = {
      action: 'wait_for',
      target: { hints: [], fallback_selector: 'h1' },
      timeout: '5s',
    };
    await expect(executor.execute(step, 'h1')).resolves.not.toThrow();
  });

  it('hover action hovers over element', async () => {
    const step: BSLStep = {
      action: 'hover',
      target: { hints: [], fallback_selector: 'button' },
    };
    await expect(executor.execute(step, 'button')).resolves.not.toThrow();
  });

  it('scroll action scrolls element into view', async () => {
    const step: BSLStep = {
      action: 'scroll',
      target: { hints: [], fallback_selector: 'h1' },
    };
    await expect(executor.execute(step, 'h1')).resolves.not.toThrow();
  });

  it('execute throws StepError on unknown action', async () => {
    const step = { action: 'unknown_action' as any } as BSLStep;
    await expect(executor.execute(step, 'h1')).rejects.toThrow(/Unknown action/);
  });

  it('type action without value throws StepError', async () => {
    const step: BSLStep = { action: 'type', target: { hints: [], fallback_selector: '[name="email"]' } };
    await expect(executor.execute(step, '[name="email"]')).rejects.toThrow(/type action requires a value/);
  });

  it('select action without value throws StepError', async () => {
    const step: BSLStep = { action: 'select', target: { hints: [], fallback_selector: '#picker' } };
    await expect(executor.execute(step, '#picker')).rejects.toThrow(/select action requires a value/);
  });
});

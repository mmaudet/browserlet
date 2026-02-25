#!/usr/bin/env node
/**
 * Automated screenshot capture for the Browserlet user guide.
 *
 * Launches Chromium with the extension loaded, walks through
 * the key UI flows (vault setup, credentials, recording, editor),
 * and saves PNG screenshots to docs/images/.
 *
 * Usage:
 *   node docs/take-screenshots.mjs
 *
 * Prerequisites:
 *   - Extension built: npm run build  (produces .output/chrome-mv3/)
 *   - Playwright installed (workspace dependency)
 */

import { chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const EXTENSION_PATH = path.join(ROOT, '.output', 'chrome-mv3');
const OUTPUT_DIR = path.join(ROOT, 'docs', 'images');
const MASTER_PASSWORD = 'DemoPassword2024!';

// Twake Drive BSL content for the editor screenshot
const TWAKE_BSL = fs.readFileSync(path.join(ROOT, 'twake-drive.bsl'), 'utf-8');

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Helpers ───────────────────────────────────────────────────────

async function screenshot(page, name) {
  const dest = path.join(OUTPUT_DIR, name);
  await page.screenshot({ path: dest });
  console.log(`  ✓ ${name}`);
}

async function getExtensionId(context) {
  let sw = context.serviceWorkers()[0];
  if (!sw) sw = await context.waitForEvent('serviceworker');
  return new URL(sw.url()).hostname;
}

// ─── Main ──────────────────────────────────────────────────────────

async function main() {
  // Validate extension build
  if (!fs.existsSync(path.join(EXTENSION_PATH, 'manifest.json'))) {
    console.error('Extension not built. Run `npm run build` first.');
    process.exit(1);
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'browserlet-ss-'));
  console.log(`Temp profile: ${userDataDir}\n`);

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-first-run',
      '--disable-default-apps',
    ],
  });

  try {
    const extId = await getExtensionId(context);
    console.log(`Extension ID: ${extId}\n`);
    const sidepanelUrl = `chrome-extension://${extId}/sidepanel.html`;

    // Open the sidepanel in a dedicated tab (side-panel-like viewport)
    const panel = await context.newPage();
    await panel.setViewportSize({ width: 400, height: 700 });
    await panel.goto(sidepanelUrl);
    await panel.waitForLoadState('networkidle');
    await delay(2000);

    // ── 1. Master password setup ────────────────────────────────
    // On first launch appState = 'needs_setup' → MasterPasswordSetup
    console.log('Phase 1: Vault setup');
    await screenshot(panel, 'ext-mot-de-passe-maitre.png');

    // Fill and submit the master password form
    const pwInputs = panel.locator('input[type="password"]');
    await pwInputs.nth(0).fill(MASTER_PASSWORD);
    await delay(300);
    // Screenshot with strength indicator filled
    await pwInputs.nth(1).fill(MASTER_PASSWORD);
    await delay(300);
    await panel.locator('button[type="submit"]').click();
    await delay(3000); // wait for vault creation + app transition to 'ready'

    // ── 2. Side panel main view (scripts list) ──────────────────
    console.log('Phase 2: Main view');
    await screenshot(panel, 'ext-sidepanel-ouvert.png');

    // ── 3. Credential management ────────────────────────────────
    console.log('Phase 3: Credentials');

    // Seed a mock credential via chrome.storage.local
    // (the list view only reads alias/username/url/dates, never decrypts)
    await panel.evaluate(async () => {
      const PASSWORDS_KEY = 'browserlet_passwords';
      const now = Date.now();
      await chrome.storage.local.set({
        [PASSWORDS_KEY]: [
          {
            id: 'pwd-demo-linagora',
            url: 'https://twake.linagora.com',
            username: 'mmaudet',
            encryptedPassword: 'demo-encrypted-placeholder',
            alias: 'LINAGORA',
            createdAt: now - 86400000,
            updatedAt: now,
          },
        ],
      });
    });

    // Navigate to Credentials tab (3rd nav button) & refresh
    await panel.locator('nav button:nth-child(3)').click();
    await delay(1500);

    // Screenshot: credential list with LINAGORA entry
    await screenshot(panel, 'ext-credential-liste.png');

    // Screenshot: simulate capture mode banner for "add credential"
    // Find the "Stored Credentials" text node and inject banner after its header container
    const bannerInjected = await panel.evaluate(() => {
      // Walk the DOM tree to find the element with exact text "Stored Credentials"
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (node.textContent?.trim() === 'Stored Credentials') {
          // Walk up to the header bar (the div with gray background)
          let container = node.parentElement;
          for (let i = 0; i < 5; i++) {
            if (!container) break;
            const bg = getComputedStyle(container).backgroundColor;
            if (bg === 'rgb(245, 245, 245)') {
              // Found the header bar - insert banner after it
              const banner = document.createElement('div');
              banner.style.cssText =
                'padding: 12px; background: #f3e5f5; border-bottom: 1px solid #ce93d8; display: flex; justify-content: space-between; align-items: center;';
              banner.innerHTML = `
                <div>
                  <div style="font-weight:500; color:#7b1fa2; display:flex; align-items:center; gap:6px;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
                         stroke="#7b1fa2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
                    </svg>
                    Mode Capture actif
                  </div>
                  <div style="font-size:12px; color:#666;">Saisissez vos identifiants sur la page de login, puis cliquez Arreter</div>
                </div>
                <button style="padding:6px 12px; background:#9c27b0; color:white; border:none; border-radius:4px; cursor:pointer; font-size:13px;">Arreter</button>
              `;
              container.parentElement.insertBefore(banner, container.nextSibling);
              return true;
            }
            container = container.parentElement;
          }
        }
      }
      return false;
    });
    if (!bannerInjected) {
      console.log('  ⚠ Could not inject capture banner');
    }
    await delay(500);
    await screenshot(panel, 'ext-credential-ajout.png');

    // ── 4. Recording view ───────────────────────────────────────
    console.log('Phase 4: Recording');

    // Navigate to Recording tab (2nd nav button)
    await panel.locator('nav button:nth-child(2)').click();
    await delay(1000);

    // Screenshot: idle recording view with "Start Recording" button
    await screenshot(panel, 'ext-enregistrement-start.png');

    // Simulate recording state in the UI for "stop" screenshot
    // The button text is in French: "Demarrer l'enregistrement" / status "Pret"
    await panel.evaluate(() => {
      // Find and update the recording button
      const buttons = Array.from(document.querySelectorAll('button'));
      const recBtn = buttons.find((b) =>
        b.textContent?.includes('enregistrement') || b.textContent?.includes('Recording')
      );
      if (recBtn) {
        recBtn.textContent = "Arreter l'enregistrement";
        recBtn.style.background = '#f44336';
      }
      // Update the status badge from "Pret"/"Idle" to "Enregistrement..."
      const allSpans = document.querySelectorAll('span, div');
      for (const el of allSpans) {
        const text = el.textContent?.trim();
        if ((text === 'Pret' || text === 'Idle') && el.children.length === 0) {
          el.textContent = 'Enregistrement...';
          // Also update parent container style if it has background
          const parent = el.closest('div[style]');
          if (parent && parent.style.background) {
            parent.style.background = '#ffebee';
            parent.style.color = '#c62828';
          }
        }
      }
    });
    await delay(300);
    await screenshot(panel, 'ext-enregistrement-stop.png');

    // ── 5. Recording overlay on a web page ──────────────────────
    console.log('Phase 5: Recording overlay');

    // Open the twake login page in a separate tab (wider viewport)
    const webPage = await context.newPage();
    await webPage.setViewportSize({ width: 1280, height: 800 });

    // Navigate to twake - just show the login page
    try {
      await webPage.goto('https://mmaudet-home.twake.linagora.com/', {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      });
    } catch {
      // If twake is unreachable, use a fallback page
      await webPage.goto('https://example.com', {
        waitUntil: 'domcontentloaded',
        timeout: 10000,
      });
    }
    await delay(2000);

    // Inject the recording indicator overlay (red "REC" badge)
    await webPage.evaluate(() => {
      // Keyframes
      const style = document.createElement('style');
      style.textContent = `
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `;
      document.head.appendChild(style);

      // Recording indicator badge
      const indicator = document.createElement('div');
      indicator.style.cssText = `
        position: fixed; top: 10px; right: 10px; z-index: 2147483647;
        display: flex; align-items: center; gap: 8px;
        padding: 8px 12px;
        background-color: rgba(244, 67, 54, 0.95);
        color: white;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 12px; font-weight: 600;
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        pointer-events: none;
      `;
      const dot = document.createElement('div');
      dot.style.cssText = `
        width: 8px; height: 8px;
        background-color: white; border-radius: 50%;
        animation: pulse 1.5s ease-in-out infinite;
      `;
      indicator.appendChild(dot);
      indicator.appendChild(document.createTextNode('REC'));
      document.body.appendChild(indicator);

      // Add a subtle blue highlight overlay on a form element (if any)
      const input = document.querySelector('input[type="email"], input[type="text"], input');
      if (input) {
        const rect = input.getBoundingClientRect();
        const highlight = document.createElement('div');
        highlight.style.cssText = `
          position: absolute; pointer-events: none; box-sizing: border-box;
          z-index: 2147483647; transition: all 0.1s ease-out;
          border: 2px solid rgba(66, 133, 244, 0.8);
          background-color: rgba(66, 133, 244, 0.1);
          border-radius: 2px;
          top: ${rect.top + window.scrollY}px;
          left: ${rect.left + window.scrollX}px;
          width: ${rect.width}px;
          height: ${rect.height}px;
        `;
        document.body.appendChild(highlight);
      }
    });
    await delay(500);
    await screenshot(webPage, 'ext-enregistrement-overlay.png');
    await webPage.close();

    // ── 6. BSL Editor ───────────────────────────────────────────
    console.log('Phase 6: BSL Editor');

    // Go back to the panel and seed a script with twake-drive.bsl content
    await panel.bringToFront();

    // Create a script in storage
    await panel.evaluate(async (bslContent) => {
      const SCRIPTS_KEY = 'browserlet_scripts';
      const now = Date.now();
      const script = {
        id: `script-twake-drive-${now}`,
        name: 'Twake Drive – LINAGORA folder',
        version: '1.0.0',
        content: bslContent,
        createdAt: now,
        updatedAt: now,
      };
      // Get existing scripts and add the new one
      const data = await chrome.storage.local.get(SCRIPTS_KEY);
      const scripts = data[SCRIPTS_KEY] || [];
      scripts.push(script);
      await chrome.storage.local.set({ [SCRIPTS_KEY]: scripts });
    }, TWAKE_BSL);

    // Navigate to Scripts list tab
    await panel.locator('nav button:nth-child(1)').click();
    await delay(1000);

    // Reload the page to pick up the new script
    await panel.reload();
    await delay(3000);

    // Find the Twake Drive script in the list and open its editor
    // The script row has action buttons; the pencil (edit) icon opens the editor
    const scriptName = panel.locator('text=Twake Drive');
    if (await scriptName.count() > 0) {
      // Each script row has buttons: Rename(T), Edit(pencil), Triggers(zap), History, Play, Delete
      // We need button index 1 (pencil/edit) within the script's row
      // The script name and buttons share a parent container
      // Use a more robust approach: find all buttons near the script name
      const row = scriptName.first().locator('xpath=ancestor::div[contains(@style,"border-bottom")]');
      if (await row.count() > 0) {
        // The edit button is the 2nd button (index 1) in the action buttons area
        const buttons = row.locator('button');
        const btnCount = await buttons.count();
        console.log(`  Found ${btnCount} buttons in script row`);
        // Click the pencil/edit button (usually 2nd button, index 1)
        if (btnCount >= 2) {
          await buttons.nth(1).click();
        }
      } else {
        // Fallback: double-click the script name
        await scriptName.first().dblclick();
      }
      await delay(3000); // wait for Monaco editor to load

      // Screenshot: BSL editor with twake-drive content
      await screenshot(panel, 'ext-bsl-editeur.png');

      // Screenshot: export button (same view - the Export button is in the top toolbar)
      await screenshot(panel, 'ext-export-bsl.png');
    } else {
      console.log('  ⚠ Could not find Twake Drive script in list, skipping editor screenshots');
    }

    // ── 7. CLI screenshots ──────────────────────────────────────
    console.log('Phase 7: CLI screenshots (skipped - requires terminal capture)');
    console.log('  ℹ cli-vault-init.png and cli-run-output.png need manual capture');

    console.log('\nDone! Screenshots saved to docs/images/');
  } finally {
    await context.close();
    // Clean up temp profile
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      /* ignore cleanup errors */
    }
  }
}

main().catch((err) => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});

import { defineConfig } from 'wxt';
import monacoEditorPluginModule from 'vite-plugin-monaco-editor';
import preact from '@preact/preset-vite';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Handle ESM/CJS interop - the package exports differently based on module system
const monacoEditorPlugin =
  (monacoEditorPluginModule as any).default || monacoEditorPluginModule;

/**
 * Post-build hook to extract Monaco inline script to external file.
 * Required for Manifest V3 CSP compliance (no inline scripts).
 */
function extractMonacoInlineScript(outputDir: string): void {
  const htmlPath = join(outputDir, 'sidepanel.html');

  try {
    let html = readFileSync(htmlPath, 'utf-8');

    // Match the Monaco inline script
    const inlineScriptRegex = /<script>(self\["MonacoEnvironment"\][\s\S]*?)<\/script>/;
    const match = html.match(inlineScriptRegex);

    if (match) {
      const scriptContent = match[1];

      // Write to external file
      const scriptPath = join(outputDir, 'monaco-env.js');
      writeFileSync(scriptPath, scriptContent, 'utf-8');

      // Replace inline script with external reference
      html = html.replace(inlineScriptRegex, '<script src="/monaco-env.js"></script>');
      writeFileSync(htmlPath, html, 'utf-8');

      console.log('[WXT] Extracted Monaco inline script to monaco-env.js');
    }
  } catch (error) {
    console.warn('[WXT] Could not extract Monaco inline script:', error);
  }
}

export default defineConfig({
  manifest: ({ browser }) => {
    const isFirefox = browser === 'firefox';

    // Base permissions (common to all browsers)
    const basePermissions = ['storage', 'unlimitedStorage', 'tabs', 'activeTab', 'notifications', 'alarms', 'idle'];

    // Chrome-specific permissions
    const chromePermissions = [...basePermissions, 'scripting', 'sidePanel'];

    // Firefox MV3 permissions (scripting now available)
    const firefoxPermissions = [...basePermissions, 'scripting'];

    return {
      name: '__MSG_appName__',
      description: '__MSG_appDescription__',
      default_locale: 'en',
      version: '0.1.0',
      ...(isFirefox ? {
        browser_specific_settings: {
          gecko: {
            id: 'browserlet@browserlet.dev',
            strict_min_version: '109.0',
          },
        },
      } : {}),
      permissions: isFirefox ? firefoxPermissions : chromePermissions,
      host_permissions: [
        '<all_urls>',  // Required for content script injection on any page
        'https://api.anthropic.com/*',
        'http://localhost:11434/*',
        'http://127.0.0.1:11434/*',
      ],
      // Browser-specific sidebar API
      ...(isFirefox ? {
        sidebar_action: {
          default_panel: 'sidepanel.html',
          default_title: 'Browserlet',
          default_icon: {
            16: 'icon/16.png',
            32: 'icon/32.png',
            48: 'icon/48.png',
            128: 'icon/128.png',
          },
        },
      } : {
        side_panel: {
          default_path: 'sidepanel.html',
        },
      }),
      action: {
        default_title: 'Open Browserlet',
      },
    };
  },
  hooks: {
    'build:done': (wxt) => {
      extractMonacoInlineScript(wxt.config.outDir);
    },
  },
  vite: () => ({
    plugins: [
      preact(),
      monacoEditorPlugin({
        languageWorkers: ['editorWorkerService'],
      }),
    ],
  }),
});

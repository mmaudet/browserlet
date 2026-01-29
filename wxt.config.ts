import { defineConfig } from 'wxt';
import monacoEditorPluginModule from 'vite-plugin-monaco-editor';

// Handle ESM/CJS interop - the package exports differently based on module system
const monacoEditorPlugin =
  (monacoEditorPluginModule as any).default || monacoEditorPluginModule;

export default defineConfig({
  manifest: {
    name: '__MSG_appName__',
    description: '__MSG_appDescription__',
    default_locale: 'en',
    version: '0.1.0',
    permissions: ['storage', 'sidePanel', 'tabs', 'activeTab'],
    host_permissions: [
      'https://api.anthropic.com/*',
      'http://localhost:11434/*',
      'http://127.0.0.1:11434/*',
    ],
    side_panel: {
      default_path: 'sidepanel.html',
    },
    action: {
      default_title: 'Open Browserlet',
    },
  },
  vite: () => ({
    plugins: [
      monacoEditorPlugin({
        languageWorkers: ['editorWorkerService'],
      }),
    ],
  }),
});

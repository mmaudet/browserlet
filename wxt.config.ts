import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'Browserlet',
    description: 'Web automation for legacy applications - resilient automation without recurring AI costs',
    version: '0.1.0',
    permissions: ['storage', 'sidePanel'],
    side_panel: {
      default_path: 'sidepanel.html',
    },
    action: {
      default_title: 'Open Browserlet',
    },
  },
});

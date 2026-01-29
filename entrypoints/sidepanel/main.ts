import van from 'vanjs-core';
import { currentView, navigateTo, goBack, editorScript } from './router';
import { loadScripts, selectedScript, selectScript } from './stores/scripts';
import { ScriptList } from './components/ScriptList';
import { ScriptEditor, disposeEditor } from './components/ScriptEditor';
import { RecordingView } from './components/RecordingView';
import { ExecutionView } from './components/ExecutionView';
import { ContextZone } from './components/ContextZone';
import { ImportButton, ExportButton } from './components/ImportExport';
import { saveScript } from '../../utils/storage/scripts';
import type { Script } from '../../utils/types';

const { div, button, span, nav } = van.tags;

// Navigation tabs
function NavTabs() {
  const tabs: Array<{ id: typeof currentView.val; label: string; icon: string }> = [
    { id: 'list', label: chrome.i18n.getMessage('scripts') || 'Scripts', icon: '📋' },
    { id: 'recording', label: chrome.i18n.getMessage('record') || 'Record', icon: '🔴' },
    { id: 'execution', label: chrome.i18n.getMessage('run') || 'Run', icon: '▶️' }
  ];

  return nav({
    style: 'display: flex; border-bottom: 1px solid #ddd; background: white;'
  },
    ...tabs.map(tab =>
      button({
        style: () => `flex: 1; padding: 12px 8px; border: none; background: none; cursor: pointer; font-size: 12px; display: flex; flex-direction: column; align-items: center; gap: 4px; ${
          currentView.val === tab.id || (currentView.val === 'editor' && tab.id === 'list')
            ? 'color: #4285f4; border-bottom: 2px solid #4285f4;'
            : 'color: #666;'
        }`,
        onclick: () => {
          if (currentView.val === 'editor') {
            disposeEditor();
          }
          navigateTo(tab.id);
        }
      },
        span({ style: 'font-size: 16px;' }, tab.icon),
        span(tab.label)
      )
    )
  );
}

// Create new script
async function createNewScript(): Promise<void> {
  const defaultContent = `name: New Script
version: "1.0.0"
description: ""
steps:
  - action: navigate
    url: "https://example.com"
`;

  const script = await saveScript({
    name: 'New Script',
    version: '1.0.0',
    content: defaultContent
  });

  await loadScripts();
  selectScript(script.id);
  navigateTo('editor', script);
}

// Main app component
function App() {
  return div({ style: 'display: flex; flex-direction: column; height: 100vh; background: #f5f5f5;' },
    // Header
    div({
      style: 'padding: 12px 16px; background: white; border-bottom: 1px solid #ddd; display: flex; justify-content: space-between; align-items: center;'
    },
      span({ style: 'font-weight: 600; font-size: 16px;' }, 'Browserlet'),
      div({ style: 'display: flex; gap: 8px;' },
        ImportButton({ onImport: (script) => navigateTo('editor', script) })
      )
    ),

    // Context zone
    div({ style: 'padding: 12px 16px 0;' },
      ContextZone()
    ),

    // Navigation
    NavTabs(),

    // Content area
    div({ style: 'flex: 1; overflow: hidden; display: flex; flex-direction: column;' },
      () => {
        const view = currentView.val;

        if (view === 'list') {
          return ScriptList({
            onScriptSelect: (script) => navigateTo('editor', script),
            onNewScript: createNewScript
          });
        }

        if (view === 'editor') {
          const script = editorScript.val;
          if (!script) {
            navigateTo('list');
            return div();
          }
          return div({ style: 'display: flex; flex-direction: column; height: 100%;' },
            // Editor toolbar
            div({
              style: 'display: flex; justify-content: space-between; padding: 8px 12px; background: white; border-bottom: 1px solid #ddd;'
            },
              button({
                style: 'background: none; border: none; cursor: pointer; font-size: 14px; color: #666;',
                onclick: () => {
                  disposeEditor();
                  goBack();
                }
              }, '← ' + (chrome.i18n.getMessage('back') || 'Back')),
              // Export button with reactive script getter
              () => {
                const currentScript = editorScript.val;
                return currentScript
                  ? div({ style: 'display: flex; gap: 8px;' }, ExportButton({ script: currentScript }))
                  : div();
              }
            ),
            // Editor
            div({ style: 'flex: 1;' },
              ScriptEditor({
                script,
                onSave: (updated) => {
                  // Update editorScript so export gets latest version
                  editorScript.val = updated;
                }
              })
            )
          );
        }

        if (view === 'recording') {
          return RecordingView();
        }

        if (view === 'execution') {
          return ExecutionView();
        }

        return div();
      }
    )
  );
}

// Initialize
async function init() {
  // Check service worker
  try {
    await chrome.runtime.sendMessage({ type: 'PING' });
  } catch (error) {
    console.error('Service worker not available:', error);
  }

  // Load scripts
  await loadScripts();

  // Mount app
  const root = document.getElementById('app');
  if (root) {
    van.add(root, App());
  }
}

init();

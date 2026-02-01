import { render } from 'preact';
import { signal } from '@preact/signals';
import { currentView, navigateTo, goBack, editorScript, ViewName } from './router';
import { loadScripts, selectScript } from './stores/scripts';
import { loadLLMConfig, llmConfigStore } from './stores/llmConfig';
import { loadPasswords, passwordStore, refreshVaultState } from './stores/passwords';
import { ScriptList } from './components/ScriptList';
import { ScriptEditor, disposeEditor } from './components/ScriptEditor';
import { RecordingView } from './components/RecordingView';
import { LLMSettings } from './components/LLMSettings';
import { ContextZone } from './components/ContextZone';
import { ExportButton } from './components/ImportExport';
import { saveScript } from '../../utils/storage/scripts';
import type { Script } from '../../utils/types';
import { SuggestedScripts } from './components/SuggestedScripts';
import { suggestedScriptIds, loadTriggers } from './stores/triggers';
import { CredentialManager } from './components/CredentialManager';
import { startExecution } from './stores/execution';

// App initialization state
const appState = signal<'loading' | 'needs_setup' | 'needs_unlock' | 'ready'>('loading');

// Bottom action bar component
function BottomActionBar() {
  const actions: Array<{ id: ViewName; icon: string; labelKey: string; iconSize?: string }> = [
    { id: 'list', icon: '📋', labelKey: 'scripts' },
    { id: 'recording', icon: '🔴', labelKey: 'record' },
    { id: 'credentials', icon: '🔐', labelKey: 'credentials' },
    { id: 'settings', icon: '⚙️', labelKey: 'settings' }
  ];

  return (
    <nav style={{
      display: 'flex',
      borderTop: '1px solid #ddd',
      background: 'white',
      padding: '8px 0'
    }}>
      {actions.map(action => (
        <button
          key={action.id}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            padding: '8px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: currentView.value === action.id ? '#4285f4' : '#666',
            fontSize: '12px'
          }}
          onClick={() => navigateTo(action.id)}
        >
          <span style={{ fontSize: '24px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{action.icon}</span>
          <span>{chrome.i18n.getMessage(action.labelKey) || action.labelKey}</span>
        </button>
      ))}
    </nav>
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

// Content router
function ContentRouter() {
  const view = currentView.value;

  if (view === 'list') {
    return (
      <ScriptList
        onScriptSelect={(script) => navigateTo('editor', script)}
        onNewScript={createNewScript}
      />
    );
  }

  if (view === 'editor') {
    const script = editorScript.value;
    if (!script) {
      navigateTo('list');
      return <div />;
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Editor toolbar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '8px 12px',
          background: 'white',
          borderBottom: '1px solid #ddd'
        }}>
          <button
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              color: '#666'
            }}
            onClick={() => {
              disposeEditor();
              goBack();
            }}
          >
            ← {chrome.i18n.getMessage('back') || 'Back'}
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            {editorScript.value && <ExportButton script={editorScript.value} />}
          </div>
        </div>
        {/* Editor */}
        <div style={{ flex: 1 }}>
          <ScriptEditor
            script={script}
            onSave={(updated) => {
              editorScript.value = updated;
            }}
          />
        </div>
      </div>
    );
  }

  if (view === 'recording') {
    return <RecordingView />;
  }

  if (view === 'settings') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Settings toolbar with back button */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-start',
          padding: '8px 12px',
          background: 'white',
          borderBottom: '1px solid #ddd'
        }}>
          <button
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              color: '#666'
            }}
            onClick={() => goBack()}
          >
            ← {chrome.i18n.getMessage('back') || 'Back'}
          </button>
        </div>
        {/* Settings content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <LLMSettings />
        </div>
      </div>
    );
  }

  if (view === 'credentials') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Credentials toolbar with back button */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-start',
          padding: '8px 12px',
          background: 'white',
          borderBottom: '1px solid #ddd'
        }}>
          <button
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              color: '#666'
            }}
            onClick={() => goBack()}
          >
            ← {chrome.i18n.getMessage('back') || 'Back'}
          </button>
        </div>
        {/* Credentials content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <CredentialManager />
        </div>
      </div>
    );
  }

  return <div />;
}

// Vault unlock/setup handler - called when master password is set up or vault is unlocked
async function handleVaultReady(): Promise<void> {
  console.log('[Browserlet Sidepanel] Vault ready, loading app data...');
  await refreshVaultState();
  await loadAppData();
  appState.value = 'ready';
}

// Main app component
function App() {
  const state = appState.value;

  // Loading state
  if (state === 'loading') {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#f5f5f5'
      }}>
        <div style={{ fontSize: '24px', marginBottom: '16px' }}>🔐</div>
        <div style={{ color: '#666' }}>Chargement...</div>
      </div>
    );
  }

  // Needs setup or unlock - show CredentialManager directly
  if (state === 'needs_setup' || state === 'needs_unlock') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f5f5f5' }}>
        {/* Header */}
        <div style={{
          padding: '12px 16px',
          background: 'white',
          borderBottom: '1px solid #ddd',
          textAlign: 'center'
        }}>
          <span style={{ fontWeight: 600, fontSize: '16px' }}>Browserlet</span>
        </div>
        {/* Info message */}
        <div style={{
          padding: '16px',
          background: state === 'needs_setup' ? '#e3f2fd' : '#fff3e0',
          borderBottom: '1px solid #ddd',
          textAlign: 'center'
        }}>
          {state === 'needs_setup' ? (
            <div>
              <div style={{ fontWeight: 500, marginBottom: '4px' }}>
                Bienvenue dans Browserlet !
              </div>
              <div style={{ fontSize: '13px', color: '#666' }}>
                Créez un mot de passe principal pour sécuriser vos identifiants et clés API.
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontWeight: 500, marginBottom: '4px' }}>
                Vault verrouillé
              </div>
              <div style={{ fontSize: '13px', color: '#666' }}>
                Saisissez votre mot de passe principal pour accéder à vos identifiants.
              </div>
            </div>
          )}
        </div>
        {/* Credential Manager for setup/unlock */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <CredentialManager onVaultReady={handleVaultReady} />
        </div>
      </div>
    );
  }

  // Ready state - full app
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f5f5f5' }}>
      {/* Context zone en haut */}
      <div style={{ padding: '12px 16px 0' }}>
        <ContextZone />
      </div>

      {/* Suggested scripts (contextual triggers) */}
      {suggestedScriptIds.value.length > 0 && (
        <div style={{
          padding: '8px 16px',
          background: '#e3f2fd',
          borderBottom: '1px solid #90caf9'
        }}>
          <SuggestedScripts
            onRunScript={(script) => {
              startExecution(script);
            }}
          />
        </div>
      )}

      {/* Content area */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <ContentRouter />
      </div>

      {/* Bottom action bar - toujours visible pour navigation rapide */}
      <BottomActionBar />
    </div>
  );
}

// Initialize
async function init() {
  console.log('[Browserlet Sidepanel] init() started');

  // Check service worker
  try {
    await chrome.runtime.sendMessage({ type: 'PING' });
    console.log('[Browserlet Sidepanel] Service worker is available');
  } catch (error) {
    console.error('Service worker not available:', error);
  }

  // Mount app first (shows loading state)
  const root = document.getElementById('app');
  if (root) {
    render(<App />, root);
  }

  // Check vault state FIRST - this determines if we need setup/unlock
  await loadPasswords();
  const vaultState = passwordStore.vaultState.value;
  console.log('[Browserlet Sidepanel] Vault state:', vaultState);

  if (vaultState.needsSetup) {
    // First time - need to create master password
    console.log('[Browserlet Sidepanel] Master password not set up, showing onboarding');
    appState.value = 'needs_setup';
    return; // Don't load other data until setup is complete
  }

  if (vaultState.isLocked) {
    // Master password exists but vault is locked
    console.log('[Browserlet Sidepanel] Vault is locked, prompting for unlock');
    appState.value = 'needs_unlock';
    return; // Don't load other data until unlocked
  }

  // Vault is unlocked - load everything
  await loadAppData();
  appState.value = 'ready';
}

// Load app data after vault is unlocked
async function loadAppData() {
  // Load scripts
  await loadScripts();
  console.log('[Browserlet Sidepanel] Scripts loaded');

  // Load triggers for context-aware suggestions
  console.log('[Browserlet Sidepanel] Loading triggers...');
  await loadTriggers();
  console.log('[Browserlet Sidepanel] Triggers loaded, suggestedScriptIds:', suggestedScriptIds.value);

  // Load LLM configuration from storage (can now decrypt with unlocked vault)
  try {
    await loadLLMConfig();
    if (llmConfigStore.needsApiKey.value) {
      console.log('LLM API key needs re-entry');
    } else {
      console.log('[Browserlet Sidepanel] LLM config loaded successfully');
    }
  } catch (error) {
    console.error('Failed to load LLM config:', error);
  }
}

init();

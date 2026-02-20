import '../../utils/firefoxPolyfill';
import { render } from 'preact';
import { signal } from '@preact/signals';
import { ArrowLeft, Loader2, CheckCircle } from 'lucide-preact';
import { currentView, navigateTo, goBack, editorScript } from './router';
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
import { ActionBar } from './components/ActionBar';
import { startExecution, showCompletionModal, completedScriptName } from './stores/execution';
import { repairTarget } from './stores/repair';
import { DiagnosticRepairPanel } from './components/DiagnosticRepairPanel';

// App initialization state
const appState = signal<'loading' | 'needs_setup' | 'needs_unlock' | 'ready'>('loading');

// Execution completion modal
function CompletionModal() {
  if (!showCompletionModal.value) return null;

  const handleClose = () => {
    showCompletionModal.value = false;
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000
      }}
      onClick={handleClose}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '300px',
          width: 'calc(100% - 48px)',
          textAlign: 'center',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
        }}
        onClick={(e: Event) => e.stopPropagation()}
      >
        <div style={{
          width: '56px',
          height: '56px',
          background: '#e8f5e9',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px'
        }}>
          <CheckCircle size={32} color="#4caf50" />
        </div>
        <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 600, color: '#333' }}>
          {chrome.i18n.getMessage('executionSuccess') || 'Success'}
        </h3>
        <p style={{ margin: '0 0 20px', fontSize: '14px', color: '#666' }}>
          {completedScriptName.value && (
            <span style={{ fontWeight: 500 }}>{completedScriptName.value}</span>
          )}
          <br />
          {chrome.i18n.getMessage('scriptCompletedSuccessfully') || 'Script completed successfully'}
        </p>
        <button
          onClick={handleClose}
          style={{
            width: '100%',
            padding: '12px',
            background: '#4caf50',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '15px',
            fontWeight: 500,
            cursor: 'pointer'
          }}
        >
          OK
        </button>
      </div>
    </div>
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
        onImport={(script) => navigateTo('editor', script)}
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
              fontSize: '13px',
              color: '#007AFF',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              borderRadius: '6px',
              transition: 'background 0.15s ease'
            }}
            onClick={() => {
              disposeEditor();
              goBack();
            }}
          >
            <ArrowLeft size={16} strokeWidth={2} />
            {chrome.i18n.getMessage('back') || 'Back'}
          </button>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
              fontSize: '13px',
              color: '#007AFF',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              borderRadius: '6px',
              transition: 'background 0.15s ease'
            }}
            onClick={() => goBack()}
          >
            <ArrowLeft size={16} strokeWidth={2} />
            {chrome.i18n.getMessage('back') || 'Back'}
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
              fontSize: '13px',
              color: '#007AFF',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              borderRadius: '6px',
              transition: 'background 0.15s ease'
            }}
            onClick={() => goBack()}
          >
            <ArrowLeft size={16} strokeWidth={2} />
            {chrome.i18n.getMessage('back') || 'Back'}
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
        <div style={{ marginBottom: '16px', color: '#8e8e93' }}>
          <Loader2 size={32} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
        </div>
        <div style={{ color: '#8e8e93', fontSize: '14px' }}>Chargement...</div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
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
      {/* Context zone at very top */}
      <div style={{ padding: '12px 16px', background: 'white', borderBottom: '1px solid #ddd' }}>
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

      {/* Main content area - scripts list or other views */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <ContentRouter />
      </div>

      {/* Fixed bottom action bar */}
      <ActionBar currentView={currentView.value} />

      {/* Execution completion modal */}
      <CompletionModal />

      {/* Diagnostic repair panel overlay */}
      {repairTarget.value && <DiagnosticRepairPanel />}
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

/**
 * SuggestedScripts component displays context-matched scripts
 * Shows scripts that match the current page context
 */

import { useEffect } from 'preact/hooks';
import { signal, effect } from '@preact/signals';
import type { Script } from '../../../utils/types';
import { getScripts } from '../../../utils/storage/scripts';
import { suggestedScriptIds, clearSuggestions } from '../stores/triggers';

// Helper to get i18n messages
const msg = (key: string): string => chrome.i18n.getMessage(key) || key;

interface SuggestedScriptsProps {
  onRunScript: (script: Script) => void;
}

// Module-level state for scripts
const scripts = signal<Script[]>([]);
const isLoading = signal(false);

/**
 * SuggestedScripts component
 */
export function SuggestedScripts({ onRunScript }: SuggestedScriptsProps) {
  console.log('[Browserlet SuggestedScripts] Component initialized, initial suggestedScriptIds:', suggestedScriptIds.value);

  // Load suggested scripts when IDs change using effect
  useEffect(() => {
    const dispose = effect(async () => {
      const ids = suggestedScriptIds.value;
      console.log('[Browserlet SuggestedScripts] effect triggered, ids:', ids);
      if (ids.length === 0) {
        scripts.value = [];
        return;
      }

      isLoading.value = true;
      try {
        const allScripts = await getScripts();
        scripts.value = allScripts.filter(s => ids.includes(s.id));
        console.log('[Browserlet SuggestedScripts] Loaded scripts:', scripts.value.map(s => s.name));
      } finally {
        isLoading.value = false;
      }
    });

    return () => dispose();
  }, []);

  // Load on mount - check session storage for current tab
  async function loadSuggestions(): Promise<void> {
    console.log('[Browserlet SuggestedScripts] loadSuggestions called');
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_SUGGESTED_SCRIPTS'
      });
      console.log('[Browserlet SuggestedScripts] GET_SUGGESTED_SCRIPTS response:', response);
      if (response.success && response.data) {
        suggestedScriptIds.value = response.data as string[];
      }
    } catch (error) {
      console.warn('[Browserlet SuggestedScripts] loadSuggestions error:', error);
    }
  }

  // Initial load and tab change listener
  useEffect(() => {
    loadSuggestions();

    const handleTabActivated = () => {
      console.log('[Browserlet SuggestedScripts] Tab activated, reloading suggestions');
      loadSuggestions();
    };

    chrome.tabs.onActivated.addListener(handleTabActivated);

    return () => {
      chrome.tabs.onActivated.removeListener(handleTabActivated);
    };
  }, []);

  const handleDismiss = () => {
    clearSuggestions();
    // Clear badge for current tab
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs[0]?.id) {
        chrome.action.setBadgeText({ text: '', tabId: tabs[0].id });
      }
    });
  };

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px'
      }}>
        <h3 style={{
          fontSize: '14px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          margin: 0
        }}>
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#3b82f6',
            animation: 'pulse 2s infinite'
          }} />
          {msg('suggestedScriptsTitle') || 'Suggested Scripts'}
        </h3>
        {scripts.value.length > 0 && (
          <button
            style={{
              fontSize: '12px',
              color: '#6b7280',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 8px'
            }}
            onClick={handleDismiss}
          >
            Dismiss
          </button>
        )}
      </div>

      {/* Content */}
      {isLoading.value ? (
        <div style={{ color: '#6b7280', fontSize: '14px', padding: '8px 0' }}>
          Loading...
        </div>
      ) : scripts.value.length === 0 ? (
        <div style={{ color: '#9ca3af', fontSize: '14px', padding: '8px 0' }}>
          {msg('suggestedScriptsEmpty') || 'No scripts suggested for this page'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {scripts.value.map(script => (
            <div
              key={script.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px',
                background: '#eff6ff',
                borderRadius: '8px',
                border: '1px solid #bfdbfe'
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontWeight: 500,
                  fontSize: '14px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {script.name}
                </div>
                {script.description && (
                  <div style={{
                    fontSize: '12px',
                    color: '#6b7280',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {script.description}
                  </div>
                )}
              </div>
              <button
                style={{
                  marginLeft: '8px',
                  padding: '6px 12px',
                  background: '#3b82f6',
                  color: 'white',
                  fontSize: '14px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
                onClick={() => onRunScript(script)}
              >
                {msg('suggestedScriptRun') || 'Run'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Badge indicator for when suggestions are available
 * Can be added to navigation/header
 */
export function SuggestionBadge() {
  if (suggestedScriptIds.value.length === 0) {
    return null;
  }

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '20px',
      height: '20px',
      fontSize: '12px',
      fontWeight: 'bold',
      color: 'white',
      background: '#3b82f6',
      borderRadius: '50%'
    }}>
      {String(suggestedScriptIds.value.length)}
    </span>
  );
}

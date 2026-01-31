/**
 * SuggestedScripts component displays context-matched scripts
 * Shows scripts that match the current page context
 */

import van from 'vanjs-core';
import type { Script } from '../../../utils/types';
import { getScripts } from '../../../utils/storage/scripts';
import { suggestedScriptIds, clearSuggestions } from '../stores/triggers';

const { div, h3, p, button, span } = van.tags;

// Helper to get i18n messages
const msg = (key: string): string => chrome.i18n.getMessage(key) || key;

interface SuggestedScriptsProps {
  onRunScript: (script: Script) => void;
}

/**
 * SuggestedScripts component
 */
export function SuggestedScripts({ onRunScript }: SuggestedScriptsProps) {
  // State
  const scripts = van.state<Script[]>([]);
  const isLoading = van.state(false);

  console.log('[Browserlet SuggestedScripts] Component initialized, initial suggestedScriptIds:', suggestedScriptIds.val);

  // Load suggested scripts when IDs change
  van.derive(async () => {
    const ids = suggestedScriptIds.val;
    console.log('[Browserlet SuggestedScripts] van.derive triggered, ids:', ids);
    if (ids.length === 0) {
      scripts.val = [];
      return;
    }

    isLoading.val = true;
    try {
      const allScripts = await getScripts();
      scripts.val = allScripts.filter(s => ids.includes(s.id));
      console.log('[Browserlet SuggestedScripts] Loaded scripts:', scripts.val.map(s => s.name));
    } finally {
      isLoading.val = false;
    }
  });

  // Load on mount - check session storage for current tab
  async function loadSuggestions(): Promise<void> {
    console.log('[Browserlet SuggestedScripts] loadSuggestions called');
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_SUGGESTED_SCRIPTS'
      });
      console.log('[Browserlet SuggestedScripts] GET_SUGGESTED_SCRIPTS response:', response);
      if (response.success && response.data) {
        suggestedScriptIds.val = response.data as string[];
      }
    } catch (error) {
      console.warn('[Browserlet SuggestedScripts] loadSuggestions error:', error);
    }
  }

  // Initial load
  loadSuggestions();

  // Listen for tab changes to refresh suggestions
  chrome.tabs.onActivated.addListener(() => {
    console.log('[Browserlet SuggestedScripts] Tab activated, reloading suggestions');
    loadSuggestions();
  });

  return div({ style: 'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;' },
    // Header
    div({ style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;' },
      h3({ style: 'font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 8px; margin: 0;' },
        span({ style: 'width: 8px; height: 8px; border-radius: 50%; background: #3b82f6; animation: pulse 2s infinite;' }),
        msg('suggestedScriptsTitle') || 'Suggested Scripts'
      ),
      () => scripts.val.length > 0
        ? button({
            style: 'font-size: 12px; color: #6b7280; background: none; border: none; cursor: pointer; padding: 4px 8px;',
            onclick: () => {
              clearSuggestions();
              // Clear badge for current tab
              chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
                if (tabs[0]?.id) {
                  chrome.action.setBadgeText({ text: '', tabId: tabs[0].id });
                }
              });
            }
          }, 'Dismiss')
        : div()
    ),

    // Content
    () => {
      if (isLoading.val) {
        return div({ style: 'color: #6b7280; font-size: 14px; padding: 8px 0;' }, 'Loading...');
      }

      if (scripts.val.length === 0) {
        return div({ style: 'color: #9ca3af; font-size: 14px; padding: 8px 0;' },
          msg('suggestedScriptsEmpty') || 'No scripts suggested for this page');
      }

      return div({ style: 'display: flex; flex-direction: column; gap: 8px;' },
        ...scripts.val.map(script =>
          div({ style: 'display: flex; align-items: center; justify-content: space-between; padding: 12px; background: #eff6ff; border-radius: 8px; border: 1px solid #bfdbfe;' },
            div({ style: 'flex: 1; min-width: 0;' },
              div({ style: 'font-weight: 500; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;' }, script.name),
              script.description
                ? div({ style: 'font-size: 12px; color: #6b7280; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;' }, script.description)
                : div()
            ),
            button({
              style: 'margin-left: 8px; padding: 6px 12px; background: #3b82f6; color: white; font-size: 14px; border-radius: 6px; border: none; cursor: pointer; flex-shrink: 0;',
              onclick: () => onRunScript(script)
            }, msg('suggestedScriptRun') || 'Run')
          )
        )
      );
    }
  );
}

/**
 * Badge indicator for when suggestions are available
 * Can be added to navigation/header
 */
export function SuggestionBadge() {
  return () => suggestedScriptIds.val.length > 0
    ? span({
        style: 'display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; font-size: 12px; font-weight: bold; color: white; background: #3b82f6; border-radius: 50%;'
      }, String(suggestedScriptIds.val.length))
    : div();
}

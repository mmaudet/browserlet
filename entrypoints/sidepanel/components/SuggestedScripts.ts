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

  // Load suggested scripts when IDs change
  van.derive(async () => {
    const ids = suggestedScriptIds.val;
    if (ids.length === 0) {
      scripts.val = [];
      return;
    }

    isLoading.val = true;
    try {
      const allScripts = await getScripts();
      scripts.val = allScripts.filter(s => ids.includes(s.id));
    } finally {
      isLoading.val = false;
    }
  });

  // Load on mount - check session storage for current tab
  async function loadSuggestions(): Promise<void> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_SUGGESTED_SCRIPTS'
      });
      if (response.success && response.data) {
        suggestedScriptIds.val = response.data as string[];
      }
    } catch {
      // Ignore errors
    }
  }

  // Initial load
  loadSuggestions();

  // Listen for tab changes to refresh suggestions
  chrome.tabs.onActivated.addListener(() => {
    loadSuggestions();
  });

  return div({ class: 'suggested-scripts' },
    // Header
    div({ class: 'flex justify-between items-center mb-3' },
      h3({ class: 'text-sm font-semibold flex items-center gap-2' },
        span({ class: 'w-2 h-2 rounded-full bg-blue-500 animate-pulse' }),
        msg('suggestedScriptsTitle')
      ),
      () => scripts.val.length > 0
        ? button({
            class: 'text-xs text-gray-500 hover:text-gray-700',
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
        : null
    ),

    // Content
    () => isLoading.val
      ? div({ class: 'text-gray-500 text-sm py-2' }, 'Loading...')
      : scripts.val.length === 0
        ? div({ class: 'text-gray-400 text-sm py-2' }, msg('suggestedScriptsEmpty'))
        : div({ class: 'space-y-2' },
            ...scripts.val.map(script =>
              div({ class: 'flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100' },
                div({ class: 'flex-1 min-w-0' },
                  div({ class: 'font-medium text-sm truncate' }, script.name),
                  script.description
                    ? div({ class: 'text-xs text-gray-500 truncate' }, script.description)
                    : null
                ),
                button({
                  class: 'ml-2 px-3 py-1.5 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 flex-shrink-0',
                  onclick: () => onRunScript(script)
                }, msg('suggestedScriptRun'))
              )
            )
          )
  );
}

/**
 * Badge indicator for when suggestions are available
 * Can be added to navigation/header
 */
export function SuggestionBadge() {
  return () => suggestedScriptIds.val.length > 0
    ? span({
        class: 'inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-blue-500 rounded-full'
      }, String(suggestedScriptIds.val.length))
    : null;
}

import van from 'vanjs-core';
import type { Script } from '../../../utils/types';
import { filteredScripts, searchTerm, isLoading, selectScript, selectedScriptId } from '../stores/scripts';
import { startExecution } from '../stores/execution';
import { navigateTo } from '../router';
import { TriggerConfig } from './TriggerConfig';

const { div, input, span, button } = van.tags;

interface ScriptListProps {
  onScriptSelect?: (script: Script) => void;
  onNewScript?: () => void;
}

function ScriptItem({ script, isSelected, onSelect, onRun, onConfigureTriggers }: {
  script: Script;
  isSelected: boolean;
  onSelect: () => void;
  onRun: () => void;
  onConfigureTriggers: () => void;
}) {
  return div({
    class: () => `script-item ${isSelected ? 'selected' : ''}`,
    style: `
      padding: 12px;
      border-bottom: 1px solid #f0f0f0;
      cursor: pointer;
      background: ${isSelected ? '#e3f2fd' : 'white'};
      transition: background 0.15s;
    `
  },
    div({ style: 'display: flex; justify-content: space-between; align-items: center;' },
      div({
        style: 'flex: 1; min-width: 0;',
        onclick: onSelect
      },
        div({ style: 'display: flex; justify-content: space-between; align-items: flex-start;' },
          span({ style: 'font-weight: 500; color: #333;' }, script.name),
          script.target_app ? span({
            style: 'font-size: 10px; background: #e0e0e0; padding: 2px 6px; border-radius: 4px; color: #666;'
          }, script.target_app) : ''
        )
      ),
      div({ style: 'display: flex; gap: 4px; align-items: center;' },
        button({
          class: 'p-1 text-gray-400 hover:text-gray-600',
          style: 'background: none; border: none; cursor: pointer; font-size: 18px; padding: 4px 8px; color: #666;',
          title: chrome.i18n.getMessage('configureTriggers') || 'Configure triggers',
          onclick: (e: Event) => {
            e.stopPropagation();
            onConfigureTriggers();
          }
        }, '\u26A1'), // Lightning bolt emoji
        button({
          onclick: (e: Event) => {
            e.stopPropagation();
            onRun();
          },
          style: 'padding: 6px 12px; background: #4caf50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;',
          title: chrome.i18n.getMessage('runScript') || 'Run Script'
        }, '▶')
      )
    ),
    script.description ? div({
      style: 'font-size: 12px; color: #666; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;'
    }, script.description) : '',
    script.tags && script.tags.length > 0 ? div({
      style: 'margin-top: 6px; display: flex; gap: 4px; flex-wrap: wrap;'
    },
      ...script.tags.map(tag =>
        span({
          style: 'font-size: 10px; background: #f5f5f5; padding: 2px 6px; border-radius: 3px; color: #888;'
        }, tag)
      )
    ) : ''
  );
}

export function ScriptList({ onScriptSelect, onNewScript }: ScriptListProps = {}) {
  const showTriggerConfig = van.state<string | null>(null);

  return div({ class: 'script-list-container', style: 'display: flex; flex-direction: column; height: 100%;' },
    // Search header
    div({ style: 'padding: 12px; background: #f5f5f5; border-bottom: 1px solid #ddd;' },
      div({ style: 'display: flex; gap: 8px; margin-bottom: 8px;' },
        input({
          type: 'text',
          placeholder: chrome.i18n.getMessage('searchPlaceholder') || 'Search scripts...',
          value: searchTerm.val,
          oninput: (e: Event) => { searchTerm.val = (e.target as HTMLInputElement).value; },
          style: 'flex: 1; padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px;'
        }),
        onNewScript ? button({
          onclick: onNewScript,
          style: 'padding: 8px 12px; background: #4285f4; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 20px; line-height: 1;',
          title: chrome.i18n.getMessage('newScript') || 'New Script'
        }, '+') : ''
      ),
      div({ style: 'font-size: 12px; color: #666;' },
        () => `${filteredScripts.val.length} ${chrome.i18n.getMessage('scripts') || 'scripts'}`
      )
    ),

    // Script list
    div({ style: 'flex: 1; overflow-y: auto;' },
      () => {
        if (isLoading.val) {
          return div({ style: 'padding: 24px; text-align: center; color: #999;' },
            chrome.i18n.getMessage('loading') || 'Loading...'
          );
        }

        const scripts = filteredScripts.val;
        if (scripts.length === 0) {
          return div({ style: 'padding: 24px; text-align: center; color: #999;' },
            searchTerm.val
              ? chrome.i18n.getMessage('noResults') || 'No scripts found'
              : chrome.i18n.getMessage('noScripts') || 'No scripts yet. Create one to get started!'
          );
        }

        return div(
          ...scripts.map(script =>
            ScriptItem({
              script,
              isSelected: selectedScriptId.val === script.id,
              onSelect: () => {
                selectScript(script.id);
                onScriptSelect?.(script);
              },
              onRun: () => {
                startExecution(script);
                navigateTo('execution');
              },
              onConfigureTriggers: () => {
                showTriggerConfig.val = script.id;
              }
            })
          )
        );
      }
    ),

    // Trigger config modal
    () => showTriggerConfig.val
      ? div({
          class: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50',
          style: 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 50;',
          onclick: () => { showTriggerConfig.val = null; }
        },
          div({
            class: 'bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto',
            style: 'background: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); max-width: 28rem; width: 100%; max-height: 80vh; overflow-y: auto;',
            onclick: (e: Event) => e.stopPropagation()
          },
            TriggerConfig({
              scriptId: showTriggerConfig.val,
              onClose: () => { showTriggerConfig.val = null; }
            })
          )
        )
      : null
  );
}

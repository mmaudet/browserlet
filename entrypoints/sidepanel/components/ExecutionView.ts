import van from 'vanjs-core';
import { Parser } from '@json2csv/plainjs';
import {
  isExecuting, currentScript, currentStep, totalSteps,
  progressPercent, executionStatus, executionResults, executionError,
  stopExecution, resetExecution
} from '../stores/execution';

const { div, button, span, pre } = van.tags;

export function ExecutionView() {
  const copySuccess = van.state<string | null>(null);

  const showCopySuccess = (message: string) => {
    copySuccess.val = message;
    setTimeout(() => { copySuccess.val = null; }, 2000);
  };

  const copyAsJSON = async () => {
    try {
      const json = JSON.stringify(executionResults.val, null, 2);
      await navigator.clipboard.writeText(json);
      showCopySuccess(chrome.i18n.getMessage('copiedToClipboard') || 'Copied to clipboard');
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  const copyAsCSV = async () => {
    try {
      const results = executionResults.val;
      if (results.length === 0) {
        showCopySuccess(chrome.i18n.getMessage('noScriptsFound') || 'No results to copy');
        return;
      }

      // Convert to array of objects if needed
      const data = results.map((r, i) =>
        typeof r === 'object' && r !== null
          ? r as Record<string, unknown>
          : { index: i, value: r }
      );

      const parser = new Parser();
      const csv = parser.parse(data as Record<string, unknown>[]);
      await navigator.clipboard.writeText(csv);
      showCopySuccess(chrome.i18n.getMessage('copiedToClipboard') || 'Copied to clipboard');
    } catch (error) {
      console.error('CSV conversion failed:', error);
    }
  };

  return div({ class: 'execution-view', style: 'padding: 16px;' },
    // Header
    div({ style: 'margin-bottom: 16px;' },
      span({ style: 'font-weight: 500; font-size: 16px;' },
        chrome.i18n.getMessage('executionTitle') || 'Execution'
      )
    ),

    // Idle state - show instructions
    () => executionStatus.val === 'idle' && !isExecuting.val ? div({
      style: 'text-align: center; padding: 40px 20px; color: #666;'
    },
      div({ style: 'font-size: 48px; margin-bottom: 16px;' }, '▶️'),
      div({ style: 'font-size: 14px; margin-bottom: 8px;' },
        chrome.i18n.getMessage('noExecution') || 'No execution in progress'
      ),
      div({ style: 'font-size: 12px; color: #999;' },
        chrome.i18n.getMessage('executionHint') || 'Select a script and click "Run" to execute it'
      )
    ) : null,

    // Active execution header
    () => currentScript.val && executionStatus.val !== 'idle'
      ? div({ style: 'margin-bottom: 16px;' },
          div(
            span({ style: 'font-weight: 500; color: #333;' }, currentScript.val.name),
            span({ style: 'margin-left: 8px; font-size: 12px; color: #666;' },
              () => `${chrome.i18n.getMessage('executionStep', [String(currentStep.val), String(totalSteps.val)]) || `Step ${currentStep.val} / ${totalSteps.val}`}`
            )
          )
        )
      : null,

    // Progress bar
    () => isExecuting.val || executionStatus.val !== 'idle' ? div({
      style: 'margin-bottom: 16px;'
    },
      div({
        style: 'height: 8px; background: #e0e0e0; border-radius: 4px; overflow: hidden;'
      },
        div({
          style: () => `height: 100%; background: ${executionStatus.val === 'failed' ? '#f44336' : '#4caf50'}; width: ${progressPercent.val}%; transition: width 0.3s;`
        })
      ),
      div({ style: 'display: flex; justify-content: space-between; margin-top: 4px; font-size: 12px; color: #666;' },
        span(() => {
          const status = executionStatus.val;
          if (status === 'running') return chrome.i18n.getMessage('executionRunning') || 'Running...';
          if (status === 'completed') return chrome.i18n.getMessage('executionComplete') || 'Completed';
          if (status === 'failed') return chrome.i18n.getMessage('executionFailed') || 'Failed';
          if (status === 'stopped') return chrome.i18n.getMessage('stopExecution') || 'Stopped';
          return '';
        }),
        span(() => `${progressPercent.val}%`)
      )
    ) : null,

    // Error display
    () => executionError.val ? div({
      style: 'padding: 12px; background: #ffebee; border-radius: 6px; color: #c62828; font-size: 13px; margin-bottom: 16px;'
    }, executionError.val) : null,

    // Controls
    () => isExecuting.val ? div({ style: 'margin-bottom: 16px;' },
      button({
        class: 'btn btn-danger',
        style: 'width: 100%; padding: 10px; background: #f44336; color: white; border: none; border-radius: 6px; cursor: pointer;',
        onclick: stopExecution
      }, chrome.i18n.getMessage('stopExecution') || 'Stop')
    ) : executionStatus.val !== 'idle' ? div({ style: 'margin-bottom: 16px;' },
      button({
        class: 'btn btn-secondary',
        style: 'width: 100%; padding: 10px; background: #e0e0e0; border: none; border-radius: 6px; cursor: pointer;',
        onclick: resetExecution
      }, chrome.i18n.getMessage('clearContext') || 'Clear Results')
    ) : null,

    // Results section
    () => executionResults.val.length > 0 ? div(
      div({ style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;' },
        span({ style: 'font-weight: 500; color: #333;' },
          chrome.i18n.getMessage('success') || 'Results'
        ),
        div({ style: 'display: flex; gap: 8px;' },
          button({
            class: 'btn btn-secondary',
            style: 'padding: 4px 12px; font-size: 12px; background: #e0e0e0; border: none; border-radius: 4px; cursor: pointer;',
            onclick: copyAsJSON
          }, 'JSON'),
          button({
            class: 'btn btn-secondary',
            style: 'padding: 4px 12px; font-size: 12px; background: #e0e0e0; border: none; border-radius: 4px; cursor: pointer;',
            onclick: copyAsCSV
          }, 'CSV')
        )
      ),
      () => copySuccess.val ? div({
        style: 'background: #e8f5e9; color: #2e7d32; padding: 8px; border-radius: 4px; font-size: 12px; margin-bottom: 8px;'
      }, copySuccess.val) : null,
      pre({
        style: 'background: #f5f5f5; padding: 12px; border-radius: 6px; font-size: 12px; overflow-x: auto; max-height: 200px; margin: 0;'
      }, () => JSON.stringify(executionResults.val, null, 2))
    ) : null
  );
}

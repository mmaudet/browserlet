import { useSignal } from '@preact/signals';
import { Parser } from '@json2csv/plainjs';
import { Play, Check } from 'lucide-preact';
import {
  isExecuting, currentScript, currentStep, totalSteps,
  progressPercent, executionStatus, executionResults, executionError,
  stopExecution, resetExecution
} from '../stores/execution';

export function ExecutionView() {
  const copySuccess = useSignal<string | null>(null);

  const showCopySuccess = (message: string) => {
    copySuccess.value = message;
    setTimeout(() => { copySuccess.value = null; }, 2000);
  };

  const copyAsJSON = async () => {
    try {
      const json = JSON.stringify(executionResults.value, null, 2);
      await navigator.clipboard.writeText(json);
      showCopySuccess(chrome.i18n.getMessage('copiedToClipboard') || 'Copied to clipboard');
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  const copyAsCSV = async () => {
    try {
      const results = executionResults.value;
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

  const getStatusText = () => {
    const status = executionStatus.value;
    if (status === 'running') return chrome.i18n.getMessage('executionRunning') || 'Running...';
    if (status === 'waiting_auth') return chrome.i18n.getMessage('waitingAuth') || 'Waiting for authentication...';
    if (status === 'completed') return chrome.i18n.getMessage('executionComplete') || 'Completed';
    if (status === 'failed') return chrome.i18n.getMessage('executionFailed') || 'Failed';
    if (status === 'stopped') return chrome.i18n.getMessage('stopExecution') || 'Stopped';
    return '';
  };

  /**
   * Check if results contain meaningful data (not just empty objects)
   */
  const hasActualResults = () => {
    const results = executionResults.value;
    if (results.length === 0) return false;
    // Check if all results are empty objects
    return results.some(r => {
      if (r === null || r === undefined) return false;
      if (typeof r !== 'object') return true; // primitive value is meaningful
      return Object.keys(r as object).length > 0;
    });
  };

  return (
    <div style={{ padding: '16px' }}>
      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <span style={{ fontWeight: 500, fontSize: '16px' }}>
          {chrome.i18n.getMessage('executionTitle') || 'Execution'}
        </span>
      </div>

      {/* Idle state - show instructions */}
      {executionStatus.value === 'idle' && !isExecuting.value && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#8e8e93' }}>
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
            <Play size={48} strokeWidth={1.5} />
          </div>
          <div style={{ fontSize: '14px', marginBottom: '8px' }}>
            {chrome.i18n.getMessage('noExecution') || 'No execution in progress'}
          </div>
          <div style={{ fontSize: '12px', color: '#aeaeb2' }}>
            {chrome.i18n.getMessage('executionHint') || 'Select a script and click "Run" to execute it'}
          </div>
        </div>
      )}

      {/* Active execution header */}
      {currentScript.value && executionStatus.value !== 'idle' && (
        <div style={{ marginBottom: '16px' }}>
          <div>
            <span style={{ fontWeight: 500, color: '#333' }}>{currentScript.value.name}</span>
            <span style={{ marginLeft: '8px', fontSize: '12px', color: '#666' }}>
              {chrome.i18n.getMessage('executionStep', [String(currentStep.value), String(totalSteps.value)]) || `Step ${currentStep.value} / ${totalSteps.value}`}
            </span>
          </div>
        </div>
      )}

      {/* Progress bar */}
      {(isExecuting.value || executionStatus.value !== 'idle') && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ height: '8px', background: '#e0e0e0', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              background: executionStatus.value === 'failed' ? '#f44336' : '#4caf50',
              width: `${progressPercent.value}%`,
              transition: 'width 0.3s'
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '12px', color: '#666' }}>
            <span>{getStatusText()}</span>
            <span>{progressPercent.value}%</span>
          </div>
        </div>
      )}

      {/* Error display */}
      {executionError.value && (
        <div style={{
          padding: '12px',
          background: '#ffebee',
          borderRadius: '6px',
          color: '#c62828',
          fontSize: '13px',
          marginBottom: '16px'
        }}>
          {executionError.value}
        </div>
      )}

      {/* Auth required message */}
      {executionStatus.value === 'waiting_auth' && (
        <div style={{
          backgroundColor: '#fff3cd',
          border: '1px solid #ffc107',
          padding: '12px',
          borderRadius: '4px',
          marginBottom: '16px'
        }}>
          <p style={{ margin: '0 0 8px 0', fontWeight: 500 }}>
            {chrome.i18n.getMessage('authRequired') || 'Authentication required'}
          </p>
          <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>
            {chrome.i18n.getMessage('authContinue') || 'Please log in to the target application. Execution will resume automatically.'}
          </p>
        </div>
      )}

      {/* Controls - show stop button when running or waiting for auth */}
      {(executionStatus.value === 'running' || executionStatus.value === 'waiting_auth') ? (
        <div style={{ marginBottom: '16px' }}>
          <button
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
            onClick={stopExecution}
          >
            {chrome.i18n.getMessage('stopExecution') || 'Stop'}
          </button>
        </div>
      ) : executionStatus.value !== 'idle' ? (
        <div style={{ marginBottom: '16px' }}>
          <button
            style={{
              width: '100%',
              padding: '10px',
              background: '#e0e0e0',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
            onClick={resetExecution}
          >
            {chrome.i18n.getMessage('clearContext') || 'Clear Results'}
          </button>
        </div>
      ) : null}

      {/* Results section - only show if execution completed/stopped */}
      {(executionStatus.value === 'completed' || executionStatus.value === 'stopped') && (
        <div>
          {hasActualResults() ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 500, color: '#333' }}>
                  {chrome.i18n.getMessage('success') || 'Results'}
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    style={{
                      padding: '4px 12px',
                      fontSize: '12px',
                      background: '#e0e0e0',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                    onClick={copyAsJSON}
                  >
                    JSON
                  </button>
                  <button
                    style={{
                      padding: '4px 12px',
                      fontSize: '12px',
                      background: '#e0e0e0',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                    onClick={copyAsCSV}
                  >
                    CSV
                  </button>
                </div>
              </div>
              {copySuccess.value && (
                <div style={{
                  background: '#e8f5e9',
                  color: '#2e7d32',
                  padding: '8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  marginBottom: '8px'
                }}>
                  {copySuccess.value}
                </div>
              )}
              <pre style={{
                background: '#f5f5f5',
                padding: '12px',
                borderRadius: '6px',
                fontSize: '12px',
                overflowX: 'auto',
                maxHeight: '200px',
                margin: 0
              }}>
                {JSON.stringify(executionResults.value, null, 2)}
              </pre>
            </>
          ) : (
            <div style={{
              padding: '16px',
              background: '#f5f5f5',
              borderRadius: '8px',
              textAlign: 'center',
              color: '#666',
              fontSize: '13px'
            }}>
              <div style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <Check size={16} strokeWidth={2} color="#34c759" /> Script exécuté avec succès
              </div>
              <div style={{ fontSize: '12px', color: '#aeaeb2' }}>
                Aucune donnée extraite (pas d'action "extract" dans le script)
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

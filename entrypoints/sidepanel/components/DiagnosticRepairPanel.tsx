/**
 * DiagnosticRepairPanel - Overlay panel for repairing failed BSL script steps
 *
 * Shows failed/matched hints, allows fetching DOM-based alternative suggestions
 * from the live page, applying a suggestion to rewrite the script, and re-running.
 *
 * Phase 39 - Plan 039-01
 */

import { useSignal } from '@preact/signals';
import { X, RefreshCw, Loader2, Check, Play } from 'lucide-preact';
import {
  repairTarget,
  repairStatus,
  domSuggestions,
  fetchDOMSuggestions,
  applySuggestion,
  closeRepair,
} from '../stores/repair';
import { startExecution, currentScript } from '../stores/execution';
import { scriptsState } from '../stores/scripts';
import type { SemanticHint } from '@browserlet/core/types';

/**
 * Format a SemanticHint for display as a readable string.
 */
function formatHint(hint: SemanticHint): string {
  if (typeof hint.value === 'string') {
    return `${hint.type}: ${hint.value}`;
  }
  return `${hint.type}: ${hint.value.name}=${hint.value.value}`;
}

/**
 * Truncate a URL for display.
 */
function truncateUrl(url: string, maxLen: number = 60): string {
  if (url.length <= maxLen) return url;
  return url.slice(0, maxLen - 3) + '...';
}

export function DiagnosticRepairPanel() {
  const target = repairTarget.value;
  if (!target) return null;

  const status = repairStatus.value;
  const suggestions = domSuggestions.value;
  const applyingIndex = useSignal<number | null>(null);

  const handleApplySuggestion = async (suggestionHints: SemanticHint[], index: number) => {
    applyingIndex.value = index;
    await applySuggestion(suggestionHints, 'dom_suggestion');
    applyingIndex.value = null;
  };

  const handleReRun = async () => {
    // Get the latest version of the script from state
    const script = scriptsState.value.find(s => s.id === target.scriptId);
    if (script) {
      closeRepair();
      await startExecution(script);
    }
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
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 10001,
      }}
      onClick={closeRepair}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '12px 12px 0 0',
          width: '100%',
          maxHeight: '85vh',
          overflowY: 'auto',
          boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.15)',
        }}
        onClick={(e: Event) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px',
            borderBottom: '1px solid #e0e0e0',
            position: 'sticky',
            top: 0,
            background: 'white',
            zIndex: 1,
            borderRadius: '12px 12px 0 0',
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: '16px', color: '#333' }}>
              Repair Step {target.stepIndex + 1}
            </div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
              {target.stepIntent || 'Unknown intent'}
            </div>
          </div>
          <button
            onClick={closeRepair}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#8e8e93',
              padding: '4px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} strokeWidth={2} />
          </button>
        </div>

        <div style={{ padding: '16px' }}>
          {/* Failure Info */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', color: '#666', marginBottom: '6px' }}>
              Page: {truncateUrl(target.pageUrl)}
            </div>
            <div
              style={{
                padding: '10px',
                background: '#ffebee',
                borderRadius: '6px',
                color: '#c62828',
                fontSize: '13px',
                marginBottom: '12px',
              }}
            >
              {target.failureReason}
            </div>

            {/* Failed hints */}
            {target.failedHints.length > 0 && (
              <div style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '11px', fontWeight: 500, color: '#999', marginBottom: '4px', textTransform: 'uppercase' as const }}>
                  Failed hints
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {target.failedHints.map((hint, i) => (
                    <span
                      key={i}
                      style={{
                        background: '#ffebee',
                        color: '#c62828',
                        borderRadius: '12px',
                        padding: '2px 8px',
                        fontSize: '11px',
                      }}
                    >
                      {hint}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Matched hints */}
            {target.matchedHints.length > 0 && (
              <div style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '11px', fontWeight: 500, color: '#999', marginBottom: '4px', textTransform: 'uppercase' as const }}>
                  Matched hints
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {target.matchedHints.map((hint, i) => (
                    <span
                      key={i}
                      style={{
                        background: '#fff8e1',
                        color: '#f57f17',
                        borderRadius: '12px',
                        padding: '2px 8px',
                        fontSize: '11px',
                      }}
                    >
                      {hint}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Current hints */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 500, color: '#999', marginBottom: '6px', textTransform: 'uppercase' as const }}>
              Current hints
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {target.originalHints.map((hint, i) => (
                <span
                  key={i}
                  style={{
                    background: '#f0f0f0',
                    borderRadius: '12px',
                    padding: '2px 8px',
                    fontSize: '11px',
                    color: '#333',
                  }}
                >
                  {formatHint(hint)}
                </span>
              ))}
            </div>
          </div>

          {/* DOM Suggestions section */}
          <div style={{ marginBottom: '16px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 500, color: '#999', textTransform: 'uppercase' as const }}>
                DOM Suggestions
              </div>
              <button
                onClick={fetchDOMSuggestions}
                disabled={status === 'loading_suggestions'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  fontSize: '12px',
                  background: status === 'loading_suggestions' ? '#e0e0e0' : '#e3f2fd',
                  color: status === 'loading_suggestions' ? '#999' : '#1976d2',
                  border: '1px solid ' + (status === 'loading_suggestions' ? '#ccc' : '#90caf9'),
                  borderRadius: '6px',
                  cursor: status === 'loading_suggestions' ? 'default' : 'pointer',
                }}
              >
                {status === 'loading_suggestions' ? (
                  <>
                    <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                    Analyzing page...
                  </>
                ) : (
                  <>
                    <RefreshCw size={12} />
                    Get suggestions
                  </>
                )}
              </button>
            </div>

            {/* Suggestion cards */}
            {suggestions.length > 0 ? (
              suggestions.map((suggestionSet, idx) => (
                <div
                  key={idx}
                  style={{
                    border: '1px solid #e0e0e0',
                    borderRadius: '6px',
                    padding: '10px',
                    marginBottom: '8px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', flex: 1 }}>
                      {suggestionSet.map((hint, hIdx) => (
                        <span
                          key={hIdx}
                          style={{
                            background: '#e8f5e9',
                            color: '#2e7d32',
                            borderRadius: '12px',
                            padding: '2px 8px',
                            fontSize: '11px',
                          }}
                        >
                          {formatHint(hint)}
                        </span>
                      ))}
                    </div>
                    <button
                      onClick={() => handleApplySuggestion(suggestionSet, idx)}
                      disabled={status === 'applying'}
                      style={{
                        marginLeft: '8px',
                        padding: '4px 10px',
                        fontSize: '11px',
                        fontWeight: 500,
                        background: applyingIndex.value === idx ? '#81c784' : '#4caf50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: status === 'applying' ? 'default' : 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {applyingIndex.value === idx ? 'Applying...' : 'Apply'}
                    </button>
                  </div>
                </div>
              ))
            ) : status !== 'loading_suggestions' ? (
              <div
                style={{
                  padding: '12px',
                  background: '#f5f5f5',
                  borderRadius: '6px',
                  textAlign: 'center',
                  color: '#999',
                  fontSize: '12px',
                }}
              >
                No suggestions available. Click "Get suggestions" to analyze the page.
              </div>
            ) : null}
          </div>

          {/* Status messages */}
          {status === 'done' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px',
                background: '#e8f5e9',
                borderRadius: '6px',
                color: '#2e7d32',
                fontSize: '13px',
                marginBottom: '12px',
              }}
            >
              <Check size={16} strokeWidth={2} />
              Repair applied and logged. Click "Re-run" to verify the fix.
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {status === 'done' && (
              <button
                onClick={handleReRun}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '12px',
                  background: '#007AFF',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                <Play size={18} />
                Re-run Script
              </button>
            )}
            <button
              onClick={closeRepair}
              style={{
                flex: status === 'done' ? undefined : 1,
                padding: '12px',
                background: '#e0e0e0',
                color: '#333',
                border: 'none',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {status === 'done' ? 'Close' : 'Dismiss'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

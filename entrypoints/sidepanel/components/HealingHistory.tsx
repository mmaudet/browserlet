/**
 * HealingHistory component - displays repair history for a script with undo capability
 */

import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { ChevronDown, ChevronRight, Undo2, CheckCircle, History } from 'lucide-preact';
import type { HealingRecord } from '../../../utils/storage/healing';

interface HealingHistoryProps {
  scriptId: string;
}

// Local state
const isExpanded = signal(false);
const records = signal<HealingRecord[]>([]);
const loading = signal(false);
const undoing = signal<string | null>(null);

/**
 * Format timestamp to localized date/time
 */
function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(timestamp));
}

/**
 * Summarize hints for display
 */
function summarizeHints(hints: Array<{ type: string; value: string }>): string {
  if (!hints || hints.length === 0) return '-';
  const first = hints[0];
  if (hints.length === 1) {
    return `${first.type}: ${first.value.substring(0, 30)}${first.value.length > 30 ? '...' : ''}`;
  }
  return `${first.type}: ${first.value.substring(0, 20)}... (+${hints.length - 1})`;
}

export function HealingHistory({ scriptId }: HealingHistoryProps) {
  // Load history when component mounts or scriptId changes
  useEffect(() => {
    const loadHistory = async () => {
      loading.value = true;
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'GET_HEALING_HISTORY',
          payload: { scriptId }
        });
        if (response.success && Array.isArray(response.data)) {
          records.value = response.data;
        }
      } catch (error) {
        console.error('[HealingHistory] Failed to load history:', error);
      } finally {
        loading.value = false;
      }
    };

    loadHistory();
  }, [scriptId]);

  // Don't render if no history
  if (records.value.length === 0 && !loading.value) {
    return null;
  }

  const handleUndo = async (record: HealingRecord) => {
    if (record.undoneAt || undoing.value) return;

    undoing.value = record.id;
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'UNDO_HEALING',
        payload: { scriptId, recordId: record.id }
      });

      if (response.success) {
        // Refresh history
        const historyResponse = await chrome.runtime.sendMessage({
          type: 'GET_HEALING_HISTORY',
          payload: { scriptId }
        });
        if (historyResponse.success && Array.isArray(historyResponse.data)) {
          records.value = historyResponse.data;
        }
      } else {
        console.error('[HealingHistory] Undo failed:', response.error);
      }
    } catch (error) {
      console.error('[HealingHistory] Failed to undo:', error);
    } finally {
      undoing.value = null;
    }
  };

  const t = (key: string, fallback: string) => chrome.i18n.getMessage(key) || fallback;

  return (
    <div
      class="healing-history"
      style={{
        borderTop: '1px solid #e0e0e0',
        background: '#fafafa'
      }}
    >
      {/* Header - toggle expand/collapse */}
      <button
        onClick={() => { isExpanded.value = !isExpanded.value; }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          width: '100%',
          padding: '8px 12px',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: 500,
          color: '#666'
        }}
      >
        {isExpanded.value ? (
          <ChevronDown size={14} />
        ) : (
          <ChevronRight size={14} />
        )}
        <History size={14} />
        <span>{t('healingHistory', 'Healing History')}</span>
        <span style={{ color: '#999', fontWeight: 400 }}>
          ({records.value.length})
        </span>
      </button>

      {/* Content - records list */}
      {isExpanded.value && (
        <div style={{ padding: '0 12px 12px' }}>
          {loading.value ? (
            <div style={{ fontSize: '12px', color: '#999', padding: '8px 0' }}>
              {t('loading', 'Loading...')}
            </div>
          ) : records.value.length === 0 ? (
            <div style={{ fontSize: '12px', color: '#999', padding: '8px 0' }}>
              {t('noHealingHistory', 'No repairs applied to this script')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {records.value.map(record => (
                <div
                  key={record.id}
                  style={{
                    padding: '8px',
                    background: record.undoneAt ? '#f5f5f5' : '#fff',
                    border: '1px solid #e0e0e0',
                    borderRadius: '4px',
                    fontSize: '11px',
                    opacity: record.undoneAt ? 0.6 : 1
                  }}
                >
                  {/* Header row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ color: '#666' }}>
                      Step {record.stepIndex + 1}
                    </span>
                    <span style={{ color: '#999', fontSize: '10px' }}>
                      {formatDate(record.approvedAt)}
                    </span>
                  </div>

                  {/* Hints summary */}
                  <div style={{ marginBottom: '4px' }}>
                    <span style={{ color: '#999' }}>
                      {summarizeHints(record.originalHints)}
                    </span>
                    <span style={{ color: '#666', margin: '0 4px' }}>→</span>
                    <span style={{ color: '#333' }}>
                      {summarizeHints(record.newHints)}
                    </span>
                  </div>

                  {/* Confidence */}
                  <div style={{ marginBottom: '4px', color: '#666' }}>
                    {t('confidenceScore', 'Confidence')}: {Math.round(record.confidence * 100)}%
                  </div>

                  {/* Undo button or undone badge */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                    {record.undoneAt ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 8px',
                          background: '#e0e0e0',
                          borderRadius: '4px',
                          color: '#666',
                          fontSize: '10px'
                        }}
                      >
                        <CheckCircle size={12} />
                        {t('healingUndone', 'Undone')}
                      </span>
                    ) : (
                      <button
                        onClick={() => handleUndo(record)}
                        disabled={undoing.value !== null}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 8px',
                          background: '#fff',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          cursor: undoing.value ? 'wait' : 'pointer',
                          fontSize: '10px',
                          color: '#666',
                          opacity: undoing.value === record.id ? 0.5 : 1
                        }}
                      >
                        <Undo2 size={12} />
                        {undoing.value === record.id
                          ? t('loading', 'Loading...')
                          : t('undoHealing', 'Undo')}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

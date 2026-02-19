import { useSignal } from '@preact/signals';
import { CheckCircle, XCircle, StopCircle, Loader2, X, Camera, Database, ChevronDown, ChevronRight } from 'lucide-preact';
import type { ExecutionRecord, ScreenshotRecord } from '../../../utils/types';
import { getExecutionHistory, clearExecutionHistory } from '../../../utils/storage/history';
import { getScreenshots } from '../../../utils/storage/screenshots';
import { ScreenshotGallery } from './ScreenshotGallery';

interface ExecutionHistoryModalProps {
  scriptId: string;
  scriptName: string;
  onClose: () => void;
  onViewData: (record: ExecutionRecord) => void;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function formatDuration(startedAt: number, completedAt?: number): string {
  if (!completedAt) return '-';
  const ms = completedAt - startedAt;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.round((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

function getStatusIcon(status: ExecutionRecord['status']) {
  switch (status) {
    case 'completed': return <CheckCircle size={14} color="#34c759" strokeWidth={2} />;
    case 'failed': return <XCircle size={14} color="#ff3b30" strokeWidth={2} />;
    case 'stopped': return <StopCircle size={14} color="#8e8e93" strokeWidth={2} />;
    case 'running': return <Loader2 size={14} color="#007AFF" strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }} />;
    default: return <StopCircle size={14} color="#8e8e93" strokeWidth={2} />;
  }
}

function getStatusLabel(status: ExecutionRecord['status']): string {
  switch (status) {
    case 'completed': return chrome.i18n.getMessage('executionSuccess') || 'Success';
    case 'failed': return chrome.i18n.getMessage('executionFailed') || 'Failed';
    case 'stopped': return chrome.i18n.getMessage('stopExecution') || 'Stopped';
    case 'running': return chrome.i18n.getMessage('executionRunning') || 'Running';
    default: return status;
  }
}

export function ExecutionHistoryModal({ scriptId, scriptName, onClose, onViewData }: ExecutionHistoryModalProps) {
  const historyRecords = useSignal<ExecutionRecord[]>([]);
  const screenshots = useSignal<ScreenshotRecord[]>([]);
  const isLoading = useSignal(true);
  const expandedExecutionId = useSignal<string | null>(null);

  const loadHistory = async () => {
    isLoading.value = true;
    const [records, screenshotData] = await Promise.all([
      getExecutionHistory(scriptId),
      getScreenshots(scriptId)
    ]);
    historyRecords.value = records;
    screenshots.value = screenshotData;
    isLoading.value = false;
  };

  // Load on mount (signal-based effect equivalent)
  if (historyRecords.value.length === 0 && isLoading.value) {
    loadHistory();
  }

  const handleClearHistory = async () => {
    const confirmMsg = chrome.i18n.getMessage('confirmClearHistory') || 'Clear all history for this script?';
    if (confirm(confirmMsg)) {
      await clearExecutionHistory(scriptId);
      historyRecords.value = [];
    }
  };

  const getExecutionScreenshots = (executionId: string): ScreenshotRecord[] => {
    return screenshots.value.filter(s => s.executionId === executionId);
  };

  const toggleExpanded = (executionId: string) => {
    expandedExecutionId.value = expandedExecutionId.value === executionId ? null : executionId;
  };

  return (
    <div style={{ padding: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 500 }}>
          {chrome.i18n.getMessage('executionHistory') || 'Execution History'}
        </h3>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8e8e93', padding: '4px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title={chrome.i18n.getMessage('close') || 'Close'}
        >
          <X size={20} strokeWidth={2} />
        </button>
      </div>
      <div style={{ fontSize: '13px', color: '#666', marginBottom: '12px' }}>
        {scriptName}
      </div>

      {/* Content */}
      {isLoading.value ? (
        <div style={{ textAlign: 'center', padding: '24px', color: '#999' }}>
          {chrome.i18n.getMessage('loading') || 'Loading...'}
        </div>
      ) : historyRecords.value.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px', color: '#999' }}>
          {chrome.i18n.getMessage('noExecutionHistory') || 'No executions yet'}
        </div>
      ) : (
        <>
          {/* History list */}
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {historyRecords.value.map(record => {
              const executionScreenshots = getExecutionScreenshots(record.id);
              const hasScreenshots = executionScreenshots.length > 0;
              const isExpanded = expandedExecutionId.value === record.id;
              const hasResults = record.results && Object.keys(record.results as Record<string, unknown>).length > 0;
              const isClickable = hasScreenshots || hasResults;

              return (
                <div
                  key={record.id}
                  style={{
                    borderBottom: '1px solid #f0f0f0',
                    background: record.status === 'failed' ? '#fff5f5' : 'white'
                  }}
                >
                  {/* Execution header - clickable if has content */}
                  <div
                    onClick={() => isClickable && toggleExpanded(record.id)}
                    style={{
                      padding: '10px 12px',
                      cursor: isClickable ? 'pointer' : 'default',
                      transition: 'background 0.15s'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#666' }}>
                        {isClickable && (
                          isExpanded
                            ? <ChevronDown size={14} color="#666" />
                            : <ChevronRight size={14} color="#666" />
                        )}
                        {formatDate(record.startedAt)}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                        {/* Screenshot indicator */}
                        {hasScreenshots && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '2px', color: '#666' }}>
                            <Camera size={12} />
                            <span style={{ fontSize: '10px' }}>{executionScreenshots.length}</span>
                          </span>
                        )}
                        {getStatusIcon(record.status)}
                        <span style={{ color: record.status === 'failed' ? '#d32f2f' : record.status === 'completed' ? '#2e7d32' : '#666' }}>
                          {getStatusLabel(record.status)}
                        </span>
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#999', marginLeft: isClickable ? '20px' : '0' }}>
                      <span>
                        {chrome.i18n.getMessage('executionStep', [String(record.currentStep || 0), String(record.totalSteps || 0)]) || `Step ${record.currentStep || 0}/${record.totalSteps || 0}`}
                      </span>
                      <span>{formatDuration(record.startedAt, record.completedAt)}</span>
                    </div>
                    {record.error && (
                      <div style={{ marginTop: '6px', marginLeft: isClickable ? '20px' : '0', fontSize: '11px', color: '#d32f2f', background: '#ffebee', padding: '6px 8px', borderRadius: '4px' }}>
                        {record.error}
                      </div>
                    )}
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div style={{ padding: '0 12px 12px 32px', background: '#fafafa' }}>
                      {/* View Data button */}
                      {hasResults && (
                        <button
                          onClick={(e: Event) => {
                            e.stopPropagation();
                            onViewData(record);
                          }}
                          style={{
                            marginBottom: hasScreenshots ? '12px' : '0',
                            padding: '6px 12px',
                            fontSize: '11px',
                            background: '#e3f2fd',
                            border: '1px solid #90caf9',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            color: '#1976d2',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Database size={12} />
                          {chrome.i18n.getMessage('viewData') || 'View Data'}
                        </button>
                      )}

                      {/* Inline screenshots for this execution */}
                      {hasScreenshots && (
                        <ScreenshotGallery
                          screenshots={executionScreenshots}
                          scriptName={scriptName}
                          onDeleted={loadHistory}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Clear history button */}
          <div style={{ marginTop: '12px', textAlign: 'right' }}>
            <button
              onClick={handleClearHistory}
              style={{ padding: '6px 12px', fontSize: '12px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', color: '#666' }}
            >
              {chrome.i18n.getMessage('clearHistory') || 'Clear History'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

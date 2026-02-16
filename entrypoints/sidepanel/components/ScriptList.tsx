import { useSignal, signal } from '@preact/signals';
import { Type, Pencil, Trash2, Zap, History, Play, CheckCircle, XCircle, StopCircle, Loader2, X, Plus, Database, Camera, ChevronDown, ChevronRight } from 'lucide-preact';
import type { Script, ExecutionRecord, ScreenshotRecord } from '../../../utils/types';
import { filteredScripts, searchTerm, isLoading, selectScript, selectedScriptId, updateScriptInState } from '../stores/scripts';
import { triggersState } from '../stores/triggers';
import { startExecution, isExecuting, currentScript, executionStatus, progressPercent, stopExecution, executionError } from '../stores/execution';
import { navigateTo } from '../router';
import { TriggerConfig } from './TriggerConfig';
import { deleteScript, saveScript } from '../../../utils/storage/scripts';
import { ImportButton } from './ImportExport';
import { getExecutionHistory, clearExecutionHistory } from '../../../utils/storage/history';
import { getScreenshots } from '../../../utils/storage/screenshots';
import { ExtractedDataModal } from './ExtractedDataModal';
import { ScreenshotGallery } from './ScreenshotGallery';
import { exportToJSON, exportToCSV } from '../../../utils/export/dataExport';

// Session status tracking per script (Phase 33)
interface SessionStatusInfo {
  exists: boolean;
  expired: boolean;
  capturedAt?: number;
}
const sessionStatusMap = signal<Map<string, SessionStatusInfo>>(new Map());

async function updateSessionStatus(scriptId: string): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]?.url) return;

    const domain = new URL(tabs[0].url).hostname;
    const response = await chrome.runtime.sendMessage({
      type: 'GET_SESSION_STATUS',
      payload: { scriptId, domain }
    });

    if (response?.success) {
      const newMap = new Map(sessionStatusMap.value);
      newMap.set(scriptId, response.data as SessionStatusInfo);
      sessionStatusMap.value = newMap;
    }
  } catch (err) {
    console.warn('[Browserlet] Failed to fetch session status:', err);
  }
}

async function handleToggleSessionPersistence(script: Script, enabled: boolean): Promise<void> {
  const updated = await saveScript({
    ...script,
    sessionPersistence: {
      enabled,
      ttl: script.sessionPersistence?.ttl
    }
  });
  updateScriptInState(updated);
  if (enabled) {
    updateSessionStatus(script.id);
  }
}

interface ScriptListProps {
  onScriptSelect?: (script: Script) => void;
  onNewScript?: () => void;
}

interface ScriptItemProps {
  script: Script;
  isSelected: boolean;
  triggerCount: number;
  isRunning: boolean;
  runStatus: 'idle' | 'running' | 'completed' | 'failed' | 'stopped' | 'waiting_auth';
  progress: number;
  sessionStatus: SessionStatusInfo | undefined;
  onEdit: () => void;
  onRun: () => void;
  onStop: () => void;
  onConfigureTriggers: () => void;
  onViewHistory: () => void;
  onDelete: () => void;
  onRename: () => void;
  onToggleSession: (enabled: boolean) => void;
}

function ScriptItem({ script, isSelected, triggerCount, isRunning, runStatus, progress, sessionStatus, onEdit, onRun, onStop, onConfigureTriggers, onViewHistory, onDelete, onRename, onToggleSession }: ScriptItemProps) {
  return (
    <div
      style={{
        padding: '12px',
        borderBottom: '1px solid #f0f0f0',
        background: isRunning ? '#e6f7e6' : isSelected ? '#e8f4fd' : 'white',
        transition: 'background 0.15s'
      }}
    >
      {/* Progress bar when running */}
      {isRunning && (
        <div style={{
          height: '3px',
          background: '#e0e0e0',
          borderRadius: '2px',
          marginBottom: '8px',
          overflow: 'hidden'
        }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: '#34c759',
            transition: 'width 0.3s ease'
          }} />
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        {/* Script info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 500, color: '#333' }}>{script.name}</span>
            {script.target_app && (
              <span style={{ fontSize: '10px', background: '#e0e0e0', padding: '2px 6px', borderRadius: '4px', color: '#666', flexShrink: 0 }}>
                {script.target_app}
              </span>
            )}
            {isRunning && (
              <span style={{ fontSize: '10px', background: '#34c759', padding: '2px 6px', borderRadius: '4px', color: 'white', flexShrink: 0 }}>
                {progress}%
              </span>
            )}
          </div>
        </div>
        {/* Actions */}
        <div style={{ display: 'flex', gap: '1px', alignItems: 'center', flexShrink: 0 }}>
          {/* Rename */}
          <button
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: '#8e8e93', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title={chrome.i18n.getMessage('renameScript') || 'Rename'}
            onClick={(e: Event) => {
              e.stopPropagation();
              onRename();
            }}
          >
            <Type size={15} strokeWidth={1.5} />
          </button>
          {/* Edit */}
          <button
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: '#8e8e93', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title={chrome.i18n.getMessage('editScript') || 'Edit'}
            onClick={(e: Event) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            <Pencil size={15} strokeWidth={1.5} />
          </button>
          {/* Triggers */}
          <button
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: triggerCount > 0 ? '#ff9500' : '#8e8e93', position: 'relative', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title={chrome.i18n.getMessage('configureTriggers') || 'Configure triggers'}
            onClick={(e: Event) => {
              e.stopPropagation();
              onConfigureTriggers();
            }}
          >
            <Zap size={16} strokeWidth={1.5} fill={triggerCount > 0 ? '#ff9500' : 'none'} />
            {triggerCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '0',
                right: '0',
                background: '#007AFF',
                color: 'white',
                fontSize: '9px',
                fontWeight: 600,
                minWidth: '14px',
                height: '14px',
                borderRadius: '7px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 3px'
              }}>
                {triggerCount}
              </span>
            )}
          </button>
          {/* History */}
          <button
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: '#8e8e93', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title={chrome.i18n.getMessage('viewHistory') || 'View History'}
            onClick={(e: Event) => {
              e.stopPropagation();
              onViewHistory();
            }}
          >
            <History size={15} strokeWidth={1.5} />
          </button>
          {/* Play/Stop */}
          {isRunning ? (
            <button
              onClick={(e: Event) => {
                e.stopPropagation();
                onStop();
              }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: '#ff3b30', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title={chrome.i18n.getMessage('stopExecution') || 'Stop'}
            >
              <StopCircle size={16} strokeWidth={1.5} />
            </button>
          ) : (
            <button
              onClick={(e: Event) => {
                e.stopPropagation();
                onRun();
              }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: '#34c759', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title={chrome.i18n.getMessage('runScript') || 'Run Script'}
            >
              <Play size={16} strokeWidth={1.5} fill="#34c759" />
            </button>
          )}
          {/* Delete (far right) */}
          <button
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: '#ff3b30', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: '4px' }}
            title={chrome.i18n.getMessage('deleteScript') || 'Delete'}
            onClick={(e: Event) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 size={15} strokeWidth={1.5} />
          </button>
        </div>
      </div>
      {script.description && (
        <div style={{ fontSize: '12px', color: '#666', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {script.description}
        </div>
      )}
      {script.tags && script.tags.length > 0 && (
        <div style={{ marginTop: '6px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {script.tags.map(tag => (
            <span
              key={tag}
              style={{ fontSize: '10px', background: '#f5f5f5', padding: '2px 6px', borderRadius: '3px', color: '#888' }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
      {/* Session persistence toggle and status badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
        <label style={{ fontSize: '12px', color: '#666', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={script.sessionPersistence?.enabled || false}
            onChange={(e: Event) => {
              e.stopPropagation();
              onToggleSession((e.target as HTMLInputElement).checked);
            }}
            style={{ margin: 0 }}
          />
          {chrome.i18n.getMessage('sessionPersistenceEnable') || 'Remember login'}
        </label>
        {script.sessionPersistence?.enabled && sessionStatus && (
          <span style={{
            fontSize: '11px',
            padding: '2px 6px',
            borderRadius: '4px',
            backgroundColor: sessionStatus.exists
              ? (sessionStatus.expired ? '#ff9500' : '#4caf50')
              : '#ccc',
            color: 'white'
          }}>
            {sessionStatus.exists
              ? (sessionStatus.expired
                ? (chrome.i18n.getMessage('sessionExpired') || 'Expired')
                : (chrome.i18n.getMessage('sessionActive') || 'Active'))
              : (chrome.i18n.getMessage('sessionNone') || 'None')}
          </span>
        )}
      </div>
    </div>
  );
}

async function handleDeleteScript(script: Script): Promise<void> {
  const confirmMessage = chrome.i18n.getMessage('confirmDeleteScript') || `Delete "${script.name}"? This cannot be undone.`;
  if (confirm(confirmMessage)) {
    await deleteScript(script.id);
  }
}

async function handleRenameScript(script: Script): Promise<void> {
  const promptMessage = chrome.i18n.getMessage('renameScriptPrompt') || 'Enter new name:';
  const newName = prompt(promptMessage, script.name);
  if (newName && newName.trim() && newName !== script.name) {
    const trimmedName = newName.trim();
    // Update name in BSL content (YAML) as well
    let updatedContent = script.content;
    if (updatedContent) {
      // Replace the name field in YAML - escape quotes for YAML string
      const escapedName = trimmedName.replace(/"/g, '\\"');
      updatedContent = updatedContent.replace(/^name:.*$/m, `name: "${escapedName}"`);
    }
    const updated = await saveScript({ ...script, name: trimmedName, content: updatedContent });
    updateScriptInState(updated);
  }
}

// History modal component
interface ScriptHistoryModalProps {
  scriptId: string;
  scriptName: string;
  onClose: () => void;
  onViewData: (record: ExecutionRecord) => void;
}

function ScriptHistoryModal({ scriptId, scriptName, onClose, onViewData }: ScriptHistoryModalProps) {
  const historyRecords = useSignal<ExecutionRecord[]>([]);
  const screenshots = useSignal<ScreenshotRecord[]>([]);
  const isLoading = useSignal(true);
  const expandedExecutionId = useSignal<string | null>(null);

  // Load history and screenshots on mount
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

  // Use effect equivalent via immediate call
  if (historyRecords.value.length === 0 && isLoading.value) {
    loadHistory();
  }

  const handleClearHistory = async () => {
    const confirmMsg = chrome.i18n.getMessage('clearHistory') || 'Clear all history for this script?';
    if (confirm(confirmMsg)) {
      await clearExecutionHistory(scriptId);
      historyRecords.value = [];
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatDuration = (start: number, end?: number) => {
    if (!end) return '-';
    const durationMs = end - start;
    if (durationMs < 1000) return `${durationMs}ms`;
    return `${(durationMs / 1000).toFixed(1)}s`;
  };

  const getStatusIcon = (status: ExecutionRecord['status']) => {
    switch (status) {
      case 'completed': return <CheckCircle size={14} color="#34c759" strokeWidth={2} />;
      case 'failed': return <XCircle size={14} color="#ff3b30" strokeWidth={2} />;
      case 'stopped': return <StopCircle size={14} color="#8e8e93" strokeWidth={2} />;
      case 'running': return <Loader2 size={14} color="#007AFF" strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }} />;
      default: return <StopCircle size={14} color="#8e8e93" strokeWidth={2} />;
    }
  };

  const getStatusLabel = (status: ExecutionRecord['status']) => {
    switch (status) {
      case 'completed': return chrome.i18n.getMessage('executionSuccess') || 'Success';
      case 'failed': return chrome.i18n.getMessage('executionFailed') || 'Failed';
      case 'stopped': return chrome.i18n.getMessage('stopExecution') || 'Stopped';
      case 'running': return chrome.i18n.getMessage('executionRunning') || 'Running';
      default: return status;
    }
  };

  // Get screenshots for a specific execution
  const getExecutionScreenshots = (executionId: string): ScreenshotRecord[] => {
    return screenshots.value.filter(s => s.executionId === executionId);
  };

  // Toggle expansion of an execution entry
  const toggleExpanded = (executionId: string) => {
    expandedExecutionId.value = expandedExecutionId.value === executionId ? null : executionId;
  };

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 500 }}>
          {chrome.i18n.getMessage('executionHistory') || 'Execution History'}
        </h3>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8e8e93', padding: '4px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <X size={20} strokeWidth={2} />
        </button>
      </div>
      <div style={{ fontSize: '13px', color: '#666', marginBottom: '12px' }}>
        {scriptName}
      </div>

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

export function ScriptList({ onScriptSelect, onNewScript }: ScriptListProps = {}) {
  const showTriggerConfig = useSignal<string | null>(null);
  const showHistoryModal = useSignal<{ scriptId: string; scriptName: string } | null>(null);
  const showDataModal = useSignal<{ scriptName: string; results: Record<string, unknown> } | null>(null);
  const sessionStatusLoaded = useSignal(false);

  // Fetch session status for scripts with session persistence enabled (on first render)
  if (!sessionStatusLoaded.value && !isLoading.value && filteredScripts.value.length > 0) {
    sessionStatusLoaded.value = true;
    filteredScripts.value.forEach(script => {
      if (script.sessionPersistence?.enabled) {
        updateSessionStatus(script.id);
      }
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Error toast - shows execution errors immediately */}
      {executionError.value && (
        <div style={{
          padding: '12px 16px',
          background: '#ffebee',
          borderBottom: '1px solid #ef9a9a',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px'
        }}>
          <XCircle size={18} color="#d32f2f" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ flex: 1, fontSize: '13px', color: '#c62828', lineHeight: '1.4' }}>
            {executionError.value}
          </div>
          <button
            onClick={() => { executionError.value = null; }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px',
              color: '#d32f2f',
              flexShrink: 0
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Search header */}
      <div style={{ padding: '12px', background: '#f5f5f5', borderBottom: '1px solid #ddd' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <input
            type="text"
            placeholder={chrome.i18n.getMessage('searchPlaceholder') || 'Search scripts...'}
            value={searchTerm.value}
            onInput={(e: Event) => { searchTerm.value = (e.target as HTMLInputElement).value; }}
            style={{ flex: 1, padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '13px' }}
          />
          <ImportButton onImport={(script) => onScriptSelect?.(script)} />
          {onNewScript && (
            <button
              onClick={onNewScript}
              style={{ padding: '8px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title={chrome.i18n.getMessage('newScript') || 'New Script'}
            >
              <Plus size={20} strokeWidth={2.5} />
            </button>
          )}
        </div>
        <div style={{ fontSize: '12px', color: '#666' }}>
          {filteredScripts.value.length} {chrome.i18n.getMessage('scripts') || 'scripts'}
        </div>
      </div>

      {/* Script list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {isLoading.value ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#999' }}>
            {chrome.i18n.getMessage('loading') || 'Loading...'}
          </div>
        ) : filteredScripts.value.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#999' }}>
            {searchTerm.value
              ? chrome.i18n.getMessage('noResults') || 'No scripts found'
              : chrome.i18n.getMessage('noScripts') || 'No scripts yet. Create one to get started!'}
          </div>
        ) : (
          <div>
            {filteredScripts.value.map(script => {
              const scriptIsRunning = isExecuting.value && currentScript.value?.id === script.id;
              return (
                <ScriptItem
                  key={script.id}
                  script={script}
                  isSelected={selectedScriptId.value === script.id}
                  triggerCount={triggersState.value.filter(t => t.scriptId === script.id && t.enabled).length}
                  isRunning={scriptIsRunning}
                  runStatus={scriptIsRunning ? executionStatus.value : 'idle'}
                  progress={scriptIsRunning ? progressPercent.value : 0}
                  sessionStatus={sessionStatusMap.value.get(script.id)}
                  onEdit={() => {
                    selectScript(script.id);
                    onScriptSelect?.(script);
                  }}
                  onRun={() => {
                    console.log('[Browserlet] Play button clicked for script:', script.name);
                    startExecution(script);
                  }}
                  onStop={() => {
                    console.log('[Browserlet] Stop button clicked for script:', script.name);
                    stopExecution();
                  }}
                  onConfigureTriggers={() => {
                    showTriggerConfig.value = script.id;
                  }}
                  onViewHistory={() => {
                    showHistoryModal.value = { scriptId: script.id, scriptName: script.name };
                  }}
                  onDelete={() => handleDeleteScript(script)}
                  onRename={() => handleRenameScript(script)}
                  onToggleSession={(enabled) => handleToggleSessionPersistence(script, enabled)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Trigger config modal */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: showTriggerConfig.value ? 'flex' : 'none',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}
        onClick={() => { showTriggerConfig.value = null; }}
      >
        <div
          style={{
            background: 'white',
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            maxWidth: '28rem',
            width: 'calc(100% - 32px)',
            maxHeight: '80vh',
            overflowY: 'auto',
            margin: '16px'
          }}
          onClick={(e: Event) => e.stopPropagation()}
        >
          {showTriggerConfig.value ? (
            <TriggerConfig
              scriptId={showTriggerConfig.value}
              onClose={() => { showTriggerConfig.value = null; }}
            />
          ) : null}
        </div>
      </div>

      {/* History modal */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: showHistoryModal.value ? 'flex' : 'none',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}
        onClick={() => { showHistoryModal.value = null; }}
      >
        <div
          style={{
            background: 'white',
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            maxWidth: '28rem',
            width: 'calc(100% - 32px)',
            maxHeight: '80vh',
            overflowY: 'auto',
            margin: '16px'
          }}
          onClick={(e: Event) => e.stopPropagation()}
        >
          {showHistoryModal.value ? (
            <ScriptHistoryModal
              scriptId={showHistoryModal.value.scriptId}
              scriptName={showHistoryModal.value.scriptName}
              onClose={() => { showHistoryModal.value = null; }}
              onViewData={(record) => {
                // Handle both array and object formats for results
                let results = record.results as Record<string, unknown>;
                // If results is an array, unwrap the first element or merge all
                if (Array.isArray(record.results)) {
                  results = record.results.reduce((acc, item) => {
                    if (typeof item === 'object' && item !== null) {
                      return { ...acc, ...item };
                    }
                    return acc;
                  }, {} as Record<string, unknown>);
                }
                showDataModal.value = {
                  scriptName: record.scriptName,
                  results
                };
              }}
            />
          ) : null}
        </div>
      </div>

      {/* Extracted Data modal */}
      <ExtractedDataModal
        data={showDataModal.value?.results || {}}
        scriptName={showDataModal.value?.scriptName || ''}
        isOpen={showDataModal.value !== null}
        onClose={() => { showDataModal.value = null; }}
        onExportJSON={() => {
          if (showDataModal.value) {
            exportToJSON(showDataModal.value.results, showDataModal.value.scriptName);
          }
        }}
        onExportCSV={() => {
          if (showDataModal.value) {
            exportToCSV(showDataModal.value.results, showDataModal.value.scriptName);
          }
        }}
      />
    </div>
  );
}

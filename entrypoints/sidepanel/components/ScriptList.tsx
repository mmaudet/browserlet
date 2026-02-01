import { useSignal } from '@preact/signals';
import { Pencil, Trash2, Zap, History, Play, CheckCircle, XCircle, StopCircle, Loader2, X, Plus } from 'lucide-preact';
import type { Script, ExecutionRecord } from '../../../utils/types';
import { filteredScripts, searchTerm, isLoading, selectScript, selectedScriptId, updateScriptInState } from '../stores/scripts';
import { triggersState } from '../stores/triggers';
import { startExecution } from '../stores/execution';
import { navigateTo } from '../router';
import { TriggerConfig } from './TriggerConfig';
import { deleteScript, saveScript } from '../../../utils/storage/scripts';
import { ImportButton } from './ImportExport';
import { getExecutionHistory, clearExecutionHistory } from '../../../utils/storage/history';

interface ScriptListProps {
  onScriptSelect?: (script: Script) => void;
  onNewScript?: () => void;
}

interface ScriptItemProps {
  script: Script;
  isSelected: boolean;
  triggerCount: number;
  onSelect: () => void;
  onRun: () => void;
  onConfigureTriggers: () => void;
  onViewHistory: () => void;
  onDelete: () => void;
  onRename: () => void;
}

function ScriptItem({ script, isSelected, triggerCount, onSelect, onRun, onConfigureTriggers, onViewHistory, onDelete, onRename }: ScriptItemProps) {
  return (
    <div
      style={{
        padding: '12px',
        borderBottom: '1px solid #f0f0f0',
        cursor: 'pointer',
        background: isSelected ? '#e3f2fd' : 'white',
        transition: 'background 0.15s'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div
          style={{ flex: 1, minWidth: 0 }}
          onClick={onSelect}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontWeight: 500, color: '#333' }}>{script.name}</span>
            {script.target_app && (
              <span style={{ fontSize: '10px', background: '#e0e0e0', padding: '2px 6px', borderRadius: '4px', color: '#666' }}>
                {script.target_app}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
          <button
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: '#8e8e93', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title={chrome.i18n.getMessage('renameScript') || 'Rename'}
            onClick={(e: Event) => {
              e.stopPropagation();
              onRename();
            }}
          >
            <Pencil size={15} strokeWidth={1.5} />
          </button>
          <button
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: '#ff3b30', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title={chrome.i18n.getMessage('deleteScript') || 'Delete'}
            onClick={(e: Event) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 size={15} strokeWidth={1.5} />
          </button>
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
          <button
            onClick={(e: Event) => {
              e.stopPropagation();
              onRun();
            }}
            style={{ padding: '5px 10px', background: '#34c759', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title={chrome.i18n.getMessage('runScript') || 'Run Script'}
          >
            <Play size={14} strokeWidth={2} fill="white" />
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
}

function ScriptHistoryModal({ scriptId, scriptName, onClose }: ScriptHistoryModalProps) {
  const historyRecords = useSignal<ExecutionRecord[]>([]);
  const isLoading = useSignal(true);

  // Load history on mount
  const loadHistory = async () => {
    isLoading.value = true;
    const records = await getExecutionHistory(scriptId);
    historyRecords.value = records;
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
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {historyRecords.value.map(record => (
              <div
                key={record.id}
                style={{
                  padding: '10px 12px',
                  borderBottom: '1px solid #f0f0f0',
                  background: record.status === 'failed' ? '#fff5f5' : 'white'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', color: '#666' }}>
                    {formatDate(record.startedAt)}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                    {getStatusIcon(record.status)}
                    <span style={{ color: record.status === 'failed' ? '#d32f2f' : record.status === 'completed' ? '#2e7d32' : '#666' }}>
                      {getStatusLabel(record.status)}
                    </span>
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#999' }}>
                  <span>
                    {chrome.i18n.getMessage('executionStep', [String(record.currentStep || 0), String(record.totalSteps || 0)]) || `${record.currentStep || 0}/${record.totalSteps || 0} steps`}
                  </span>
                  <span>{formatDuration(record.startedAt, record.completedAt)}</span>
                </div>
                {record.error && (
                  <div style={{ marginTop: '6px', fontSize: '11px', color: '#d32f2f', background: '#ffebee', padding: '6px 8px', borderRadius: '4px' }}>
                    {record.error}
                  </div>
                )}
              </div>
            ))}
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
            {filteredScripts.value.map(script => (
              <ScriptItem
                key={script.id}
                script={script}
                isSelected={selectedScriptId.value === script.id}
                triggerCount={triggersState.value.filter(t => t.scriptId === script.id && t.enabled).length}
                onSelect={() => {
                  selectScript(script.id);
                  onScriptSelect?.(script);
                }}
                onRun={() => {
                  startExecution(script);
                }}
                onConfigureTriggers={() => {
                  showTriggerConfig.value = script.id;
                }}
                onViewHistory={() => {
                  showHistoryModal.value = { scriptId: script.id, scriptName: script.name };
                }}
                onDelete={() => handleDeleteScript(script)}
                onRename={() => handleRenameScript(script)}
              />
            ))}
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
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

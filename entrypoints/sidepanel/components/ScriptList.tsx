import { useSignal } from '@preact/signals';
import type { Script } from '../../../utils/types';
import { filteredScripts, searchTerm, isLoading, selectScript, selectedScriptId, updateScriptInState } from '../stores/scripts';
import { startExecution } from '../stores/execution';
import { navigateTo } from '../router';
import { TriggerConfig } from './TriggerConfig';
import { deleteScript, saveScript } from '../../../utils/storage/scripts';

interface ScriptListProps {
  onScriptSelect?: (script: Script) => void;
  onNewScript?: () => void;
}

interface ScriptItemProps {
  script: Script;
  isSelected: boolean;
  onSelect: () => void;
  onRun: () => void;
  onConfigureTriggers: () => void;
  onDelete: () => void;
  onRename: () => void;
}

function ScriptItem({ script, isSelected, onSelect, onRun, onConfigureTriggers, onDelete, onRename }: ScriptItemProps) {
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
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <button
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', padding: '4px 6px', color: '#666' }}
            title={chrome.i18n.getMessage('renameScript') || 'Rename'}
            onClick={(e: Event) => {
              e.stopPropagation();
              onRename();
            }}
          >
            &#9999;&#65039;
          </button>
          <button
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', padding: '4px 6px', color: '#d32f2f' }}
            title={chrome.i18n.getMessage('deleteScript') || 'Delete'}
            onClick={(e: Event) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            &#128465;&#65039;
          </button>
          <button
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', padding: '4px 8px', color: '#666' }}
            title={chrome.i18n.getMessage('configureTriggers') || 'Configure triggers'}
            onClick={(e: Event) => {
              e.stopPropagation();
              onConfigureTriggers();
            }}
          >
            {'\u26A1'}
          </button>
          <button
            onClick={(e: Event) => {
              e.stopPropagation();
              onRun();
            }}
            style={{ padding: '6px 12px', background: '#4caf50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
            title={chrome.i18n.getMessage('runScript') || 'Run Script'}
          >
            &#9654;
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

export function ScriptList({ onScriptSelect, onNewScript }: ScriptListProps = {}) {
  const showTriggerConfig = useSignal<string | null>(null);

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
          {onNewScript && (
            <button
              onClick={onNewScript}
              style={{ padding: '8px 12px', background: '#4285f4', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}
              title={chrome.i18n.getMessage('newScript') || 'New Script'}
            >
              +
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
                onSelect={() => {
                  selectScript(script.id);
                  onScriptSelect?.(script);
                }}
                onRun={() => {
                  startExecution(script);
                  navigateTo('execution');
                }}
                onConfigureTriggers={() => {
                  showTriggerConfig.value = script.id;
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
    </div>
  );
}

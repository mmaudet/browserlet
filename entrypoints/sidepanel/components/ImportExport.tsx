import { useRef } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import { saveAs } from 'file-saver';
import type { Script } from '../../../utils/types';
import { parseScript, dumpScript } from '../../../utils/yaml/parser';
import { saveScript } from '../../../utils/storage/scripts';
import { loadScripts } from '../stores/scripts';

interface ExportButtonProps {
  script: Script;
  className?: string;
}

export function ExportButton({ script, className }: ExportButtonProps) {
  const handleExport = () => {
    try {
      const yamlContent = dumpScript(script);
      const blob = new Blob([yamlContent], { type: 'text/yaml;charset=utf-8' });
      const filename = `${script.name.replace(/[^a-z0-9]/gi, '_')}.yaml`;
      saveAs(blob, filename);
    } catch (error) {
      console.error('Export failed:', error);
      alert(chrome.i18n.getMessage('exportFailed') || 'Failed to export script');
    }
  };

  return (
    <button
      class={className || 'btn btn-secondary'}
      onClick={handleExport}
      title={chrome.i18n.getMessage('exportScript') || 'Export as YAML'}
    >
      {chrome.i18n.getMessage('export') || 'Export'}
    </button>
  );
}

interface ImportButtonProps {
  onImport?: (script: Script) => void;
  className?: string;
}

export function ImportButton({ onImport, className }: ImportButtonProps) {
  const isImporting = useSignal(false);
  const error = useSignal<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: Event) => {
    const inputEl = e.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    if (!file) return;

    isImporting.value = true;
    error.value = null;

    try {
      const content = await readFileAsText(file);
      const result = parseScript(content);

      if (!result.success) {
        error.value = result.error;
        return;
      }

      // Save imported script
      const savedScript = await saveScript({
        ...result.data,
        name: result.data.name!,
        version: result.data.version || '1.0.0',
        content: content
      });

      // Reload scripts list
      await loadScripts();

      // Notify parent
      onImport?.(savedScript);

      // Reset input
      inputEl.value = '';
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      error.value = `Import failed: ${message}`;
    } finally {
      isImporting.value = false;
    }
  };

  // Default inline style for ScriptList integration
  const defaultStyle = {
    padding: '8px 12px',
    background: '#f5f5f5',
    border: '1px solid #ddd',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    color: '#333',
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  };

  return (
    <div style={{ display: 'inline-block', position: 'relative' }}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".yaml,.yml"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
      <button
        class={className}
        style={className ? undefined : defaultStyle}
        onClick={() => fileInputRef.current?.click()}
        disabled={isImporting.value}
        title={chrome.i18n.getMessage('importScript') || 'Import YAML file'}
      >
        <span>📥</span>
        {isImporting.value
          ? chrome.i18n.getMessage('importing') || '...'
          : null}
      </button>
      {error.value && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          color: '#f44336',
          fontSize: '12px',
          marginTop: '4px',
          maxWidth: '200px',
          background: 'white',
          padding: '4px 8px',
          borderRadius: '4px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          zIndex: 10
        }}>
          {error.value}
        </div>
      )}
    </div>
  );
}

// Helper to read file as text with UTF-8
function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file, 'UTF-8');
  });
}

import { useRef } from 'preact/hooks';
import { signal } from '@preact/signals';
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
  const isImporting = signal(false);
  const error = signal<string | null>(null);
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

  return (
    <div style={{ display: 'inline-block' }}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".yaml,.yml"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
      <button
        class={className || 'btn btn-secondary'}
        onClick={() => fileInputRef.current?.click()}
        disabled={isImporting.value}
        title={chrome.i18n.getMessage('importScript') || 'Import YAML file'}
      >
        {isImporting.value
          ? chrome.i18n.getMessage('importing') || 'Importing...'
          : chrome.i18n.getMessage('import') || 'Import'}
      </button>
      {error.value && (
        <div style={{
          color: '#f44336',
          fontSize: '12px',
          marginTop: '4px',
          maxWidth: '200px'
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

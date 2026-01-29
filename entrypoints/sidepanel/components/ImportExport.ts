import van from 'vanjs-core';
import { saveAs } from 'file-saver';
import type { Script } from '../../../utils/types';
import { parseScript, dumpScript } from '../../../utils/yaml/parser';
import { saveScript } from '../../../utils/storage/scripts';
import { loadScripts } from '../stores/scripts';

const { button, input, div } = van.tags;

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

  return button({
    class: className || 'btn btn-secondary',
    onclick: handleExport,
    title: chrome.i18n.getMessage('exportScript') || 'Export as YAML'
  }, chrome.i18n.getMessage('export') || 'Export');
}

interface ImportButtonProps {
  onImport?: (script: Script) => void;
  className?: string;
}

export function ImportButton({ onImport, className }: ImportButtonProps) {
  const isImporting = van.state(false);
  const error = van.state<string | null>(null);

  const handleFileSelect = async (e: Event) => {
    const inputEl = e.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    if (!file) return;

    isImporting.val = true;
    error.val = null;

    try {
      const content = await readFileAsText(file);
      const result = parseScript(content);

      if (!result.success) {
        error.val = result.error;
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
      error.val = `Import failed: ${message}`;
    } finally {
      isImporting.val = false;
    }
  };

  // Hidden file input + visible button
  const fileInput = input({
    type: 'file',
    accept: '.yaml,.yml',
    style: 'display: none;',
    onchange: handleFileSelect
  });

  return div({ style: 'display: inline-block;' },
    fileInput,
    button({
      class: className || 'btn btn-secondary',
      onclick: () => (fileInput as HTMLInputElement).click(),
      disabled: () => isImporting.val,
      title: chrome.i18n.getMessage('importScript') || 'Import YAML file'
    },
      () => isImporting.val
        ? chrome.i18n.getMessage('importing') || 'Importing...'
        : chrome.i18n.getMessage('import') || 'Import'
    ),
    () => error.val
      ? div({ style: 'color: #f44336; font-size: 12px; margin-top: 4px; max-width: 200px;' }, error.val)
      : null
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

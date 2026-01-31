import van from 'vanjs-core';
import { monaco, setupMonaco } from '../monaco-setup';
import type { Script } from '../../../utils/types';
import { saveScript } from '../../../utils/storage/scripts';

const { div, button, span } = van.tags;

// Debounce helper
function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let timeout: ReturnType<typeof setTimeout>;
  return ((...args: unknown[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), ms);
  }) as T;
}

// Extract name from YAML content
function extractNameFromYaml(content: string): string | null {
  const match = content.match(/^name:\s*["']?([^"'\n]+)["']?\s*$/m);
  return match?.[1]?.trim() || null;
}

interface ScriptEditorProps {
  script: Script;
  onSave?: (script: Script) => void;
  onClose?: () => void;
}

// Module-level editor reference (Monaco instance is not serializable, keep in closure)
let editorInstance: monaco.editor.IStandaloneCodeEditor | null = null;

export function getEditorContent(): string {
  return editorInstance?.getValue() || '';
}

export function setEditorContent(content: string): void {
  editorInstance?.setValue(content);
}

export function ScriptEditor({ script, onSave, onClose }: ScriptEditorProps) {
  setupMonaco();

  const isSaving = van.state(false);
  const lastSaved = van.state<number>(script.updatedAt);

  // Create container and mount editor after DOM insertion
  const container = div({
    class: 'script-editor-container',
    style: 'display: flex; flex-direction: column; height: 100%;'
  },
    // Header
    div({ class: 'editor-header', style: 'display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: #f5f5f5; border-bottom: 1px solid #ddd;' },
      span({ style: 'font-weight: 500;' }, script.name),
      div({ style: 'display: flex; gap: 8px; align-items: center;' },
        () => isSaving.val
          ? span({ style: 'font-size: 12px; color: #666;' }, chrome.i18n.getMessage('saving') || 'Saving...')
          : span({ style: 'font-size: 12px; color: #999;' },
              chrome.i18n.getMessage('lastSaved') || 'Saved'
            ),
        onClose && button({
          class: 'btn btn-secondary',
          style: 'padding: 4px 12px; font-size: 12px;',
          onclick: onClose
        }, chrome.i18n.getMessage('close') || 'Close')
      )
    ),
    // Editor container
    div({
      id: 'monaco-editor-container',
      style: 'flex: 1; min-height: 300px;'
    })
  );

  // Mount editor after container is in DOM
  requestAnimationFrame(() => {
    const editorContainer = document.getElementById('monaco-editor-container');
    if (!editorContainer) return;

    // Dispose previous instance if exists
    editorInstance?.dispose();

    editorInstance = monaco.editor.create(editorContainer, {
      value: script.content,
      language: 'yaml',
      theme: 'vs-light',
      minimap: { enabled: false },
      automaticLayout: true,
      fontSize: 13,
      lineNumbers: 'on',
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      tabSize: 2,
      insertSpaces: true
    });

    // Auto-save on change (debounced)
    const autoSave = debounce(async () => {
      isSaving.val = true;
      try {
        const content = editorInstance?.getValue() || '';
        // Extract name from YAML content to sync with script.name
        const nameFromYaml = extractNameFromYaml(content);
        const updated = await saveScript({
          ...script,
          content,
          // Update name if it changed in YAML
          name: nameFromYaml || script.name,
          id: script.id
        });
        lastSaved.val = updated.updatedAt;
        onSave?.(updated);
      } catch (error) {
        console.error('Failed to save script:', error);
      } finally {
        isSaving.val = false;
      }
    }, 1000);

    editorInstance.onDidChangeModelContent(() => {
      autoSave();
    });
  });

  return container;
}

// Cleanup function to dispose editor
export function disposeEditor(): void {
  editorInstance?.dispose();
  editorInstance = null;
}

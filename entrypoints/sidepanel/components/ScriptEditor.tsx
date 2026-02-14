import { useRef, useEffect } from 'preact/hooks';
import { monaco, setupMonaco } from '../monaco-setup';
import type { Script } from '../../../utils/types';
import { saveScript } from '../../../utils/storage/scripts';

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

// Module-level editor reference for external access
let moduleEditorInstance: monaco.editor.IStandaloneCodeEditor | null = null;

export function getEditorContent(): string {
  return moduleEditorInstance?.getValue() || '';
}

export function setEditorContent(content: string): void {
  moduleEditorInstance?.setValue(content);
}

export function ScriptEditor({ script, onSave, onClose }: ScriptEditorProps) {
  setupMonaco();

  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  // Initialize Monaco editor
  useEffect(() => {
    if (!containerRef.current) return;

    // Dispose previous instance if exists
    editorRef.current?.dispose();

    // Create new editor instance
    editorRef.current = monaco.editor.create(containerRef.current, {
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

    // Update module-level reference
    moduleEditorInstance = editorRef.current;

    // Auto-save on change (debounced)
    const autoSave = debounce(async () => {
      try {
        const content = editorRef.current?.getValue() || '';
        // Extract name from YAML content to sync with script.name
        const nameFromYaml = extractNameFromYaml(content);
        const updated = await saveScript({
          ...script,
          content,
          // Update name if it changed in YAML
          name: nameFromYaml || script.name,
          id: script.id
        });
        onSave?.(updated);
      } catch (error) {
        console.error('Failed to save script:', error);
      }
    }, 1000);

    const disposeContentListener = editorRef.current.onDidChangeModelContent(() => {
      autoSave();
    });

    // CRITICAL: Cleanup on unmount - dispose Monaco editor to prevent memory leaks
    return () => {
      disposeContentListener.dispose();
      editorRef.current?.dispose();
      editorRef.current = null;
      // Clear module-level reference if it's the same instance
      if (moduleEditorInstance === editorRef.current) {
        moduleEditorInstance = null;
      }
    };
  }, [script.id]); // Recreate editor only when script changes

  return (
    <div
      class="script-editor-container"
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      {/* Header */}
      <div
        class="editor-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          background: '#f5f5f5',
          borderBottom: '1px solid #ddd'
        }}
      >
        <span style={{ fontWeight: 500, color: '#333' }}>{script.name}</span>
        {onClose && (
          <button
            class="btn btn-secondary"
            style={{ padding: '4px 12px', fontSize: '12px' }}
            onClick={onClose}
          >
            {chrome.i18n.getMessage('close') || 'Close'}
          </button>
        )}
      </div>
      {/* Editor container */}
      <div
        ref={containerRef}
        id="monaco-editor-container"
        style={{ flex: 1, minHeight: '300px' }}
      />
    </div>
  );
}

// Cleanup function to dispose editor (for external use)
export function disposeEditor(): void {
  moduleEditorInstance?.dispose();
  moduleEditorInstance = null;
}
